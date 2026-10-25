import { createHash, randomBytes } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import { DRAFT_STEPS, currentStep, validateAction, type DraftAction, type DraftRole, type DraftSide } from '@pasen/shared'
import { DateTime } from 'luxon'

import Draft from '#models/draft'
import DraftActionRow from '#models/draft_action'
import FearlessNight from '#models/fearless_night'
import Group from '#models/group'
import StaticChampion from '#models/static_champion'
import { FearlessService } from '#fearless/fearless_service'

export class DraftError extends Error {
  constructor(
    readonly status: 401 | 403 | 404 | 409 | 422,
    message: string
  ) {
    super(message)
  }
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex')

export type DraftView = {
  id: number
  nightId: number | null
  serverTime: string
  createdAt: string
  stepStartedAt: string
  finishedAt: string | null
  seats: Record<DraftSide, boolean>
  hover: number | null
  current: { step: number; side: DraftSide; kind: 'ban' | 'pick' } | null
  actions: DraftAction[]
  /** Champions burned in the fearless night this draft belongs to, while it runs. */
  burned: number[]
}

/**
 * Running a draft: seats, turns, bans and picks. The rules themselves live in
 * @pasen/shared so the page shows exactly what this enforces.
 */
export class DraftService {
  async current(group: Group): Promise<Draft | null> {
    return Draft.query().where('group_id', group.id).orderBy('id', 'desc').first()
  }

  async create(group: Group): Promise<Draft> {
    const open = await Draft.query().where('group_id', group.id).whereNull('finished_at').first()
    if (open) throw new DraftError(409, 'A draft is already running. Finish it, or ask the admin to cancel it.')

    const fearless = new FearlessService()
    const night = await fearless.latest(group)
    const active = night ? (await fearless.board(night)).night.active : false
    return Draft.create({
      groupId: group.id,
      fearlessNightId: active ? night!.id : null,
      stepStartedAt: DateTime.now(),
    })
  }

  async takeSeat(draft: Draft, side: DraftSide): Promise<string> {
    const column = side === 'blue' ? 'blue_seat' : 'red_seat'
    const token = randomBytes(24).toString('base64url')
    // Conditional update: two people clicking the same seat at once, one gets it.
    const updated = await db.from('drafts').where('id', draft.id).whereNull(column).update({ [column]: hash(token) })
    if (Number(Array.isArray(updated) ? updated[0] : updated) === 0) {
      throw new DraftError(409, 'Someone already has that seat.')
    }
    return token
  }

  async leaveSeat(draft: Draft, side: DraftSide, token: string | undefined) {
    if (this.#sideOf(draft, token) !== side) throw new DraftError(403, 'That seat is not yours.')
    await this.freeSeat(draft, side)
  }

  async freeSeat(draft: Draft, side: DraftSide) {
    if (side === 'blue') draft.blueSeat = null
    else draft.redSeat = null
    await draft.save()
  }

  async hover(draft: Draft, token: string | undefined, championId: number | null) {
    await draft.load('actions')
    // Only the captain on the clock shows what they are looking at.
    this.#playing(draft, token)
    draft.hoverChampionId = championId
    await draft.save()
  }

  async act(draft: Draft, token: string | undefined, championId: number, role: DraftRole | null) {
    await draft.load('actions')
    const side = this.#playing(draft, token)
    const champion = await StaticChampion.find(championId)
    if (!champion) throw new DraftError(422, 'No champion with that id.')

    const verdict = validateAction({
      actions: this.#actions(draft),
      burned: new Set(await this.#burned(draft)),
      side,
      championId,
      positions: champion.positions ?? [],
      role,
    })
    if (!verdict.ok) {
      throw new DraftError(verdict.reason === 'not-your-turn' ? 403 : verdict.reason === 'finished' ? 409 : 422, verdict.reason)
    }

    await db.transaction(async (trx) => {
      await DraftActionRow.create(
        { draftId: draft.id, step: verdict.step, side, kind: verdict.kind, championId, role: verdict.role },
        { client: trx }
      )
      draft.useTransaction(trx)
      draft.hoverChampionId = null
      draft.stepStartedAt = DateTime.now()
      if (verdict.step === DRAFT_STEPS.length - 1) draft.finishedAt = DateTime.now()
      await draft.save()
    })
  }

  async view(draft: Draft): Promise<DraftView> {
    await draft.load('actions', (actions) => actions.orderBy('step'))
    const actions = this.#actions(draft)
    const index = currentStep(actions)
    return {
      id: draft.id,
      nightId: draft.fearlessNightId,
      serverTime: DateTime.now().toUTC().toISO()!,
      createdAt: draft.createdAt.toUTC().toISO()!,
      stepStartedAt: draft.stepStartedAt.toUTC().toISO()!,
      finishedAt: draft.finishedAt?.toUTC().toISO() ?? null,
      seats: { blue: draft.blueSeat !== null, red: draft.redSeat !== null },
      hover: draft.hoverChampionId,
      current: index === null ? null : { step: index, ...DRAFT_STEPS[index] },
      actions,
      burned: await this.#burned(draft),
    }
  }

  async history(group: Group, nightId: number): Promise<DraftView[]> {
    const drafts = await Draft.query().where('group_id', group.id).where('fearless_night_id', nightId).orderBy('id')
    return Promise.all(drafts.map((draft) => this.view(draft)))
  }

  #actions(draft: Draft): DraftAction[] {
    return [...draft.actions]
      .sort((a, b) => a.step - b.step)
      .map((a) => ({ step: a.step, side: a.side, kind: a.kind, championId: a.championId, role: a.role }))
  }

  #sideOf(draft: Draft, token: string | undefined): DraftSide | null {
    if (!token) return null
    const digest = hash(token)
    if (draft.blueSeat === digest) return 'blue'
    if (draft.redSeat === digest) return 'red'
    return null
  }

  /** The side holding this token, if it is that side's turn. */
  #playing(draft: Draft, token: string | undefined): DraftSide {
    const side = this.#sideOf(draft, token)
    if (!side) throw new DraftError(401, 'Take a seat first.')
    const index = currentStep(this.#actions(draft))
    if (index === null) throw new DraftError(409, 'This draft is over.')
    if (DRAFT_STEPS[index].side !== side) throw new DraftError(403, 'Not your turn.')
    return side
  }

  /** Burned champions of the draft's fearless night, while that night runs. */
  async #burned(draft: Draft): Promise<number[]> {
    if (!draft.fearlessNightId) return []
    const night = await FearlessNight.find(draft.fearlessNightId)
    if (!night) return []
    const board = await new FearlessService().board(night)
    return board.night.active ? board.burned.map((burn) => burn.championId) : []
  }
}

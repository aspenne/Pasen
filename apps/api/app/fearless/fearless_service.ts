import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import Draft from '#models/draft'
import FearlessNight from '#models/fearless_night'
import Group from '#models/group'
import { CustomGameReader } from '#customs/custom_game_reader'
import { NIGHT_HOURS, fearlessBoard, nightEndsAt, type FearlessBoard } from '#fearless/fearless_board'

/**
 * A game is dated by its start, and a night by when its games end. Reading
 * from a little before the night catches a game started before the admin
 * pressed Start; the board then keeps only the ones that ended inside it.
 */
const LONGEST_GAME = { hours: 3 }

/**
 * How far back a night can be started. An hour short of a whole night, so a
 * night started late still has an hour to run.
 */
const LATEST_BACKDATE = { hours: NIGHT_HOURS - 1 }

export class InvalidNightStartError extends Error {}

/** How many nights a series can chain; past that, the oldest stop counting. */
const MAX_SERIES = 20

export class FearlessService {
  /** The group's most recent night, finished or not. */
  async latest(group: Group): Promise<FearlessNight | null> {
    return FearlessNight.query().where('group_id', group.id).orderBy('started_at', 'desc').first()
  }

  /**
   * Opens a night, ending whichever one was still open.
   *
   * `since` starts it earlier, for when the group played a game or two before
   * anyone pressed Start: those games then burn their champions like the rest.
   * A draft already running without a night joins this one, so its captains
   * see the burned champions without starting over.
   */
  async start(group: Group, label: string | null, since?: DateTime, continues?: FearlessNight): Promise<FearlessNight> {
    const now = DateTime.now()
    const startedAt = since ?? now
    if (startedAt > now) throw new InvalidNightStartError('A night cannot start in the future.')
    if (startedAt < now.minus(LATEST_BACKDATE)) {
      throw new InvalidNightStartError(`A night can start at most ${LATEST_BACKDATE.hours} hours ago.`)
    }

    return db.transaction(async (trx) => {
      await FearlessNight.query({ client: trx })
        .where('group_id', group.id)
        .whereNull('ended_at')
        .update({ ended_at: now.toUTC().toISO() })

      const night = await FearlessNight.create(
        {
          groupId: group.id,
          label: label || null,
          startedAt,
          endedAt: null,
          excludedCustomIds: [],
          continuesNightId: continues?.id ?? null,
        },
        { client: trx }
      )

      await Draft.query({ client: trx })
        .where('group_id', group.id)
        .whereNull('finished_at')
        .whereNull('fearless_night_id')
        .update({ fearless_night_id: night.id })

      return night
    })
  }

  /**
   * The night's board. One that continues an earlier night starts with that
   * night's burned champions - which may carry over from further back again,
   * up to a series of `MAX_SERIES` nights.
   */
  async board(night: FearlessNight, now: Date = new Date(), depth = 0): Promise<FearlessBoard> {
    await night.load('group')
    await night.load('adjustments')

    let continues = null
    if (night.continuesNightId && depth < MAX_SERIES) {
      const earlier = await FearlessNight.find(night.continuesNightId)
      if (earlier) {
        const earlierBoard = await this.board(earlier, now, depth + 1)
        continues = {
          id: earlier.id,
          label: earlier.label,
          startedAt: earlier.startedAt.toJSDate(),
          burned: earlierBoard.burned.map((burn) => ({ championId: burn.championId })),
        }
      }
    }

    const startedAt = night.startedAt.toJSDate()
    const endsAt = nightEndsAt({ startedAt, endedAt: night.endedAt?.toJSDate() ?? null })

    const games = await new CustomGameReader().between(
      night.group,
      night.startedAt.minus(LONGEST_GAME),
      DateTime.fromJSDate(endsAt)
    )

    return fearlessBoard(
      {
        id: night.id,
        label: night.label,
        startedAt,
        endedAt: night.endedAt?.toJSDate() ?? null,
        excludedCustomIds: night.excludedCustomIds,
      },
      games,
      night.adjustments.map((adjustment) => ({
        championId: adjustment.championId,
        kind: adjustment.kind,
        decidedAt: adjustment.decidedAt.toJSDate(),
      })),
      now,
      continues
    )
  }
}

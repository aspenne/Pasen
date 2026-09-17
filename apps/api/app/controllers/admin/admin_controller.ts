import type { HttpContext } from '@adonisjs/core/http'
import string from '@adonisjs/core/helpers/string'
import logger from '@adonisjs/core/services/logger'
import vine from '@vinejs/vine'
import { PLATFORMS } from '@pasen/shared'
import { DateTime } from 'luxon'

import Group from '#models/group'
import Member from '#models/member'
import RiotAccount from '#models/riot_account'
import { AccountLinker } from '#ingestion/account_linker'
import { riot, riotGateway, riotKeyProvider } from '#riot/service'

const newGroup = vine.compile(
  vine.object({ name: vine.string().trim().minLength(2).maxLength(60) })
)

const newAccount = vine.compile(
  vine.object({
    // "Name#TAG". Split here rather than asking the UI for two fields, because
    // that is how players copy their own id.
    riotId: vine.string().trim().regex(/^.{3,16}#.{2,5}$/),
    platform: vine.enum(PLATFORMS),
    memberName: vine.string().trim().minLength(1).maxLength(40).optional(),
    memberSlug: vine.string().trim().optional(),
    backfillSince: vine.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
)

const memberPatch = vine.compile(
  vine.object({
    displayName: vine.string().trim().minLength(1).maxLength(40).optional(),
    accentColor: vine.string().trim().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  })
)

const apiKey = vine.compile(vine.object({ key: vine.string().trim().minLength(10) }))

export default class AdminController {
  /** Everything the admin screen needs in one call. */
  async status() {
    const accounts = await RiotAccount.query().preload('member').orderBy('id')
    const keyStatus = await riotKeyProvider().status()
    const limiter = await riotGateway().limiter()

    return {
      riotKey: keyStatus,
      // Live view of what is left of the Riot budget this window.
      budget: (await limiter.snapshot()).map((entry: { window: { seconds: number; limit: number }; used: number }) => ({
        windowSeconds: entry.window.seconds,
        limit: entry.window.limit,
        used: entry.used,
      })),
      accounts: accounts.map((account) => ({
        id: account.id,
        riotId: account.riotId,
        platform: account.platform,
        memberSlug: account.member.slug,
        displayName: account.member.displayName,
        summonerLevel: account.summonerLevel,
        backfillState: account.backfillState,
        backfillError: account.backfillError,
        syncedFrom: account.syncedFrom?.toUTC().toISO() ?? null,
        syncedTo: account.syncedTo?.toUTC().toISO() ?? null,
        lastSyncedAt: account.lastSyncedAt?.toUTC().toISO() ?? null,
      })),
    }
  }

  async setRiotKey({ request, response }: HttpContext) {
    const { key } = await apiKey.validate(request.all())
    await riotKeyProvider().set(key)

    // The key is never echoed back, not even to the admin who just typed it.
    return response.ok(await riotKeyProvider().status())
  }

  async createGroup({ request, response }: HttpContext) {
    const { name } = await newGroup.validate(request.all())

    const group = await Group.updateOrCreate(
      { slug: string.slug(name).toLowerCase() },
      { name }
    )

    return response.created({ slug: group.slug, name: group.name })
  }

  async addAccount({ params, request, response }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)
    const payload = await newAccount.validate(request.all())

    const [gameName, tagLine] = payload.riotId.split('#')

    // An existing member chosen from the list wins over a typed name, so
    // attaching a smurf cannot silently create a second person.
    const member = payload.memberSlug
      ? await Member.findByOrFail('slug', payload.memberSlug)
      : null

    const account = await new AccountLinker(riot(), logger).link({
      gameName,
      tagLine,
      platform: payload.platform,
      memberId: member?.id,
      memberName: payload.memberName,
      backfillTarget: payload.backfillSince
        ? DateTime.fromISO(payload.backfillSince, { zone: 'utc' })
        : undefined,
    })

    const owner = await account.related('member').query().firstOrFail()
    await group.related('members').sync([owner.id], false)

    return response.created({
      id: account.id,
      riotId: account.riotId,
      memberSlug: owner.slug,
      displayName: owner.displayName,
    })
  }

  /**
   * Removes the account, and the member with it when that was their last one.
   * Stored matches are deliberately left alone: they belong to other members
   * too, and deleting them would tear holes in everybody else's history.
   */
  async removeAccount({ params, response }: HttpContext) {
    const account = await RiotAccount.findOrFail(params.id)
    const memberId = account.memberId
    await account.delete()

    const remaining = await RiotAccount.query().where('member_id', memberId).count('* as total')
    if (Number(remaining[0].$extras.total) === 0) {
      await Member.query().where('id', memberId).delete()
    }

    return response.noContent()
  }

  async updateMember({ params, request, response }: HttpContext) {
    const member = await Member.findByOrFail('slug', params.slug)
    const payload = await memberPatch.validate(request.all())

    member.merge({
      displayName: payload.displayName ?? member.displayName,
      accentColor: payload.accentColor === undefined ? member.accentColor : payload.accentColor,
    })
    await member.save()

    return response.ok({
      slug: member.slug,
      displayName: member.displayName,
      accentColor: member.accentColor,
    })
  }

  /** Puts an account back at the front of the backfill queue. */
  async resync({ params, response }: HttpContext) {
    const account = await RiotAccount.findOrFail(params.id)

    account.merge({
      backfillState: 'pending',
      backfillError: null,
      // Cleared so the walk restarts from the newest match rather than from
      // wherever it gave up.
      syncedFrom: null,
      lastSyncedAt: null,
    })
    await account.save()

    return response.ok({ id: account.id, backfillState: account.backfillState })
  }
}

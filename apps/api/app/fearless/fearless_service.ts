import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import FearlessNight from '#models/fearless_night'
import Group from '#models/group'
import { CustomGameReader } from '#customs/custom_game_reader'
import { fearlessBoard, nightEndsAt, type FearlessBoard } from '#fearless/fearless_board'

/**
 * A game is dated by its start, and a night by when its games end. Reading
 * from a little before the night catches a game started before the admin
 * pressed Start; the board then keeps only the ones that ended inside it.
 */
const LONGEST_GAME = { hours: 3 }

export class FearlessService {
  /** The group's most recent night, finished or not. */
  async latest(group: Group): Promise<FearlessNight | null> {
    return FearlessNight.query().where('group_id', group.id).orderBy('started_at', 'desc').first()
  }

  /** Opens a night, ending whichever one was still open. */
  async start(group: Group, label: string | null): Promise<FearlessNight> {
    return db.transaction(async (trx) => {
      const now = DateTime.now()
      await FearlessNight.query({ client: trx })
        .where('group_id', group.id)
        .whereNull('ended_at')
        .update({ ended_at: now.toUTC().toISO() })

      return FearlessNight.create(
        { groupId: group.id, label: label || null, startedAt: now, endedAt: null, excludedCustomIds: [] },
        { client: trx }
      )
    })
  }

  async board(night: FearlessNight, now: Date = new Date()): Promise<FearlessBoard> {
    await night.load('group')
    await night.load('adjustments')

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
      now
    )
  }
}

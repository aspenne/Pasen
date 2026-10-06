import { createHash } from 'node:crypto'
import { DateTime } from 'luxon'

import CustomGame from '#models/custom_game'
import Group from '#models/group'

/**
 * Turns an agent capture into a stored custom game.
 *
 * Only four paths into the payload are read here, and they are the four the
 * agent itself reads to decide when to save - so they are proven by the fact
 * that a capture exists at all. Everything else stays in `raw` until there is a
 * real file to design against; guessing at field names would mean a migration
 * the first time one of them turned out to be spelled differently.
 */
export type Capture = {
  gameData?: { gameMode?: unknown; gameTime?: unknown; mapName?: unknown }
  allPlayers?: unknown
  events?: { Events?: unknown }
}

export class InvalidCaptureError extends Error {}

export type StoreResult = { game: CustomGame; duplicate: boolean }

export class CustomCaptureService {
  async store(
    group: Group,
    capture: unknown,
    meta: { fileName?: string; capturedAt?: string; label?: string } = {}
  ): Promise<StoreResult> {
    const payload = this.#validate(capture)
    const fingerprint = fingerprintOf(capture)

    const existing = await CustomGame.findBy('fingerprint', fingerprint)
    if (existing) return { game: existing, duplicate: true }

    const capturedAt = capturedAtFrom(meta.fileName, meta.capturedAt)

    const game = await CustomGame.create({
      groupId: group.id,
      fingerprint,
      /*
       * The payload has no wall clock - `gameTime` is a game clock in seconds -
       * so the start is reconstructed by winding back from when the capture was
       * written. Within a few seconds, which is all anyone needs to tell two
       * customs apart.
       */
      playedAt: capturedAt.minus({ seconds: payload.duration }),
      duration: payload.duration,
      gameMode: payload.gameMode,
      mapName: payload.mapName,
      playerCount: payload.playerCount,
      label: meta.label?.trim() || null,
      raw: capture as Record<string, unknown>,
    })

    return { game, duplicate: false }
  }

  /** Rejects anything that is not a Live Client capture, before it reaches the table. */
  #validate(capture: unknown) {
    if (!capture || typeof capture !== 'object') {
      throw new InvalidCaptureError('That file is not JSON an agent capture would produce.')
    }

    const { gameData, allPlayers } = capture as Capture

    if (!Array.isArray(allPlayers) || allPlayers.length === 0) {
      throw new InvalidCaptureError('No players in that capture — it holds no game.')
    }

    const mode = gameData?.gameMode
    const time = gameData?.gameTime

    if (typeof mode !== 'string' || typeof time !== 'number') {
      throw new InvalidCaptureError(
        'That capture has no gameData.gameMode or gameData.gameTime, so it did not come from the agent.'
      )
    }

    return {
      gameMode: mode,
      duration: Math.max(0, Math.round(time)),
      mapName: typeof gameData?.mapName === 'string' ? gameData.mapName : null,
      playerCount: allPlayers.length,
    }
  }
}

/**
 * The capture carries no game id, so the bytes are the identity. Stable because
 * the keys are sorted before hashing: the same capture read twice must not land
 * twice because a JSON serialiser reordered an object.
 */
export function fingerprintOf(capture: unknown): string {
  return createHash('sha256').update(stableStringify(capture)).digest('hex')
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0
  )
  return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}:${stableStringify(inner)}`).join(',')}}`
}

/**
 * When the capture was written, best effort, most trustworthy first.
 *
 * The agent stamps its own filename, and that survives a copy between machines
 * where a file's modified time sometimes does not - so the name wins, and the
 * browser's `lastModified` is the fallback behind it.
 */
export function capturedAtFrom(fileName?: string, capturedAt?: string): DateTime {
  const stamped = fileName?.match(/custom-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/)
  if (stamped) {
    const parsed = DateTime.fromISO(`${stamped[1]}T${stamped[2]}:${stamped[3]}:${stamped[4]}`, {
      zone: 'utc',
    })
    if (parsed.isValid) return parsed
  }

  if (capturedAt) {
    const parsed = DateTime.fromISO(capturedAt, { zone: 'utc' })
    if (parsed.isValid) return parsed
  }

  return DateTime.utc()
}

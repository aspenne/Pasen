import CustomGame from '#models/custom_game'
import Group from '#models/group'
import RiotAccount from '#models/riot_account'
import StaticChampion from '#models/static_champion'
import StaticSummonerSpell from '#models/static_summoner_spell'
import { viewCustomGame, type CustomGameView, type ViewLookups } from '#customs/custom_game_view'

/**
 * Reads stored customs back out for the site, resolving what the capture
 * leaves unresolved - champion ids, spell ids, and which human is which member
 * - against our own tables rather than against Riot.
 */
export class CustomGameReader {
  async list(group: Group): Promise<CustomGameView[]> {
    const games = await CustomGame.query()
      .where('group_id', group.id)
      .orderBy('played_at', 'desc')
      .limit(50)
    if (games.length === 0) return []

    const lookups = await this.#lookups(group)
    return games.map((game) => viewCustomGame(stored(game), lookups))
  }

  async find(group: Group, id: number): Promise<CustomGameView | null> {
    const game = await CustomGame.query().where('group_id', group.id).where('id', id).first()
    if (!game) return null
    return viewCustomGame(stored(game), await this.#lookups(group))
  }

  async #lookups(group: Group): Promise<ViewLookups> {
    const [champions, spells, accounts] = await Promise.all([
      StaticChampion.query().select('id', 'slug'),
      StaticSummonerSpell.query().select('id', 'slug'),
      RiotAccount.query()
        .preload('member')
        .whereHas('member', (member) =>
          member.whereHas('groups', (groups) => groups.where('groups.id', group.id))
        ),
    ])

    return {
      championIdBySlug: new Map(champions.map((champion) => [champion.slug, champion.id])),
      spellIdBySlug: new Map(spells.map((spell) => [spell.slug, spell.id])),
      memberByRiotId: new Map(
        accounts.map((account) => [
          `${account.gameName}#${account.tagLine}`.toLowerCase(),
          { slug: account.member.slug, displayName: account.member.displayName },
        ])
      ),
    }
  }
}

function stored(game: CustomGame) {
  return {
    id: game.id,
    label: game.label,
    winnerOverride: game.winnerOverride,
    playedAt: game.playedAt.toUTC().toISO()!,
    duration: game.duration,
    gameMode: game.gameMode,
    mapName: game.mapName,
    raw: game.raw,
  }
}

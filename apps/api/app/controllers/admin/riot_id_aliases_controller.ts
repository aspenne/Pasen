import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'

import RiotAccount from '#models/riot_account'
import RiotAccountAlias from '#models/riot_account_alias'

const aliasInput = vine.compile(
  vine.object({
    riotId: vine.string().trim().regex(/^[^#]{3,16}#[^#]{2,5}$/),
  })
)

/**
 * Old Riot IDs typed in by hand: a rename from before Pasen followed them, or
 * one the daily check could not see. Customs played under that name then
 * count for the member.
 */
export default class RiotIdAliasesController {
  async store({ params, request, response }: HttpContext) {
    const account = await RiotAccount.findOrFail(params.id)
    const { riotId } = await aliasInput.validate(request.all())
    const [gameName, tagLine] = riotId.split('#').map((part) => part.trim())

    if (`${gameName}#${tagLine}`.toLowerCase() === `${account.gameName}#${account.tagLine}`.toLowerCase()) {
      return response.conflict({ message: 'That is the account’s current Riot ID.' })
    }
    const known = await RiotAccountAlias.query()
      .where('riot_account_id', account.id)
      .whereRaw('lower(game_name) = ? and lower(tag_line) = ?', [gameName.toLowerCase(), tagLine.toLowerCase()])
      .first()
    if (known) return response.conflict({ message: 'That Riot ID is already listed.' })

    const alias = await RiotAccountAlias.create({ riotAccountId: account.id, gameName, tagLine, source: 'manual' })
    return response.created({ id: alias.id, riotId: alias.riotId, source: alias.source })
  }

  async destroy({ params, response }: HttpContext) {
    const alias = await RiotAccountAlias.findOrFail(params.id)
    await alias.delete()
    return response.noContent()
  }
}

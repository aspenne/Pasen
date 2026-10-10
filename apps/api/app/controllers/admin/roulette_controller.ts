import type { HttpContext } from '@adonisjs/core/http'

import Group from '#models/group'
import { InvalidTeamsError, normaliseTeams } from '#roulette/lobby_teams'
import { NoLobbyError, RouletteService } from '#roulette/roulette_service'

/** Dealing the roles, and setting the teams by hand when no app read the lobby. */
export default class AdminRouletteController {
  async draw({ params, response }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)
    try {
      const draw = await new RouletteService().draw(group)
      return response.created({ id: draw.id, revealAt: draw.revealAt.toUTC().toISO(), roles: draw.roles })
    } catch (error) {
      if (error instanceof NoLobbyError) return response.conflict({ message: error.message })
      throw error
    }
  }

  async lobby({ params, request, response }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)
    try {
      const teams = normaliseTeams(request.input('teams'))
      const { lobby } = await new RouletteService().ingest(group, teams, 'manual')
      return response.ok({ id: lobby.id, teams: lobby.teams })
    } catch (error) {
      if (error instanceof InvalidTeamsError) return response.unprocessableEntity({ message: error.message })
      throw error
    }
  }
}

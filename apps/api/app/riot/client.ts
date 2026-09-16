import type { RiotRequester } from '#riot/gateway'
import { AccountEndpoint } from '#riot/endpoints/account'
import { LeagueEndpoint } from '#riot/endpoints/league'
import { MatchEndpoint } from '#riot/endpoints/match'
import { SpectatorEndpoint } from '#riot/endpoints/spectator'
import { SummonerEndpoint } from '#riot/endpoints/summoner'

/**
 * The surface the rest of the application sees. Services depend on this rather
 * than on the gateway, so they cannot invent a request that skips the typed
 * endpoints, and so they can be handed a fake in tests.
 */
export class RiotClient {
  readonly account: AccountEndpoint
  readonly summoner: SummonerEndpoint
  readonly league: LeagueEndpoint
  readonly match: MatchEndpoint
  readonly spectator: SpectatorEndpoint

  constructor(readonly gateway: RiotRequester) {
    this.account = new AccountEndpoint(gateway)
    this.summoner = new SummonerEndpoint(gateway)
    this.league = new LeagueEndpoint(gateway)
    this.match = new MatchEndpoint(gateway)
    this.spectator = new SpectatorEndpoint(gateway)
  }
}

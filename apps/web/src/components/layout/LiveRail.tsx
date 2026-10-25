import { LiveGameCard } from '@/components/LiveGameCard'
import type { LiveGame, StaticData } from '@/lib/api'

/** Games in progress, wherever someone is on the site. Nothing at all when nobody plays. */
export function LiveRail({ games, staticData }: { games: LiveGame[]; staticData?: StaticData }) {
  if (games.length === 0) return null
  return (
    <section aria-labelledby="live-rail">
      <h2 id="live-rail" className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-loss">
        <span aria-hidden className="live-dot inline-block size-[7px] rounded-full bg-loss" />
        In game now · {games.length}
      </h2>
      <div className="space-y-2">
        {games.map((game) => (
          <LiveGameCard
            key={game.gameId}
            game={game}
            staticData={staticData}
            queueLabel={staticData?.queues?.[String(game.queueId)]?.description ?? game.gameMode}
            compact
          />
        ))}
      </div>
    </section>
  )
}

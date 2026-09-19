import { useEffect, useState } from 'react'

import { ChampionIcon } from '@/components/ChampionIcon'
import type { LiveGame, StaticData } from '@/lib/api'
import { duration } from '@/lib/format'

/**
 * Riot reports the elapsed time only at poll time, so the card counts forward
 * from it. Anything else would show a clock frozen for up to a minute.
 */
function useElapsed(startedAt: string, reportedSeconds: number) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const drift = Math.floor((now - new Date(startedAt).getTime()) / 1000)
  return Math.max(reportedSeconds, drift, 0)
}

export function LiveGameCard({
  game,
  staticData,
  queueLabel,
}: {
  game: LiveGame
  staticData?: StaticData
  queueLabel: string
}) {
  const elapsed = useElapsed(game.startedAt, game.lengthSeconds)
  const ours = game.participants.filter((p) => p.tracked)
  const teams = [100, 200].map((teamId) => game.participants.filter((p) => p.teamId === teamId))

  return (
    /*
     * A translucent accent border rather than a solid one. A game in progress
     * should catch the eye without shouting louder than the results of the
     * games that are already decided.
     */
    <article className="rounded-[8px] border border-accent/25 bg-panel-raised px-[18px] py-4">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[15px] text-ink">
            {ours.map((p) => p.displayName ?? p.riotId).join(', ')}
          </div>
          <div className="mt-0.5 text-[13px] text-ink-dim">{queueLabel}</div>
        </div>
        <div className="tnum shrink-0 text-[19px] text-accent">{duration(elapsed)}</div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {teams.map((team, index) => (
          <div key={index} className="space-y-1.5">
            {team.map((participant) => (
              <div key={participant.puuid} className="flex items-center gap-2">
                <ChampionIcon
                  championId={participant.championId}
                  championName={String(participant.championId)}
                  staticData={staticData}
                  size={24}
                />
                <span
                  className={`truncate text-[13px] ${
                    participant.tracked ? 'text-accent' : 'text-ink-muted'
                  }`}
                >
                  {participant.displayName ?? participant.riotId ?? 'Unknown'}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </article>
  )
}

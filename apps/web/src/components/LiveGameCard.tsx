import { ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'

import { ChampionIcon } from '@/components/ChampionIcon'
import type { LiveGame, LiveParticipant, StaticData } from '@/lib/api'
import { spellIcon } from '@/lib/ddragon'
import { duration, rankShort, tierColor, tierCrest } from '@/lib/format'

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

function SpellPair({
  participant,
  staticData,
}: {
  participant: LiveParticipant
  staticData?: StaticData
}) {
  const spells = [participant.spell1Id, participant.spell2Id]

  return (
    <div className="hidden shrink-0 flex-col gap-[2px] sm:flex">
      {spells.map((id, index) => {
        const spell = staticData?.summonerSpells[String(id)]
        const src = spellIcon(staticData?.version ?? null, spell?.slug)
        return (
          <div key={index} className="size-[15px] overflow-hidden rounded-[3px] bg-line-strong">
            {src && <img src={src} alt={spell?.name ?? ''} width={15} height={15} />}
          </div>
        )
      })}
    </div>
  )
}

function PlayerRow({
  participant,
  staticData,
}: {
  participant: LiveParticipant
  staticData?: StaticData
}) {
  const crest = tierCrest(participant.rank?.tier)
  const name = participant.displayName ?? participant.riotId ?? 'Unknown player'

  return (
    <div
      className={`flex items-center gap-2 rounded-[4px] px-1.5 py-1 ${
        participant.tracked ? 'bg-accent-soft/50' : ''
      }`}
    >
      <ChampionIcon
        championId={participant.championId}
        championName={String(participant.championId)}
        staticData={staticData}
        size={32}
      />
      <SpellPair participant={participant} staticData={staticData} />

      <div className="min-w-0 flex-1">
        <div
          className={`truncate text-[13px] ${
            participant.tracked ? 'text-accent' : 'text-ink-muted'
          }`}
        >
          {name}
        </div>
        <div className="flex items-center gap-1">
          {crest && (
            <img src={crest} alt="" aria-hidden width={13} height={13} className="shrink-0" />
          )}
          <span
            className="tnum truncate text-[11px]"
            style={{ color: tierColor(participant.rank?.tier) }}
          >
            {rankShort(participant.rank)}
          </span>
        </div>
      </div>
    </div>
  )
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
  const [open, setOpen] = useState(false)
  const ours = game.participants.filter((p) => p.tracked)
  const teams = [100, 200].map((teamId) => game.participants.filter((p) => p.teamId === teamId))

  return (
    <article className="overflow-hidden rounded-[8px] border border-accent/30 bg-panel">
      {/*
        Collapsed by default: the headline is that they are playing, and a
        ten-player line-up on every card would bury the day underneath the few
        games happening right now.
      */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-panel-raised ${
          open ? 'border-b border-line' : ''
        }`}
      >
        <div className="min-w-0">
          <div className="truncate text-[14px] text-ink">
            {ours.map((p) => p.displayName ?? p.riotId).join(', ')}
          </div>
          <div className="mt-0.5 truncate text-[12px] text-ink-dim">
            {queueLabel} · {open ? 'hide the line-up' : 'see who they are against'}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="display tnum text-[20px] font-semibold text-accent">
            {duration(elapsed)}
          </span>
          <ChevronDown
            size={15}
            className={`text-ink-dim transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {open && (
      <div className="grid gap-x-4 gap-y-3 p-3 sm:grid-cols-2">
        {teams.map((team, index) => (
          <div key={index}>
            <div className="mb-1.5 px-1.5 text-[10px] uppercase tracking-[0.13em] text-ink-dim">
              {index === 0 ? 'Blue side' : 'Red side'}
            </div>
            <div className="space-y-0.5">
              {team.map((participant) => (
                <PlayerRow
                  key={participant.puuid ?? `${participant.teamId}:${participant.championId}`}
                  participant={participant}
                  staticData={staticData}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      )}
    </article>
  )
}

import { useEffect, useState } from 'react'

import { ChampionIcon } from '@/components/ChampionIcon'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
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
        const spell = staticData?.summonerSpells?.[String(id)]
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
    <Accordion
      type="single"
      collapsible
      value={open ? 'lineup' : ''}
      onValueChange={(value) => setOpen(value === 'lineup')}
      className="overflow-hidden rounded-[8px] border border-accent/30 bg-panel"
    >
      <AccordionItem value="lineup" className="border-b-0">
        {/*
          Collapsed by default: the headline is that they are playing, and a
          ten-player line-up on every card would bury the day underneath the
          few games happening right now.
        */}
        <AccordionTrigger className="items-center gap-3 rounded-none px-4 py-3 hover:no-underline data-[state=open]:border-b data-[state=open]:border-line">
          <span className="min-w-0 flex-1 text-left">
            {/*
              Who, and on what. The champion is the first thing anyone wants
              from a game in progress, and it used to be buried inside the
              line-up - collapsed, the card named people and showed nothing.
            */}
            <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {ours.map((participant) => (
                <span
                  key={participant.puuid ?? `${participant.teamId}:${participant.championId}`}
                  className="flex min-w-0 items-center gap-2"
                >
                  <ChampionIcon
                    championId={participant.championId}
                    championName={
                      staticData?.champions?.[String(participant.championId)]?.name ??
                      String(participant.championId)
                    }
                    staticData={staticData}
                    size={34}
                    className="rounded-[9px]"
                  />
                  <span className="min-w-0">
                    <span className="display block truncate text-[15px] font-semibold text-ink">
                      {participant.displayName ?? participant.riotId}
                    </span>
                    <span className="block truncate text-[11px] font-normal text-ink-dim">
                      {staticData?.champions?.[String(participant.championId)]?.name ?? 'Champion'}
                    </span>
                  </span>
                </span>
              ))}
            </span>

            <span className="mt-2 block truncate text-[12px] font-normal text-ink-dim">
              {queueLabel} · {open ? 'hide the line-up' : 'see who they are against'}
            </span>
          </span>

          <span className="display tnum shrink-0 text-[20px] font-semibold text-accent">
            {duration(elapsed)}
          </span>
        </AccordionTrigger>

        <AccordionContent className="grid gap-x-4 gap-y-3 p-3 pb-3 sm:grid-cols-2">
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
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

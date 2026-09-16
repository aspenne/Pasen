import { DateTime } from 'luxon'

import Group from '#models/group'
import Match from '#models/match'
import Member from '#models/member'
import RiotAccount from '#models/riot_account'
import StaticChampion from '#models/static_champion'

export async function seedGroup(timezone = 'Europe/Paris') {
  const group = await Group.create({ slug: 'arigafion', name: 'ARIGAFION', timezone })
  const member = await Member.create({ slug: 'patate', displayName: 'Patate' })
  await group.related('members').attach([member.id])

  const account = await RiotAccount.create({
    memberId: member.id,
    puuid: 'puuid-patate',
    gameName: 'Patate',
    tagLine: 'CCC',
    platform: 'euw1',
    backfillState: 'done',
  })

  return { group, member, account }
}

export async function addMember(group: Group, slug: string, puuid: string) {
  const member = await Member.create({ slug, displayName: slug })
  await group.related('members').attach([member.id])

  const account = await RiotAccount.create({
    memberId: member.id,
    puuid,
    gameName: slug,
    tagLine: 'EUW',
    platform: 'euw1',
    backfillState: 'done',
  })

  return { member, account }
}

export async function seedChampions(count: number) {
  for (let i = 1; i <= count; i++) {
    await StaticChampion.create({
      id: i,
      slug: `Champ${i}`,
      name: `Champ ${i}`,
      title: 'the Placeholder',
      tags: ['Fighter'],
      image: `Champ${i}.png`,
      version: '16.18.1',
    })
  }
}

export type ParticipantOverrides = Partial<{
  championId: number
  championName: string
  win: boolean
  kills: number
  deaths: number
  assists: number
  cs: number
  teamPosition: string | null
  teamId: number
  subteamId: number | null
}>

/** One stored match with one tracked participant, at a chosen instant. */
export async function seedMatch(
  matchId: string,
  at: DateTime,
  puuid: string,
  matchOverrides: Record<string, unknown> = {},
  participant: ParticipantOverrides = {}
) {
  const match = await Match.create({
    matchId,
    platform: 'EUW1',
    queueId: 420,
    queueGroup: 'ranked_solo',
    gameMode: 'CLASSIC',
    gameType: 'MATCHED_GAME',
    gameVersion: '16.18.1',
    gameCreation: at,
    gameDuration: 1800,
    gameEndedAt: at.plus({ seconds: 1800 }),
    participantCount: 10,
    statsEligible: true,
    raw: {},
    ingestedAt: DateTime.utc(),
    ...matchOverrides,
  })

  await addParticipant(match, puuid, participant)
  return match
}

export async function addParticipant(
  match: Match,
  puuid: string,
  overrides: ParticipantOverrides = {}
) {
  return match.related('participants').create({
    matchId: match.matchId,
    puuid,
    teamId: overrides.teamId ?? 100,
    subteamId: overrides.subteamId ?? null,
    championId: overrides.championId ?? 266,
    championName: overrides.championName ?? 'Aatrox',
    teamPosition: overrides.teamPosition === undefined ? 'TOP' : overrides.teamPosition,
    individualPosition: 'TOP',
    win: overrides.win ?? true,
    kills: overrides.kills ?? 5,
    deaths: overrides.deaths ?? 2,
    assists: overrides.assists ?? 7,
    goldEarned: 12000,
    cs: overrides.cs ?? 180,
    damageDealt: 20000,
    damageTaken: 18000,
    visionScore: 20,
    wardsPlaced: 8,
    wardsKilled: 3,
    champLevel: 16,
    summoner1Id: 4,
    summoner2Id: 12,
    items: [1, 2, 3, 4, 5, 6, 7],
    perks: null,
    riotIdGameName: puuid,
    riotIdTagLine: 'CCC',
    doubleKills: 0,
    tripleKills: 0,
    quadraKills: 0,
    pentaKills: 0,
    firstBloodKill: false,
    earlySurrender: false,
  })
}

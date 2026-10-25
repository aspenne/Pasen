import { describe, expect, it } from 'vitest'

import { DRAFT_STEPS, currentStep, defaultRole, validateAction, type DraftAction } from './draft.js'

function act(step: number, championId: number, role: DraftAction['role'] = null): DraftAction {
  return { step, side: DRAFT_STEPS[step].side, kind: DRAFT_STEPS[step].kind, championId, role }
}

describe('DRAFT_STEPS', () => {
  it('follows the tournament order', () => {
    const code = DRAFT_STEPS.map((s) => `${s.side[0]}${s.kind[0]}`).join(' ')
    expect(code).toBe(
      'bb rb bb rb bb rb ' + 'bp rp rp bp bp rp ' + 'rb bb rb bb ' + 'rp bp bp rp'
    )
    expect(DRAFT_STEPS).toHaveLength(20)
  })
})

describe('currentStep', () => {
  it('is the next step, and null once twenty are done', () => {
    expect(currentStep([])).toBe(0)
    expect(currentStep([act(0, 1), act(1, 2)])).toBe(2)
    expect(currentStep(DRAFT_STEPS.map((_, i) => act(i, i + 1)))).toBeNull()
  })
})

describe('defaultRole', () => {
  it("takes the first free role the champion plays, else the first free one", () => {
    expect(defaultRole(['MIDDLE', 'UTILITY'], ['MIDDLE'])).toBe('UTILITY')
    expect(defaultRole(['TOP'], ['TOP'])).toBe('JUNGLE')
    expect(defaultRole([], [])).toBe('TOP')
    expect(defaultRole(['TOP'], ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'])).toBeNull()
  })
})

describe('validateAction', () => {
  const base = { actions: [] as DraftAction[], burned: new Set<number>(), positions: [] as string[] }

  it('lets the side whose turn it is ban a free champion', () => {
    expect(validateAction({ ...base, side: 'blue', championId: 7 })).toEqual({ ok: true, kind: 'ban', step: 0, role: null })
  })

  it('refuses the other side, a used champion, a burned one, and a finished draft', () => {
    expect(validateAction({ ...base, side: 'red', championId: 7 })).toEqual({ ok: false, reason: 'not-your-turn' })
    expect(validateAction({ ...base, actions: [act(0, 7)], side: 'red', championId: 7 })).toEqual({ ok: false, reason: 'taken' })
    expect(validateAction({ ...base, burned: new Set([7]), side: 'blue', championId: 7 })).toEqual({ ok: false, reason: 'burned' })
    const done = DRAFT_STEPS.map((_, i) => act(i, i + 100))
    expect(validateAction({ ...base, actions: done, side: 'red', championId: 7 })).toEqual({ ok: false, reason: 'finished' })
  })

  it('gives a pick a role: the one asked for if free, else the default', () => {
    const bans = DRAFT_STEPS.slice(0, 6).map((_, i) => act(i, i + 100))
    expect(validateAction({ ...base, actions: bans, side: 'blue', championId: 7, positions: ['MIDDLE'] })).toEqual({
      ok: true, kind: 'pick', step: 6, role: 'MIDDLE',
    })
    expect(validateAction({ ...base, actions: bans, side: 'blue', championId: 7, positions: ['MIDDLE'], role: 'BOTTOM' })).toEqual({
      ok: true, kind: 'pick', step: 6, role: 'BOTTOM',
    })
    const withMid = [...bans, act(6, 50, 'MIDDLE'), act(7, 51, 'TOP'), act(8, 52, 'TOP')]
    expect(validateAction({ ...base, actions: withMid, side: 'blue', championId: 7, role: 'MIDDLE' })).toEqual({ ok: false, reason: 'role-taken' })
  })
})

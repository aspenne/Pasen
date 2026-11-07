import { describe, expect, it } from 'vitest'

import { PROGRESSION, arpNote, chordForBar, midiToFrequency, readSoundPref, writeSoundPref } from '@/lib/draftAudio'

describe('midiToFrequency', () => {
  it('tunes A4 to 440 Hz and an octave to a doubling', () => {
    expect(midiToFrequency(69)).toBe(440)
    expect(midiToFrequency(81)).toBe(880)
    expect(midiToFrequency(57)).toBe(220)
  })
})

describe('chordForBar', () => {
  it('loops the four chords, bar after bar', () => {
    expect(chordForBar(0)).toBe(PROGRESSION[0])
    expect(chordForBar(3)).toBe(PROGRESSION[3])
    expect(chordForBar(4)).toBe(PROGRESSION[0])
    expect(chordForBar(-1)).toBe(PROGRESSION[3])
  })
})

describe('arpNote', () => {
  it('climbs the chord an octave up to the next root, then comes back down', () => {
    const chord = [50, 53, 57]
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((step) => arpNote(chord, step))).toEqual([62, 65, 69, 74, 69, 65, 69, 74])
  })
})

describe('sound preference', () => {
  it('is off until asked for, then remembered', () => {
    localStorage.clear()
    expect(readSoundPref()).toBe(false)
    writeSoundPref(true)
    expect(readSoundPref()).toBe(true)
    writeSoundPref(false)
    expect(readSoundPref()).toBe(false)
  })
})

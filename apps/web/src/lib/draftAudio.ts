/**
 * The draft's sound: a background loop and a cue for each lock-in, all made
 * with the Web Audio API. Nothing is downloaded and nothing is borrowed - the
 * music is an original four-chord loop played by a few oscillators, which
 * keeps the page light and leaves no licence to worry about.
 *
 * Browsers only let a page make sound after the reader has clicked or tapped,
 * so the engine is created lazily and resumed from a user gesture.
 */

/** D minor, i - VI - III - VII: Dm, Bb, F, C. Brooding, then lifting, like a champion select. */
export const PROGRESSION: readonly (readonly number[])[] = [
  [50, 53, 57], // D3 F3 A3
  [46, 50, 53], // Bb2 D3 F3
  [53, 57, 60], // F3 A3 C4
  [48, 52, 55], // C3 E3 G3
]

export const BPM = 84
/** Eighth notes per bar. */
const STEPS_PER_BAR = 8

export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

export function chordForBar(bar: number): readonly number[] {
  return PROGRESSION[((bar % PROGRESSION.length) + PROGRESSION.length) % PROGRESSION.length]
}

/** The arpeggio's note on an eighth of the bar: the chord climbing an octave up, then back. */
export function arpNote(chord: readonly number[], step: number): number {
  const climb = [0, 1, 2, 3, 2, 1, 2, 3][step % STEPS_PER_BAR]
  return climb === 3 ? chord[0] + 24 : chord[climb] + 12
}

const PREF_KEY = 'pasen-draft-sound'

/** Whether this browser asked for the draft's sound last time. Off unless asked. */
export function readSoundPref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === 'on'
  } catch {
    return false
  }
}

export function writeSoundPref(on: boolean) {
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off')
  } catch {
    // Private mode: the choice lasts as long as the page does.
  }
}

export type DraftAudio = {
  /** Fades the loop in. Call from a click or tap. */
  start: () => void
  /** Fades the loop out; cues stop too. */
  stop: () => void
  /** The sound of a champion being locked: bright for a pick, heavy for a ban. */
  cue: (kind: 'pick' | 'ban') => void
}

const MUSIC_VOLUME = 0.16
const CUE_VOLUME = 0.35
const LOOKAHEAD_SECONDS = 0.25
const TICK_MS = 60

export function createDraftAudio(): DraftAudio {
  const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  const ctx = new AudioCtx()

  const master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)

  // A short feedback delay stands in for a room, so the loop is not bone dry.
  const delay = ctx.createDelay(1)
  delay.delayTime.value = (60 / BPM) * 0.75
  const feedback = ctx.createGain()
  feedback.gain.value = 0.32
  const wet = ctx.createGain()
  wet.gain.value = 0.35
  delay.connect(feedback).connect(delay)
  delay.connect(wet).connect(master)

  const music = ctx.createGain()
  music.gain.value = 1
  music.connect(master)
  music.connect(delay)

  const cues = ctx.createGain()
  cues.gain.value = CUE_VOLUME
  cues.connect(ctx.destination)

  const eighth = 60 / BPM / 2
  let step = 0
  let nextTime = 0
  let timer: number | null = null
  let playing = false

  function voice(
    type: OscillatorType,
    frequency: number,
    at: number,
    length: number,
    peak: number,
    attack: number,
    destination: AudioNode,
    cutoff = 2400
  ) {
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = frequency
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = cutoff
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(peak, at + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
    osc.connect(filter).connect(gain).connect(destination)
    osc.start(at)
    osc.stop(at + length + 0.05)
    return osc
  }

  function kick(at: number) {
    const osc = ctx.createOscillator()
    osc.frequency.setValueAtTime(90, at)
    osc.frequency.exponentialRampToValueAtTime(38, at + 0.35)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.5, at)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.4)
    osc.connect(gain).connect(music)
    osc.start(at)
    osc.stop(at + 0.45)
  }

  function playStep(at: number) {
    const bar = Math.floor(step / STEPS_PER_BAR)
    const inBar = step % STEPS_PER_BAR
    const chord = chordForBar(bar)
    const barLength = eighth * STEPS_PER_BAR

    if (inBar === 0) {
      // The pad: each chord tone twice, a few cents apart, swelling over the bar.
      for (const note of chord) {
        for (const detune of [-6, 6]) {
          const osc = voice('sawtooth', midiToFrequency(note), at, barLength + 0.6, 0.035, 0.9, music, 900)
          osc.detune.value = detune
        }
      }
      voice('sine', midiToFrequency(chord[0] - 12), at, barLength * 0.5, 0.22, 0.04, music)
      kick(at)
    }
    if (inBar === 4) {
      voice('sine', midiToFrequency(chord[0] - 12), at, barLength * 0.5, 0.18, 0.04, music)
      kick(at)
    }
    voice('triangle', midiToFrequency(arpNote(chord, inBar)), at, eighth * 1.6, 0.07, 0.01, music, 3200)
  }

  function schedule() {
    while (nextTime < ctx.currentTime + LOOKAHEAD_SECONDS) {
      playStep(nextTime)
      nextTime += eighth
      step++
    }
  }

  function noise(at: number, length: number) {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.start(at)
    return source
  }

  return {
    start() {
      void ctx.resume()
      if (playing) return
      playing = true
      const now = ctx.currentTime
      master.gain.cancelScheduledValues(now)
      master.gain.setValueAtTime(master.gain.value, now)
      master.gain.linearRampToValueAtTime(MUSIC_VOLUME, now + 2)
      nextTime = now + 0.05
      timer = window.setInterval(schedule, TICK_MS)
      schedule()
    },

    stop() {
      if (!playing) return
      playing = false
      const now = ctx.currentTime
      master.gain.cancelScheduledValues(now)
      master.gain.setValueAtTime(master.gain.value, now)
      master.gain.linearRampToValueAtTime(0, now + 0.6)
      if (timer !== null) window.clearInterval(timer)
      timer = null
    },

    cue(kind) {
      if (!playing) return
      const at = ctx.currentTime + 0.01
      if (kind === 'pick') {
        // A rising fifth and a shimmer of air: something arriving.
        voice('triangle', midiToFrequency(81), at, 0.5, 0.5, 0.005, cues, 6000)
        voice('triangle', midiToFrequency(88), at + 0.09, 0.9, 0.45, 0.005, cues, 6000)
        const air = noise(at, 0.5)
        const band = ctx.createBiquadFilter()
        band.type = 'bandpass'
        band.frequency.setValueAtTime(800, at)
        band.frequency.exponentialRampToValueAtTime(6000, at + 0.4)
        const gain = ctx.createGain()
        gain.gain.setValueAtTime(0.25, at)
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.5)
        air.connect(band).connect(gain).connect(cues)
      } else {
        // A low slam and a falling tone: something shut away.
        const thud = ctx.createOscillator()
        thud.frequency.setValueAtTime(130, at)
        thud.frequency.exponentialRampToValueAtTime(40, at + 0.3)
        const thudGain = ctx.createGain()
        thudGain.gain.setValueAtTime(0.9, at)
        thudGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.4)
        thud.connect(thudGain).connect(cues)
        thud.start(at)
        thud.stop(at + 0.45)
        voice('sawtooth', midiToFrequency(57), at, 0.6, 0.18, 0.005, cues, 1200).frequency.exponentialRampToValueAtTime(
          midiToFrequency(45),
          at + 0.5
        )
        const crack = noise(at, 0.18)
        const low = ctx.createBiquadFilter()
        low.type = 'lowpass'
        low.frequency.value = 1800
        const gain = ctx.createGain()
        gain.gain.setValueAtTime(0.4, at)
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18)
        crack.connect(low).connect(gain).connect(cues)
      }
    },
  }
}

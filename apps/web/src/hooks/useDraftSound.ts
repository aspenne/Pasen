import { useCallback, useEffect, useRef, useState } from 'react'

import { createDraftAudio, readSoundPref, writeSoundPref, type DraftAudio } from '@/lib/draftAudio'

/**
 * The draft's music and lock-in cues, off until the reader turns them on.
 *
 * The choice is remembered, but a browser will not play anything before the
 * reader has touched the page: when the sound was left on, it starts on the
 * first click or tap instead of on load.
 */
export function useDraftSound() {
  const [on, setOn] = useState(readSoundPref)
  const audio = useRef<DraftAudio | null>(null)

  const engine = useCallback(() => {
    if (!audio.current) {
      try {
        audio.current = createDraftAudio()
      } catch {
        // No Web Audio here: the draft runs silent.
        return null
      }
    }
    return audio.current
  }, [])

  useEffect(() => {
    if (!on) return
    const begin = () => engine()?.start()
    window.addEventListener('pointerdown', begin, { once: true })
    window.addEventListener('keydown', begin, { once: true })
    return () => {
      window.removeEventListener('pointerdown', begin)
      window.removeEventListener('keydown', begin)
    }
  }, [on, engine])

  // Leaving the page takes the music with it.
  useEffect(() => () => audio.current?.stop(), [])

  const toggle = useCallback(() => {
    const next = !on
    setOn(next)
    writeSoundPref(next)
    // Called from the click itself, which is what lets the browser play.
    if (next) engine()?.start()
    else audio.current?.stop()
  }, [on, engine])

  const cue = useCallback((kind: 'pick' | 'ban') => audio.current?.cue(kind), [])

  return { on, toggle, cue }
}

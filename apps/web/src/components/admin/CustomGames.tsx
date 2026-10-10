import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { ExternalLinkIcon, PencilIcon, Trash2Icon, UploadIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { api, ApiError, type CustomSide } from '@/lib/api'
import { duration as formatDuration } from '@/lib/format'

/**
 * Captured custom games, which exist nowhere but the file the agent wrote.
 *
 * Riot's match API does not serve customs and the client's own endpoint dies
 * with the game window, so this upload is the only way one ever reaches the
 * site - and the only copy of a game is the one a person carries here.
 */
export function CustomGames({ group }: { group: string }) {
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [label, setLabel] = useState('')
  const [renaming, setRenaming] = useState<{ id: number; draft: string } | null>(null)

  const games = useQuery({
    queryKey: ['admin-customs', group],
    queryFn: () => api.customs(group),
  })

  const upload = useMutation({
    mutationFn: async (file: File) => {
      let capture: unknown
      try {
        capture = JSON.parse(await file.text())
      } catch {
        throw new Error('That file is not valid JSON.')
      }

      return api.uploadCustom(group, {
        capture,
        fileName: file.name,
        // The agent stamps its own filename; this is the fallback behind it.
        capturedAt: new Date(file.lastModified).toISOString(),
        label: label.trim() || undefined,
      })
    },
    onSuccess: (game) => {
      toast[game.duplicate ? 'info' : 'success'](
        game.duplicate
          ? 'Already stored — same capture, nothing added.'
          : `Stored: ${game.gameMode}, ${game.playerCount} players.`
      )
      setLabel('')
      if (fileInput.current) fileInput.current.value = ''
      queryClient.invalidateQueries({ queryKey: ['admin-customs', group] })
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError ? error.message : (error as Error).message || 'Upload failed.'
      ),
  })

  const decide = useMutation({
    mutationFn: ({ id, winner }: { id: number; winner: CustomSide }) => api.updateCustom(id, { winner }),
    onSuccess: (_, { id, winner }) => {
      toast.success(`${winner === 'ORDER' ? 'Blue' : 'Red'} side set as the winner.`)
      queryClient.invalidateQueries({ queryKey: ['admin-customs', group] })
      // The same keys the game's own page refreshes: its page, the list, the standings.
      queryClient.invalidateQueries({ queryKey: ['custom', group, String(id)] })
      queryClient.invalidateQueries({ queryKey: ['customs', group] })
    },
    onError: () => toast.error('Could not save that. Are you still signed in?'),
  })

  const rename = useMutation({
    // Emptied, the game goes back to the name the site gives it.
    mutationFn: ({ id, label }: { id: number; label: string | null }) => api.updateCustom(id, { label }),
    onSuccess: (_, { id }) => {
      toast.success('Renamed.')
      setRenaming(null)
      queryClient.invalidateQueries({ queryKey: ['admin-customs', group] })
      queryClient.invalidateQueries({ queryKey: ['custom', group, String(id)] })
      queryClient.invalidateQueries({ queryKey: ['customs', group] })
    },
    onError: () => toast.error('Could not save that. Are you still signed in?'),
  })

  const remove = useMutation({
    mutationFn: api.removeCustom,
    onSuccess: () => {
      toast.success('Removed.')
      queryClient.invalidateQueries({ queryKey: ['admin-customs', group] })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[15px]">Custom games</CardTitle>
        <CardDescription>
          Drop in a capture from <code className="text-ink-muted">captures/</code>. Riot does not
          serve customs and the client forgets them when the window closes, so the file is the only
          copy there will ever be.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1 space-y-1.5">
            <Label htmlFor="custom-label">Name it (optional)</Label>
            <Input
              id="custom-label"
              value={label}
              placeholder="Inhouse du vendredi"
              maxLength={80}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="custom-file">Capture</Label>
            <Input
              id="custom-file"
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="file:mr-3 file:text-ink-muted"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) upload.mutate(file)
              }}
            />
          </div>

          <Button variant="outline" disabled={upload.isPending} onClick={() => fileInput.current?.click()}>
            <UploadIcon />
            {upload.isPending ? 'Reading…' : 'Choose a file'}
          </Button>
        </div>

        {games.isPending ? (
          <Skeleton className="h-16" />
        ) : games.data && games.data.length > 0 ? (
          <ul className="divide-y divide-line rounded-[6px] border border-line">
            {games.data.map((game) => (
              <li key={game.id} className="flex items-center gap-4 px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {renaming?.id === game.id ? (
                      <Input
                        autoFocus
                        value={renaming.draft}
                        maxLength={80}
                        disabled={rename.isPending}
                        aria-label={`New name for ${game.label ?? game.gameMode}`}
                        placeholder="Enter to save, Esc to cancel"
                        className="h-7 text-[13px]"
                        onChange={(event) => setRenaming({ id: game.id, draft: event.target.value })}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            rename.mutate({ id: game.id, label: renaming.draft.trim() || null })
                          } else if (event.key === 'Escape') {
                            setRenaming(null)
                          }
                        }}
                      />
                    ) : (
                      <>
                        <span className="display truncate text-[14px] text-ink">
                          {game.label ?? `${game.gameMode} · ${game.playerCount} players`}
                        </span>
                        <button
                          type="button"
                          aria-label={`Rename ${game.label ?? game.gameMode}`}
                          onClick={() => setRenaming({ id: game.id, draft: game.label ?? '' })}
                          className="tap inline-flex shrink-0 items-center text-ink-dim transition-colors hover:text-ink"
                        >
                          <PencilIcon className="size-3.5" />
                        </button>
                      </>
                    )}
                    {/* Left out of every win and loss until someone decides. */}
                    {!game.resultKnown && !game.againstBots && (
                      <span className="shrink-0 border border-loss px-1.5 text-[10px] uppercase tracking-[0.1em] text-loss">
                        No result
                      </span>
                    )}
                  </div>
                  <div className="tnum text-[11px] text-ink-dim">
                    {new Date(game.playedAt).toLocaleString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' · '}
                    {formatDuration(game.duration)}
                    {game.mapName ? ` · ${game.mapName}` : ''}
                  </div>
                </div>

                {!game.againstBots && (
                  <div className="flex shrink-0 gap-1">
                    {(['ORDER', 'CHAOS'] as const).map((side) => {
                      const chosen = game.winner === side
                      const name = side === 'ORDER' ? 'Blue' : 'Red'
                      return (
                        <button
                          key={side}
                          type="button"
                          aria-pressed={chosen}
                          aria-label={`${name} won: ${game.label ?? game.gameMode}`}
                          disabled={decide.isPending}
                          onClick={() => !chosen && decide.mutate({ id: game.id, winner: side })}
                          className={`tap rounded-[3px] px-2 py-0.5 text-[11px] uppercase tracking-[0.08em] transition-colors disabled:opacity-60 ${
                            chosen ? 'bg-accent text-on-accent' : 'bg-panel-raised text-ink-muted hover:text-ink'
                          }`}
                        >
                          {name}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/*
                  The game's own page: both scoreboards, to see who was on which
                  side, and - signed in as now - its Who won? bar.
                */}
                <a
                  href={`/${group}/customs/${game.id}`}
                  aria-label={`Open ${game.label ?? game.gameMode}`}
                  title="Open the game"
                  className="tap inline-flex shrink-0 items-center text-ink-dim transition-colors hover:text-ink"
                >
                  <ExternalLinkIcon className="size-4" />
                </a>

                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${game.label ?? game.gameMode}`}
                  onClick={() => remove.mutate(game.id)}
                >
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-ink-muted">
            Nothing captured yet. Run the agent beside a custom and upload what lands in{' '}
            <code>captures/</code>.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

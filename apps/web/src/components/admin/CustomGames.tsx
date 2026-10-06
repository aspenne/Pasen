import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Trash2Icon, UploadIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { api, ApiError } from '@/lib/api'
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
                  <div className="display truncate text-[14px] text-ink">
                    {game.label ?? `${game.gameMode} · ${game.playerCount} players`}
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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { CopyIcon, LinkIcon, Trash2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { timeAgo } from '@/lib/format'

/**
 * Pairing the PCs that run the Pasen Capture app.
 *
 * A pairing code can do one thing: send a captured custom to this group. It is
 * shown once, here, right after pairing - only its hash is stored, so a lost
 * code is replaced by pairing again, and a PC that should no longer send games
 * is revoked with one click.
 */
export function CaptureDevices({ group }: { group: string }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [issued, setIssued] = useState<{ name: string; token: string } | null>(null)

  const devices = useQuery({
    queryKey: ['capture-devices', group],
    queryFn: () => api.captureDevices(group),
  })

  const pair = useMutation({
    mutationFn: () => api.pairCaptureDevice(group, name.trim()),
    onSuccess: (device) => {
      setIssued({ name: device.name, token: device.token })
      setName('')
      queryClient.invalidateQueries({ queryKey: ['capture-devices', group] })
    },
    onError: () => toast.error('Could not pair that PC.'),
  })

  const revoke = useMutation({
    mutationFn: api.revokeCaptureDevice,
    onSuccess: () => {
      toast.success('Revoked. That PC can no longer send games.')
      queryClient.invalidateQueries({ queryKey: ['capture-devices', group] })
    },
  })

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token)
      toast.success('Code copied.')
    } catch {
      toast.error('Copy it by hand: select the code and copy.')
    }
  }

  const live = (devices.data ?? []).filter((device) => !device.revokedAt)
  const revoked = (devices.data ?? []).filter((device) => device.revokedAt)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[15px]">Capture app</CardTitle>
        <CardDescription>
          Pair a PC so Pasen Capture can send customs straight here. Name it, paste the code into the
          app, done. The code can only send games to this group.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            if (name.trim()) pair.mutate()
          }}
        >
          <div className="min-w-[180px] flex-1 space-y-1.5">
            <Label htmlFor="device-name">Which PC is this?</Label>
            <Input
              id="device-name"
              value={name}
              maxLength={60}
              placeholder="PC de Patate"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" disabled={!name.trim() || pair.isPending}>
            <LinkIcon />
            {pair.isPending ? 'Pairing…' : 'Pair this PC'}
          </Button>
        </form>

        {issued && (
          /*
           * The only time the code exists anywhere but on that PC. Said plainly,
           * so nobody closes the page expecting to come back for it.
           */
          <div className="space-y-2 border-l-2 border-accent bg-accent-soft/40 px-4 py-3">
            <p className="text-[13px] text-ink">
              Code for <strong>{issued.name}</strong>. Paste it into Pasen Capture now: it will not
              be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-[4px] bg-ground px-2.5 py-1.5 font-mono text-[12px] text-ink">
                {issued.token}
              </code>
              <Button size="sm" variant="outline" onClick={() => copy(issued.token)}>
                <CopyIcon />
                Copy
              </Button>
            </div>
            <button
              type="button"
              onClick={() => setIssued(null)}
              className="text-[12px] text-ink-dim underline-offset-2 hover:text-ink hover:underline"
            >
              I have pasted it
            </button>
          </div>
        )}

        {live.length > 0 ? (
          <ul className="divide-y divide-line rounded-[6px] border border-line">
            {live.map((device) => (
              <li key={device.id} className="flex items-center gap-4 px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] text-ink">{device.name}</div>
                  <div className="text-[11px] text-ink-dim">
                    {device.lastUsedAt
                      ? `Last sent a game ${timeAgo(device.lastUsedAt)}`
                      : `Paired ${timeAgo(device.createdAt)}, nothing sent yet`}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Revoke ${device.name}`}
                  onClick={() => revoke.mutate(device.id)}
                >
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-ink-muted">No PC paired yet.</p>
        )}

        {revoked.length > 0 && (
          <p className="text-[11px] text-ink-dim">
            Revoked: {revoked.map((device) => device.name).join(', ')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

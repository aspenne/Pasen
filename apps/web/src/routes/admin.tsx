import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { KeyRoundIcon, RefreshCwIcon, Trash2Icon } from 'lucide-react'

import { CaptureDevices } from '@/components/admin/CaptureDevices'
import { CustomGames } from '@/components/admin/CustomGames'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, ApiError, type AdminAccount } from '@/lib/api'
import { timeAgo } from '@/lib/format'

export const Route = createFileRoute('/admin')({ component: Admin })

const DEFAULT_GROUP = import.meta.env.VITE_DEFAULT_GROUP ?? 'arigafion'

function Admin() {
  const session = useQuery({ queryKey: ['session'], queryFn: api.session })

  return (
    <div className="min-h-screen bg-ground text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <span className="text-[13px] tracking-[0.14em] text-accent">PASEN ADMIN</span>
          {session.data?.authenticated && <SignOut email={session.data.email} />}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {session.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : session.data?.authenticated ? (
          <Console />
        ) : (
          <SignIn />
        )}
      </main>
    </div>
  )
}

function SignOut({ email }: { email: string | null }) {
  const queryClient = useQueryClient()
  const signOut = useMutation({
    mutationFn: api.signOut,
    onSuccess: () => queryClient.invalidateQueries(),
  })

  return (
    <div className="flex items-center gap-3 text-[12px]">
      <span className="text-ink-muted">{email}</span>
      <Button variant="outline" size="sm" onClick={() => signOut.mutate()}>
        Sign out
      </Button>
    </div>
  )
}

function SignIn() {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const signIn = useMutation({
    mutationFn: () => api.signIn(email, password),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: () => toast.error('That email and password do not match.'),
  })

  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle className="text-[15px]">Sign in</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            signIn.mutate()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <Button type="submit" disabled={signIn.isPending} className="w-full">
            {signIn.isPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function Console() {
  const status = useQuery({
    queryKey: ['admin-status'],
    queryFn: api.adminStatus,
    // Backfills move while this page is open.
    refetchInterval: 15_000,
  })

  if (status.isPending) return <Skeleton className="h-64 w-full" />
  if (!status.data) return <p className="text-[13px] text-loss">Could not load status.</p>

  return (
    <div className="space-y-6">
      <RiotKeyCard status={status.data.riotKey} budget={status.data.budget} />
      <AddAccountCard accounts={status.data.accounts} />
      <AccountsCard accounts={status.data.accounts} />
      <CustomGames group={DEFAULT_GROUP} />
      <CaptureDevices group={DEFAULT_GROUP} />
    </div>
  )
}

function RiotKeyCard({
  status,
  budget,
}: {
  status: { hasKey: boolean; source: string; invalidSince: string | null; fingerprint: string | null }
  budget: { windowSeconds: number; limit: number; used: number }[]
}) {
  const queryClient = useQueryClient()
  const [key, setKey] = useState('')

  const save = useMutation({
    mutationFn: () => api.setRiotKey(key.trim()),
    onSuccess: () => {
      setKey('')
      queryClient.invalidateQueries({ queryKey: ['admin-status'] })
      toast.success('Key rotated. Every process picks it up on its next call.')
    },
    onError: () => toast.error('Riot would not take that key.'),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[14px]">
          <KeyRoundIcon className="size-4 text-accent" aria-hidden />
          Riot API key
        </CardTitle>
        <CardDescription>
          Stored in the database, so a rotation needs no redeploy and no restart. It is never
          shown again.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {status.invalidSince && (
          <p className="border-l-2 border-loss bg-panel-raised px-3 py-2 text-[12px] text-ink-muted">
            Riot rejected this key {timeAgo(status.invalidSince)}. Development keys expire every
            24 hours — paste a fresh one below.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px]">
          <span className="text-ink-muted">
            {status.hasKey ? `Set, from the ${status.source}` : 'No key configured'}
          </span>
          {status.fingerprint && (
            <span className="tnum text-ink-dim">fingerprint {status.fingerprint}</span>
          )}
          {budget.map((window) => (
            <span key={window.windowSeconds} className="tnum text-ink-dim">
              {window.used}/{window.limit} used this {window.windowSeconds}s
            </span>
          ))}
        </div>

        <form
          className="flex gap-2"
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            save.mutate()
          }}
        >
          <Input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="RGAPI-…"
            autoComplete="off"
          />
          <Button type="submit" disabled={key.trim().length < 10 || save.isPending}>
            {save.isPending ? 'Saving…' : 'Rotate'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function AddAccountCard({ accounts }: { accounts: AdminAccount[] }) {
  const queryClient = useQueryClient()
  const [riotId, setRiotId] = useState('')
  const [platform, setPlatform] = useState('euw1')
  const [memberSlug, setMemberSlug] = useState('new')

  const members = [...new Map(accounts.map((a) => [a.memberSlug, a.displayName])).entries()]

  const add = useMutation({
    mutationFn: () =>
      api.addAccount(DEFAULT_GROUP, {
        riotId: riotId.trim(),
        platform,
        // An existing member wins over a typed name, so attaching a smurf cannot
        // quietly create a second person.
        memberSlug: memberSlug === 'new' ? undefined : memberSlug,
      }),
    onSuccess: (account) => {
      setRiotId('')
      setMemberSlug('new')
      queryClient.invalidateQueries()
      toast.success(`${account.riotId} added. The backfill starts on the next cycle.`)
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError && error.status === 404
          ? 'Riot does not know that Riot ID on that platform.'
          : 'Could not add that account.'
      ),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[14px]">Add an account</CardTitle>
      </CardHeader>

      <CardContent>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            add.mutate()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="riot-id">Riot ID</Label>
            <Input
              id="riot-id"
              value={riotId}
              onChange={(e) => setRiotId(e.target.value)}
              placeholder="Name#TAG"
              className="w-56"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="platform">Platform</Label>
            <Input
              id="platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-24"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="belongs-to">Belongs to</Label>
            <Select value={memberSlug} onValueChange={setMemberSlug}>
              <SelectTrigger id="belongs-to" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">A new member</SelectItem>
                {members.map(([slug, name]) => (
                  <SelectItem key={slug} value={slug}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={!riotId.includes('#') || add.isPending}>
            {add.isPending ? 'Resolving…' : 'Add'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

const STATE_VARIANT: Record<AdminAccount['backfillState'], string> = {
  done: 'text-win',
  running: 'text-accent',
  pending: 'text-ink-muted',
  failed: 'text-loss',
}

function AccountsCard({ accounts }: { accounts: AdminAccount[] }) {
  const queryClient = useQueryClient()
  const [pendingRemoval, setPendingRemoval] = useState<AdminAccount | null>(null)

  const resync = useMutation({
    mutationFn: api.resyncAccount,
    onSuccess: () => {
      queryClient.invalidateQueries()
      toast.success('Queued for a fresh backfill.')
    },
  })

  const remove = useMutation({
    mutationFn: api.removeAccount,
    onSuccess: () => {
      setPendingRemoval(null)
      queryClient.invalidateQueries()
      toast.success('Account removed. Its matches were kept.')
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[14px]">Accounts ({accounts.length})</CardTitle>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Riot ID</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Backfill</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell className="font-normal text-ink">
                  {account.riotId}
                  <span className="block text-[11px] text-ink-dim">
                    {account.platform}
                    {account.summonerLevel ? ` · level ${account.summonerLevel}` : ''}
                  </span>
                </TableCell>

                <TableCell className="text-ink-muted">{account.displayName}</TableCell>

                <TableCell>
                  <span className={STATE_VARIANT[account.backfillState]}>
                    {account.backfillState}
                  </span>
                  <span className="block text-[11px] text-ink-dim">
                    {account.lastSyncedAt ? timeAgo(account.lastSyncedAt) : 'never synced'}
                  </span>
                  {account.backfillState === 'failed' && account.backfillError && (
                    <span className="block text-[11px] text-loss">{account.backfillError}</span>
                  )}
                </TableCell>

                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => resync.mutate(account.id)}
                      aria-label={`Resync ${account.riotId}`}
                    >
                      <RefreshCwIcon className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingRemoval(account)}
                      aria-label={`Remove ${account.riotId}`}
                      className="hover:text-loss"
                    >
                      <Trash2Icon className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={pendingRemoval !== null} onOpenChange={() => setPendingRemoval(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {pendingRemoval?.riotId}?</DialogTitle>
            <DialogDescription>
              Their stored matches are kept — they belong to the rest of the group too. Re-adding
              this account later means backfilling it again, which is thousands of Riot requests.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingRemoval(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => pendingRemoval && remove.mutate(pendingRemoval.id)}
            >
              {remove.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'

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
          <span className="text-[13px] tracking-[0.14em] text-gold">PASEN ADMIN</span>
          {session.data?.authenticated && <SignOut email={session.data.email} />}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {session.isPending ? (
          <p className="text-[13px] text-ink-muted">Checking…</p>
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
      <button
        type="button"
        onClick={() => signOut.mutate()}
        className="border border-line-strong px-2 py-1 text-ink-muted hover:text-ink"
      >
        Sign out
      </button>
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
  })

  return (
    <form
      className="max-w-sm space-y-3"
      onSubmit={(event: FormEvent) => {
        event.preventDefault()
        signIn.mutate()
      }}
    >
      <h1 className="text-[15px]">Sign in</h1>

      <Field label="Email">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
          className="w-full bg-panel px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-gold"
        />
      </Field>

      <Field label="Password">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="w-full bg-panel px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-gold"
        />
      </Field>

      {signIn.isError && (
        <p className="text-[12px] text-loss">That email and password do not match.</p>
      )}

      <button
        type="submit"
        disabled={signIn.isPending}
        className="border border-line-strong px-3 py-2 text-[13px] text-ink hover:border-gold disabled:opacity-50"
      >
        {signIn.isPending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}

function Console() {
  const status = useQuery({
    queryKey: ['admin-status'],
    queryFn: api.adminStatus,
    // Backfills move while this page is open.
    refetchInterval: 15_000,
  })

  if (status.isPending) return <p className="text-[13px] text-ink-muted">Loading…</p>
  if (!status.data) return <p className="text-[13px] text-loss">Could not load status.</p>

  return (
    <div className="space-y-8">
      <RiotKeyPanel status={status.data.riotKey} budget={status.data.budget} />
      <AddAccountPanel accounts={status.data.accounts} />
      <AccountsPanel accounts={status.data.accounts} />
    </div>
  )
}

function RiotKeyPanel({
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
    },
  })

  return (
    <section>
      <h2 className="mb-2 text-[13px]">Riot API key</h2>

      {status.invalidSince && (
        <p className="mb-2 border-l-2 border-loss bg-panel px-3 py-2 text-[12px] text-ink-muted">
          Riot rejected this key {timeAgo(status.invalidSince)}. Development keys expire every
          24 hours — paste a fresh one below.
        </p>
      )}

      <div className="bg-panel px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[12px]">
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
          className="mt-3 flex gap-2"
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            save.mutate()
          }}
        >
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="RGAPI-…"
            autoComplete="off"
            className="min-w-0 flex-1 bg-panel-raised px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-gold"
          />
          <button
            type="submit"
            disabled={key.trim().length < 10 || save.isPending}
            className="shrink-0 border border-line-strong px-3 py-2 text-[12px] hover:border-gold disabled:opacity-40"
          >
            {save.isPending ? 'Saving…' : 'Rotate'}
          </button>
        </form>
        <p className="mt-1 text-[11px] text-ink-dim">
          Stored in the database, so every process picks it up without a restart. It is never
          shown again.
        </p>
      </div>
    </section>
  )
}

function AddAccountPanel({ accounts }: { accounts: AdminAccount[] }) {
  const queryClient = useQueryClient()
  const [riotId, setRiotId] = useState('')
  const [platform, setPlatform] = useState('euw1')
  const [memberSlug, setMemberSlug] = useState('')

  const members = [...new Map(accounts.map((a) => [a.memberSlug, a.displayName])).entries()]

  const add = useMutation({
    mutationFn: () =>
      api.addAccount(DEFAULT_GROUP, {
        riotId: riotId.trim(),
        platform,
        // An existing member wins over a typed name, so attaching a smurf cannot
        // quietly create a second person.
        memberSlug: memberSlug || undefined,
      }),
    onSuccess: () => {
      setRiotId('')
      setMemberSlug('')
      queryClient.invalidateQueries()
    },
  })

  return (
    <section>
      <h2 className="mb-2 text-[13px]">Add an account</h2>

      <form
        className="flex flex-wrap items-end gap-2 bg-panel px-4 py-3"
        onSubmit={(event: FormEvent) => {
          event.preventDefault()
          add.mutate()
        }}
      >
        <Field label="Riot ID">
          <input
            value={riotId}
            onChange={(e) => setRiotId(e.target.value)}
            placeholder="Name#TAG"
            required
            className="w-56 bg-panel-raised px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-gold"
          />
        </Field>

        <Field label="Platform">
          <input
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-24 bg-panel-raised px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-gold"
          />
        </Field>

        <Field label="Belongs to">
          <select
            value={memberSlug}
            onChange={(e) => setMemberSlug(e.target.value)}
            className="w-44 bg-panel-raised px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-gold"
          >
            <option value="">A new member</option>
            {members.map(([slug, name]) => (
              <option key={slug} value={slug}>
                {name}
              </option>
            ))}
          </select>
        </Field>

        <button
          type="submit"
          disabled={!riotId.includes('#') || add.isPending}
          className="border border-line-strong px-3 py-2 text-[12px] hover:border-gold disabled:opacity-40"
        >
          {add.isPending ? 'Resolving…' : 'Add'}
        </button>

        {add.isError && (
          <p className="w-full text-[12px] text-loss">
            {add.error instanceof ApiError && add.error.status === 404
              ? 'Riot does not know that Riot ID on that platform.'
              : 'Could not add that account.'}
          </p>
        )}
      </form>
    </section>
  )
}

const STATE_TONE: Record<AdminAccount['backfillState'], string> = {
  done: 'text-win',
  running: 'text-gold',
  pending: 'text-ink-muted',
  failed: 'text-loss',
}

function AccountsPanel({ accounts }: { accounts: AdminAccount[] }) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries()

  const resync = useMutation({ mutationFn: api.resyncAccount, onSuccess: invalidate })
  const remove = useMutation({ mutationFn: api.removeAccount, onSuccess: invalidate })

  return (
    <section>
      <h2 className="mb-2 text-[13px]">Accounts ({accounts.length})</h2>

      <div className="space-y-px">
        {accounts.map((account) => (
          <div key={account.id} className="flex items-center gap-3 bg-panel px-4 py-2 text-[12px]">
            <div className="min-w-0 flex-1">
              <div className="truncate text-ink">{account.riotId}</div>
              <div className="truncate text-[11px] text-ink-muted">
                {account.displayName} · {account.platform}
                {account.summonerLevel ? ` · level ${account.summonerLevel}` : ''}
              </div>
            </div>

            <div className="w-40 shrink-0 text-right">
              <div className={STATE_TONE[account.backfillState]}>{account.backfillState}</div>
              <div className="text-[11px] text-ink-dim">
                {account.lastSyncedAt ? `synced ${timeAgo(account.lastSyncedAt)}` : 'never synced'}
              </div>
            </div>

            <button
              type="button"
              onClick={() => resync.mutate(account.id)}
              className="shrink-0 border border-line-strong px-2 py-1 text-ink-muted hover:text-ink"
            >
              Resync
            </button>
            <button
              type="button"
              onClick={() => {
                // Removing an account is not undoable without re-adding and
                // re-backfilling it, which costs thousands of Riot requests.
                if (confirm(`Remove ${account.riotId}? Stored matches are kept.`)) {
                  remove.mutate(account.id)
                }
              }}
              className="shrink-0 border border-line-strong px-2 py-1 text-ink-muted hover:text-loss"
            >
              Remove
            </button>
          </div>
        ))}

        {accounts.map((account) =>
          account.backfillError ? (
            <p key={`err-${account.id}`} className="bg-panel px-4 py-2 text-[11px] text-loss">
              {account.riotId}: {account.backfillError}
            </p>
          ) : null
        )}
      </div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-[0.08em] text-ink-dim">
        {label}
      </span>
      {children}
    </label>
  )
}

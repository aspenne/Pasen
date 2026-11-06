import { Link, createFileRoute } from '@tanstack/react-router'
import { SITE_SCOPE } from '@pasen/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { AccountForms } from '@/components/account/AccountForms'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api, type Session } from '@/lib/api'

export const Route = createFileRoute('/account')({ component: Account })

const DEFAULT_GROUP = import.meta.env.VITE_DEFAULT_GROUP ?? 'arigafion'

/** Where anyone signs in or opens an account, and sees what it can do. */
function Account() {
  const session = useQuery({ queryKey: ['session'], queryFn: api.session })

  return (
    <div className="min-h-screen bg-ground text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-4xl items-baseline gap-4 px-4 py-3">
          <span className="text-[13px] tracking-[0.14em] text-accent">PASEN</span>
          <Link
            to="/$group"
            params={{ group: DEFAULT_GROUP }}
            search={{ scope: SITE_SCOPE }}
            className="tap inline-flex items-center text-[12px] text-ink-dim transition-colors hover:text-ink"
          >
            ← Back to the site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {session.isPending ? (
          <Skeleton className="h-32 max-w-sm" />
        ) : session.data?.authenticated ? (
          <YourAccount session={session.data} />
        ) : (
          <AccountForms />
        )}
      </main>
    </div>
  )
}

function YourAccount({ session }: { session: Session }) {
  const queryClient = useQueryClient()
  const signOut = useMutation({
    mutationFn: api.signOut,
    onSuccess: () => queryClient.invalidateQueries(),
  })

  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle className="text-[15px]">{session.fullName ?? 'Your account'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-[13px]">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
          <dt className="text-ink-dim">Email</dt>
          <dd className="truncate text-ink">{session.email}</dd>

          <dt className="text-ink-dim">Role</dt>
          <dd className={session.admin ? 'text-accent' : 'text-ink'}>{session.admin ? 'Admin' : 'Member'}</dd>

          <dt className="text-ink-dim">Player</dt>
          <dd>
            {session.memberSlug ? (
              <Link
                to="/$group/players/$member"
                params={{ group: DEFAULT_GROUP, member: session.memberSlug }}
                search={{ scope: SITE_SCOPE }}
                className="text-ink underline-offset-2 hover:underline"
              >
                {session.memberName ?? session.memberSlug}
              </Link>
            ) : (
              <span className="text-ink-muted">Not linked yet: an admin links your account to your player.</span>
            )}
          </dd>
        </dl>

        <div className="flex gap-2">
          {session.admin && (
            <Button asChild size="sm">
              <Link to="/admin">Open the admin</Link>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => signOut.mutate()}>
            Sign out
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

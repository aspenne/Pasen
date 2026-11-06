import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, ApiError, type AdminAccount, type UserRole } from '@/lib/api'
import { timeAgo } from '@/lib/format'

/** Select items cannot carry an empty value, so "no player" needs a name. */
const NO_PLAYER = '__none'

/**
 * Everyone with an account: what they may do, and which player they are.
 * Promoting someone is one click; the server refuses an admin demoting
 * themself, so the select for your own role is not offered.
 */
export function Users({ accounts, self }: { accounts: AdminAccount[]; self: string | null }) {
  const queryClient = useQueryClient()
  const users = useQuery({ queryKey: ['admin-users'], queryFn: api.users })

  // The players, once each, from the tracked accounts.
  const players = [...new Map(accounts.map((account) => [account.memberSlug, account.displayName])).entries()].sort(
    ([, a], [, b]) => a.localeCompare(b)
  )

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: { role?: UserRole; memberSlug?: string | null } }) =>
      api.updateUser(id, patch),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['session'] })
      toast.success(`${user.fullName ?? user.email} saved.`)
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError && error.status === 409
          ? 'You cannot take your own admin rights away.'
          : 'That did not go through.'
      ),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[14px]">Users ({users.data?.users.length ?? '…'})</CardTitle>
        <CardDescription>
          Anyone can open an account from the site; it starts as a member, who sees what a visitor
          sees. Make someone an admin and they get this page.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {users.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="text-right">Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data?.users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-normal text-ink">
                    {user.fullName ?? user.email}
                    <span className="block text-[11px] text-ink-dim">
                      {user.fullName ? `${user.email} · ` : ''}joined {timeAgo(user.createdAt)}
                    </span>
                  </TableCell>

                  <TableCell>
                    <Select
                      value={user.memberSlug ?? NO_PLAYER}
                      onValueChange={(value) =>
                        update.mutate({ id: user.id, patch: { memberSlug: value === NO_PLAYER ? null : value } })
                      }
                    >
                      <SelectTrigger size="sm" className="w-40" aria-label={`Player for ${user.email}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_PLAYER}>Not linked</SelectItem>
                        {players.map(([slug, name]) => (
                          <SelectItem key={slug} value={slug}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  <TableCell className="text-right">
                    {user.email === self ? (
                      <span className="text-[12px] text-accent">Admin · you</span>
                    ) : (
                      <Select
                        value={user.role}
                        onValueChange={(role) => update.mutate({ id: user.id, patch: { role: role as UserRole } })}
                      >
                        <SelectTrigger size="sm" className="ml-auto w-28" aria-label={`Role for ${user.email}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

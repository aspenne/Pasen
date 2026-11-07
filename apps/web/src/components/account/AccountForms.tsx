import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api, ApiError } from '@/lib/api'

/** As long as the server asks for, so the form says so before it is sent. */
export const MIN_PASSWORD = 12

/**
 * Signing in and signing up, one card. Both end the same way: the session
 * query is refetched, and whatever page holds the card renders for whoever is
 * now signed in.
 */
export function AccountForms({ initial = 'sign-in' }: { initial?: 'sign-in' | 'sign-up' }) {
  return (
    <Card className="max-w-sm">
      <Tabs defaultValue={initial}>
        <CardHeader>
          <TabsList>
            <TabsTrigger value="sign-in">Sign in</TabsTrigger>
            <TabsTrigger value="sign-up">Create an account</TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent>
          <TabsContent value="sign-in">
            <SignInForm />
          </TabsContent>
          <TabsContent value="sign-up">
            <SignUpForm />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  )
}

function SignInForm() {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const signIn = useMutation({
    mutationFn: () => api.signIn(email, password),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: () => toast.error('That email and password do not match.'),
  })

  return (
    <form
      className="space-y-3"
      onSubmit={(event: FormEvent) => {
        event.preventDefault()
        signIn.mutate()
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="sign-in-email">Email</Label>
        <Input
          id="sign-in-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sign-in-password">Password</Label>
        <Input
          id="sign-in-password"
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
  )
}

function SignUpForm() {
  const queryClient = useQueryClient()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const signUp = useMutation({
    mutationFn: () => api.signUp({ email, password, fullName: fullName.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries()
      toast.success('Account created. You are signed in.')
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError && error.status === 409
          ? 'An account already uses that email.'
          : 'That did not go through. Check the email and password.'
      ),
  })

  return (
    <form
      className="space-y-3"
      onSubmit={(event: FormEvent) => {
        event.preventDefault()
        signUp.mutate()
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="sign-up-name">Name</Label>
        <Input
          id="sign-up-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="nickname"
          maxLength={60}
          placeholder="How the group knows you"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sign-up-email">Email</Label>
        <Input
          id="sign-up-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sign-up-password">Password</Label>
        <Input
          id="sign-up-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={MIN_PASSWORD}
          required
        />
        <CardDescription className="text-[11px]">At least {MIN_PASSWORD} characters.</CardDescription>
      </div>

      <Button type="submit" disabled={signUp.isPending} className="w-full">
        {signUp.isPending ? 'Creating…' : 'Create the account'}
      </Button>
      <p className="text-[11px] text-ink-dim">
        A new account is a member’s. An admin can give it more rights.
      </p>
    </form>
  )
}

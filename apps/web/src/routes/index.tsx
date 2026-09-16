import { createFileRoute, redirect } from '@tanstack/react-router'

const DEFAULT_GROUP = import.meta.env.VITE_DEFAULT_GROUP ?? 'arigafion'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/$group', params: { group: DEFAULT_GROUP } })
  },
})

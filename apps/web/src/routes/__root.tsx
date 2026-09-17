import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'

import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
})

function RootLayout() {
  return (
    // delayDuration shorter than the default: these tooltips carry numbers
    // people are scanning for, not explanations they are waiting on.
    <TooltipProvider delayDuration={200}>
      <Outlet />
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}

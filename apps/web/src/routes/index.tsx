import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import { health } from '@/lib/api'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const { data, error, isPending } = useQuery({
    queryKey: ['health'],
    queryFn: health,
  })

  return (
    <section>
      <h1 className="text-lg">Backend connectivity</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Phase 0 check: the browser reaches the API, and the API reaches Postgres and Redis.
      </p>

      <div className="mt-4 border-l-2 border-gold bg-panel px-4 py-3 text-sm">
        {isPending && <span className="text-ink-muted">Checking…</span>}
        {error && <span className="text-loss">Unreachable: {error.message}</span>}
        {data && (
          <ul className="space-y-1">
            <li>
              API <StatusDot ok={true} /> reachable
            </li>
            <li>
              Postgres <StatusDot ok={data.checks.database.ok} />{' '}
              {data.checks.database.error ?? 'connected'}
            </li>
            <li>
              Redis <StatusDot ok={data.checks.redis.ok} />{' '}
              {data.checks.redis.error ?? 'connected'}
            </li>
          </ul>
        )}
      </div>
    </section>
  )
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      aria-label={ok ? 'ok' : 'failing'}
      className={`inline-block size-1.5 rounded-full align-middle ${ok ? 'bg-win' : 'bg-loss'}`}
    />
  )
}

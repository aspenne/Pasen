const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333'

export class ApiError extends Error {
  // Written out rather than declared as a constructor parameter property:
  // `erasableSyntaxOnly` forbids syntax that emits runtime code from types.
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/**
 * Every call carries credentials because the admin session is cookie-based, and
 * surfaces a non-2xx as a thrown ApiError so TanStack Query treats it as a
 * failure instead of caching an error body as data.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new ApiError(response.status, body || response.statusText)
  }

  return response.json() as Promise<T>
}

export type HealthResponse = {
  status: 'ok' | 'degraded'
  checks: {
    database: { ok: boolean; error?: string }
    redis: { ok: boolean; error?: string }
  }
}

export const health = () => apiFetch<HealthResponse>('/health')

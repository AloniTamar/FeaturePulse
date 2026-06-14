const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

function getToken() { return localStorage.getItem('fp_token') }
export function setToken(t: string) { localStorage.setItem('fp_token', t) }
export function clearToken() {
  localStorage.removeItem('fp_token')
  localStorage.removeItem('fp_email')
}
export function isLoggedIn() { return !!getToken() }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; apps: AppSummary[] }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string) =>
    request<{ token: string }>('/auth/register', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>('/auth/me/password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) }),

  deleteAccount: () =>
    request<void>('/auth/me', { method: 'DELETE' }),

  listApps: () =>
    request<AppSummary[]>('/apps'),

  createApp: (name: string, packageName: string) =>
    request<AppSummary>('/apps', { method: 'POST', body: JSON.stringify({ name, packageName }) }),

  renameApp: (appId: string, name: string) =>
    request<AppSummary>(`/apps/${appId}`, { method: 'PATCH', body: JSON.stringify({ name }) }),

  deleteApp: (appId: string) =>
    request<void>(`/apps/${appId}`, { method: 'DELETE' }),

  getDashboard: (appId: string) =>
    request<{ counts: Record<string, number>; recentTransitions: unknown[] }>(`/apps/${appId}/dashboard`),

  getFeatures: (appId: string, params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request<{ data: Feature[]; pagination: Pagination }>(`/apps/${appId}/features${qs ? `?${qs}` : ''}`)
  },

  getFeature: (featureId: string) =>
    request<Feature>(`/features/${featureId}`),

  getTimeline: (featureId: string, days = 30) =>
    request<TimelineRow[]>(`/features/${featureId}/timeline?days=${days}`),

  ignoreFeature: (featureId: string, ignore: boolean) =>
    request<Feature>(`/features/${featureId}/ignore`, { method: 'PATCH', body: JSON.stringify({ ignore }) }),

  getTrend: (appId: string, days = 30) =>
    request<TrendPoint[]>(`/apps/${appId}/trend?days=${days}`),

  getDeadFeatures: (appId: string) =>
    request<Feature[]>(`/apps/${appId}/dead`),

  exportFeatures: (appId: string, format: 'json' | 'csv') =>
    `${BASE}/api/v1/apps/${appId}/export?format=${format}`,
}

export interface AppSummary {
  id: string
  name: string
  packageName: string
  apiKey: string
  createdAt: string
  featureCount: number
}

export interface Feature {
  id: string; appId: string; elementType: string; resourceName: string | null
  screenName: string; state: 'THRIVING' | 'DECLINING' | 'DORMANT' | 'DEAD'
  lastInteraction: string | null; firstSeen: string; isIgnored: boolean
  daysSinceLastUse: number | null
}

export interface TimelineRow {
  featureId: string; date: string; impressions: number
  interactions: number; uniqueUsers: number; interactionRate: number
}

export interface Pagination { page: number; limit: number; total: number }
export interface TrendPoint { date: string; avgInteractionRate: number }

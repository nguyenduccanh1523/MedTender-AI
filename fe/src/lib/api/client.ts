export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

let refreshInFlight: Promise<boolean> | undefined
let sessionRevision = 0

function request(path: string, options: RequestInit) {
  const headers = new Headers(options.headers)
  headers.set('x-medtender-request', 'web')
  if (options.body) headers.set('Content-Type', 'application/json')
  return fetch(`/api/v1${path}`, { ...options, headers, cache: 'no-store', credentials: 'same-origin' })
}

function refreshSession() {
  return refreshInFlight ??= request('/auth/refresh', { method: 'POST' })
    .then((response) => {
      if (response.ok) sessionRevision += 1
      return response.ok
    })
    .finally(() => { refreshInFlight = undefined })
}

export async function api<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const revision = sessionRevision
  let response: Response
  try {
    response = await request(path, options)
    if (response.status === 401 && retry && (revision !== sessionRevision || await refreshSession())) {
      response = await request(path, options)
    }
  } catch {
    throw new ApiError(0, 'Không kết nối được. Vui lòng thử lại.')
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const fallback = response.status >= 500
      ? 'Dịch vụ hiện chưa sẵn sàng. Vui lòng thử lại.'
      : 'Yêu cầu không thực hiện được. Vui lòng thử lại.'
    throw new ApiError(response.status, typeof body?.message === 'string' ? body.message : fallback)
  }

  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}

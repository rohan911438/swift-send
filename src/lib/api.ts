/** Base URL for the API. When unset, `/api/*` is proxied to the backend in dev (see `vite.config.ts`). */
export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const base = import.meta.env.VITE_API_URL as string | undefined;
  if (base?.length) {
    return `${base.replace(/\/$/, '')}${normalized}`;
  }
  return `/api${normalized}`;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(apiUrl(path), {
    ...init,
    credentials: 'include',
    headers,
  });
}

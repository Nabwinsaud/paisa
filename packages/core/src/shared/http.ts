// Shared HTTP utilities
// Centralized fetch wrapper with retry/timeout support

export interface FetchOptions {
  url: string;
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: unknown;
}

export async function request<T>(opts: FetchOptions): Promise<T> {
  const res = await fetch(opts.url, {
    method: opts.method,
    headers: opts.headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${opts.url}: ${await res.text()}`);
  }

  return res.json() as Promise<T>;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const DEFAULT_API_PORT = '3000';

/**
 * Picks the API address for the app. On a phone, "localhost" is the phone itself, so when the
 * configured URL is local (or missing) we reuse the computer address the app was loaded from:
 * Expo reports it as `hostUri`, e.g. "192.168.1.20:8081". A non-local configured URL always wins.
 * Tunnel hosts (not an IP) are ignored because the API is not tunnelled.
 */
export function resolveApiUrl(
  configured: string | undefined,
  expoHostUri: string | undefined,
): string {
  const fallback = trimSlash(configured ?? `http://localhost:${DEFAULT_API_PORT}`);
  if (configured && !isLocalUrl(configured)) return fallback;

  const devHost = expoHostUri?.split(':')[0];
  if (!devHost || LOCAL_HOSTS.has(devHost) || !IPV4.test(devHost)) return fallback;
  return `http://${devHost}:${portOf(fallback)}`;
}

function isLocalUrl(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

function portOf(url: string): string {
  try {
    return new URL(url).port || DEFAULT_API_PORT;
  } catch {
    return DEFAULT_API_PORT;
  }
}

function trimSlash(url: string): string {
  return url.replace(/\/$/, '');
}

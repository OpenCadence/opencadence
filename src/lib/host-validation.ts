const loopbackHosts = ["localhost", "127.0.0.1", "[::1]"];

function hostname(value: string): string | null {
  const candidate = value.trim();
  if (!candidate || /[\s,\\/?#@]/.test(candidate)) return null;
  try {
    return new URL(`http://${candidate}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isAllowedRequestHost(
  hostHeader: string | null,
  configuredHosts = process.env.CADENCE_ALLOWED_HOSTS,
): boolean {
  if (!hostHeader) return false;
  const requestHostname = hostname(hostHeader);
  if (!requestHostname) return false;

  const allowed = new Set(loopbackHosts);
  for (const value of configuredHosts?.split(",") ?? []) {
    const configuredHostname = hostname(value);
    if (configuredHostname) allowed.add(configuredHostname);
  }
  return allowed.has(requestHostname);
}

/**
 * Cheap, client-safe validation for IMAGE template overrides.
 * Server must additionally resolve the destination with isDeliverableUrl.
 * This function never fetches the URL or follows redirects.
 */
export function isValidHttpsImageUrl(value: string): boolean {
  if (typeof value !== 'string' || value.length > 2048 || !value.trim() || value !== value.trim()) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.port || url.hash) return false;
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
        host.endsWith('.internal') || host.endsWith('.test') || host.endsWith('.invalid')) return false;
    // Block IP literals: hostnames are expected for media CDN URLs.
    if (host.startsWith('[') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return false;
    if (!host.includes('.') || host.startsWith('.') || host.endsWith('.')) return false;
    return true;
  } catch {
    return false;
  }
}

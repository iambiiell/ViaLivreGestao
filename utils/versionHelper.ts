/**
 * Version Management & Comparison Utilities
 */

export const APP_VERSION = '1.5.0';

/**
 * Normalizes a version string into an array of numeric components: [major, minor, patch]
 * Examples: "v1.5.0" -> [1, 5, 0], "1.6" -> [1, 6, 0], "v2.0.1-beta" -> [2, 0, 1]
 */
export function parseVersion(versionStr: string): number[] {
  if (!versionStr) return [0, 0, 0];
  const cleaned = versionStr.trim().replace(/^[vV]/, '').split(/[-+]/)[0];
  const parts = cleaned.split('.').map(p => {
    const n = parseInt(p, 10);
    return isNaN(n) ? 0 : n;
  });
  while (parts.length < 3) {
    parts.push(0);
  }
  return parts.slice(0, 3);
}

/**
 * Compares two semantic version strings.
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 */
export function compareVersions(v1: string, v2: string): number {
  const [maj1, min1, pat1] = parseVersion(v1);
  const [maj2, min2, pat2] = parseVersion(v2);

  if (maj1 !== maj2) return maj1 > maj2 ? 1 : -1;
  if (min1 !== min2) return min1 > min2 ? 1 : -1;
  if (pat1 !== pat2) return pat1 > pat2 ? 1 : -1;
  return 0;
}

/**
 * Checks if a remote/published release tag is strictly newer than current app version.
 */
export function isNewerVersion(remoteTag: string, currentVersion: string = APP_VERSION): boolean {
  if (!remoteTag) return false;
  return compareVersions(remoteTag, currentVersion) > 0;
}

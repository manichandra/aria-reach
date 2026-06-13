/**
 * Library Reach Index (LRI).
 *
 * LRI(L) = Dw(L) x A(L)
 *   Dw = weekly npm downloads (public proxy for ecosystem reach)
 *   A  = estimated unique active deployments per weekly download
 *        (illustrative sensitivity parameter; default 0.1)
 *
 * From: "ARIA Anti-Patterns in Shared Component Libraries: A Taxonomy and
 * Force-Multiplied Remediation Strategy for Screen Reader Accessibility".
 * The LRI is an order-of-magnitude prioritization instrument, not a
 * precise measurement.
 */

export interface ReachRow {
  pkg: string;
  weeklyDownloads: number;
  aHat: number;
  lri: number;
}

const NPM_DOWNLOADS_API = 'https://api.npmjs.org/downloads/point/last-week';

export async function packageReach(pkg: string, aHat = 0.1): Promise<ReachRow> {
  const url = `${NPM_DOWNLOADS_API}/${pkg.split('/').map(encodeURIComponent).join('/')}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`npm downloads API returned ${res.status} for "${pkg}"`);
  }
  const data = (await res.json()) as { downloads?: number };
  const weeklyDownloads = data.downloads ?? 0;
  return { pkg, weeklyDownloads, aHat, lri: Math.round(weeklyDownloads * aHat) };
}

export async function reach(pkgs: string[], aHat = 0.1): Promise<ReachRow[]> {
  return Promise.all(pkgs.map((p) => packageReach(p, aHat)));
}

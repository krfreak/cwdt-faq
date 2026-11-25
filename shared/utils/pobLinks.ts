// Build links Path of Building can import from, with the URL it downloads the raw build code from.
// Mirrors PoB's own list (src/Modules/BuildSiteTools.lua, buildSites.websiteList).
//
// Only the build id is taken from a pasted link; the download URL is always built from the fixed
// template below, so the server route that fetches it (server/api/pob-link.get.ts) can only ever
// reach these sites.

export interface PobLinkSite {
  label: string;
  /** Matches a pasted link; group 1 is the build id */
  pattern: RegExp;
  download: (id: string) => string;
}

// Build ids are letters, digits, '-' and '_'; pobb.in also has user builds (u/<user>/<name>).
const ID = '[A-Za-z0-9_-]{1,64}';

export const POB_LINK_SITES: PobLinkSite[] = [
  { label: 'pobb.in', pattern: new RegExp(`^https?://pobb\\.in/((?:u/${ID}/)?${ID})/?$`), download: (id) => `https://pobb.in/pob/${id}` },
  { label: 'poe.ninja', pattern: new RegExp(`^https?://poe\\.ninja/(?:poe1/)?pob/(${ID})/?$`), download: (id) => `https://poe.ninja/poe1/pob/raw/${id}` },
  { label: 'pob.codes', pattern: new RegExp(`^https?://pob\\.codes/b/(${ID})/?(?:\\?.*)?$`), download: (id) => `https://api.pob.codes/${id}/raw` },
  { label: 'Maxroll', pattern: new RegExp(`^https?://maxroll\\.gg/poe/pob/(${ID})/?$`), download: (id) => `https://maxroll.gg/poe/api/pob/${id}` },
  { label: 'poedb.tw', pattern: new RegExp(`^https?://poedb\\.tw/pob/(${ID})/?$`), download: (id) => `https://poedb.tw/pob/${id}/raw` },
  { label: 'Pastebin', pattern: new RegExp(`^https?://pastebin\\.com/(?:raw/)?(${ID})/?$`), download: (id) => `https://pastebin.com/raw/${id}` },
  { label: 'PastebinP', pattern: new RegExp(`^https?://pastebinp\\.com/(?:raw/)?(${ID})/?$`), download: (id) => `https://pastebinp.com/raw/${id}` },
  { label: 'Rentry', pattern: new RegExp(`^https?://rentry\\.co/(${ID})/?$`), download: (id) => `https://rentry.co/paste/${id}/raw` },
];

export interface ParsedPobLink {
  site: PobLinkSite;
  id: string;
  downloadUrl: string;
}

/** Returns the site and download URL for a supported build link, or null. */
export function parsePobLink(text: string): ParsedPobLink | null {
  const url = text.trim().replace(/^(https?:\/\/)www\./i, '$1');
  for (const site of POB_LINK_SITES) {
    const m = site.pattern.exec(url);
    if (m?.[1]) return { site, id: m[1], downloadUrl: site.download(m[1]) };
  }
  return null;
}

export const isLink = (text: string) => /^https?:\/\//i.test(text.trim());

export const supportedLinkSites = POB_LINK_SITES.map((s) => s.label).join(', ');

// Downloads the build code behind a PoB build link (pobb.in, poe.ninja, ...), for the PoB checker.
//
// Most build sites do not allow cross-origin requests, so the browser cannot fetch them itself.
// This route only ever fetches URLs built from the fixed templates in shared/utils/pobLinks.ts;
// the pasted link only contributes a validated build id.
import { parsePobLink } from '#shared/utils/pobLinks';

const TIMEOUT_MS = 10_000;
/** Real build codes are well under 200 KB */
const MAX_BYTES = 1024 * 1024;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 200;

const cache = new Map<string, { code: string; expires: number }>();

function remember(url: string, code: string) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(url, { code, expires: Date.now() + CACHE_TTL_MS });
}

async function readLimited(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let text = '';
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw createError({ statusCode: 502, statusMessage: 'The build site returned more data than a PoB code.' });
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

export default defineEventHandler(async (event) => {
  const { url } = getQuery(event);
  const link = typeof url === 'string' ? parsePobLink(url) : null;
  if (!link) {
    throw createError({ statusCode: 400, statusMessage: 'That link is not a supported PoB build link.' });
  }

  const cached = cache.get(link.downloadUrl);
  if (cached && cached.expires > Date.now()) return { code: cached.code };

  let res: Response;
  try {
    res = await fetch(link.downloadUrl, {
      headers: { 'user-agent': 'CWDT FAQ PoB checker', accept: 'text/plain, */*' },
      // The templates point at the final download URLs; refuse to be redirected anywhere else
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw createError({ statusCode: 502, statusMessage: `Could not reach ${link.site.label}. Try again, or paste the PoB code instead.` });
  }
  if (res.status === 404 || res.status === 400) {
    throw createError({ statusCode: 404, statusMessage: `${link.site.label} has no build at that link.` });
  }
  if (!res.ok) {
    throw createError({ statusCode: 502, statusMessage: `${link.site.label} answered with an error (${res.status}). Try again, or paste the PoB code instead.` });
  }

  const code = (await readLimited(res)).trim();
  // A PoB code is base64url text; anything else (an HTML page, an error message) is not a build
  if (!code || !/^[A-Za-z0-9+/=_-]+$/.test(code.replace(/\s+/g, ''))) {
    throw createError({ statusCode: 502, statusMessage: `${link.site.label} did not return a PoB code for that link.` });
  }
  remember(link.downloadUrl, code);
  return { code };
});

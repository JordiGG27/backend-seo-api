import axios from 'axios';

const CHECK_TIMEOUT_MS = 6000;
const MAX_LINKS_TO_CHECK = 15;
const CONCURRENCY = 5;

const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; SEOAuditBot/1.0)',
};

function describeError(err) {
  if (err.code === 'ECONNABORTED') return 'Timeout: el enlace tardó demasiado en responder';
  if (err.code === 'ENOTFOUND') return 'Dominio no resuelto (DNS)';
  if (err.code === 'ECONNREFUSED') return 'Conexión rechazada por el servidor';
  return err.message;
}

async function checkLink(url) {
  try {
    const response = await axios.get(url, {
      timeout: CHECK_TIMEOUT_MS,
      maxRedirects: 5,
      validateStatus: () => true,
      headers: REQUEST_HEADERS,
      responseType: 'stream',
    });
    response.data.destroy();
    return { url, status: response.status, ok: response.status < 400 };
  } catch (err) {
    return { url, status: err.response?.status || null, ok: false, error: describeError(err) };
  }
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;

  async function next() {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
  return results;
}

export async function checkBrokenLinks(internalUrls) {
  const uniqueUrls = [...new Set(internalUrls)];
  const truncated = uniqueUrls.length > MAX_LINKS_TO_CHECK;
  const urlsToCheck = uniqueUrls.slice(0, MAX_LINKS_TO_CHECK);

  const results = await runWithConcurrency(urlsToCheck, CONCURRENCY, checkLink);
  const brokenLinks = results.filter((r) => !r.ok);

  return {
    totalInternalLinksFound: uniqueUrls.length,
    checked: results.length,
    truncated,
    brokenCount: brokenLinks.length,
    brokenLinks,
  };
}

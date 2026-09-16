import { scrapeSEOData } from '../../lib/scraper';
import { getPageSpeedData } from '../../lib/pagespeed';

function normalizeUrl(rawUrl) {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    return parsed.toString();
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido. Usa GET o POST.' });
  }

  const rawUrl = req.method === 'GET' ? req.query.url : req.body?.url;
  const targetUrl = normalizeUrl(rawUrl);

  if (!targetUrl) {
    return res.status(400).json({
      success: false,
      error: 'URL inválida o ausente. Envía un parámetro "url" válido, ej: ?url=https://ejemplo.com',
    });
  }

  const [scrapeResult, pageSpeedResult] = await Promise.allSettled([
    scrapeSEOData(targetUrl),
    getPageSpeedData(targetUrl),
  ]);

  if (scrapeResult.status === 'rejected') {
    const err = scrapeResult.reason;
    const isTimeout = err.code === 'ECONNABORTED';
    const isNotFound = err.code === 'ENOTFOUND' || err.response?.status === 404;
    const isBlocked = err.response?.status === 403 || err.response?.status === 429;

    let message = 'No se pudo analizar la página.';
    if (isTimeout) message = 'La página tardó demasiado en responder (timeout).';
    else if (isNotFound) message = 'No se encontró la URL indicada.';
    else if (isBlocked) message = 'El sitio bloqueó la petición de análisis (403/429).';
    else if (err.response?.status) message = `El servidor respondió con estado ${err.response.status}.`;

    return res.status(422).json({
      success: false,
      url: targetUrl,
      error: message,
      details: err.message,
    });
  }

  const response = {
    success: true,
    url: targetUrl,
    analyzedAt: new Date().toISOString(),
    seo: scrapeResult.value,
    performance:
      pageSpeedResult.status === 'fulfilled'
        ? pageSpeedResult.value
        : {
            mobile: { error: 'PageSpeed no disponible', score: null, coreWebVitals: null },
            desktop: { error: 'PageSpeed no disponible', score: null, coreWebVitals: null },
          },
  };

  return res.status(200).json(response);
}

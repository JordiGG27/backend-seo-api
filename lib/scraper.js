const axios = require('axios');
const cheerio = require('cheerio');

const REQUEST_TIMEOUT_MS = 10000;
const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

function toAbsoluteUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractHeadings($) {
  const headings = [];
  $(HEADING_TAGS.join(', ')).each((_, el) => {
    const tag = el.tagName.toLowerCase();
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text) {
      headings.push({ level: Number(tag[1]), tag, text });
    }
  });
  return headings;
}

function extractImages($, baseUrl) {
  const images = $('img');
  const missingAlt = [];

  images.each((_, el) => {
    const alt = $(el).attr('alt');
    const src = $(el).attr('src') || $(el).attr('data-src');
    if (!alt || !alt.trim()) {
      const absoluteSrc = src ? toAbsoluteUrl(src, baseUrl) : null;
      missingAlt.push(absoluteSrc || src || '(sin src)');
    }
  });

  return {
    total: images.length,
    missingAltCount: missingAlt.length,
    missingAltUrls: missingAlt,
  };
}

function extractLinks($, baseUrl) {
  const baseHost = new URL(baseUrl).hostname;
  let internal = 0;
  let external = 0;

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
      return;
    }
    const absolute = toAbsoluteUrl(href, baseUrl);
    if (!absolute) return;

    try {
      const linkHost = new URL(absolute).hostname;
      if (linkHost === baseHost) internal += 1;
      else external += 1;
    } catch {
      // href no parseable, se ignora
    }
  });

  return { internal, external, total: internal + external };
}

async function scrapeSEOData(targetUrl) {
  const response = await axios.get(targetUrl, {
    timeout: REQUEST_TIMEOUT_MS,
    maxRedirects: 5,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 SEOAuditBot/1.0',
      Accept: 'text/html,application/xhtml+xml',
    },
    validateStatus: (status) => status < 400,
  });

  const html = response.data;
  const $ = cheerio.load(html);
  const finalUrl = response.request?.res?.responseUrl || targetUrl;

  const title = $('title').first().text().trim();
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() || '';
  const canonical = $('link[rel="canonical"]').attr('href') || null;
  const lang = $('html').attr('lang') || null;

  return {
    onPage: {
      title: {
        text: title,
        length: title.length,
      },
      metaDescription: {
        text: metaDescription,
        length: metaDescription.length,
      },
      headings: extractHeadings($),
    },
    images: extractImages($, finalUrl),
    links: extractLinks($, finalUrl),
    technical: {
      lang,
      canonical: {
        present: Boolean(canonical),
        url: canonical,
      },
      isHttps: finalUrl.startsWith('https://'),
      finalUrl,
    },
  };
}

module.exports = { scrapeSEOData };

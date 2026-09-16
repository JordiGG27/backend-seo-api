import axios from 'axios';

const PAGESPEED_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const PAGESPEED_TIMEOUT_MS = 30000;

function extractCoreWebVitals(data) {
  const metrics = data?.loadingExperience?.metrics || data?.originLoadingExperience?.metrics;
  const audits = data?.lighthouseResult?.audits;

  return {
    lcp: metrics?.LARGEST_CONTENTFUL_PAINT_MS?.percentile
      ? `${(metrics.LARGEST_CONTENTFUL_PAINT_MS.percentile / 1000).toFixed(1)}s`
      : audits?.['largest-contentful-paint']?.displayValue || null,
    cls: metrics?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile
      ? (metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100).toFixed(2)
      : audits?.['cumulative-layout-shift']?.displayValue || null,
    inp: metrics?.INTERACTION_TO_NEXT_PAINT?.percentile
      ? `${metrics.INTERACTION_TO_NEXT_PAINT.percentile}ms`
      : null,
    fcp: audits?.['first-contentful-paint']?.displayValue || null,
    speedIndex: audits?.['speed-index']?.displayValue || null,
  };
}

async function fetchPageSpeed(targetUrl, strategy) {
  const apiKey = process.env.PAGESPEED_API_KEY;

  const params = {
    url: targetUrl,
    strategy,
    category: 'performance',
  };
  if (apiKey) {
    params.key = apiKey;
  }

  const { data } = await axios.get(PAGESPEED_ENDPOINT, {
    params,
    timeout: PAGESPEED_TIMEOUT_MS,
  });

  const score = data?.lighthouseResult?.categories?.performance?.score;

  return {
    score: score != null ? Math.round(score * 100) : null,
    coreWebVitals: extractCoreWebVitals(data),
  };
}

function buildErrorResult(err, strategy) {
  const googleMessage = err.response?.data?.error?.message;
  return {
    error: `No se pudo obtener el análisis ${strategy === 'mobile' ? 'móvil' : 'de escritorio'} de PageSpeed`,
    details: googleMessage || err.message,
    score: null,
    coreWebVitals: null,
  };
}

export async function getPageSpeedData(targetUrl) {
  const [mobileResult, desktopResult] = await Promise.allSettled([
    fetchPageSpeed(targetUrl, 'mobile'),
    fetchPageSpeed(targetUrl, 'desktop'),
  ]);

  return {
    mobile:
      mobileResult.status === 'fulfilled' ? mobileResult.value : buildErrorResult(mobileResult.reason, 'mobile'),
    desktop:
      desktopResult.status === 'fulfilled' ? desktopResult.value : buildErrorResult(desktopResult.reason, 'desktop'),
  };
}


const axios = require('axios');

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
  const { data } = await axios.get(PAGESPEED_ENDPOINT, {
    params: {
      url: targetUrl,
      strategy,
      category: 'performance',
    },
    timeout: PAGESPEED_TIMEOUT_MS,
  });

  const score = data?.lighthouseResult?.categories?.performance?.score;

  return {
    score: score != null ? Math.round(score * 100) : null,
    coreWebVitals: extractCoreWebVitals(data),
  };
}

async function getPageSpeedData(targetUrl) {
  const [mobileResult, desktopResult] = await Promise.allSettled([
    fetchPageSpeed(targetUrl, 'mobile'),
    fetchPageSpeed(targetUrl, 'desktop'),
  ]);

  return {
    mobile:
      mobileResult.status === 'fulfilled'
        ? mobileResult.value
        : { error: 'No se pudo obtener el análisis móvil de PageSpeed', score: null, coreWebVitals: null },
    desktop:
      desktopResult.status === 'fulfilled'
        ? desktopResult.value
        : { error: 'No se pudo obtener el análisis de escritorio de PageSpeed', score: null, coreWebVitals: null },
  };
}

module.exports = { getPageSpeedData };

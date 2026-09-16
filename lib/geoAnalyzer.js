import axios from 'axios';

const AI_BOTS = [
  { name: 'GPTBot', vendor: 'OpenAI', purpose: 'Entrenamiento de modelos' },
  { name: 'ChatGPT-User', vendor: 'OpenAI', purpose: 'Navegación en tiempo real (plugins/browsing)' },
  { name: 'OAI-SearchBot', vendor: 'OpenAI', purpose: 'Búsqueda de ChatGPT' },
  { name: 'ClaudeBot', vendor: 'Anthropic', purpose: 'Entrenamiento de modelos' },
  { name: 'anthropic-ai', vendor: 'Anthropic', purpose: 'Entrenamiento de modelos (legacy)' },
  { name: 'Claude-Web', vendor: 'Anthropic', purpose: 'Navegación en tiempo real' },
  { name: 'Google-Extended', vendor: 'Google', purpose: 'Entrenamiento de Gemini / AI Overviews' },
  { name: 'PerplexityBot', vendor: 'Perplexity', purpose: 'Índice de respuestas de IA' },
  { name: 'CCBot', vendor: 'Common Crawl', purpose: 'Dataset usado por muchos LLMs' },
  { name: 'Bytespider', vendor: 'ByteDance', purpose: 'Entrenamiento de modelos' },
  { name: 'Applebot-Extended', vendor: 'Apple', purpose: 'Apple Intelligence' },
  { name: 'Amazonbot', vendor: 'Amazon', purpose: 'Alexa / asistentes IA' },
  { name: 'meta-externalagent', vendor: 'Meta', purpose: 'Entrenamiento de Meta AI' },
];

function parseRobotsTxt(text) {
  const groups = {};
  const sitemaps = [];
  let currentAgents = [];
  let sawDirectiveForCurrentAgents = false;

  text.split('\n').forEach((rawLine) => {
    const line = rawLine.split('#')[0].trim();
    if (!line) return;

    const [rawKey, ...rest] = line.split(':');
    if (!rawKey || rest.length === 0) return;
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(':').trim();

    if (key === 'user-agent') {
      if (sawDirectiveForCurrentAgents) {
        currentAgents = [];
        sawDirectiveForCurrentAgents = false;
      }
      const agent = value.toLowerCase();
      currentAgents.push(agent);
      if (!groups[agent]) groups[agent] = [];
      return;
    }

    if (key === 'sitemap') {
      sitemaps.push(value);
      return;
    }

    if ((key === 'disallow' || key === 'allow') && currentAgents.length > 0) {
      currentAgents.forEach((agent) => groups[agent].push({ type: key, path: value }));
      sawDirectiveForCurrentAgents = true;
    }
  });

  return { groups, sitemaps };
}

function isAgentBlocked(rules) {
  if (!rules || rules.length === 0) return null;
  let blocked = false;
  rules.forEach((rule) => {
    if (rule.type === 'disallow' && rule.path === '/') blocked = true;
    if (rule.type === 'allow' && (rule.path === '/' || rule.path === '')) blocked = false;
  });
  return blocked;
}

export async function checkAIBotAccess(pageUrl) {
  const robotsUrl = new URL('/robots.txt', pageUrl).toString();

  try {
    const { data, status } = await axios.get(robotsUrl, {
      timeout: 6000,
      validateStatus: () => true,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOAuditBot/1.0)' },
    });

    if (status >= 400 || typeof data !== 'string') {
      return {
        robotsTxtFound: false,
        note: 'No se encontró robots.txt. Por defecto, los bots de IA pueden rastrear el sitio salvo que se indique lo contrario.',
        bots: AI_BOTS.map((bot) => ({ ...bot, status: 'sin-restriccion' })),
        sitemapDeclared: false,
      };
    }

    const { groups, sitemaps } = parseRobotsTxt(data);
    const wildcardBlocked = isAgentBlocked(groups['*']);

    const bots = AI_BOTS.map((bot) => {
      const agentKey = bot.name.toLowerCase();
      const specificRules = groups[agentKey];

      if (specificRules) {
        const blocked = isAgentBlocked(specificRules);
        return { ...bot, status: blocked ? 'bloqueado' : 'permitido', source: 'regla específica' };
      }
      if (wildcardBlocked === true) {
        return { ...bot, status: 'bloqueado', source: 'regla general (*)' };
      }
      return { ...bot, status: 'permitido', source: wildcardBlocked === false ? 'regla general (*)' : 'sin mención' };
    });

    return {
      robotsTxtFound: true,
      sitemapDeclared: sitemaps.length > 0,
      sitemaps,
      bots,
    };
  } catch (err) {
    return {
      robotsTxtFound: false,
      error: 'No se pudo comprobar robots.txt',
      details: err.message,
      bots: AI_BOTS.map((bot) => ({ ...bot, status: 'desconocido' })),
    };
  }
}

export function analyzeAIReadiness($, structuredData) {
  const tableCount = $('table').length;
  const listCount = $('ul, ol').length;
  const questionHeadings = [];

  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const text = $(el).text().trim();
    if (text.endsWith('?')) questionHeadings.push(text);
  });

  const hasFAQSchema = structuredData?.types?.includes('FAQPage') || false;
  const hasHowToSchema = structuredData?.types?.includes('HowTo') || false;

  const signals = [
    { key: 'faqSchema', present: hasFAQSchema, weight: 30, label: 'Marcado FAQPage (Schema.org)' },
    { key: 'questionHeadings', present: questionHeadings.length > 0, weight: 25, label: 'Encabezados en formato pregunta' },
    { key: 'tables', present: tableCount > 0, weight: 20, label: 'Tablas de datos estructurados' },
    { key: 'lists', present: listCount > 0, weight: 15, label: 'Listas (ul/ol)' },
    { key: 'howToSchema', present: hasHowToSchema, weight: 10, label: 'Marcado HowTo (Schema.org)' },
  ];

  const score = signals.reduce((total, s) => total + (s.present ? s.weight : 0), 0);
  const recommendations = signals
    .filter((s) => !s.present)
    .map((s) => `Añadir ${s.label.toLowerCase()} para mejorar la extracción por IA`);

  return {
    score,
    tableCount,
    listCount,
    questionHeadingsCount: questionHeadings.length,
    questionHeadingsSample: questionHeadings.slice(0, 5),
    hasFAQSchema,
    hasHowToSchema,
    recommendations,
  };
}

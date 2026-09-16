const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'de', 'del', 'y', 'o', 'en', 'un', 'una', 'unos', 'unas', 'que', 'es', 'por', 'para',
  'con', 'no', 'se', 'su', 'sus', 'al', 'lo', 'como', 'más', 'pero', 'le', 'ya', 'este', 'esta', 'estos', 'estas',
  'entre', 'sin', 'sobre', 'también', 'me', 'hasta', 'hay', 'donde', 'quien', 'desde', 'todo', 'nos', 'durante',
  'todos', 'uno', 'les', 'ni', 'contra', 'otros', 'ese', 'eso', 'ante', 'ellos', 'esto', 'mí', 'antes', 'algunos',
  'qué', 'yo', 'otro', 'otras', 'otra', 'él', 'tanto', 'esa', 'mucho', 'quienes', 'nada', 'muchos', 'cual', 'poco',
  'ella', 'estar', 'algunas', 'algo', 'nosotros', 'cómo', 'está', 'son', 'ser', 'the', 'and', 'for', 'with', 'that',
  'this', 'from', 'have', 'has', 'are', 'was', 'were', 'you', 'your', 'our', 'they', 'their',
]);

function tokenize(text) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-zà-ÿ0-9\s-]/gi, ' ')
      .split(/\s+/)
      .filter(Boolean)
  );
}

function countFrequencies(items) {
  const freq = new Map();
  items.forEach((item) => freq.set(item, (freq.get(item) || 0) + 1));
  return freq;
}

export function estimateKeywordFocus($, { title, headings }) {
  const bodyClone = $('body').clone();
  bodyClone.find('script, style, noscript, nav, footer, header').remove();
  const bodyText = bodyClone.text().replace(/\s+/g, ' ').trim();

  const rawWords = tokenize(bodyText);
  const meaningfulWords = rawWords.filter((w) => !STOPWORDS.has(w) && w.length >= 3 && !/^\d+$/.test(w));
  const totalWords = meaningfulWords.length;

  const unigramFreq = countFrequencies(meaningfulWords);
  const topUnigrams = [...unigramFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([term, count]) => ({
      term,
      count,
      density: totalWords ? Number(((count / totalWords) * 100).toFixed(2)) : 0,
      type: 'palabra',
    }));

  const bigrams = [];
  for (let i = 0; i < rawWords.length - 1; i += 1) {
    const w1 = rawWords[i];
    const w2 = rawWords[i + 1];
    if (w1.length >= 3 && w2.length >= 3 && !STOPWORDS.has(w1) && !STOPWORDS.has(w2)) {
      bigrams.push(`${w1} ${w2}`);
    }
  }
  const bigramFreq = countFrequencies(bigrams);
  const topBigrams = [...bigramFreq.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([term, count]) => ({
      term,
      count,
      density: totalWords ? Number(((count / totalWords) * 100).toFixed(2)) : 0,
      type: 'frase',
    }));

  const topKeywordCandidates = [...topBigrams, ...topUnigrams].slice(0, 10);
  const inferredPrimaryKeyword = topBigrams[0]?.term || topUnigrams[0]?.term || null;

  const titleLower = (title || '').toLowerCase();
  const h1Text = (headings.find((h) => h.level === 1)?.text || '').toLowerCase();

  return {
    totalWordsAnalyzed: totalWords,
    isThinContent: totalWords < 300,
    topKeywordCandidates,
    inferredPrimaryKeyword,
    alignment: {
      keywordInTitle: inferredPrimaryKeyword ? titleLower.includes(inferredPrimaryKeyword) : null,
      keywordInH1: inferredPrimaryKeyword ? h1Text.includes(inferredPrimaryKeyword) : null,
    },
    note: 'Estimación basada únicamente en la densidad de términos de esta página. No refleja volumen de búsqueda real ni datos de competidores.',
  };
}

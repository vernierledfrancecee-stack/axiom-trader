/**
 * AXIOM — Module News
 * Récupère et traduit en français les actualités financières.
 */

const { XMLParser } = require('fast-xml-parser');

// Cache : { key: { articles, timestamp } }
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Traduit un texte en français via Claude Haiku.
 */
async function translateToFrench(text) {
  if (!text || text.trim() === '') return '';
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return text;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: 'Tu es un traducteur financier expert. Traduis ce texte en français professionnel, concis. Retourne uniquement la traduction, rien d\'autre.',
        messages: [{ role: 'user', content: text }],
      }),
    });
    const data = await response.json();
    return data.content?.[0]?.text || text;
  } catch {
    return text;
  }
}

/**
 * Fetch et parse le flux RSS Yahoo Finance.
 */
async function fetchYahooRSS() {
  const url = 'https://finance.yahoo.com/news/rssindex';
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AXIOM/1.0)',
      'Accept': 'application/rss+xml, application/xml, text/xml',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!r.ok) throw new Error(`Yahoo RSS ${r.status}`);
  const xml = await r.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });
  const parsed = parser.parse(xml);
  const items = parsed?.rss?.channel?.item || [];
  const list = Array.isArray(items) ? items : [items];

  return list.map(item => ({
    titre: item.title || '',
    resume: item.description || '',
    lien: item.link || '',
    date: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    image: item['media:content']?.['@_url'] || item['media:thumbnail']?.['@_url'] || null,
    source: 'Yahoo Finance',
  }));
}

/**
 * Fallback : utilise Claude avec web search pour récupérer les 5 dernières news.
 */
async function fetchViaClaudeFallback() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1 }],
        messages: [{
          role: 'user',
          content: 'Donne-moi les 5 dernières actualités importantes des marchés financiers américains aujourd\'hui. Pour chaque news : titre en français, résumé en 1-2 phrases en français, ticker concerné si applicable. Format JSON array: [{titre, resume, ticker, lien}]',
        }],
      }),
    });

    const data = await response.json();
    let fullText = '';
    for (const block of (data.content || [])) {
      if (block.type === 'text') fullText += block.text;
    }

    const jsonMatch = fullText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const articles = JSON.parse(jsonMatch[0]);
    return articles.map(a => ({
      titre: a.titre || '',
      resume: a.resume || '',
      lien: a.lien || '#',
      date: new Date().toISOString(),
      image: null,
      source: 'claude',
      tickersMentionnes: a.ticker ? [a.ticker] : [],
      traduit: true,
    }));
  } catch {
    return [];
  }
}

/**
 * Détermine quels tickers sont mentionnés dans un article.
 */
function findMentionedTickers(article, tickers) {
  const text = `${article.titre} ${article.resume}`.toUpperCase();
  return tickers.filter(t => text.includes(t.toUpperCase()));
}

/**
 * Récupère les news, traduit et filtre par tickers.
 * @param {string[]} tickers - Liste de tickers à filtrer (optionnel)
 */
async function getNews(tickers = []) {
  const cacheKey = tickers.sort().join(',') || 'all';
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { ...cached.data, cached: true };
  }

  let articles = [];
  let source = 'yahoo';

  try {
    const raw = await fetchYahooRSS();

    // Traduire en parallèle par batch de 5 pour éviter le rate limiting
    const translated = [];
    const BATCH = 5;
    for (let i = 0; i < Math.min(raw.length, 20); i += BATCH) {
      const batch = raw.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(async (article) => {
        const [titreFR, resumeFR] = await Promise.all([
          translateToFrench(article.titre),
          translateToFrench(article.resume.replace(/<[^>]+>/g, '').substring(0, 300)),
        ]);
        return {
          ...article,
          titreFR,
          resumeFR,
          traduit: true,
          tickersMentionnes: findMentionedTickers(article, tickers),
        };
      }));
      translated.push(...results);
    }
    articles = translated;
  } catch (err) {
    console.warn('[News] Yahoo RSS échoué, fallback Claude:', err.message);
    articles = await fetchViaClaudeFallback();
    source = 'claude';
  }

  // Filtrer si tickers spécifiés
  if (tickers.length > 0) {
    const filtered = articles.filter(a => a.tickersMentionnes?.length > 0);
    // Si aucun article ne match, retourner tous les articles quand même
    if (filtered.length > 0) articles = filtered;
  }

  const result = {
    articles,
    lastUpdated: Date.now(),
    source,
  };

  cache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}

module.exports = { getNews };

/**
 * AXIOM — Module Fondamentaux
 * Récupère les données fondamentales Yahoo Finance sans clé API.
 */

// Cache 30 minutes par ticker
const fundamentalCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Retourne null si la valeur est invalide (null, undefined, NaN, Infinity).
 */
function safe(v) {
  if (v === null || v === undefined || !isFinite(v)) return null;
  return v;
}

/**
 * Fetch les données fondamentales pour un ticker.
 * @param {string} ticker
 * @returns {Object} Données fondamentales structurées
 */
async function getFundamentals(ticker) {
  const t = ticker.toUpperCase();
  const cached = fundamentalCache.get(t);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const modules = [
    'financialData',
    'defaultKeyStatistics',
    'earningsTrends',
    'recommendationTrend',
    'summaryDetail',
    'price',
  ].join(',');

  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${t}?modules=${modules}`;

  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });

    if (!r.ok) throw new Error(`Yahoo Finance ${r.status}`);
    const json = await r.json();
    const result = json?.quoteSummary?.result?.[0];
    if (!result) throw new Error('Données introuvables');

    const fd = result.financialData || {};
    const ks = result.defaultKeyStatistics || {};
    const sd = result.summaryDetail || {};
    const price = result.price || {};
    const rt = result.recommendationTrend?.trend?.[0] || {};

    // Prochains earnings
    let earningsDate = null;
    let daysToEarnings = null;
    const earningsTrend = result.earningsTrends?.trend;
    if (Array.isArray(earningsTrend) && earningsTrend.length > 0) {
      const nextEarnings = earningsTrend[0]?.endDate;
      if (nextEarnings) {
        earningsDate = nextEarnings;
        const diff = new Date(nextEarnings) - new Date();
        daysToEarnings = Math.ceil(diff / (1000 * 60 * 60 * 24));
      }
    }
    // Fallback sur calendarEvents si disponible
    if (!earningsDate && result.calendarEvents?.earnings?.earningsDate?.[0]?.raw) {
      const ts = result.calendarEvents.earnings.earningsDate[0].raw;
      earningsDate = new Date(ts * 1000).toISOString().split('T')[0];
      daysToEarnings = Math.ceil((new Date(earningsDate) - new Date()) / 86400000);
    }

    // Consensus analystes
    const totalAnalysts = (rt.strongBuy || 0) + (rt.buy || 0) + (rt.hold || 0) + (rt.sell || 0) + (rt.strongSell || 0);
    const consensusScore = totalAnalysts > 0
      ? ((rt.strongBuy || 0) * 5 + (rt.buy || 0) * 4 + (rt.hold || 0) * 3 + (rt.sell || 0) * 2 + (rt.strongSell || 0) * 1) / totalAnalysts
      : null;

    let consensusLabel = 'N/A';
    if (consensusScore !== null) {
      if (consensusScore >= 4.5) consensusLabel = 'STRONG BUY';
      else if (consensusScore >= 3.5) consensusLabel = 'BUY';
      else if (consensusScore >= 2.5) consensusLabel = 'HOLD';
      else if (consensusScore >= 1.5) consensusLabel = 'SELL';
      else consensusLabel = 'STRONG SELL';
    }

    const data = {
      ticker: t,
      // Prix et range
      prixActuel: safe(fd.currentPrice?.raw || price.regularMarketPrice?.raw),
      high52w: safe(sd.fiftyTwoWeekHigh?.raw),
      low52w: safe(sd.fiftyTwoWeekLow?.raw),
      // Valorisation
      peTtm: safe(sd.trailingPE?.raw),
      peForward: safe(ks.forwardPE?.raw),
      eps: safe(fd.epsTrailingTwelveMonths?.raw || ks.trailingEps?.raw),
      epsForward: safe(ks.forwardEps?.raw),
      // Croissance
      revenueGrowth: safe(fd.revenueGrowth?.raw ? fd.revenueGrowth.raw * 100 : null),
      earningsGrowth: safe(fd.earningsGrowth?.raw ? fd.earningsGrowth.raw * 100 : null),
      // Santé financière
      profitMargin: safe(fd.profitMargins?.raw ? fd.profitMargins.raw * 100 : null),
      debtToEquity: safe(fd.debtToEquity?.raw),
      freeCashFlow: safe(fd.freeCashflow?.raw),
      // Volume
      volumeActuel: safe(price.regularMarketVolume?.raw || sd.volume?.raw),
      volumeMoyen: safe(sd.averageVolume?.raw || sd.averageDailyVolume10Day?.raw),
      // Analystes
      nbAnalystes: safe(fd.numberOfAnalystOpinions?.raw),
      consensusScore: safe(consensusScore ? parseFloat(consensusScore.toFixed(2)) : null),
      consensusLabel,
      targetPrixMoyen: safe(fd.targetMeanPrice?.raw),
      // Volatilité
      beta: safe(ks.beta?.raw || sd.beta?.raw),
      // Earnings
      earningsDate,
      daysToEarnings: safe(daysToEarnings),
      // Recommandation
      recoText: fd.recommendationKey || null,
    };

    fundamentalCache.set(t, { data, timestamp: Date.now() });
    return data;
  } catch (err) {
    console.warn(`[Fundamental] ${t}: ${err.message}`);
    // Retourner un objet avec tous les champs à null plutôt que de crasher
    return {
      ticker: t,
      prixActuel: null, high52w: null, low52w: null,
      peTtm: null, peForward: null, eps: null, epsForward: null,
      revenueGrowth: null, earningsGrowth: null,
      profitMargin: null, debtToEquity: null, freeCashFlow: null,
      volumeActuel: null, volumeMoyen: null,
      nbAnalystes: null, consensusScore: null, consensusLabel: 'N/A',
      targetPrixMoyen: null, beta: null,
      earningsDate: null, daysToEarnings: null, recoText: null,
      error: err.message,
    };
  }
}

/**
 * Fetch les fondamentaux pour plusieurs tickers en parallèle.
 */
async function getFundamentalsMultiple(tickers) {
  const results = await Promise.all(tickers.map(t => getFundamentals(t)));
  return Object.fromEntries(results.map((r, i) => [tickers[i], r]));
}

module.exports = { getFundamentals, getFundamentalsMultiple };

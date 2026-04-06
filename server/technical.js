/**
 * AXIOM — Module Technical
 * Calcule les indicateurs techniques (EMA, RSI, MACD) à partir des données OHLC Yahoo Finance.
 */

// Cache 15 minutes par ticker+interval
const techCache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000;

/**
 * Calcule l'EMA sur une série de prix.
 */
function calcEMA(prices, period) {
  if (prices.length < period) return [];
  const k = 2 / (period + 1);
  const emas = [];
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  emas.push(ema);
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
    emas.push(ema);
  }
  return emas;
}

/**
 * Calcule le RSI sur une série de prix.
 */
function calcRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(1));
}

/**
 * Calcule le MACD (12, 26, 9).
 */
function calcMACD(prices) {
  if (prices.length < 35) return null;
  const ema12 = calcEMA(prices, 12);
  const ema26 = calcEMA(prices, 26);

  if (!ema12.length || !ema26.length) return null;

  // Aligner les deux séries (ema26 est plus courte)
  const offset = ema12.length - ema26.length;
  const macdLine = ema26.map((v, i) => ema12[i + offset] - v);

  const signal = calcEMA(macdLine, 9);
  const lastMACD = macdLine[macdLine.length - 1];
  const lastSignal = signal[signal.length - 1];
  const histogram = lastMACD - lastSignal;

  return {
    macd: parseFloat(lastMACD?.toFixed(4) || '0'),
    signal: parseFloat(lastSignal?.toFixed(4) || '0'),
    histogram: parseFloat(histogram?.toFixed(4) || '0'),
    bullish: histogram > 0,
  };
}

/**
 * Récupère les données OHLC depuis Yahoo Finance.
 */
async function fetchOHLC(ticker, interval = '1d', range = '1y') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${interval}&range=${range}&includePrePost=false`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`Yahoo OHLC ${r.status}`);
  const data = await r.json();
  const result = data.chart?.result?.[0];
  if (!result) throw new Error('Données OHLC introuvables');

  const { timestamp, indicators: { quote: [q] } } = result;
  const candles = timestamp
    .map((t, i) => ({
      time: t,
      open: q.open[i],
      high: q.high[i],
      low: q.low[i],
      close: q.close[i],
      volume: q.volume[i],
    }))
    .filter(c => c.open != null && c.close != null);

  return candles;
}

/**
 * Calcule tous les indicateurs techniques pour un ticker.
 */
async function getTechnicals(ticker) {
  const t = ticker.toUpperCase();
  const cacheKey = t;
  const cached = techCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const candles = await fetchOHLC(t, '1d', '1y');
    if (candles.length < 30) throw new Error('Historique insuffisant');

    const closes = candles.map(c => c.close);
    const volumes = candles.map(c => c.volume || 0);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    const prixActuel = closes[closes.length - 1];

    // EMAs
    const ema20arr = calcEMA(closes, 20);
    const ema50arr = calcEMA(closes, 50);
    const ema200arr = calcEMA(closes, 200);

    const ema20 = ema20arr.length > 0 ? ema20arr[ema20arr.length - 1] : null;
    const ema50 = ema50arr.length > 0 ? ema50arr[ema50arr.length - 1] : null;
    const ema200 = ema200arr.length > 0 ? ema200arr[ema200arr.length - 1] : null;

    // RSI 14
    const rsi = calcRSI(closes, 14);

    // MACD
    const macd = calcMACD(closes);

    // Volume
    const vol20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const volActuel = volumes[volumes.length - 1] || 0;
    const ratioVolume = vol20 > 0 ? parseFloat((volActuel / vol20).toFixed(2)) : null;

    // High/Low 52 semaines (depuis les données 1Y)
    const high52w = Math.max(...highs);
    const low52w = Math.min(...lows);
    const distHigh52w = high52w > 0 ? parseFloat(((prixActuel - high52w) / high52w * 100).toFixed(1)) : null;

    // Position par rapport aux EMAs
    const audessusEma20 = ema20 ? prixActuel > ema20 : null;
    const audessusEma50 = ema50 ? prixActuel > ema50 : null;
    const audessusEma200 = ema200 ? prixActuel > ema200 : null;

    // Tendance générale
    let tendance = 'NEUTRE';
    const score = [audessusEma20, audessusEma50, audessusEma200].filter(Boolean).length;
    if (score === 3) tendance = 'HAUSSIER';
    else if (score === 0) tendance = 'BAISSIER';
    else if (score >= 2) tendance = 'PLUTÔT HAUSSIER';
    else tendance = 'PLUTÔT BAISSIER';

    const data = {
      ticker: t,
      prixActuel: parseFloat(prixActuel?.toFixed(2) || '0'),
      ema20: parseFloat(ema20?.toFixed(2) || '0'),
      ema50: parseFloat(ema50?.toFixed(2) || '0'),
      ema200: parseFloat(ema200?.toFixed(2) || '0'),
      rsi,
      macd,
      ratioVolume,
      volumeActuel: volActuel,
      volumeMoyen20j: parseFloat(vol20.toFixed(0)),
      high52w: parseFloat(high52w?.toFixed(2) || '0'),
      low52w: parseFloat(low52w?.toFixed(2) || '0'),
      distHigh52w,
      audessusEma20,
      audessusEma50,
      audessusEma200,
      tendance,
      nbBougies: candles.length,
    };

    techCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (err) {
    console.warn(`[Technical] ${t}: ${err.message}`);
    return {
      ticker: t,
      prixActuel: null, ema20: null, ema50: null, ema200: null,
      rsi: null, macd: null, ratioVolume: null,
      volumeActuel: null, volumeMoyen20j: null,
      high52w: null, low52w: null, distHigh52w: null,
      audessusEma20: null, audessusEma50: null, audessusEma200: null,
      tendance: 'INCONNU',
      error: err.message,
    };
  }
}

/**
 * Fetch les indicateurs pour plusieurs tickers en parallèle.
 */
async function getTechnicalsMultiple(tickers) {
  const results = await Promise.all(tickers.map(t => getTechnicals(t)));
  return Object.fromEntries(results.map((r, i) => [tickers[i], r]));
}

module.exports = { getTechnicals, getTechnicalsMultiple };

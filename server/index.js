/**
 * AXIOM v2.0 — Serveur Express
 * API de trading : données marché, IA, Telegram, trades, news, analytics.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;
const START_TIME = Date.now();

// ─── Logs ────────────────────────────────────────────────────────────────────
const LOGS_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

function logError(context, err) {
  const line = `[${new Date().toISOString()}] [${context}] ${err?.message || err}\n`;
  try { fs.appendFileSync(path.join(LOGS_DIR, 'errors.log'), line); } catch {}
  console.error(line.trim());
}

// ─── Sécurité ────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3001')
  .split(',').map(s => s.trim());

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Trop de requêtes. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

app.use(express.json());

// ─── Validation helpers ───────────────────────────────────────────────────────
function validateTicker(ticker) {
  return typeof ticker === 'string' && /^[A-Za-z]{1,6}$/.test(ticker);
}
function validatePrice(price) {
  const n = parseFloat(price);
  return !isNaN(n) && n > 0;
}
function validateQty(qty) {
  const n = parseInt(qty);
  return !isNaN(n) && n > 0 && Number.isInteger(n);
}

// ─── Middleware admin ─────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) return next();
  if (req.headers['x-admin-key'] !== adminKey) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  next();
}

// ─── Initialisation des modules ───────────────────────────────────────────────
const { initDatabase, getTradeHistory } = require('./database');
const { initCron, triggerManualScan } = require('./cron');
const { initBot, testConnection } = require('./telegram');
const { getNews } = require('./news');
const { openTrade, closeTrade, getActiveTrades } = require('./tradeTracker');
const { getStats, getCapitalCurve, getDailyPnLStats, getSummary, initAnalyticsCron, saveCapitalSnapshot } = require('./analytics');
const { getFundamentals } = require('./fundamental');
const { getTechnicals } = require('./technical');

initDatabase();
initBot(process.env.TELEGRAM_POLLING === 'true');
initCron();
initAnalyticsCron();

// ─── GET /api/candles/:ticker ─────────────────────────────────────────────────
app.get('/api/candles/:ticker', async (req, res) => {
  const { ticker } = req.params;
  if (!validateTicker(ticker)) return res.status(400).json({ error: 'Ticker invalide' });

  const { interval = '5m', range = '1d' } = req.query;
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker.toUpperCase()}?interval=${interval}&range=${range}&includePrePost=false`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await r.json();
    const result = data.chart?.result?.[0];
    if (!result) return res.status(404).json({ error: 'Ticker introuvable' });
    const { timestamp, indicators: { quote: [q] } } = result;
    const candles = timestamp
      .map((t, i) => ({ time: t, open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i] }))
      .filter(c => c.open != null && c.close != null);
    res.json({ candles });
  } catch (err) {
    logError('candles', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/axiom — Gemini 2.0 Flash (émule le format SSE Anthropic) ───────
app.post('/api/axiom', async (req, res) => {
  const { system, user, useWebSearch = false } = req.body;
  if (!user) return res.status(400).json({ error: 'Missing user message' });

  try {
    const { callGemini } = require('./gemini');
    const text = await callGemini(system || '', user, { useWebSearch });

    // Émettre au format SSE Anthropic pour rétrocompatibilité client
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write(`data: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text } })}\n\n`);
    res.end();
  } catch (err) {
    logError('axiom', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/scan-manual ────────────────────────────────────────────────────
app.post('/api/scan-manual', requireAdmin, async (req, res) => {
  try {
    const result = await triggerManualScan();
    res.json(result);
  } catch (err) {
    logError('scan-manual', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/news ────────────────────────────────────────────────────────────
app.get('/api/news', async (req, res) => {
  const tickersParam = req.query.tickers || '';
  const tickers = tickersParam
    ? tickersParam.split(',').map(t => t.trim().toUpperCase()).filter(t => validateTicker(t))
    : [];
  try {
    const result = await getNews(tickers);
    res.json(result);
  } catch (err) {
    logError('news', err);
    res.status(500).json({ error: err.message, articles: [] });
  }
});

// ─── POST /api/trade/open ─────────────────────────────────────────────────────
app.post('/api/trade/open', async (req, res) => {
  const { ticker, direction, entree, stop, tp1, tp2, rr, quantite } = req.body;

  if (!validateTicker(ticker)) return res.status(400).json({ error: 'Ticker invalide (1-6 lettres)' });
  if (!['LONG', 'SHORT'].includes(direction)) return res.status(400).json({ error: 'Direction invalide (LONG ou SHORT)' });
  if (!validatePrice(entree)) return res.status(400).json({ error: 'Prix entrée invalide' });
  if (!validatePrice(stop)) return res.status(400).json({ error: 'Stop invalide' });
  if (!validateQty(quantite)) return res.status(400).json({ error: 'Quantité invalide (entier positif)' });

  try {
    const result = await openTrade({ ticker: ticker.toUpperCase(), direction, entree, stop, tp1, tp2, rr, quantite });
    res.json(result);
  } catch (err) {
    logError('trade/open', err);
    res.status(400).json({ error: err.message });
  }
});

// ─── POST /api/trade/close ────────────────────────────────────────────────────
app.post('/api/trade/close', async (req, res) => {
  const { ticker, prixSortie, raison } = req.body;

  if (!validateTicker(ticker)) return res.status(400).json({ error: 'Ticker invalide' });
  if (!validatePrice(prixSortie)) return res.status(400).json({ error: 'Prix de sortie invalide' });

  try {
    const result = await closeTrade(ticker.toUpperCase(), prixSortie, raison || 'Fermeture manuelle');
    res.json(result);
  } catch (err) {
    logError('trade/close', err);
    res.status(400).json({ error: err.message });
  }
});

// ─── GET /api/trade/active ────────────────────────────────────────────────────
app.get('/api/trade/active', (req, res) => {
  try {
    res.json(getActiveTrades());
  } catch (err) {
    logError('trade/active', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/trade/history ───────────────────────────────────────────────────
app.get('/api/trade/history', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    res.json(getTradeHistory(limit));
  } catch (err) {
    logError('trade/history', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/analytics/* ─────────────────────────────────────────────────────
app.get('/api/analytics/stats', (req, res) => {
  try { res.json(getStats()); }
  catch (err) { logError('analytics/stats', err); res.status(500).json({ error: err.message }); }
});

app.get('/api/analytics/capital-curve', (req, res) => {
  try { res.json(getCapitalCurve()); }
  catch (err) { logError('analytics/capital-curve', err); res.status(500).json({ error: err.message }); }
});

app.get('/api/analytics/daily-pnl', (req, res) => {
  try { res.json(getDailyPnLStats()); }
  catch (err) { logError('analytics/daily-pnl', err); res.status(500).json({ error: err.message }); }
});

app.post('/api/analytics/snapshot', requireAdmin, (req, res) => {
  try {
    const { capital } = req.body;
    saveCapitalSnapshot(capital ? parseFloat(capital) : null);
    res.json({ success: true });
  } catch (err) { logError('analytics/snapshot', err); res.status(500).json({ error: err.message }); }
});

// ─── GET /api/fundamentals/:ticker ───────────────────────────────────────────
app.get('/api/fundamentals/:ticker', async (req, res) => {
  const { ticker } = req.params;
  if (!validateTicker(ticker)) return res.status(400).json({ error: 'Ticker invalide' });
  try {
    const data = await getFundamentals(ticker.toUpperCase());
    res.json(data);
  } catch (err) {
    logError('fundamentals', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/technicals/:ticker ─────────────────────────────────────────────
app.get('/api/technicals/:ticker', async (req, res) => {
  const { ticker } = req.params;
  if (!validateTicker(ticker)) return res.status(400).json({ error: 'Ticker invalide' });
  try {
    const data = await getTechnicals(ticker.toUpperCase());
    res.json(data);
  } catch (err) {
    logError('technicals', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /health ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  const hasBotToken = !!process.env.TELEGRAM_BOT_TOKEN;
  const hasChatId = !!process.env.TELEGRAM_CHAT_ID;
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;
  res.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - START_TIME) / 1000),
    version: '2.0.0',
    tradesActifs: Object.keys(getActiveTrades()).length,
    cronActif: true,
    telegram: {
      botToken: hasBotToken ? 'configuré' : 'MANQUANT',
      chatId: hasChatId ? 'configuré' : 'MANQUANT',
      polling: process.env.TELEGRAM_POLLING === 'true' ? 'activé' : 'désactivé',
      pret: hasBotToken && hasChatId,
    },
    gemini: {
      apiKey: hasGeminiKey ? 'configuré' : 'MANQUANT',
    },
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
  });
});

// ─── POST /api/telegram-test ──────────────────────────────────────────────────
app.post('/api/telegram-test', requireAdmin, async (req, res) => {
  try {
    const result = await testConnection();
    if (result.ok) {
      res.json({ success: true, message: 'Message de test envoyé sur Telegram avec succès.' });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (err) {
    logError('telegram-test', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/stats/summary ───────────────────────────────────────────────────
app.get('/api/stats/summary', (req, res) => {
  try { res.json(getSummary()); }
  catch (err) { logError('stats/summary', err); res.status(500).json({ error: err.message }); }
});

// ─── Static frontend ──────────────────────────────────────────────────────────
const distPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  logError('global', err);
  res.status(500).json({ error: 'Erreur serveur interne' });
});

app.listen(PORT, () => {
  console.log(`✅ AXIOM v2.0 démarré sur le port ${PORT}`);
  console.log(`   Telegram: ${process.env.TELEGRAM_BOT_TOKEN ? 'configuré' : 'non configuré'}`);
  console.log(`   Admin Key: ${process.env.ADMIN_KEY ? 'configurée' : 'non configurée'}`);
});

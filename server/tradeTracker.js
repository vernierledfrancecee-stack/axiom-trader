/**
 * AXIOM — Module Trade Tracker
 * Gère les trades actifs, la surveillance des prix et les alertes automatiques.
 */

const { sendAlert } = require('./telegram');
const { insertTrade, closeTrade: dbCloseTrade, getTradeHistory } = require('./database');

// Map des trades actifs en mémoire : ticker → tradeData
const activeTrades = new Map();

// IDs des intervalles de surveillance par ticker
const watchIntervals = new Map();

/**
 * Récupère le prix actuel depuis Yahoo Finance.
 */
async function fetchCurrentPrice(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1m&range=1d`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await r.json();
    const result = data.chart?.result?.[0];
    if (!result) return null;
    const closes = result.indicators?.quote?.[0]?.close || [];
    const lastClose = closes.filter(Boolean).pop();
    return lastClose || null;
  } catch {
    return null;
  }
}

/**
 * Génère le rapport post-trade via Claude Haiku.
 */
async function generateTradeReport(trade, pnl, pnlPct, raison) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return 'Rapport non disponible (API key absente).';

  try {
    const prompt = `Tu es Marcus Reid, trader senior. Analyse ce trade terminé et donne un retour factuel en 3-4 phrases maximum.

Trade : ${trade.ticker} (${trade.direction})
Entrée : ${trade.entree} | Sortie : ${trade.prixActuel} | Stop : ${trade.stop} | TP1 : ${trade.tp1} | TP2 : ${trade.tp2}
P&L : ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}€ (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)
Raison de sortie : ${raison}
Durée : ${trade.dureeMinutes || '?'} minutes

Analyse ce qui a fonctionné ou échoué. Sois bref, direct, pédagogique.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    return data.content?.[0]?.text || 'Rapport non disponible.';
  } catch (err) {
    return `Rapport non disponible: ${err.message}`;
  }
}

/**
 * Démarre la surveillance automatique d'un trade.
 */
function startWatching(ticker) {
  if (watchIntervals.has(ticker)) return;

  const interval = setInterval(async () => {
    const trade = activeTrades.get(ticker);
    if (!trade) {
      clearInterval(interval);
      watchIntervals.delete(ticker);
      return;
    }

    const prix = await fetchCurrentPrice(ticker);
    if (prix === null) return;

    trade.prixActuel = prix;
    activeTrades.set(ticker, trade);

    const { entree, stop, tp1, tp2, direction, quantite } = trade;
    const mult = direction === 'SHORT' ? -1 : 1;
    const pnl = (prix - entree) * quantite * mult;

    // Distance en % vers les niveaux
    const distStop = Math.abs((prix - stop) / entree) * 100;
    const distTp1 = tp1 ? Math.abs((tp1 - prix) / entree) * 100 : null;

    // Alerte stop proche (< 0.5%)
    const touchesStop = direction === 'LONG' ? prix <= stop : prix >= stop;
    const nearStop = direction === 'LONG'
      ? prix <= stop * 1.005
      : prix >= stop * 0.995;

    if (touchesStop) {
      // Stop déclenché
      await closeTrade(ticker, prix, 'STOP LOSS déclenché automatiquement');
      await sendAlert(
        `🛑 <b>STOP LOSS déclenché — ${ticker}</b>\nPrix : ${prix.toFixed(2)} | Perte : ${pnl.toFixed(2)}€`
      );
    } else if (nearStop) {
      // Avertissement stop proche
      await sendAlert(
        `⚠️ <b>ATTENTION — STOP proche sur ${ticker}</b>\nPrix : ${prix.toFixed(2)} | Stop : ${stop} | Distance : ${distStop.toFixed(2)}%`
      );
    } else if (tp2 && (direction === 'LONG' ? prix >= tp2 : prix <= tp2)) {
      // TP2 atteint
      await sendAlert(
        `🎯 <b>TP2 ATTEINT — ${ticker} !</b>\nPrix : ${prix.toFixed(2)} | Gain : +${pnl.toFixed(2)}€`
      );
    } else if (tp1 && (direction === 'LONG' ? prix >= tp1 : prix <= tp1)) {
      // TP1 atteint
      await sendAlert(
        `✅ <b>TP1 ATTEINT — ${ticker}</b>\nPrix : ${prix.toFixed(2)} | Gain : +${pnl.toFixed(2)}€\nDéplacer le stop au break-even ?`
      );
    }
  }, 15000); // Toutes les 15 secondes

  watchIntervals.set(ticker, interval);
  console.log(`[TradeTracker] Surveillance démarrée : ${ticker}`);
}

/**
 * Ouvre un nouveau trade et démarre la surveillance.
 */
async function openTrade(tradeData) {
  const {
    ticker,
    direction,
    entree,
    stop,
    tp1,
    tp2,
    rr,
    quantite,
  } = tradeData;

  // Validation
  if (!ticker || !direction || !entree || !stop || !quantite) {
    throw new Error('Champs obligatoires manquants : ticker, direction, entree, stop, quantite');
  }
  if (!['LONG', 'SHORT'].includes(direction)) {
    throw new Error('Direction invalide (LONG ou SHORT)');
  }
  if (activeTrades.has(ticker)) {
    throw new Error(`Trade déjà actif sur ${ticker}`);
  }

  const dateOuverture = new Date().toISOString();

  const trade = {
    ticker,
    direction,
    entree: parseFloat(entree),
    stop: parseFloat(stop),
    tp1: tp1 ? parseFloat(tp1) : null,
    tp2: tp2 ? parseFloat(tp2) : null,
    rr: rr || null,
    quantite: parseInt(quantite),
    dateOuverture,
    prixActuel: parseFloat(entree),
    status: 'OUVERT',
  };

  // Persistance SQLite
  const dbId = insertTrade({
    ticker: trade.ticker,
    direction: trade.direction,
    entree: trade.entree,
    stop: trade.stop,
    tp1: trade.tp1,
    tp2: trade.tp2,
    rr: trade.rr,
    quantite: trade.quantite,
    date_ouverture: dateOuverture,
  });
  trade.dbId = dbId;

  activeTrades.set(ticker, trade);
  startWatching(ticker);

  await sendAlert(
    `📂 <b>TRADE OUVERT — ${ticker}</b>\n${direction} | Entrée : ${entree} | Stop : ${stop} | TP1 : ${tp1 || '?'} | Qté : ${quantite} actions`
  );

  console.log(`[TradeTracker] Trade ouvert : ${ticker} ${direction} @ ${entree}`);
  return { success: true, trade, dbId };
}

/**
 * Ferme un trade actif et génère le rapport Marcus.
 */
async function closeTrade(ticker, prixSortie, raison = 'Fermeture manuelle') {
  const trade = activeTrades.get(ticker);
  if (!trade) throw new Error(`Aucun trade actif sur ${ticker}`);

  // Arrêter la surveillance
  const interval = watchIntervals.get(ticker);
  if (interval) {
    clearInterval(interval);
    watchIntervals.delete(ticker);
  }

  const dateFermeture = new Date().toISOString();
  const prixSortieNum = parseFloat(prixSortie);

  const mult = trade.direction === 'SHORT' ? -1 : 1;
  const pnl = (prixSortieNum - trade.entree) * trade.quantite * mult;
  const pnlPct = ((prixSortieNum - trade.entree) / trade.entree) * 100 * mult;

  const dateOuv = new Date(trade.dateOuverture);
  const dateFerm = new Date(dateFermeture);
  const dureeMinutes = Math.round((dateFerm - dateOuv) / 60000);

  // Déterminer le status
  let status = 'FERME';
  if (raison.includes('STOP')) status = 'STOP';
  else if (raison.includes('TP2')) status = 'TP2';
  else if (raison.includes('TP1')) status = 'TP1';

  // Rapport Marcus
  trade.prixActuel = prixSortieNum;
  trade.dureeMinutes = dureeMinutes;
  const rapport = await generateTradeReport(trade, pnl, pnlPct, raison);

  // Persistance SQLite
  if (trade.dbId) {
    dbCloseTrade(trade.dbId, {
      prix_sortie: prixSortieNum,
      pnl: parseFloat(pnl.toFixed(2)),
      pnl_pct: parseFloat(pnlPct.toFixed(2)),
      raison_sortie: raison,
      rapport_marcus: rapport,
      date_fermeture: dateFermeture,
      duree_minutes: dureeMinutes,
      status,
    });
  }

  // Retirer de la mémoire
  activeTrades.delete(ticker);

  console.log(`[TradeTracker] Trade fermé : ${ticker} @ ${prixSortie} | P&L: ${pnl.toFixed(2)}€`);

  return {
    ticker,
    prixSortie: prixSortieNum,
    pnl: parseFloat(pnl.toFixed(2)),
    pnlPct: parseFloat(pnlPct.toFixed(2)),
    dureeMinutes,
    rapport,
    status,
  };
}

/**
 * Retourne tous les trades actifs avec leur P&L flottant.
 */
function getActiveTrades() {
  const result = {};
  for (const [ticker, trade] of activeTrades.entries()) {
    const mult = trade.direction === 'SHORT' ? -1 : 1;
    const pnl = trade.prixActuel
      ? (trade.prixActuel - trade.entree) * trade.quantite * mult
      : 0;
    const pnlPct = trade.prixActuel
      ? ((trade.prixActuel - trade.entree) / trade.entree) * 100 * mult
      : 0;

    result[ticker] = {
      ...trade,
      pnl: parseFloat(pnl.toFixed(2)),
      pnlPct: parseFloat(pnlPct.toFixed(2)),
    };
  }
  return result;
}

module.exports = { openTrade, closeTrade, getActiveTrades };

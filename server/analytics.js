/**
 * AXIOM — Module Analytics
 * Calcule les métriques de performance depuis SQLite.
 */

const {
  getClosedTrades,
  getSnapshots,
  getDailyPnL,
  insertSnapshot,
  getLastSnapshot,
} = require('./database');

const cron = require('node-cron');

/**
 * Calcule toutes les statistiques de performance.
 */
function getStats() {
  const trades = getClosedTrades(365);

  if (trades.length === 0) {
    return {
      nbTrades: 0,
      winRate: 0,
      profitFactor: 0,
      moyenneGain: 0,
      moyennePerte: 0,
      maxDrawdown: 0,
      sharpe: 0,
      bestTrade: null,
      worstTrade: null,
      streakActuelle: 0,
      streakType: null,
    };
  }

  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);

  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
  const totalGain = wins.reduce((s, t) => s + t.pnl, 0);
  const totalLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = totalLoss > 0 ? totalGain / totalLoss : totalGain > 0 ? Infinity : 0;
  const moyenneGain = wins.length > 0 ? totalGain / wins.length : 0;
  const moyennePerte = losses.length > 0 ? totalLoss / losses.length : 0;

  // Max drawdown
  let peak = 0;
  let cumPnl = 0;
  let maxDrawdown = 0;
  const sortedByDate = [...trades].sort((a, b) => a.date_fermeture?.localeCompare(b.date_fermeture));
  for (const t of sortedByDate) {
    cumPnl += t.pnl || 0;
    if (cumPnl > peak) peak = cumPnl;
    const drawdown = peak - cumPnl;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // Sharpe simplifié (ratio gain moyen / écart-type)
  const allPnl = trades.map(t => t.pnl || 0);
  const mean = allPnl.reduce((a, b) => a + b, 0) / allPnl.length;
  const variance = allPnl.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / allPnl.length;
  const stdDev = Math.sqrt(variance);
  const sharpe = stdDev > 0 ? mean / stdDev : 0;

  // Best/Worst
  const bestTrade = trades.reduce((best, t) => (!best || t.pnl > best.pnl ? t : best), null);
  const worstTrade = trades.reduce((worst, t) => (!worst || t.pnl < worst.pnl ? t : worst), null);

  // Streak actuelle
  let streakActuelle = 0;
  let streakType = null;
  if (trades.length > 0) {
    const last = trades[0]; // trades triés par date DESC
    const isWin = last.pnl > 0;
    streakType = isWin ? 'WIN' : 'LOSS';
    for (const t of trades) {
      if ((t.pnl > 0) === isWin) streakActuelle++;
      else break;
    }
  }

  return {
    nbTrades: trades.length,
    winRate: parseFloat(winRate.toFixed(1)),
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    moyenneGain: parseFloat(moyenneGain.toFixed(2)),
    moyennePerte: parseFloat(moyennePerte.toFixed(2)),
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    sharpe: parseFloat(sharpe.toFixed(2)),
    bestTrade,
    worstTrade,
    streakActuelle,
    streakType,
  };
}

/**
 * Retourne la courbe de capital depuis les snapshots.
 */
function getCapitalCurve() {
  const snapshots = getSnapshots(90);
  return snapshots.map(s => ({
    date: s.date,
    capital: s.capital_total,
    pnlCumul: s.pnl_cumul,
  }));
}

/**
 * Retourne le P&L par jour sur 30 jours.
 */
function getDailyPnLStats() {
  return getDailyPnL(30);
}

/**
 * Enregistre un snapshot du portefeuille.
 */
function saveCapitalSnapshot(capitalTotal) {
  const trades = getClosedTrades(1); // Trades du jour
  const today = new Date().toISOString().split('T')[0];
  const last = getLastSnapshot();

  const pnlJour = trades.reduce((s, t) => {
    const tradeDate = t.date_fermeture?.split('T')[0];
    return tradeDate === today ? s + (t.pnl || 0) : s;
  }, 0);

  const pnlCumul = last ? (last.pnl_cumul || 0) + pnlJour : pnlJour;
  const capitalInitial = parseFloat(process.env.CAPITAL_INITIAL || '5000');
  const nbTrades = trades.filter(t => t.date_fermeture?.startsWith(today)).length;

  const allTrades = getClosedTrades(365);
  const wins = allTrades.filter(t => t.pnl > 0).length;
  const winRate = allTrades.length > 0 ? (wins / allTrades.length) * 100 : 0;

  insertSnapshot({
    date: today,
    capital_total: capitalTotal || capitalInitial + pnlCumul,
    pnl_jour: parseFloat(pnlJour.toFixed(2)),
    pnl_cumul: parseFloat(pnlCumul.toFixed(2)),
    nb_trades_jour: nbTrades,
    win_rate_cumul: parseFloat(winRate.toFixed(1)),
  });

  console.log(`[Analytics] Snapshot sauvegardé : ${today} | Capital: ${capitalTotal}€ | P&L jour: ${pnlJour.toFixed(2)}€`);
}

/**
 * Initialise le cron de snapshot à 16h05 EST.
 */
function initAnalyticsCron() {
  cron.schedule('5 16 * * 1-5', () => {
    console.log('[Analytics] Snapshot automatique 16h05 EST');
    saveCapitalSnapshot(null);
  }, { timezone: 'America/New_York' });

  console.log('[Analytics] Cron snapshot 16h05 EST (lun-ven) configuré');
}

/**
 * Résumé rapide pour le dashboard.
 */
function getSummary() {
  const stats = getStats();
  const last = getLastSnapshot();
  const capitalInitial = parseFloat(process.env.CAPITAL_INITIAL || '5000');

  return {
    capitalInitial,
    capitalActuel: last?.capital_total || capitalInitial,
    pnlJour: last?.pnl_jour || 0,
    pnlCumul: last?.pnl_cumul || 0,
    ...stats,
  };
}

module.exports = {
  getStats,
  getCapitalCurve,
  getDailyPnLStats,
  saveCapitalSnapshot,
  initAnalyticsCron,
  getSummary,
};

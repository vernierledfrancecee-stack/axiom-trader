/**
 * AXIOM — Module CRON
 * Scan automatique Hunt Market à 09h25 EST, lundi-vendredi.
 */

const cron = require('node-cron');
const { sendAlert, sendSignal } = require('./telegram');
const { getFundamentals } = require('./fundamental');
const { saveSignal } = require('./signalStore');

// Watchlist identique au client — 28 grandes caps liquides S&P500/NASDAQ
const WATCHLIST = [
  'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'GOOGL', 'NFLX',
  'AMD', 'INTC', 'QCOM', 'AVGO',
  'JPM', 'BAC', 'GS', 'V', 'MA',
  'XOM', 'CVX',
  'UNH', 'LLY', 'JNJ',
  'BA', 'CAT', 'GE',
  'SPY', 'QQQ', 'GLD',
];

/**
 * Récupère le prix actuel d'un ticker via Yahoo Finance.
 */
async function fetchLivePrice(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1m&range=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    return meta?.regularMarketPrice || meta?.previousClose || null;
  } catch {
    return null;
  }
}

/**
 * Pré-charge les prix de la watchlist en parallèle.
 * Retourne un objet { TICKER: price }
 */
async function prefetchWatchlistPrices() {
  const results = await Promise.all(
    WATCHLIST.map(async (ticker) => {
      const price = await fetchLivePrice(ticker);
      return [ticker, price];
    })
  );
  const map = {};
  for (const [ticker, price] of results) {
    if (price) map[ticker] = price;
  }
  return map;
}

/**
 * Parse la réponse JSON de Marcus pour extraire les signaux structurés.
 * @param {Object} result - Résultat de huntMarket()
 * @returns {Array} Liste de signaux structurés
 */
function extractSignals(result) {
  const signals = [];

  if (!result || !result.bestSetups || !Array.isArray(result.bestSetups)) {
    return signals;
  }

  for (const setup of result.bestSetups) {
    if (!setup.ticker) continue;
    if (setup.signal === 'NO TRADE') continue;

    /**
     * Parse un prix depuis une chaîne.
     * Gère : "$595", "$595-600", "595 - 600", "$595.50 (résistance clé)"
     * Prend le milieu d'une plage, ou le PREMIER prix trouvé (pas la moyenne).
     */
    function parsePrice(str) {
      if (!str) return null;
      const s = String(str);
      // Plage : "$595-600" ou "595 - 600" ou "$595–$600"
      const rangeMatch = s.match(/\$?([\d,]+\.?\d*)\s*[-–]\s*\$?([\d,]+\.?\d*)/);
      if (rangeMatch) {
        const low = parseFloat(rangeMatch[1].replace(',', ''));
        const high = parseFloat(rangeMatch[2].replace(',', ''));
        if (!isNaN(low) && !isNaN(high) && high > low && high < low * 1.5) {
          return (low + high) / 2;
        }
      }
      // Premier prix valide (précédé de $ ou en début de token)
      const priceMatch = s.match(/\$\s*([\d,]+\.?\d+)/);
      if (priceMatch) {
        const val = parseFloat(priceMatch[1].replace(',', ''));
        if (!isNaN(val) && val > 0) return val;
      }
      // Premier nombre dans la chaîne
      const firstNum = s.match(/([\d,]+\.?\d+)/);
      if (firstNum) {
        const val = parseFloat(firstNum[1].replace(',', ''));
        if (!isNaN(val) && val > 0) return val;
      }
      return null;
    }

    const entree = parsePrice(setup.entryZone || setup.prixActuel);
    const stop = parsePrice(setup.stopLoss);
    const tp1 = parsePrice(setup.target1);
    const tp2 = parsePrice(setup.target2);

    // Vérification de cohérence : stop et TP doivent être du bon côté de l'entrée
    const direction = setup.signal || setup.direction || 'LONG';
    if (entree && stop && tp1) {
      if (direction === 'LONG') {
        if (stop >= entree || tp1 <= entree) {
          console.warn(`[CRON] Setup ${setup.ticker} incohérent (LONG) : entrée=${entree} stop=${stop} tp1=${tp1} — ignoré`);
          continue;
        }
      } else if (direction === 'SHORT') {
        if (stop <= entree || tp1 >= entree) {
          console.warn(`[CRON] Setup ${setup.ticker} incohérent (SHORT) : entrée=${entree} stop=${stop} tp1=${tp1} — ignoré`);
          continue;
        }
      }
    }

    if (!entree || !stop || !tp1) continue;

    const rr = setup.riskReward || (tp1 && entree && stop
      ? `1:${((Math.abs(tp1 - entree)) / Math.abs(entree - stop)).toFixed(1)}`
      : '?');

    const conviction = Math.round((setup.conviction || 0) / 10);

    signals.push({
      ticker: setup.ticker,
      direction,
      entree: entree.toFixed(2),
      stop: stop.toFixed(2),
      tp1: tp1 ? tp1.toFixed(2) : '?',
      tp2: tp2 ? tp2.toFixed(2) : '?',
      rr,
      conviction,
      raison: setup.catalyst || setup.technicalSetup || '',
      // Champs étendus (Module 6)
      setup: setup.technicalSetup || '',
      rsi: setup.rsi || '',
      ratioVolume: setup.volumeRatio || '',
      pe: setup.pe || '',
      consensus: setup.consensus || '',
      joursEarnings: setup.daysToEarnings || '',
      pctRisque: setup.maxRiskPct || '',
      quantite: setup.positionSize || '',
      montantRisque: setup.riskAmount || '',
      recommandation: setup.recommandation || setup.direction || '',
      phraseVerdict: setup.phraseVerdict || '',
    });
  }

  return signals;
}

/**
 * Effectue le scan Hunt Market et envoie les signaux sur Telegram.
 */
async function triggerManualScan() {
  console.log(`[CRON] Déclenchement scan — ${new Date().toLocaleString('fr-FR', { timeZone: 'America/New_York' })} EST`);

  let result;
  let source = 'api';

  try {
    // Appel direct à l'API Anthropic côté serveur (équivalent à huntMarket du client)
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY absent');

    const HUNTER_SYSTEM = `Tu es Marcus Reid, trader institutionnel 20 ans NYSE/NASDAQ. Français uniquement. Froid, factuel.
R1:stop-loss obligatoire R2:R/R≥1:1.5 R3:max 2% capital R4:max 3 positions R5:drawdown>3%→stop R6:2 indicateurs min R7:volume confirme prix
JSON VALIDE UNIQUEMENT:
{
  "marketBrief": "string",
  "marketCondition": "BULLISH" | "BEARISH" | "NEUTRAL" | "VOLATILE",
  "vixLevel": "string",
  "sectorFocus": "string",
  "bestSetups": [
    {
      "rank": 1,
      "ticker": "string",
      "signal": "LONG" | "SHORT" | "NO TRADE",
      "direction": "LONG" | "SHORT",
      "timeframe": "SCALP" | "DAY TRADE" | "SWING 24H" | "SWING 48H",
      "conviction": 0-100,
      "entryZone": "string",
      "stopLoss": "string",
      "target1": "string",
      "target2": "string",
      "riskReward": "string",
      "catalyst": "string",
      "technicalSetup": "string",
      "volumeContext": "string",
      "invalidationNote": "string",
      "urgency": "HIGH" | "MEDIUM" | "LOW"
    }
  ],
  "avoidList": ["ticker1", "ticker2"]
}`;

    // Pré-charger les prix réels de la watchlist
    console.log('[CRON] Chargement des prix de la watchlist...');
    const priceMap = await prefetchWatchlistPrices();
    const priceCount = Object.keys(priceMap).length;
    console.log(`[CRON] ${priceCount}/${WATCHLIST.length} prix chargés`);

    const priceTable = WATCHLIST
      .filter(t => priceMap[t])
      .map(t => `${t}:$${priceMap[t].toFixed(2)}`)
      .join(' | ');

    const capital = process.env.CAPITAL_INITIAL || 5000;
    const userMessage = `Scanne le marché MAINTENANT. Capital disponible : $${capital}. Mode : SWING.

WATCHLIST AUTORISÉE — choisis UNIQUEMENT parmi ces titres :
${priceTable}

Ces prix sont réels (moins de 2 minutes). La zone d'entrée DOIT être à ±2% du prix fourni.
Utilise la recherche web pour identifier les catalyseurs, actualités et momentum du jour sur ces titres.
Trouve 3-4 setups à forte conviction en respectant toutes les règles. Retourne le JSON.`;

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'web-search-2025-03-05',
    };

    const body = {
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: HUNTER_SYSTEM,
      messages: [{ role: 'user', content: userMessage }],
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${errText}`);
    }

    const data = await response.json();

    // Extraire le texte de la réponse
    let fullText = '';
    if (data.content) {
      for (const block of data.content) {
        if (block.type === 'text') fullText += block.text;
      }
    }

    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Aucun JSON dans la réponse Marcus');
    result = JSON.parse(jsonMatch[0]);

  } catch (err) {
    console.error('[CRON] Erreur scan:', err.message);
    await sendAlert(`🔴 <b>AXIOM — Erreur scan 09h25</b>\n${err.message}`);
    return { success: false, error: err.message, signals: 0 };
  }

  // Extraire et envoyer les signaux
  const signals = extractSignals(result);
  console.log(`[CRON] ${signals.length} signal(s) détecté(s)`);

  if (signals.length === 0) {
    const condition = result.marketCondition || 'INCONNU';
    await sendAlert(`📊 <b>AXIOM — Scan 09h25 EST</b>\n\nAucun setup qualifié aujourd'hui.\n<b>Condition marché :</b> ${condition}\n${result.marketBrief ? '\n' + result.marketBrief : ''}`);
    return { success: true, signals: 0, marketCondition: result.marketCondition };
  }

  // Résumé de marché
  if (result.marketBrief) {
    await sendAlert(`📊 <b>AXIOM — Scan 09h25 EST</b>\n\n${result.marketBrief}\n<b>Condition :</b> ${result.marketCondition} | <b>VIX :</b> ${result.vixLevel}\n<b>Secteur :</b> ${result.sectorFocus}\n\n🔍 <b>${signals.length} setup(s) détecté(s)...</b>`);
  }

  // Enrichir les signaux avec les données fondamentales
  for (const signal of signals) {
    try {
      const fund = await getFundamentals(signal.ticker);
      if (fund) {
        signal.pe = fund.peTrailing ? fund.peTrailing.toFixed(1) : (signal.pe || '');
        signal.consensus = fund.consensusLabel || (signal.consensus || '');
        signal.joursEarnings = fund.daysToEarnings != null ? fund.daysToEarnings : (signal.joursEarnings || '');
      }
    } catch (err) {
      console.warn(`[CRON] Fondamentaux ${signal.ticker} indisponibles:`, err.message);
    }
    // Sauvegarder dans le store pour que le bot puisse retrouver stop/TP
    saveSignal(signal);
    await sendSignal(signal);
    // Petit délai pour éviter le rate limiting Telegram
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`[CRON] ${signals.length} signal(s) envoyé(s) sur Telegram`);
  return { success: true, signals: signals.length, setups: signals, marketCondition: result.marketCondition };
}

/**
 * Initialise le job CRON — 09h25 EST, lundi-vendredi.
 */
function initCron() {
  const task = cron.schedule('25 9 * * 1-5', async () => {
    console.log('[CRON] Déclenchement automatique 09h25 EST');
    try {
      await triggerManualScan();
    } catch (err) {
      console.error('[CRON] Erreur non gérée:', err.message);
      await sendAlert(`🔴 <b>AXIOM — Erreur cron scan</b>\n${err.message}`);
    }
  }, {
    timezone: 'America/New_York',
  });

  console.log('[CRON] Job 09h25 EST (lun-ven) configuré');
  return task;
}

module.exports = { initCron, triggerManualScan };

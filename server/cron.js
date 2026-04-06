/**
 * AXIOM — Module CRON
 * Scan automatique Hunt Market à 09h25 EST, lundi-vendredi.
 */

const cron = require('node-cron');
const { sendAlert, sendSignal } = require('./telegram');

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

    // Extraire les prix depuis les chaînes format "$XXX" ou "XXX-XXX"
    function parsePrice(str) {
      if (!str) return null;
      const nums = (String(str).match(/[\d.]+/g) || []).map(Number).filter(Boolean);
      if (!nums.length) return null;
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    }

    const entree = parsePrice(setup.entryZone);
    const stop = parsePrice(setup.stopLoss);
    const tp1 = parsePrice(setup.target1);
    const tp2 = parsePrice(setup.target2);

    if (!entree || !stop || !tp1) continue;

    const rr = setup.riskReward || (tp1 && entree && stop
      ? `1:${((tp1 - entree) / Math.abs(entree - stop)).toFixed(1)}`
      : '?');

    const conviction = Math.round((setup.conviction || 0) / 10);

    signals.push({
      ticker: setup.ticker,
      direction: setup.signal || setup.direction || 'LONG',
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

    const capital = process.env.CAPITAL_INITIAL || 5000;
    const userMessage = `Scanne le marché MAINTENANT. Capital disponible : $${capital}. Mode : SWING.

Utilise la recherche web pour trouver les meilleures opportunités du jour. Trouve 3-4 setups à forte conviction en respectant toutes les règles. Retourne le JSON.`;

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
    await sendAlert('📊 Scan 09h25 terminé — aucun setup qualifié aujourd\'hui');
    return { success: true, signals: 0, marketCondition: result.marketCondition };
  }

  // Résumé de marché
  if (result.marketBrief) {
    await sendAlert(`📊 <b>AXIOM — Scan 09h25 EST</b>\n\n${result.marketBrief}\n<b>Condition :</b> ${result.marketCondition} | <b>VIX :</b> ${result.vixLevel}\n<b>Secteur :</b> ${result.sectorFocus}\n\n🔍 <b>${signals.length} setup(s) détecté(s)...</b>`);
  }

  for (const signal of signals) {
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

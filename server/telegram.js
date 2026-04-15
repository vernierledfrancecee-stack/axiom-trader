/**
 * AXIOM — Module Telegram
 * Singleton bot Telegram pour les alertes de trading.
 */

let TelegramBot;
try {
  TelegramBot = require('node-telegram-bot-api');
} catch (e) {
  console.warn('[Telegram] node-telegram-bot-api non disponible:', e.message);
}

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let bot = null;
let pollingEnabled = false;

function initBot(enablePolling = false) {
  if (!TOKEN) {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN absent — les alertes Telegram sont désactivées.');
    return null;
  }
  if (!TelegramBot) {
    console.warn('[Telegram] Module TelegramBot non disponible.');
    return null;
  }
  if (bot) return bot;

  try {
    bot = new TelegramBot(TOKEN, { polling: enablePolling });
    pollingEnabled = enablePolling;
    console.log(`[Telegram] Bot initialisé (polling: ${enablePolling})`);

    if (enablePolling) {
      setupPollingHandlers();
    }
  } catch (err) {
    console.error('[Telegram] Erreur initialisation bot:', err.message);
    bot = null;
  }

  return bot;
}

/**
 * Configure les handlers de messages entrants (polling actif).
 */
function setupPollingHandlers() {
  if (!bot) return;

  const { getActiveTrades, closeTrade, openTrade } = require('./tradeTracker');
  const { getSignal, getAllSignals } = require('./signalStore');

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();

    // /status — résumé du portefeuille
    if (text === '/status') {
      try {
        const trades = getActiveTrades();
        const count = Object.keys(trades).length;
        let pnlTotal = 0;
        let lines = [`📊 <b>AXIOM — Status</b>\n`, `<b>Trades actifs :</b> ${count}`];
        for (const [ticker, t] of Object.entries(trades)) {
          const pnl = (t.prixActuel - t.entree) * t.quantite * (t.direction === 'SHORT' ? -1 : 1);
          pnlTotal += pnl;
          const pnlStr = pnl >= 0 ? `+${pnl.toFixed(2)}€` : `${pnl.toFixed(2)}€`;
          lines.push(`• ${ticker} (${t.direction}) → P&L: ${pnlStr}`);
        }
        lines.push(`\n<b>P&L total :</b> ${pnlTotal >= 0 ? '+' : ''}${pnlTotal.toFixed(2)}€`);
        await bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'HTML' });
      } catch (err) {
        await bot.sendMessage(chatId, `Erreur: ${err.message}`);
      }
      return;
    }

    // /trades — liste des trades actifs
    if (text === '/trades') {
      try {
        const trades = getActiveTrades();
        const keys = Object.keys(trades);
        if (keys.length === 0) {
          await bot.sendMessage(chatId, '📊 Aucun trade actif en ce moment.', { parse_mode: 'HTML' });
          return;
        }
        const lines = ['📋 <b>Trades actifs :</b>\n'];
        for (const ticker of keys) {
          const t = trades[ticker];
          const pnl = (t.prixActuel - t.entree) * t.quantite * (t.direction === 'SHORT' ? -1 : 1);
          lines.push(`• <b>${ticker}</b> ${t.direction} | Entrée: ${t.entree} | Prix: ${t.prixActuel || '?'} | P&L: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}€`);
        }
        await bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'HTML' });
      } catch (err) {
        await bot.sendMessage(chatId, `Erreur: ${err.message}`);
      }
      return;
    }

    // /stop {ticker} — fermer un trade
    const stopMatch = text.match(/^\/stop\s+([A-Z]{1,6})/i);
    if (stopMatch) {
      const ticker = stopMatch[1].toUpperCase();
      try {
        const trades = getActiveTrades();
        if (!trades[ticker]) {
          await bot.sendMessage(chatId, `❌ Aucun trade actif sur ${ticker}.`);
          return;
        }
        const result = await closeTrade(ticker, trades[ticker].prixActuel, 'Fermé via Telegram');
        await bot.sendMessage(chatId,
          `🛑 <b>Trade fermé — ${ticker}</b>\nP&L: ${result.pnl >= 0 ? '+' : ''}${result.pnl.toFixed(2)}€ (${result.pnlPct >= 0 ? '+' : ''}${result.pnlPct.toFixed(2)}%)`,
          { parse_mode: 'HTML' }
        );
      } catch (err) {
        await bot.sendMessage(chatId, `Erreur fermeture ${ticker}: ${err.message}`);
      }
      return;
    }

    // ─── "pris TICKER [prix] [qté]" — ouvre un trade ───────────────────────
    // Exemples : "pris GLD", "pris GLD 428", "pris GLD 428.50 10"
    const prisMatch = text.match(/^pris\s+([A-Z]{1,6})(?:\s+([\d.,]+))?(?:\s+(\d+))?/i);
    if (prisMatch) {
      const ticker = prisMatch[1].toUpperCase();
      const prixManuel = prisMatch[2] ? parseFloat(prisMatch[2].replace(',', '.')) : null;
      const qtyManuelle = prisMatch[3] ? parseInt(prisMatch[3]) : null;

      try {
        // Récupérer le signal correspondant
        const signal = getSignal(ticker);
        if (!signal) {
          await bot.sendMessage(chatId,
            `⚠️ Aucun signal récent pour <b>${ticker}</b>.\nFais d'abord un scan ou utilise :\n<code>pris ${ticker} PRIX QTÉ STOP TP1</code>`,
            { parse_mode: 'HTML' }
          );
          return;
        }

        const entree = prixManuel || parseFloat(signal.entree);
        const stop = parseFloat(signal.stop);
        const tp1 = parseFloat(signal.tp1);
        const tp2 = parseFloat(signal.tp2);
        const direction = signal.direction || 'LONG';

        // Calcul automatique de la quantité si non fournie (risque 2% du capital)
        let quantite = qtyManuelle;
        if (!quantite) {
          const capital = parseFloat(process.env.CAPITAL_INITIAL || 5000);
          const risqueParAction = Math.abs(entree - stop);
          if (risqueParAction > 0) {
            quantite = Math.max(1, Math.floor((capital * 0.02) / risqueParAction));
          } else {
            quantite = 1;
          }
        }

        await openTrade({ ticker, direction, entree, stop, tp1, tp2, rr: signal.rr, quantite });

        const mult = direction === 'SHORT' ? -1 : 1;
        const risqueTotal = Math.abs(entree - stop) * quantite;
        const potentielTP1 = Math.abs(tp1 - entree) * quantite;

        await bot.sendMessage(chatId,
          `✅ <b>Trade enregistré — ${ticker} ${direction}</b>\n\n` +
          `💰 Entrée : <b>$${entree.toFixed(2)}</b> × ${quantite} actions\n` +
          `🛑 Stop : $${stop.toFixed(2)} (risque max : <b>${risqueTotal.toFixed(0)}€</b>)\n` +
          `🎯 TP1 : $${tp1.toFixed(2)} (potentiel : <b>+${potentielTP1.toFixed(0)}€</b>)\n` +
          `🎯 TP2 : $${tp2 ? tp2.toFixed(2) : '?'}\n\n` +
          `📡 Surveillance active — alertes automatiques stop/TP toutes les 15s`,
          { parse_mode: 'HTML' }
        );
      } catch (err) {
        await bot.sendMessage(chatId, `❌ Erreur ouverture trade ${ticker}: ${err.message}`);
      }
      return;
    }

    // ─── "vendu TICKER [prix]" — ferme un trade ─────────────────────────────
    // Exemples : "vendu GLD", "vendu GLD 432.50"
    const venduMatch = text.match(/^vendu\s+([A-Z]{1,6})(?:\s+([\d.,]+))?/i);
    if (venduMatch) {
      const ticker = venduMatch[1].toUpperCase();
      const prixSortie = venduMatch[2] ? parseFloat(venduMatch[2].replace(',', '.')) : null;

      try {
        const trades = getActiveTrades();
        if (!trades[ticker]) {
          await bot.sendMessage(chatId, `❌ Aucun trade actif sur <b>${ticker}</b>.`, { parse_mode: 'HTML' });
          return;
        }

        const prix = prixSortie || trades[ticker].prixActuel;
        const result = await closeTrade(ticker, prix, 'Fermé manuellement via Telegram');

        const emoji = result.pnl >= 0 ? '✅' : '🔴';
        await bot.sendMessage(chatId,
          `${emoji} <b>Trade clôturé — ${ticker}</b>\n\n` +
          `Sortie : $${result.prixSortie.toFixed(2)}\n` +
          `P&L : <b>${result.pnl >= 0 ? '+' : ''}${result.pnl.toFixed(2)}€</b> (${result.pnlPct >= 0 ? '+' : ''}${result.pnlPct.toFixed(2)}%)\n` +
          `Durée : ${result.dureeMinutes} min\n\n` +
          `📋 <i>${result.rapport}</i>`,
          { parse_mode: 'HTML' }
        );
      } catch (err) {
        await bot.sendMessage(chatId, `❌ Erreur fermeture ${ticker}: ${err.message}`);
      }
      return;
    }

    // ─── "/signaux" — liste les signaux disponibles ──────────────────────────
    if (text === '/signaux') {
      const signaux = getAllSignals();
      if (!signaux.length) {
        await bot.sendMessage(chatId, '📭 Aucun signal récent. Lance un scan d\'abord.');
        return;
      }
      const lines = ['📋 <b>Signaux disponibles :</b>\n'];
      for (const s of signaux) {
        lines.push(`• <b>${s.ticker}</b> ${s.direction} | Entrée: $${s.entree} | Stop: $${s.stop} | TP1: $${s.tp1}`);
        lines.push(`  → Réponds <code>pris ${s.ticker}</code> pour l'enregistrer`);
      }
      await bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'HTML' });
      return;
    }

    // ─── "/aide" — affiche les commandes ─────────────────────────────────────
    if (text === '/aide' || text === '/help') {
      await bot.sendMessage(chatId,
        `🤖 <b>AXIOM — Commandes disponibles</b>\n\n` +
        `<b>Signaux :</b>\n` +
        `• <code>/signaux</code> — voir les derniers signaux\n\n` +
        `<b>Ouvrir un trade :</b>\n` +
        `• <code>pris GLD</code> — entrée auto au prix du signal\n` +
        `• <code>pris GLD 428</code> — entrée à $428, qté auto\n` +
        `• <code>pris GLD 428 10</code> — entrée $428, 10 actions\n\n` +
        `<b>Fermer un trade :</b>\n` +
        `• <code>vendu GLD</code> — sortie au prix actuel\n` +
        `• <code>vendu GLD 435</code> — sortie à $435\n\n` +
        `<b>Portfolio :</b>\n` +
        `• <code>/status</code> — résumé P&L\n` +
        `• <code>/trades</code> — trades actifs\n` +
        `• <code>/stop TICKER</code> — fermer un trade`,
        { parse_mode: 'HTML' }
      );
      return;
    }
  });

  bot.on('polling_error', (err) => {
    console.error('[Telegram] Polling error:', err.message);
  });
}

/**
 * Envoie un message HTML brut.
 * @param {string} message
 */
async function sendAlert(message) {
  if (!bot) {
    console.warn('[Telegram] sendAlert ignoré : bot non initialisé (TELEGRAM_BOT_TOKEN absent ou invalide)');
    return;
  }
  if (!CHAT_ID) {
    console.warn('[Telegram] sendAlert ignoré : TELEGRAM_CHAT_ID absent dans les variables d\'environnement');
    return;
  }
  try {
    await bot.sendMessage(CHAT_ID, message, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('[Telegram] sendAlert error:', err.message);
  }
}

/**
 * Teste la connexion Telegram en envoyant un message de diagnostic.
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
async function testConnection() {
  if (!bot) return { ok: false, error: 'Bot non initialisé — TELEGRAM_BOT_TOKEN manquant ou invalide' };
  if (!CHAT_ID) return { ok: false, error: 'TELEGRAM_CHAT_ID absent' };
  try {
    await bot.sendMessage(CHAT_ID,
      `🔔 <b>AXIOM — Test de connexion</b>\n\n✅ Les notifications Telegram fonctionnent correctement.\n⏰ ${new Date().toLocaleString('fr-FR', { timeZone: 'America/New_York' })} EST`,
      { parse_mode: 'HTML' }
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Formate et envoie un signal de trading.
 * @param {Object} signal
 */
async function sendSignal(signal) {
  if (!bot) {
    console.warn('[Telegram] sendSignal ignoré : bot non initialisé (TELEGRAM_BOT_TOKEN absent ou invalide)');
    return;
  }
  if (!CHAT_ID) {
    console.warn('[Telegram] sendSignal ignoré : TELEGRAM_CHAT_ID absent dans les variables d\'environnement');
    return;
  }

  const {
    ticker = '?',
    direction = '?',
    entree = '?',
    stop = '?',
    tp1 = '?',
    tp2 = '?',
    rr = '?',
    conviction = '?',
    raison = '',
    // Module 6 - champs étendus
    setup = '',
    rsi = '',
    ratioVolume = '',
    pe = '',
    consensus = '',
    joursEarnings = '',
    pctRisque = '',
    quantite = '',
    montantRisque = '',
    recommandation = '',
    phraseVerdict = '',
  } = signal;

  // Format étendu si données fondamentales disponibles
  const hasExtended = setup || rsi || pe || consensus;

  // Emoji et label de recommandation
  const hasRecoKeyword = recommandation?.includes('ENTRER') || recommandation?.includes('ATTENDRE') || recommandation?.includes('ÉVITER');
  const emojiReco = hasRecoKeyword
    ? (recommandation.includes('ENTRER') ? '✅' : recommandation.includes('ATTENDRE') ? '⚠️' : '❌')
    : (direction === 'SHORT' ? '📉' : '📈');
  const labelReco = hasRecoKeyword ? recommandation : direction;

  let message;
  if (hasExtended) {
    message = `🚨 <b>SETUP DÉTECTÉ — ${ticker}</b>
${phraseVerdict ? `<i>${phraseVerdict}</i>` : ''}

📊 <b>Technique :</b> ${setup} | RSI ${rsi} | Vol x${ratioVolume}
💼 <b>Fondamental :</b> P/E ${pe} | Analystes ${consensus}${joursEarnings ? ` | Earnings dans ${joursEarnings}j` : ''}

💰 <b>Entrée :</b> ${entree}
🛑 <b>Stop :</b> ${stop}${pctRisque ? ` (-${pctRisque}%)` : ''}
🎯 <b>TP1 :</b> ${tp1} | <b>TP2 :</b> ${tp2}
⚖️ <b>R:R :</b> ${rr} | 🔥 <b>Conviction :</b> ${conviction}/10
${quantite ? `📦 <b>Taille :</b> ${quantite} actions (${montantRisque}€ risqués)` : ''}

${emojiReco} <b>${labelReco}</b>

⏰ ${new Date().toLocaleString('fr-FR', { timeZone: 'America/New_York' })} EST`;
  } else {
    message = `🚨 <b>SETUP DÉTECTÉ — ${ticker}</b>

📈 <b>Direction :</b> ${direction}
💰 <b>Entrée :</b> ${entree}
🛑 <b>Stop :</b> ${stop}
🎯 <b>TP1 :</b> ${tp1}
🎯 <b>TP2 :</b> ${tp2}
⚖️ <b>R:R :</b> ${rr}
🔥 <b>Conviction :</b> ${conviction}/10

📋 <b>Raison :</b> ${raison}

⏰ ${new Date().toLocaleString('fr-FR', { timeZone: 'America/New_York' })} EST`;
  }

  try {
    await bot.sendMessage(CHAT_ID, message, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('[Telegram] sendSignal error:', err.message);
  }
}

module.exports = { initBot, sendAlert, sendSignal, testConnection };

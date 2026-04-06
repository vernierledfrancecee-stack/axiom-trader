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

  const { getActiveTrades, closeTrade } = require('./tradeTracker');

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

    // "acheté {ticker}" ou "bought {ticker}"
    const buyMatch = text.match(/(?:acheté|bought)\s+([A-Z]{1,6})/i);
    if (buyMatch) {
      const ticker = buyMatch[1].toUpperCase();
      await bot.sendMessage(chatId,
        `✅ Confirmation reçue pour <b>${ticker}</b>.\nUtilise l'interface AXIOM ou POST /api/trade/open pour enregistrer les détails du trade.`,
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
  if (!bot || !CHAT_ID) return;
  try {
    await bot.sendMessage(CHAT_ID, message, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('[Telegram] sendAlert error:', err.message);
  }
}

/**
 * Formate et envoie un signal de trading.
 * @param {Object} signal
 */
async function sendSignal(signal) {
  if (!bot || !CHAT_ID) return;

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

  let message;
  if (hasExtended) {
    const emojiReco = recommandation?.includes('ENTRER') ? '✅' :
                      recommandation?.includes('ATTENDRE') ? '⚠️' : '❌';

    message = `🚨 <b>SETUP DÉTECTÉ — ${ticker}</b>
${phraseVerdict ? `<i>${phraseVerdict}</i>` : ''}

📊 <b>Technique :</b> ${setup} | RSI ${rsi} | Vol x${ratioVolume}
💼 <b>Fondamental :</b> P/E ${pe} | Analystes ${consensus} | Earnings dans ${joursEarnings}j

💰 <b>Entrée :</b> ${entree}
🛑 <b>Stop :</b> ${stop}${pctRisque ? ` (-${pctRisque}%)` : ''}
🎯 <b>TP1 :</b> ${tp1} | <b>TP2 :</b> ${tp2}
⚖️ <b>R:R :</b> ${rr} | 🔥 <b>Conviction :</b> ${conviction}/10
${quantite ? `📦 <b>Taille :</b> ${quantite} actions (${montantRisque}€ risqués)` : ''}

${emojiReco} <b>${recommandation || direction}</b>

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

module.exports = { initBot, sendAlert, sendSignal };

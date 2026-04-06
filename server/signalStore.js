/**
 * AXIOM — Signal Store
 * Stocke les derniers signaux en mémoire pour que le bot Telegram
 * puisse retrouver stop/TP/direction quand l'utilisateur répond "pris TICKER".
 * Expiration : 48h.
 */

const store = new Map(); // ticker → { signal, savedAt }
const TTL_MS = 48 * 60 * 60 * 1000;

function saveSignal(signal) {
  if (!signal?.ticker) return;
  store.set(signal.ticker.toUpperCase(), {
    signal,
    savedAt: Date.now(),
  });
}

function getSignal(ticker) {
  const entry = store.get(ticker.toUpperCase());
  if (!entry) return null;
  if (Date.now() - entry.savedAt > TTL_MS) {
    store.delete(ticker.toUpperCase());
    return null;
  }
  return entry.signal;
}

function getAllSignals() {
  const now = Date.now();
  const result = [];
  for (const [ticker, entry] of store.entries()) {
    if (now - entry.savedAt <= TTL_MS) {
      result.push(entry.signal);
    }
  }
  return result;
}

module.exports = { saveSignal, getSignal, getAllSignals };

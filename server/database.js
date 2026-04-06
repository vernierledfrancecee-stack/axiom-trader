/**
 * AXIOM — Module Database (SQLite)
 * Gère la persistance des trades et des snapshots de capital.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Créer le dossier data/ si nécessaire
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'axiom.db');
const db = new Database(DB_PATH);

// Optimisations SQLite
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

/**
 * Initialise les tables (migration safe).
 */
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL,
      direction TEXT NOT NULL CHECK(direction IN ('LONG', 'SHORT')),
      entree REAL NOT NULL,
      stop REAL NOT NULL,
      tp1 REAL,
      tp2 REAL,
      rr TEXT,
      quantite INTEGER NOT NULL,
      prix_sortie REAL,
      pnl REAL,
      pnl_pct REAL,
      raison_sortie TEXT,
      rapport_marcus TEXT,
      date_ouverture TEXT NOT NULL,
      date_fermeture TEXT,
      duree_minutes INTEGER,
      status TEXT NOT NULL DEFAULT 'OUVERT' CHECK(status IN ('OUVERT', 'FERME', 'STOP', 'TP1', 'TP2'))
    );

    CREATE TABLE IF NOT EXISTS capital_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      capital_total REAL NOT NULL,
      pnl_jour REAL DEFAULT 0,
      pnl_cumul REAL DEFAULT 0,
      nb_trades_jour INTEGER DEFAULT 0,
      win_rate_cumul REAL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_trades_ticker ON trades(ticker);
    CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
    CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(date_ouverture);
    CREATE INDEX IF NOT EXISTS idx_snapshots_date ON capital_snapshots(date);
  `);

  console.log('[Database] Initialisée:', DB_PATH);
}

// ─── Trades ─────────────────────────────────────────────────────────────────

function insertTrade(trade) {
  const stmt = db.prepare(`
    INSERT INTO trades (ticker, direction, entree, stop, tp1, tp2, rr, quantite, date_ouverture, status)
    VALUES (@ticker, @direction, @entree, @stop, @tp1, @tp2, @rr, @quantite, @date_ouverture, 'OUVERT')
  `);
  const result = stmt.run(trade);
  return result.lastInsertRowid;
}

function closeTrade(id, data) {
  const stmt = db.prepare(`
    UPDATE trades SET
      prix_sortie = @prix_sortie,
      pnl = @pnl,
      pnl_pct = @pnl_pct,
      raison_sortie = @raison_sortie,
      rapport_marcus = @rapport_marcus,
      date_fermeture = @date_fermeture,
      duree_minutes = @duree_minutes,
      status = @status
    WHERE id = @id
  `);
  return stmt.run({ ...data, id });
}

function getTradeHistory(limit = 50) {
  return db.prepare(`
    SELECT * FROM trades WHERE status != 'OUVERT'
    ORDER BY date_fermeture DESC LIMIT ?
  `).all(limit);
}

function getOpenTrades() {
  return db.prepare(`SELECT * FROM trades WHERE status = 'OUVERT'`).all();
}

function getTradeById(id) {
  return db.prepare(`SELECT * FROM trades WHERE id = ?`).get(id);
}

// ─── Capital Snapshots ───────────────────────────────────────────────────────

function insertSnapshot(snapshot) {
  const stmt = db.prepare(`
    INSERT INTO capital_snapshots (date, capital_total, pnl_jour, pnl_cumul, nb_trades_jour, win_rate_cumul)
    VALUES (@date, @capital_total, @pnl_jour, @pnl_cumul, @nb_trades_jour, @win_rate_cumul)
  `);
  return stmt.run(snapshot);
}

function getSnapshots(days = 90) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return db.prepare(`
    SELECT * FROM capital_snapshots
    WHERE date >= ?
    ORDER BY date ASC
  `).all(since.toISOString().split('T')[0]);
}

function getLastSnapshot() {
  return db.prepare(`SELECT * FROM capital_snapshots ORDER BY date DESC LIMIT 1`).get();
}

// ─── Analytics ───────────────────────────────────────────────────────────────

function getClosedTrades(days = 365) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return db.prepare(`
    SELECT * FROM trades
    WHERE status != 'OUVERT' AND date_fermeture >= ?
    ORDER BY date_fermeture DESC
  `).all(since.toISOString().split('T')[0] + 'T00:00:00');
}

function getDailyPnL(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return db.prepare(`
    SELECT
      date(date_fermeture) as jour,
      SUM(pnl) as pnl_total,
      COUNT(*) as nb_trades,
      SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins
    FROM trades
    WHERE status != 'OUVERT' AND date_fermeture >= ?
    GROUP BY date(date_fermeture)
    ORDER BY jour ASC
  `).all(since.toISOString().split('T')[0] + 'T00:00:00');
}

module.exports = {
  db,
  initDatabase,
  insertTrade,
  closeTrade,
  getTradeHistory,
  getOpenTrades,
  getTradeById,
  insertSnapshot,
  getSnapshots,
  getLastSnapshot,
  getClosedTrades,
  getDailyPnL,
};

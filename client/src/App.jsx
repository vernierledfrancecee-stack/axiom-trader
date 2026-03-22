import React, { useState, useEffect, useCallback } from 'react';
import { huntMarket, deepDive } from './api.js';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: '#030810',
  panel: '#070f1a',
  border: '#0d1f35',
  green: '#00ff88',
  red: '#ff3b5c',
  yellow: '#f0b429',
  blue: '#38bdf8',
  muted: '#4a6080',
  text: '#e0e6f0',
};

// ─── Global styles (injected once) ────────────────────────────────────────────
const GLOBAL_CSS = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes scanline {
    0%   { background-position: 0 0; }
    100% { background-position: 0 100%; }
  }
  .fadeUp { animation: fadeUp 0.4s ease forwards; }
  .pulse  { animation: pulse 1.5s ease infinite; }
  .spin   { animation: spin 0.8s linear infinite; }

  input, select, button { font-family: 'IBM Plex Mono', monospace; }
  input:focus, select:focus { outline: none; }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: ${C.bg}; }
  ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }

  .tab-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 10px 20px;
    font-size: 13px;
    letter-spacing: 2px;
    color: ${C.muted};
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
    font-family: 'Bebas Neue', cursive;
    font-size: 16px;
  }
  .tab-btn:hover { color: ${C.text}; }
  .tab-btn.active { color: ${C.green}; border-bottom-color: ${C.green}; }

  .btn-primary {
    background: ${C.green};
    color: ${C.bg};
    border: none;
    padding: 10px 24px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 2px;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.1s;
    text-transform: uppercase;
  }
  .btn-primary:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

  .btn-secondary {
    background: transparent;
    color: ${C.blue};
    border: 1px solid ${C.blue};
    padding: 6px 14px;
    font-size: 11px;
    letter-spacing: 1px;
    cursor: pointer;
    transition: all 0.2s;
    text-transform: uppercase;
  }
  .btn-secondary:hover { background: ${C.blue}; color: ${C.bg}; }

  .field-input {
    background: ${C.panel};
    border: 1px solid ${C.border};
    color: ${C.text};
    padding: 9px 14px;
    font-size: 13px;
    transition: border-color 0.2s;
    width: 100%;
  }
  .field-input:focus { border-color: ${C.green}; }

  .card {
    background: ${C.panel};
    border: 1px solid ${C.border};
    padding: 20px;
    transition: border-color 0.2s, transform 0.2s;
  }
  .card:hover { border-color: ${C.muted}; }

  .badge {
    display: inline-block;
    padding: 2px 8px;
    font-size: 10px;
    letter-spacing: 1.5px;
    font-weight: 600;
    text-transform: uppercase;
  }
`;

function injectGlobalCSS() {
  if (document.getElementById('axiom-styles')) return;
  const style = document.createElement('style');
  style.id = 'axiom-styles';
  style.textContent = GLOBAL_CSS;
  document.head.appendChild(style);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function directionColor(dir) {
  return dir === 'LONG' ? C.green : dir === 'SHORT' ? C.red : C.yellow;
}

function timeframeColor(tf) {
  const map = { SCALP: C.yellow, 'DAY TRADE': C.blue, 'SWING 24H': C.green, 'SWING 48H': C.muted };
  return map[tf] || C.text;
}

function urgencyColor(u) {
  return u === 'HIGH' ? C.red : u === 'MEDIUM' ? C.yellow : C.muted;
}

function conditionColor(c) {
  if (!c) return C.muted;
  const u = c.toUpperCase();
  if (u === 'BULLISH') return C.green;
  if (u === 'BEARISH') return C.red;
  if (u === 'VOLATILE') return C.yellow;
  return C.blue;
}

function Badge({ label, color }) {
  return (
    <span className="badge" style={{ background: color + '22', color, border: `1px solid ${color}44` }}>
      {label}
    </span>
  );
}

function Spinner() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 40 }}>
      <div
        className="spin"
        style={{
          width: 40, height: 40,
          border: `3px solid ${C.border}`,
          borderTopColor: C.green,
          borderRadius: '50%',
        }}
      />
      <span className="pulse" style={{ color: C.green, fontSize: 12, letterSpacing: 3 }}>SCANNING MARKETS…</span>
    </div>
  );
}

function ErrorBox({ message }) {
  return (
    <div style={{ background: C.red + '11', border: `1px solid ${C.red}44`, padding: 16, color: C.red, fontSize: 12 }}>
      ERROR: {message}
    </div>
  );
}

function PriceRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ color: C.muted, fontSize: 11, letterSpacing: 1 }}>{label}</span>
      <span style={{ color: color || C.text, fontSize: 12, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

// ─── Tab 1: HUNT MARKET ───────────────────────────────────────────────────────
function HuntTab({ onDeepDive }) {
  const [capital, setCapital] = useState('10000');
  const [mode, setMode] = useState('Full Market');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const launch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await huntMarket(capital, mode);
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [capital, mode]);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24, alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={{ display: 'block', fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 6 }}>CAPITAL ($)</label>
          <input
            className="field-input"
            type="number"
            value={capital}
            onChange={e => setCapital(e.target.value)}
            min="100"
            placeholder="10000"
          />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ display: 'block', fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 6 }}>SCAN MODE</label>
          <select className="field-input" value={mode} onChange={e => setMode(e.target.value)}>
            <option>Full Market</option>
            <option>Sector Rotation</option>
            <option>Momentum Only</option>
          </select>
        </div>
        <button className="btn-primary" onClick={launch} disabled={loading || !capital}>
          {loading ? '▶ SCANNING…' : '▶ LAUNCH HUNT'}
        </button>
      </div>

      {loading && <Spinner />}
      {error && <ErrorBox message={error} />}

      {result && (
        <div className="fadeUp">
          {/* Market Brief */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
              <span style={{ fontFamily: 'Bebas Neue', fontSize: 22, letterSpacing: 2, color: C.green }}>MARKET BRIEF</span>
              <Badge label={result.marketCondition} color={conditionColor(result.marketCondition)} />
            </div>
            <p style={{ color: C.text, fontSize: 12, lineHeight: 1.7, marginBottom: 14 }}>{result.marketBrief}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <div style={{ background: C.bg, padding: 12, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 4 }}>VIX LEVEL</div>
                <div style={{ fontSize: 13, color: C.yellow }}>{result.vixLevel}</div>
              </div>
              <div style={{ background: C.bg, padding: 12, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 4 }}>SECTOR FOCUS</div>
                <div style={{ fontSize: 13, color: C.blue }}>{result.sectorFocus}</div>
              </div>
            </div>
          </div>

          {/* Setups */}
          <div style={{ fontFamily: 'Bebas Neue', fontSize: 18, letterSpacing: 3, color: C.muted, marginBottom: 12 }}>
            TOP SETUPS — RANKED BY CONVICTION
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
            {(result.bestSetups || []).map((setup, i) => (
              <SetupCard key={i} setup={setup} onDeepDive={onDeepDive} delay={i * 80} />
            ))}
          </div>

          {/* Avoid list */}
          {result.avoidList && result.avoidList.length > 0 && (
            <div style={{ marginTop: 20, padding: 14, border: `1px solid ${C.red}33`, background: C.red + '08' }}>
              <span style={{ fontSize: 10, color: C.red, letterSpacing: 2 }}>AVOID TODAY: </span>
              {result.avoidList.map((t, i) => (
                <span key={i} style={{ color: C.red, fontSize: 12, marginLeft: 8 }}>{t}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SetupCard({ setup, onDeepDive, delay }) {
  return (
    <div
      className="card fadeUp"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both', opacity: 0 }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'Bebas Neue', fontSize: 28, color: C.text, letterSpacing: 2 }}>
              {setup.ticker}
            </span>
            <span style={{ fontFamily: 'Bebas Neue', fontSize: 14, color: C.muted }}>#{setup.rank}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <Badge label={setup.direction} color={directionColor(setup.direction)} />
            <Badge label={setup.timeframe} color={timeframeColor(setup.timeframe)} />
            <Badge label={`${setup.urgency} URGENCY`} color={urgencyColor(setup.urgency)} />
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1 }}>CONVICTION</div>
          <div style={{ fontSize: 24, fontFamily: 'Bebas Neue', color: setup.conviction >= 75 ? C.green : setup.conviction >= 50 ? C.yellow : C.red }}>
            {setup.conviction}%
          </div>
        </div>
      </div>

      {/* Price levels */}
      <div style={{ marginBottom: 12 }}>
        <PriceRow label="ENTRY ZONE" value={setup.entryZone} color={C.blue} />
        <PriceRow label="STOP LOSS" value={setup.stopLoss} color={C.red} />
        <PriceRow label="TARGET 1" value={setup.target1} color={C.green} />
        <PriceRow label="TARGET 2" value={setup.target2} color={C.green} />
        <PriceRow label="R/R RATIO" value={setup.riskReward} color={C.yellow} />
      </div>

      {/* Details */}
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
        <div style={{ marginBottom: 6 }}>
          <span style={{ color: C.blue, letterSpacing: 1 }}>CATALYST: </span>
          <span style={{ color: C.text }}>{setup.catalyst}</span>
        </div>
        <div style={{ marginBottom: 6 }}>
          <span style={{ color: C.blue, letterSpacing: 1 }}>SETUP: </span>
          <span style={{ color: C.text }}>{setup.technicalSetup}</span>
        </div>
        <div style={{ marginBottom: 6 }}>
          <span style={{ color: C.blue, letterSpacing: 1 }}>VOLUME: </span>
          <span style={{ color: C.text }}>{setup.volumeContext}</span>
        </div>
        <div>
          <span style={{ color: C.red, letterSpacing: 1 }}>INVALIDATION: </span>
          <span style={{ color: C.text }}>{setup.invalidationNote}</span>
        </div>
      </div>

      <button className="btn-secondary" style={{ width: '100%', marginTop: 4 }} onClick={() => onDeepDive(setup.ticker)}>
        ↗ DEEP DIVE {setup.ticker}
      </button>
    </div>
  );
}

// ─── Tab 2: DEEP DIVE ─────────────────────────────────────────────────────────
function DeepDiveTab({ prefillTicker, onLogTrade }) {
  const [ticker, setTicker] = useState(prefillTicker || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (prefillTicker) setTicker(prefillTicker);
  }, [prefillTicker]);

  const analyze = useCallback(async () => {
    if (!ticker.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await deepDive(ticker.trim());
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  const handleKey = e => { if (e.key === 'Enter') analyze(); };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <input
          className="field-input"
          placeholder="Enter ticker (e.g. NVDA)"
          value={ticker}
          onChange={e => setTicker(e.target.value.toUpperCase())}
          onKeyDown={handleKey}
          style={{ flex: 1, textTransform: 'uppercase', letterSpacing: 2, fontSize: 16 }}
        />
        <button className="btn-primary" onClick={analyze} disabled={loading || !ticker.trim()}>
          {loading ? 'ANALYZING…' : 'ANALYZE'}
        </button>
      </div>

      {loading && <Spinner />}
      {error && <ErrorBox message={error} />}

      {result && (
        <div className="fadeUp">
          {/* Signal header */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontFamily: 'Bebas Neue', fontSize: 42, letterSpacing: 3, color: C.text }}>
                  {result.ticker || ticker}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                  <Badge label={result.signal} color={result.signal === 'LONG' ? C.green : result.signal === 'SHORT' ? C.red : C.yellow} />
                  <Badge label={result.timeframe} color={timeframeColor(result.timeframe)} />
                  <Badge label={`${result.urgency} URGENCY`} color={urgencyColor(result.urgency)} />
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1 }}>CONVICTION</div>
                <div style={{ fontSize: 40, fontFamily: 'Bebas Neue', color: result.conviction >= 75 ? C.green : result.conviction >= 50 ? C.yellow : C.red }}>
                  {result.conviction}%
                </div>
                <div style={{ fontSize: 11, color: C.muted }}>MAX RISK: {result.maxRiskPct}</div>
              </div>
            </div>
          </div>

          {/* Price levels */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: 16, letterSpacing: 2, color: C.muted, marginBottom: 12 }}>PRICE LEVELS</div>
            <PriceRow label="ENTRY ZONE" value={result.entryZone} color={C.blue} />
            <PriceRow label="STOP LOSS" value={result.stopLoss} color={C.red} />
            <PriceRow label="TARGET 1" value={result.target1} color={C.green} />
            <PriceRow label="TARGET 2" value={result.target2} color={C.green} />
            <PriceRow label="R/R RATIO" value={result.riskReward} color={C.yellow} />
          </div>

          {/* Analysis */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: 16, letterSpacing: 2, color: C.muted, marginBottom: 12 }}>ANALYSIS</div>
            <InfoBlock label="THESIS" value={result.thesis} color={C.text} />
            <InfoBlock label="CATALYST" value={result.catalyst} color={C.blue} />
            <InfoBlock label="TECHNICAL SETUP" value={result.technicalSetup} color={C.blue} />
            <InfoBlock label="INVALIDATION" value={result.invalidationNote} color={C.red} />
            {result.warning && <InfoBlock label="WARNING" value={result.warning} color={C.yellow} />}
          </div>

          {result.signal !== 'NO TRADE' && (
            <button
              className="btn-primary"
              style={{ width: '100%' }}
              onClick={() => onLogTrade({ ticker: result.ticker || ticker, signal: result.signal })}
            >
              + LOG THIS TRADE
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function InfoBlock({ label, value, color }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color, lineHeight: 1.7 }}>{value}</div>
    </div>
  );
}

// ─── Tab 3: JOURNAL ───────────────────────────────────────────────────────────
const STORAGE_KEY = 'axiom_journal_v1';

function loadTrades() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveTrades(trades) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
}

function JournalTab({ prefillLog }) {
  const [trades, setTrades] = useState(loadTrades);
  const [form, setForm] = useState({
    ticker: prefillLog?.ticker || '',
    direction: prefillLog?.signal || 'LONG',
    outcome: 'WIN',
    pnl: '',
    notes: '',
  });

  useEffect(() => {
    if (prefillLog) {
      setForm(f => ({ ...f, ticker: prefillLog.ticker || '', direction: prefillLog.signal || 'LONG' }));
    }
  }, [prefillLog]);

  const addTrade = () => {
    if (!form.ticker || form.pnl === '') return;
    const trade = {
      id: Date.now(),
      date: new Date().toLocaleDateString(),
      ticker: form.ticker.toUpperCase(),
      direction: form.direction,
      outcome: form.outcome,
      pnl: parseFloat(form.pnl),
      notes: form.notes,
    };
    const updated = [trade, ...trades];
    setTrades(updated);
    saveTrades(updated);
    setForm(f => ({ ...f, ticker: '', pnl: '', notes: '' }));
  };

  const deleteTrade = id => {
    const updated = trades.filter(t => t.id !== id);
    setTrades(updated);
    saveTrades(updated);
  };

  // Stats
  const wins = trades.filter(t => t.outcome === 'WIN').length;
  const losses = trades.filter(t => t.outcome === 'LOSS').length;
  const winRate = trades.length ? Math.round((wins / trades.length) * 100) : 0;
  const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
  const portfolio = 10000 + totalPnL;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatBox label="TOTAL TRADES" value={trades.length} color={C.blue} />
        <StatBox label="WIN RATE" value={`${winRate}%`} color={winRate >= 60 ? C.green : winRate >= 40 ? C.yellow : C.red} />
        <StatBox label="TOTAL P&L" value={`${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`} color={totalPnL >= 0 ? C.green : C.red} />
        <StatBox label="PORTFOLIO" value={`$${portfolio.toFixed(2)}`} color={C.text} />
      </div>

      {/* Log form */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: 18, letterSpacing: 2, color: C.green, marginBottom: 16 }}>LOG TRADE</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 4 }}>TICKER</label>
            <input className="field-input" value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))} placeholder="NVDA" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 4 }}>DIRECTION</label>
            <select className="field-input" value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))}>
              <option>LONG</option>
              <option>SHORT</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 4 }}>OUTCOME</label>
            <select className="field-input" value={form.outcome} onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))}>
              <option>WIN</option>
              <option>LOSS</option>
              <option>BREAKEVEN</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 4 }}>P&L ($)</label>
            <input className="field-input" type="number" value={form.pnl} onChange={e => setForm(f => ({ ...f, pnl: e.target.value }))} placeholder="+250 or -80" />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 4 }}>NOTES (optional)</label>
          <input className="field-input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="What worked, what didn't..." />
        </div>
        <button className="btn-primary" onClick={addTrade} disabled={!form.ticker || form.pnl === ''}>
          + ADD TRADE
        </button>
      </div>

      {/* Trade list */}
      {trades.length === 0 ? (
        <div style={{ textAlign: 'center', color: C.muted, fontSize: 12, padding: 40 }}>
          No trades logged yet. Start trading!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {trades.map(trade => (
            <TradeRow key={trade.id} trade={trade} onDelete={deleteTrade} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, padding: 16 }}>
      <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontFamily: 'Bebas Neue', color, letterSpacing: 1 }}>{value}</div>
    </div>
  );
}

function TradeRow({ trade, onDelete }) {
  const outcomeColor = trade.outcome === 'WIN' ? C.green : trade.outcome === 'LOSS' ? C.red : C.yellow;
  return (
    <div
      className="fadeUp"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: C.panel,
        border: `1px solid ${outcomeColor}22`,
        borderLeft: `3px solid ${outcomeColor}`,
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontFamily: 'Bebas Neue', fontSize: 18, color: C.text, letterSpacing: 2, minWidth: 70 }}>{trade.ticker}</span>
      <Badge label={trade.direction} color={directionColor(trade.direction)} />
      <Badge label={trade.outcome} color={outcomeColor} />
      <span style={{ color: trade.pnl >= 0 ? C.green : C.red, fontSize: 14, fontWeight: 600, flex: 1 }}>
        {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
      </span>
      <span style={{ color: C.muted, fontSize: 11 }}>{trade.date}</span>
      {trade.notes && <span style={{ color: C.muted, fontSize: 11, width: '100%', marginTop: 4 }}>{trade.notes}</span>}
      <button
        onClick={() => onDelete(trade.id)}
        style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 4px' }}
        title="Delete"
      >×</button>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  injectGlobalCSS();

  const [tab, setTab] = useState('hunt');
  const [deepDiveTicker, setDeepDiveTicker] = useState('');
  const [journalPrefill, setJournalPrefill] = useState(null);

  const handleDeepDive = useCallback(ticker => {
    setDeepDiveTicker(ticker);
    setTab('dive');
  }, []);

  const handleLogTrade = useCallback(data => {
    setJournalPrefill(data);
    setTab('journal');
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <header style={{ borderBottom: `1px solid ${C.border}`, padding: '0 24px', position: 'sticky', top: 0, background: C.bg, zIndex: 100 }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '12px 0' }}>
            <span style={{ fontFamily: 'Bebas Neue', fontSize: 32, letterSpacing: 6, color: C.green }}>AXIOM</span>
            <span style={{ fontSize: 10, color: C.muted, letterSpacing: 3 }}>AUTONOMOUS TRADING AGENT</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <div className="pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, marginRight: 8 }} />
            <span style={{ fontSize: 10, color: C.green, letterSpacing: 2 }}>LIVE</span>
          </div>
        </div>
        {/* Tabs */}
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', gap: 4 }}>
          <button className={`tab-btn ${tab === 'hunt' ? 'active' : ''}`} onClick={() => setTab('hunt')}>
            ◈ HUNT MARKET
          </button>
          <button className={`tab-btn ${tab === 'dive' ? 'active' : ''}`} onClick={() => setTab('dive')}>
            ⊕ DEEP DIVE
          </button>
          <button className={`tab-btn ${tab === 'journal' ? 'active' : ''}`} onClick={() => setTab('journal')}>
            ◎ JOURNAL
          </button>
        </div>
      </header>

      {/* Content */}
      <main>
        {tab === 'hunt' && <HuntTab onDeepDive={handleDeepDive} />}
        {tab === 'dive' && <DeepDiveTab prefillTicker={deepDiveTicker} onLogTrade={handleLogTrade} />}
        {tab === 'journal' && <JournalTab prefillLog={journalPrefill} />}
      </main>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '24px 16px', color: C.muted, fontSize: 10, letterSpacing: 2, borderTop: `1px solid ${C.border}` }}>
        AXIOM v1.0 — FOR EDUCATIONAL PURPOSES ONLY. NOT FINANCIAL ADVICE.
      </footer>
    </div>
  );
}

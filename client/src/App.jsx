import React, { useState, useEffect, useCallback, useRef } from 'react';
import { huntMarket, deepDive } from './api.js';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: '#050810',
  panel: '#080f1c',
  panelAlt: '#0a1220',
  border: '#0f2040',
  borderHover: '#1a3560',
  green: '#00ff88',
  greenDim: '#00ff8822',
  red: '#ff3b5c',
  redDim: '#ff3b5c22',
  yellow: '#f0b429',
  blue: '#38bdf8',
  purple: '#a78bfa',
  muted: '#3a5070',
  mutedText: '#6a8aaa',
  text: '#dde6f5',
  textDim: '#8aa0be',
};

// ─── Global styles ─────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes scanline {
    0%   { top: -100%; }
    100% { top: 100%; }
  }
  @keyframes glow {
    0%, 100% { box-shadow: 0 0 4px ${C.green}44; }
    50%       { box-shadow: 0 0 12px ${C.green}88; }
  }

  .fadeIn   { animation: fadeIn 0.3s ease forwards; }
  .pulse    { animation: pulse 2s ease infinite; }
  .spin     { animation: spin 0.9s linear infinite; }
  .glow-on  { animation: glow 2s ease infinite; }

  input, select, button, textarea { font-family: 'IBM Plex Mono', monospace; }
  input:focus, select:focus, textarea:focus { outline: none; }

  ::-webkit-scrollbar       { width: 3px; height: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
  ::-webkit-scrollbar-thumb:hover { background: ${C.borderHover}; }

  .panel-scroll { overflow-y: auto; scrollbar-width: thin; scrollbar-color: ${C.border} transparent; }

  .tab-btn {
    background: none; border: none; cursor: pointer;
    padding: 8px 16px; font-family: 'Bebas Neue', cursive;
    font-size: 15px; letter-spacing: 2px; color: ${C.muted};
    border-bottom: 2px solid transparent;
    transition: color 0.2s, border-color 0.2s;
  }
  .tab-btn:hover { color: ${C.textDim}; }
  .tab-btn.active { color: ${C.green}; border-bottom-color: ${C.green}; }

  .btn-primary {
    background: ${C.green}; color: ${C.bg}; border: none;
    padding: 9px 20px; font-size: 11px; font-weight: 700;
    letter-spacing: 2px; cursor: pointer; text-transform: uppercase;
    transition: opacity 0.15s, transform 0.1s;
  }
  .btn-primary:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
  .btn-primary:active:not(:disabled) { transform: translateY(0); }
  .btn-primary:disabled { opacity: 0.3; cursor: not-allowed; }

  .btn-ghost {
    background: transparent; color: ${C.blue};
    border: 1px solid ${C.blue}55; padding: 5px 12px;
    font-size: 10px; letter-spacing: 1.5px; cursor: pointer;
    text-transform: uppercase; transition: all 0.15s;
  }
  .btn-ghost:hover { background: ${C.blue}18; border-color: ${C.blue}; }

  .btn-danger {
    background: transparent; color: ${C.muted};
    border: none; cursor: pointer; padding: 2px 6px;
    font-size: 14px; line-height: 1; transition: color 0.15s;
  }
  .btn-danger:hover { color: ${C.red}; }

  .field {
    background: ${C.bg}; border: 1px solid ${C.border};
    color: ${C.text}; padding: 8px 12px; font-size: 12px;
    width: 100%; transition: border-color 0.2s;
  }
  .field:focus { border-color: ${C.green}66; }

  .badge {
    display: inline-flex; align-items: center;
    padding: 2px 7px; font-size: 9px; letter-spacing: 1.5px;
    font-weight: 700; text-transform: uppercase; border-radius: 1px;
  }

  .card {
    background: ${C.panel}; border: 1px solid ${C.border};
    padding: 14px 16px; transition: border-color 0.2s;
  }
  .card:hover { border-color: ${C.borderHover}; }

  .section-label {
    font-family: 'Bebas Neue', cursive; font-size: 11px;
    letter-spacing: 3px; color: ${C.muted}; margin-bottom: 10px;
  }

  .divider {
    border: none; border-top: 1px solid ${C.border}; margin: 12px 0;
  }
`;

function injectGlobalCSS() {
  if (document.getElementById('axiom-styles')) return;
  const el = document.createElement('style');
  el.id = 'axiom-styles';
  el.textContent = GLOBAL_CSS;
  document.head.appendChild(el);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const directionColor = d => d === 'LONG' ? C.green : d === 'SHORT' ? C.red : C.yellow;
const timeframeColor = tf => ({ SCALP: C.yellow, 'DAY TRADE': C.blue, 'SWING 24H': C.green, 'SWING 48H': C.purple })[tf] || C.text;
const urgencyColor   = u => u === 'HIGH' ? C.red : u === 'MEDIUM' ? C.yellow : C.muted;
const conditionColor = c => {
  if (!c) return C.muted;
  const u = c.toUpperCase();
  if (u.includes('BULL')) return C.green;
  if (u.includes('BEAR')) return C.red;
  if (u.includes('VOL'))  return C.yellow;
  return C.blue;
};

function fmt(n) {
  if (n === undefined || n === null) return '—';
  return n;
}

// ─── Atoms ────────────────────────────────────────────────────────────────────
function Badge({ label, color }) {
  return (
    <span className="badge" style={{ background: color + '1a', color, border: `1px solid ${color}44` }}>
      {label}
    </span>
  );
}

function Spinner({ label = 'PROCESSING…' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0' }}>
      <div className="spin" style={{
        width: 16, height: 16, borderRadius: '50%',
        border: `2px solid ${C.border}`, borderTopColor: C.green,
        flexShrink: 0,
      }} />
      <span className="pulse" style={{ color: C.green, fontSize: 10, letterSpacing: 3 }}>{label}</span>
    </div>
  );
}

function ErrorBox({ msg }) {
  return (
    <div style={{ background: C.redDim, border: `1px solid ${C.red}44`, padding: 10, color: C.red, fontSize: 11, letterSpacing: 0.5 }}>
      ✕ {msg}
    </div>
  );
}

function KV({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ color: C.muted, fontSize: 10, letterSpacing: 1.5 }}>{label}</span>
      <span style={{ color: color || C.text, fontSize: 11, fontWeight: 600 }}>{fmt(value)}</span>
    </div>
  );
}

function InfoRow({ label, value, color }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 11, color: color || C.textDim, lineHeight: 1.65 }}>{fmt(value)}</div>
    </div>
  );
}

// ─── LEFT COLUMN — Hunt Market ────────────────────────────────────────────────
function HuntPanel({ onSelectSetup }) {
  const [capital, setCapital]   = useState('10000');
  const [mode, setMode]         = useState('Full Market');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [result, setResult]     = useState(null);
  const [selected, setSelected] = useState(null);

  const launch = useCallback(async () => {
    setLoading(true); setError(null); setResult(null); setSelected(null);
    try { setResult(await huntMarket(capital, mode)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [capital, mode]);

  const pickSetup = useCallback(setup => {
    setSelected(setup.ticker);
    onSelectSetup(setup);
  }, [onSelectSetup]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Controls */}
      <div style={{ padding: '14px 14px 12px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 4 }}>CAPITAL ($)</div>
            <input className="field" type="number" value={capital}
              onChange={e => setCapital(e.target.value)} min="100" />
          </div>
          <div>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 4 }}>MODE</div>
            <select className="field" value={mode} onChange={e => setMode(e.target.value)}>
              <option>Full Market</option>
              <option>Sector Rotation</option>
              <option>Momentum Only</option>
            </select>
          </div>
        </div>
        <button className="btn-primary" onClick={launch} disabled={loading || !capital}
          style={{ width: '100%' }}>
          {loading ? '▶ SCANNING…' : '▶ LAUNCH HUNT'}
        </button>
      </div>

      {/* Results */}
      <div className="panel-scroll" style={{ flex: 1, padding: '12px 14px' }}>
        {loading && <Spinner label="SCANNING MARKETS…" />}
        {error && <ErrorBox msg={error} />}

        {result && (
          <div className="fadeIn">
            {/* Market status strip */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
              <Badge label={result.marketCondition || 'N/A'} color={conditionColor(result.marketCondition)} />
              <span style={{ fontSize: 10, color: C.textDim }}>VIX {result.vixLevel}</span>
            </div>
            <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.65, marginBottom: 12 }}>
              {result.marketBrief}
            </div>
            <div style={{ fontSize: 9, color: C.blue, letterSpacing: 1, marginBottom: 4 }}>
              SECTOR FOCUS: <span style={{ color: C.textDim }}>{result.sectorFocus}</span>
            </div>
            <hr className="divider" />

            <div className="section-label">TOP SETUPS</div>

            {(result.bestSetups || []).map((s, i) => (
              <SetupMini key={i} setup={s} selected={selected === s.ticker}
                onSelect={() => pickSetup(s)} />
            ))}

            {result.avoidList?.length > 0 && (
              <div style={{ marginTop: 12, padding: '8px 10px', background: C.redDim, border: `1px solid ${C.red}33` }}>
                <span style={{ fontSize: 9, color: C.red, letterSpacing: 2 }}>AVOID: </span>
                {result.avoidList.map((t, i) => (
                  <span key={i} style={{ color: C.red, fontSize: 10, marginLeft: 6 }}>{t}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && !error && !result && (
          <div style={{ color: C.muted, fontSize: 10, letterSpacing: 2, textAlign: 'center', marginTop: 40 }}>
            AWAITING SCAN
          </div>
        )}
      </div>
    </div>
  );
}

function SetupMini({ setup, selected, onSelect }) {
  const dc = directionColor(setup.direction);
  return (
    <div onClick={onSelect} style={{
      padding: '10px 12px', marginBottom: 6, cursor: 'pointer',
      background: selected ? C.greenDim : C.panelAlt,
      border: `1px solid ${selected ? C.green + '55' : C.border}`,
      transition: 'all 0.15s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'Bebas Neue', fontSize: 20, color: C.text, letterSpacing: 1 }}>
            {setup.ticker}
          </span>
          <Badge label={setup.direction} color={dc} />
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: 18,
            color: setup.conviction >= 75 ? C.green : setup.conviction >= 50 ? C.yellow : C.red }}>
            {setup.conviction}%
          </div>
          <div style={{ fontSize: 9, color: C.muted }}>CONVICTION</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
        <Badge label={setup.timeframe} color={timeframeColor(setup.timeframe)} />
        <Badge label={setup.urgency} color={urgencyColor(setup.urgency)} />
      </div>
      <div style={{ fontSize: 10, color: C.textDim, marginTop: 5, lineHeight: 1.5 }}>
        {setup.catalyst?.slice(0, 80)}{setup.catalyst?.length > 80 ? '…' : ''}
      </div>
    </div>
  );
}

// ─── CENTER COLUMN — Deep Dive ────────────────────────────────────────────────
function DeepDivePanel({ prefillSetup, onLogTrade }) {
  const [ticker, setTicker]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [result, setResult]   = useState(null);

  // When a setup is selected from Hunt, pre-fill and auto-analyze
  useEffect(() => {
    if (!prefillSetup) return;
    setTicker(prefillSetup.ticker);
    setResult(null);
    setError(null);
  }, [prefillSetup]);

  const analyze = useCallback(async (sym) => {
    const t = (sym || ticker).trim().toUpperCase();
    if (!t) return;
    setTicker(t); setLoading(true); setError(null); setResult(null);
    try { setResult(await deepDive(t)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [ticker]);

  const handleKey = e => { if (e.key === 'Enter') analyze(); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search bar */}
      <div style={{ padding: '14px 14px 12px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="field" placeholder="TICKER…" value={ticker}
            onChange={e => setTicker(e.target.value.toUpperCase())}
            onKeyDown={handleKey}
            style={{ flex: 1, letterSpacing: 2, textTransform: 'uppercase', fontSize: 14 }}
          />
          <button className="btn-primary" onClick={() => analyze()} disabled={loading || !ticker.trim()}>
            {loading ? '…' : 'DIVE'}
          </button>
        </div>
      </div>

      {/* Analysis */}
      <div className="panel-scroll" style={{ flex: 1, padding: '14px 14px' }}>
        {loading && <Spinner label="DEEP ANALYSIS…" />}
        {error && <ErrorBox msg={error} />}

        {!loading && !error && !result && (
          <div style={{ color: C.muted, fontSize: 10, letterSpacing: 2, textAlign: 'center', marginTop: 40 }}>
            {prefillSetup
              ? <><span style={{ color: C.green }}>{prefillSetup.ticker}</span> — CLICK DIVE TO ANALYZE</>
              : 'SELECT A SETUP OR ENTER TICKER'}
          </div>
        )}

        {result && (
          <div className="fadeIn">
            {/* Header */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontFamily: 'Bebas Neue', fontSize: 48, letterSpacing: 3, color: C.text, lineHeight: 1 }}>
                    {result.ticker || ticker}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    <Badge label={result.signal} color={result.signal === 'LONG' ? C.green : result.signal === 'SHORT' ? C.red : C.yellow} />
                    <Badge label={result.timeframe} color={timeframeColor(result.timeframe)} />
                    <Badge label={`${result.urgency} URGENCY`} color={urgencyColor(result.urgency)} />
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Bebas Neue', fontSize: 42, lineHeight: 1,
                    color: result.conviction >= 75 ? C.green : result.conviction >= 50 ? C.yellow : C.red }}>
                    {result.conviction}%
                  </div>
                  <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1 }}>CONVICTION</div>
                  <div style={{ fontSize: 10, color: C.yellow, marginTop: 2 }}>MAX RISK {result.maxRiskPct}</div>
                </div>
              </div>
            </div>

            <hr className="divider" />

            {/* Price levels */}
            <div className="section-label">PRICE LEVELS</div>
            <div style={{ marginBottom: 14 }}>
              <KV label="ENTRY ZONE" value={result.entryZone} color={C.blue} />
              <KV label="STOP LOSS"  value={result.stopLoss}  color={C.red} />
              <KV label="TARGET 1"   value={result.target1}   color={C.green} />
              <KV label="TARGET 2"   value={result.target2}   color={C.green} />
              <KV label="R/R RATIO"  value={result.riskReward} color={C.yellow} />
            </div>

            {/* Thesis */}
            <div className="section-label">ANALYSIS</div>
            <InfoRow label="THESIS"          value={result.thesis}          color={C.text} />
            <InfoRow label="CATALYST"        value={result.catalyst}        color={C.blue} />
            <InfoRow label="TECHNICAL SETUP" value={result.technicalSetup}  color={C.textDim} />
            <InfoRow label="INVALIDATION"    value={result.invalidationNote} color={C.red} />
            {result.warning && <InfoRow label="WARNING" value={result.warning} color={C.yellow} />}

            {result.signal !== 'NO TRADE' && (
              <button className="btn-primary" style={{ width: '100%', marginTop: 10 }}
                onClick={() => onLogTrade({ ticker: result.ticker || ticker, signal: result.signal })}>
                + LOG TRADE
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── RIGHT COLUMN — Journal ───────────────────────────────────────────────────
const STORAGE_KEY = 'axiom_journal_v1';
const loadTrades = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } };
const saveTrades = t => localStorage.setItem(STORAGE_KEY, JSON.stringify(t));

function JournalPanel({ prefill }) {
  const [trades, setTrades] = useState(loadTrades);
  const [tab, setTab]       = useState('log'); // 'log' | 'history'
  const [form, setForm]     = useState({ ticker: '', direction: 'LONG', outcome: 'WIN', pnl: '', notes: '' });

  useEffect(() => {
    if (prefill) {
      setForm(f => ({ ...f, ticker: prefill.ticker || '', direction: prefill.signal || 'LONG' }));
      setTab('log');
    }
  }, [prefill]);

  const addTrade = () => {
    if (!form.ticker || form.pnl === '') return;
    const t = {
      id: Date.now(), date: new Date().toLocaleDateString(),
      ticker: form.ticker.toUpperCase(), direction: form.direction,
      outcome: form.outcome, pnl: parseFloat(form.pnl), notes: form.notes,
    };
    const updated = [t, ...trades];
    setTrades(updated); saveTrades(updated);
    setForm(f => ({ ...f, ticker: '', pnl: '', notes: '' }));
    setTab('history');
  };

  const del = id => { const u = trades.filter(t => t.id !== id); setTrades(u); saveTrades(u); };

  const wins     = trades.filter(t => t.outcome === 'WIN').length;
  const totalPnL = trades.reduce((s, t) => s + t.pnl, 0);
  const winRate  = trades.length ? Math.round((wins / trades.length) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Stats strip */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, flexShrink: 0 }}>
        <MiniStat label="TRADES" value={trades.length} color={C.blue} />
        <MiniStat label="WIN %" value={`${winRate}%`} color={winRate >= 60 ? C.green : winRate >= 40 ? C.yellow : C.red} />
        <MiniStat label="P&L" value={`${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(0)}`} color={totalPnL >= 0 ? C.green : C.red} />
        <MiniStat label="EQUITY" value={`$${(10000 + totalPnL).toFixed(0)}`} color={C.text} />
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button className={`tab-btn ${tab === 'log' ? 'active' : ''}`} onClick={() => setTab('log')}>LOG</button>
        <button className={`tab-btn ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>HISTORY</button>
      </div>

      <div className="panel-scroll" style={{ flex: 1, padding: '12px 14px' }}>
        {tab === 'log' && (
          <div className="fadeIn">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 4 }}>TICKER</div>
                <input className="field" value={form.ticker}
                  onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                  placeholder="NVDA" style={{ textTransform: 'uppercase', letterSpacing: 1 }} />
              </div>
              <div>
                <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 4 }}>DIRECTION</div>
                <select className="field" value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))}>
                  <option>LONG</option><option>SHORT</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 4 }}>OUTCOME</div>
                <select className="field" value={form.outcome} onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))}>
                  <option>WIN</option><option>LOSS</option><option>BREAKEVEN</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 4 }}>P&L ($)</div>
                <input className="field" type="number" value={form.pnl}
                  onChange={e => setForm(f => ({ ...f, pnl: e.target.value }))} placeholder="±amount" />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 4 }}>NOTES</div>
              <input className="field" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="What worked / didn't…" />
            </div>
            <button className="btn-primary" onClick={addTrade}
              disabled={!form.ticker || form.pnl === ''} style={{ width: '100%' }}>
              + ADD TRADE
            </button>
          </div>
        )}

        {tab === 'history' && (
          <div className="fadeIn">
            {trades.length === 0
              ? <div style={{ color: C.muted, fontSize: 10, letterSpacing: 2, textAlign: 'center', marginTop: 30 }}>NO TRADES YET</div>
              : trades.map(t => <TradeRow key={t.id} trade={t} onDelete={del} />)
            }
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'Bebas Neue', fontSize: 16, color, letterSpacing: 1 }}>{value}</div>
      <div style={{ fontSize: 8, color: C.muted, letterSpacing: 1.5 }}>{label}</div>
    </div>
  );
}

function TradeRow({ trade, onDelete }) {
  const oc = trade.outcome === 'WIN' ? C.green : trade.outcome === 'LOSS' ? C.red : C.yellow;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
      marginBottom: 5, background: C.panelAlt,
      border: `1px solid ${oc}22`, borderLeft: `2px solid ${oc}`,
      flexWrap: 'wrap',
    }}>
      <span style={{ fontFamily: 'Bebas Neue', fontSize: 15, color: C.text, letterSpacing: 1, minWidth: 50 }}>{trade.ticker}</span>
      <Badge label={trade.direction} color={directionColor(trade.direction)} />
      <Badge label={trade.outcome}   color={oc} />
      <span style={{ color: trade.pnl >= 0 ? C.green : C.red, fontSize: 12, fontWeight: 600, flex: 1, textAlign: 'right' }}>
        {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
      </span>
      <span style={{ color: C.muted, fontSize: 9 }}>{trade.date}</span>
      <button className="btn-danger" onClick={() => onDelete(trade.id)}>×</button>
      {trade.notes && (
        <div style={{ width: '100%', fontSize: 10, color: C.muted, marginTop: 2 }}>{trade.notes}</div>
      )}
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  useEffect(() => { injectGlobalCSS(); }, []);

  const [selectedSetup, setSelectedSetup] = useState(null);
  const [journalPrefill, setJournalPrefill] = useState(null);

  const handleLogTrade = useCallback(data => setJournalPrefill(data), []);

  const COL = { flex: '1 1 0', minWidth: 0, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: "'IBM Plex Mono', monospace" }}>

      {/* ── Top bar ── */}
      <header style={{ borderBottom: `1px solid ${C.border}`, padding: '0 20px', background: C.bg, zIndex: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontFamily: 'Bebas Neue', fontSize: 28, letterSpacing: 6, color: C.green }}>AXIOM</span>
            <span style={{ fontSize: 9, color: C.muted, letterSpacing: 3 }}>AUTONOMOUS TRADING AGENT</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2 }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="pulse glow-on" style={{ width: 6, height: 6, borderRadius: '50%', background: C.green }} />
              <span style={{ fontSize: 9, color: C.green, letterSpacing: 2 }}>LIVE</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Column labels ── */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, flexShrink: 0, background: C.panelAlt }}>
        {[['◈ HUNT MARKET', ''], ['⊕ DEEP DIVE', ''], ['◎ JOURNAL', '']].map(([label], i) => (
          <div key={i} style={{ flex: '1 1 0', padding: '6px 14px', borderRight: `1px solid ${C.border}`, fontSize: 10, letterSpacing: 3, color: C.muted, fontFamily: 'Bebas Neue' }}>
            {label}
          </div>
        ))}
      </div>

      {/* ── 3-column layout ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <div style={COL}>
          <HuntPanel onSelectSetup={setSelectedSetup} />
        </div>
        <div style={{ ...COL }}>
          <DeepDivePanel prefillSetup={selectedSetup} onLogTrade={handleLogTrade} />
        </div>
        <div style={{ ...COL, borderRight: 'none' }}>
          <JournalPanel prefill={journalPrefill} />
        </div>
      </div>

      {/* ── Footer ── */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: '7px 20px', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: 9, color: C.muted, letterSpacing: 2 }}>AXIOM v2.0</span>
        <span style={{ fontSize: 9, color: C.muted, letterSpacing: 1 }}>FOR EDUCATIONAL PURPOSES ONLY — NOT FINANCIAL ADVICE</span>
      </footer>
    </div>
  );
}

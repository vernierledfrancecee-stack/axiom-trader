import React, { useState, useEffect, useCallback } from 'react';
import { huntMarket, deepDive } from './api.js';
import LiveChart from './LiveChart.jsx';
import NewsPanel from './components/NewsPanel.jsx';
import TradePanel from './components/TradePanel.jsx';
import Dashboard from './components/Dashboard.jsx';
import './theme.css';

// ─── Strip <cite> tags from AI responses ──────────────────────────────────────
const stripCite = (text) =>
  typeof text === 'string' ? text.replace(/<cite[^>]*>|<\/cite>/g, '') : text;

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: 'var(--bg)',
  panel: 'var(--bg2)',
  border: 'var(--border)',
  green: 'var(--green)',
  red: 'var(--red)',
  yellow: 'var(--yellow)',
  blue: 'var(--blue)',
  muted: 'var(--text3)',
  text: 'var(--text)',
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
      <span className="pulse" style={{ color: C.green, fontSize: 12, letterSpacing: 3 }}>SCAN DU MARCHÉ…</span>
    </div>
  );
}

function ErrorBox({ message }) {
  return (
    <div style={{ background: C.red + '11', border: `1px solid ${C.red}44`, padding: 16, color: C.red, fontSize: 12 }}>
      ERREUR : {message}
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
function HuntTab({ onDeepDive, defaultCapital, profile }) {
  const [capital, setCapital] = useState(String(defaultCapital || '10000'));
  const [mode, setMode] = useState('Full Market');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const launch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await huntMarket(capital, mode, profile);
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
          <label style={{ display: 'block', fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 6 }}>MODE DE SCAN</label>
          <select className="field-input" value={mode} onChange={e => setMode(e.target.value)}>
            <option>Marché complet</option>
            <option>Rotation sectorielle</option>
            <option>Momentum uniquement</option>
          </select>
        </div>
        <button className="btn-primary" onClick={launch} disabled={loading || !capital}>
          {loading ? '▶ SCAN EN COURS…' : '▶ LANCER LA CHASSE'}
        </button>
      </div>

      {loading && <Spinner />}
      {error && <ErrorBox message={error} />}

      {result && (
        <div className="fadeUp">
          {/* Market Brief */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
              <span style={{ fontFamily: 'Bebas Neue', fontSize: 22, letterSpacing: 2, color: C.green }}>RÉSUMÉ MARCHÉ</span>
              <Badge label={result.marketCondition} color={conditionColor(result.marketCondition)} />
            </div>
            <p style={{ color: C.text, fontSize: 12, lineHeight: 1.7, marginBottom: 14 }}>{stripCite(result.marketBrief)}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <div style={{ background: C.bg, padding: 12, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 4 }}>NIVEAU VIX</div>
                <div style={{ fontSize: 13, color: C.yellow }}>{stripCite(result.vixLevel)}</div>
              </div>
              <div style={{ background: C.bg, padding: 12, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 4 }}>SECTEUR CIBLÉ</div>
                <div style={{ fontSize: 13, color: C.blue }}>{stripCite(result.sectorFocus)}</div>
              </div>
            </div>
          </div>

          {/* Setups */}
          <div style={{ fontFamily: 'Bebas Neue', fontSize: 18, letterSpacing: 3, color: C.muted, marginBottom: 12 }}>
            MEILLEURS SETUPS — CLASSÉS PAR CONVICTION
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
            {(result.bestSetups || []).map((setup, i) => (
              <SetupCard key={i} setup={setup} onDeepDive={onDeepDive} delay={i * 80} />
            ))}
          </div>

          {/* Avoid list */}
          {result.avoidList && result.avoidList.length > 0 && (
            <div style={{ marginTop: 20, padding: 14, border: `1px solid ${C.red}33`, background: C.red + '08' }}>
              <span style={{ fontSize: 10, color: C.red, letterSpacing: 2 }}>À ÉVITER AUJOURD'HUI : </span>
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
            <Badge label={`URGENCE ${setup.urgency}`} color={urgencyColor(setup.urgency)} />
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
        <PriceRow label="ZONE D'ENTRÉE" value={setup.entryZone} color={C.blue} />
        <PriceRow label="STOP LOSS" value={setup.stopLoss} color={C.red} />
        <PriceRow label="OBJECTIF 1" value={setup.target1} color={C.green} />
        <PriceRow label="OBJECTIF 2" value={setup.target2} color={C.green} />
        <PriceRow label="RATIO R/R" value={setup.riskReward} color={C.yellow} />
      </div>

      {/* Details */}
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
        <div style={{ marginBottom: 6 }}>
          <span style={{ color: C.blue, letterSpacing: 1 }}>CATALYSEUR : </span>
          <span style={{ color: C.text }}>{stripCite(setup.catalyst)}</span>
        </div>
        <div style={{ marginBottom: 6 }}>
          <span style={{ color: C.blue, letterSpacing: 1 }}>SETUP : </span>
          <span style={{ color: C.text }}>{stripCite(setup.technicalSetup)}</span>
        </div>
        <div style={{ marginBottom: 6 }}>
          <span style={{ color: C.blue, letterSpacing: 1 }}>VOLUME : </span>
          <span style={{ color: C.text }}>{stripCite(setup.volumeContext)}</span>
        </div>
        <div>
          <span style={{ color: C.red, letterSpacing: 1 }}>INVALIDATION : </span>
          <span style={{ color: C.text }}>{stripCite(setup.invalidationNote)}</span>
        </div>
      </div>

      <button className="btn-secondary" style={{ width: '100%', marginTop: 4 }} onClick={() => onDeepDive(setup.ticker)}>
        ↗ ANALYSE {setup.ticker}
      </button>
    </div>
  );
}

// ─── History helpers ──────────────────────────────────────────────────────────
const HISTORY_KEY = 'axiom_history';
const MAX_HISTORY = 20;

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveHistory(h) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
}
function addToHistory(ticker, result) {
  const h = loadHistory();
  const existing = h.findIndex(x => x.ticker === ticker);
  const entry = {
    ticker,
    signal: result.signal,
    conviction: result.conviction,
    entryZone: result.entryZone,
    stopLoss: result.stopLoss,
    target1: result.target1,
    target2: result.target2,
    riskReward: result.riskReward,
    starred: existing >= 0 ? h[existing].starred : false,
    analyzedAt: new Date().toISOString(),
    result,
  };
  if (existing >= 0) h.splice(existing, 1);
  h.unshift(entry);
  saveHistory(h.slice(0, MAX_HISTORY));
  return h.slice(0, MAX_HISTORY);
}
function toggleStar(h, ticker) {
  return h.map(x => x.ticker === ticker ? { ...x, starred: !x.starred } : x);
}
function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}j`;
}

// ─── Tab 2: DEEP DIVE ─────────────────────────────────────────────────────────
function DeepDiveTab({ prefillTicker, onLogTrade, profile }) {
  const [ticker, setTicker] = useState(prefillTicker || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(loadHistory);

  useEffect(() => {
    if (prefillTicker) setTicker(prefillTicker);
  }, [prefillTicker]);

  const analyze = useCallback(async (t) => {
    const sym = (t || ticker).trim().toUpperCase();
    if (!sym) return;
    setTicker(sym);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await deepDive(sym, profile);
      setResult(data);
      setHistory(addToHistory(sym, data));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [ticker, profile]);

  const handleKey = e => { if (e.key === 'Enter') analyze(); };

  const restoreFromHistory = (entry) => {
    setTicker(entry.ticker);
    setResult(entry.result);
    setError(null);
  };

  const onStar = (t) => {
    const h = toggleStar(loadHistory(), t);
    saveHistory(h);
    setHistory(h);
  };

  const starred = history.filter(x => x.starred);
  const recent  = history.filter(x => !x.starred);

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px' }}>

      {/* Search */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input
          className="field-input"
          placeholder="Entrer un ticker (ex : NVDA)"
          value={ticker}
          onChange={e => setTicker(e.target.value.toUpperCase())}
          onKeyDown={handleKey}
          style={{ flex: 1, textTransform: 'uppercase', letterSpacing: 2, fontSize: 16 }}
        />
        <button className="btn-primary" onClick={() => analyze()} disabled={loading || !ticker.trim()}>
          {loading ? '⏳ ANALYSE…' : 'ANALYSER'}
        </button>
      </div>

      {/* Watchlist (starred) */}
      {starred.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 6 }}>⭐ WATCHLIST</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {starred.map(e => (
              <HistoryChip key={e.ticker} entry={e} onSelect={restoreFromHistory} onStar={onStar} onReanalyze={analyze} />
            ))}
          </div>
        </div>
      )}

      {/* Recent history */}
      {recent.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 6 }}>RÉCENTS</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {recent.map(e => (
              <HistoryChip key={e.ticker} entry={e} onSelect={restoreFromHistory} onStar={onStar} onReanalyze={analyze} />
            ))}
          </div>
        </div>
      )}

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

          {/* Live chart */}
          <LiveChart
            ticker={result.ticker || ticker}
            signal={result.signal}
            entryZone={result.entryZone}
            stopLoss={result.stopLoss}
            target1={result.target1}
            target2={result.target2}
          />

          {/* Price levels */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: 16, letterSpacing: 2, color: C.muted, marginBottom: 12 }}>NIVEAUX DE PRIX</div>
            <PriceRow label="ZONE D'ENTRÉE" value={result.entryZone} color={C.blue} />
            <PriceRow label="STOP LOSS" value={result.stopLoss} color={C.red} />
            <PriceRow label="OBJECTIF 1" value={result.target1} color={C.green} />
            <PriceRow label="OBJECTIF 2" value={result.target2} color={C.green} />
            <PriceRow label="RATIO R/R" value={result.riskReward} color={C.yellow} />
          </div>

          {/* Analyse */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: 16, letterSpacing: 2, color: C.muted, marginBottom: 12 }}>ANALYSE</div>
            <InfoBlock label="THÈSE" value={result.thesis} color={C.text} />
            <InfoBlock label="CATALYSEUR" value={result.catalyst} color={C.blue} />
            <InfoBlock label="SETUP TECHNIQUE" value={result.technicalSetup} color={C.blue} />
            <InfoBlock label="INVALIDATION" value={result.invalidationNote} color={C.red} />
            {result.warning && <InfoBlock label="AVERTISSEMENT" value={result.warning} color={C.yellow} />}
          </div>

          {result.signal !== 'NO TRADE' && (
            <button
              className="btn-primary"
              style={{ width: '100%' }}
              onClick={() => onLogTrade({ ticker: result.ticker || ticker, signal: result.signal })}
            >
              + ENREGISTRER CE TRADE
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── History chip ─────────────────────────────────────────────────────────────
function HistoryChip({ entry, onSelect, onStar, onReanalyze }) {
  const sigColor = entry.signal === 'LONG' ? C.green : entry.signal === 'SHORT' ? C.red : C.muted;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '4px 8px', border: `1px solid ${C.border}`,
      background: C.panel, cursor: 'pointer', userSelect: 'none',
    }}>
      {/* Ticker — click to restore cached result */}
      <span
        onClick={() => onSelect(entry)}
        style={{ fontFamily: 'Bebas Neue', fontSize: 14, letterSpacing: 1, color: C.text }}
      >
        {entry.ticker}
      </span>

      {/* Signal dot */}
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: sigColor, display: 'inline-block' }} />

      {/* Conviction */}
      <span style={{ fontSize: 9, color: sigColor, letterSpacing: 1 }}>{entry.conviction}%</span>

      {/* Time ago */}
      <span style={{ fontSize: 9, color: C.muted }}>{timeAgo(entry.analyzedAt)}</span>

      {/* Re-analyze */}
      <span
        onClick={() => onReanalyze(entry.ticker)}
        title="Ré-analyser"
        style={{ fontSize: 10, color: C.muted, cursor: 'pointer', padding: '0 2px' }}
      >↻</span>

      {/* Star */}
      <span
        onClick={() => onStar(entry.ticker)}
        title={entry.starred ? 'Retirer watchlist' : 'Ajouter watchlist'}
        style={{ fontSize: 12, cursor: 'pointer', color: entry.starred ? C.yellow : C.muted }}
      >
        {entry.starred ? '★' : '☆'}
      </span>
    </div>
  );
}

function InfoBlock({ label, value, color }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color, lineHeight: 1.7 }}>{stripCite(value)}</div>
    </div>
  );
}

// ─── Trader Profile ───────────────────────────────────────────────────────────
const PROFILE_KEY = 'axiom_profile_v1';
const DEFAULT_PROFILE = {
  name: 'Marcus Reid',
  role: 'Institutional Trader',
  experience: '20 years',
  markets: ['NYSE', 'NASDAQ'],
  tradingStyles: ['scalping', 'day trading', 'swing trading'],
  capital: 5000,
};

function loadProfile() {
  try {
    const stored = JSON.parse(localStorage.getItem(PROFILE_KEY));
    return stored || DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}

function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
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

function JournalTab({ prefillLog, baseCapital }) {
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
  const portfolio = (baseCapital || 10000) + totalPnL;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatBox label="TRADES TOTAUX" value={trades.length} color={C.blue} />
        <StatBox label="TAUX DE RÉUSSITE" value={`${winRate}%`} color={winRate >= 60 ? C.green : winRate >= 40 ? C.yellow : C.red} />
        <StatBox label="TOTAL P&L" value={`${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`} color={totalPnL >= 0 ? C.green : C.red} />
        <StatBox label="PORTEFEUILLE" value={`$${portfolio.toFixed(2)}`} color={C.text} />
      </div>

      {/* Log form */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: 18, letterSpacing: 2, color: C.green, marginBottom: 16 }}>ENREGISTRER UN TRADE</div>
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
            <label style={{ display: 'block', fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 4 }}>RÉSULTAT</label>
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
          <label style={{ display: 'block', fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 4 }}>NOTES (optionnel)</label>
          <input className="field-input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Ce qui a marché, ce qui n'a pas..." />
        </div>
        <button className="btn-primary" onClick={addTrade} disabled={!form.ticker || form.pnl === ''}>
          + AJOUTER
        </button>
      </div>

      {/* Trade list */}
      {trades.length === 0 ? (
        <div style={{ textAlign: 'center', color: C.muted, fontSize: 12, padding: 40 }}>
          Aucun trade enregistré. Commencez à trader !
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

// ─── Tab 4: PROFILE ───────────────────────────────────────────────────────────
const STYLE_OPTIONS = ['scalping', 'day trading', 'swing trading', 'position trading'];
const MARKET_OPTIONS = ['NYSE', 'NASDAQ'];

function ProfileTab({ profile, onSave }) {
  const [form, setForm] = useState({ ...profile });
  const [saved, setSaved] = useState(false);

  const toggleStyle = style => {
    setForm(f => ({
      ...f,
      tradingStyles: f.tradingStyles.includes(style)
        ? f.tradingStyles.filter(s => s !== style)
        : [...f.tradingStyles, style],
    }));
  };

  const toggleMarket = market => {
    setForm(f => ({
      ...f,
      markets: f.markets.includes(market)
        ? f.markets.filter(m => m !== market)
        : [...f.markets, market],
    }));
  };

  const handleSave = () => {
    onSave(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const isValid = form.name.trim() && form.capital > 0 && form.tradingStyles.length > 0 && form.markets.length > 0;

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>
      <div className="card">
        <div style={{ fontFamily: 'Bebas Neue', fontSize: 22, letterSpacing: 3, color: C.green, marginBottom: 24 }}>
          PROFIL DU TRADER
        </div>

        {/* Name */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 6 }}>NOM DU TRADER</label>
          <input
            className="field-input"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Marcus Reid"
          />
        </div>

        {/* Role */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 6 }}>RÔLE</label>
          <input
            className="field-input"
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            placeholder="Institutional Trader"
          />
        </div>

        {/* Experience */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 6 }}>EXPÉRIENCE</label>
          <input
            className="field-input"
            value={form.experience}
            onChange={e => setForm(f => ({ ...f, experience: e.target.value }))}
            placeholder="20 years"
          />
        </div>

        {/* Capital */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 6 }}>CAPITAL ($)</label>
          <input
            className="field-input"
            type="number"
            min="100"
            value={form.capital}
            onChange={e => setForm(f => ({ ...f, capital: parseFloat(e.target.value) || 0 }))}
            placeholder="5000"
          />
        </div>

        {/* Markets */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 10 }}>MARCHÉS</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {MARKET_OPTIONS.map(m => (
              <button
                key={m}
                onClick={() => toggleMarket(m)}
                style={{
                  padding: '6px 18px',
                  fontSize: 12,
                  letterSpacing: 2,
                  fontFamily: 'IBM Plex Mono, monospace',
                  cursor: 'pointer',
                  border: `1px solid ${form.markets.includes(m) ? C.green : C.border}`,
                  background: form.markets.includes(m) ? C.green + '18' : 'transparent',
                  color: form.markets.includes(m) ? C.green : C.muted,
                  transition: 'all 0.15s',
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Trading Styles */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 10 }}>STYLES DE TRADING</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {STYLE_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => toggleStyle(s)}
                style={{
                  padding: '6px 14px',
                  fontSize: 11,
                  letterSpacing: 1,
                  fontFamily: 'IBM Plex Mono, monospace',
                  cursor: 'pointer',
                  border: `1px solid ${form.tradingStyles.includes(s) ? C.blue : C.border}`,
                  background: form.tradingStyles.includes(s) ? C.blue + '18' : 'transparent',
                  color: form.tradingStyles.includes(s) ? C.blue : C.muted,
                  transition: 'all 0.15s',
                  textTransform: 'uppercase',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <button className="btn-primary" onClick={handleSave} disabled={!isValid} style={{ width: '100%' }}>
          {saved ? '✓ SAUVEGARDÉ' : 'SAUVEGARDER'}
        </button>
      </div>

      {/* Risk summary */}
      <div style={{ marginTop: 16, padding: 16, border: `1px solid ${C.border}`, background: C.panel }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: 14, letterSpacing: 2, color: C.muted, marginBottom: 12 }}>PARAMÈTRES DE RISQUE</div>
        <PriceRow label="RISQUE MAX / TRADE (2%)" value={`$${(form.capital * 0.02).toFixed(2)}`} color={C.yellow} />
        <PriceRow label="LIMITE DRAWDOWN (3%)" value={`$${(form.capital * 0.03).toFixed(2)}`} color={C.red} />
        <PriceRow label="POSITIONS MAX" value="3" color={C.blue} />
        <PriceRow label="RATIO R/R MIN" value="1:1.5" color={C.green} />
      </div>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  injectGlobalCSS();

  const [tab, setTab] = useState('dashboard');
  const [deepDiveTicker, setDeepDiveTicker] = useState('');
  const [journalPrefill, setJournalPrefill] = useState(null);
  const [profile, setProfile] = useState(() => {
    const p = loadProfile();
    saveProfile(p);
    return p;
  });

  // Watchlist extraite du profil pour le panneau News
  const watchlist = profile.watchlist || [];

  const handleSaveProfile = useCallback(updated => {
    saveProfile(updated);
    setProfile(updated);
  }, []);

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
            <span style={{ fontSize: 10, color: C.muted, letterSpacing: 3 }}>AGENT DE TRADING AUTONOME v2.0</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: C.text, letterSpacing: 1 }}>{profile.name}</div>
              <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1 }}>
                {profile.experience} · {profile.markets.join('/')} · ${profile.capital.toLocaleString()}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <div className="pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, marginRight: 8 }} />
              <span style={{ fontSize: 10, color: C.green, letterSpacing: 2 }}>EN DIRECT</span>
            </div>
          </div>
        </div>
        {/* Tabs — tous montés pour ne pas perdre les états */}
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', gap: 0, overflowX: 'auto' }}>
          <button className={`tab-btn ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>
            ▤ DASHBOARD
          </button>
          <button className={`tab-btn ${tab === 'hunt' ? 'active' : ''}`} onClick={() => setTab('hunt')}>
            ◈ CHASSE MARCHÉ
          </button>
          <button className={`tab-btn ${tab === 'dive' ? 'active' : ''}`} onClick={() => setTab('dive')}>
            ⊕ ANALYSE
          </button>
          <button className={`tab-btn ${tab === 'trades' ? 'active' : ''}`} onClick={() => setTab('trades')}>
            ◆ TRADES
          </button>
          <button className={`tab-btn ${tab === 'news' ? 'active' : ''}`} onClick={() => setTab('news')}>
            ◎ ACTUALITÉS
          </button>
          <button className={`tab-btn ${tab === 'journal' ? 'active' : ''}`} onClick={() => setTab('journal')}>
            ◉ JOURNAL
          </button>
          <button className={`tab-btn ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}>
            ◈ PROFIL
          </button>
        </div>
      </header>

      {/* Content — toujours monté pour préserver l'état et les analyses en cours */}
      <main>
        <div style={{ display: tab === 'dashboard' ? 'block' : 'none' }}><Dashboard /></div>
        <div style={{ display: tab === 'hunt'    ? 'block' : 'none' }}><HuntTab onDeepDive={handleDeepDive} defaultCapital={profile.capital} profile={profile} /></div>
        <div style={{ display: tab === 'dive'    ? 'block' : 'none' }}><DeepDiveTab prefillTicker={deepDiveTicker} onLogTrade={handleLogTrade} profile={profile} /></div>
        <div style={{ display: tab === 'trades'  ? 'block' : 'none' }}><TradePanel /></div>
        <div style={{ display: tab === 'news'    ? 'block' : 'none' }}><NewsPanel watchlist={watchlist} /></div>
        <div style={{ display: tab === 'journal' ? 'block' : 'none' }}><JournalTab prefillLog={journalPrefill} baseCapital={profile.capital} /></div>
        <div style={{ display: tab === 'profile' ? 'block' : 'none' }}><ProfileTab profile={profile} onSave={handleSaveProfile} /></div>
      </main>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '24px 16px', color: C.muted, fontSize: 10, letterSpacing: 2, borderTop: `1px solid ${C.border}` }}>
        AXIOM v2.0 — À TITRE ÉDUCATIF UNIQUEMENT. PAS DE CONSEIL FINANCIER.
      </footer>
    </div>
  );
}

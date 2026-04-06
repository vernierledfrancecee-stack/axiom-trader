/**
 * AXIOM — Panneau Trades Actifs
 * Ouvrir / fermer des trades, suivi en temps réel du P&L.
 */

import React, { useState, useEffect, useCallback } from 'react';

const C = {
  bg: 'var(--bg)',
  panel: 'var(--bg2)',
  bg3: 'var(--bg3)',
  border: 'var(--border)',
  border2: 'var(--border2)',
  green: 'var(--green)',
  red: 'var(--red)',
  yellow: 'var(--yellow)',
  blue: 'var(--blue)',
  muted: 'var(--text3)',
  text: 'var(--text)',
  text2: 'var(--text2)',
};

const POLL_INTERVAL = 15000; // 15 secondes

/** Formate un nombre en euros FR */
function eur(n) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
}

/** Calcule R:R */
function calcRR(entree, stop, tp1) {
  const e = parseFloat(entree);
  const s = parseFloat(stop);
  const t = parseFloat(tp1);
  if (!e || !s || !t || Math.abs(e - s) === 0) return null;
  return ((t - e) / Math.abs(e - s)).toFixed(2);
}

/** Barre de progression vers un niveau */
function ProgressBar({ label, value, current, entree, color, direction }) {
  if (!value || !current || !entree) return null;
  const mult = direction === 'SHORT' ? -1 : 1;
  const total = Math.abs(value - entree);
  const done = Math.min(Math.abs(current - entree) * mult, total);
  const pct = total > 0 ? Math.max(0, Math.min(100, (done / total) * 100)) : 0;

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.muted, marginBottom: 3, letterSpacing: 1 }}>
        <span>{label}</span>
        <span>{value} ({pct.toFixed(0)}%)</span>
      </div>
      <div style={{ height: 4, background: C.bg3, borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

/** Carte de trade actif */
function ActiveTradeCard({ ticker, trade, onClose }) {
  const { direction, entree, stop, tp1, tp2, prixActuel, pnl, pnlPct, quantite, dateOuverture } = trade;
  const isPositive = (pnl || 0) >= 0;

  return (
    <div style={{
      background: C.panel,
      border: `1px solid ${isPositive ? C.green + '40' : C.red + '40'}`,
      padding: 16,
      animation: 'fadeUp 0.3s ease forwards',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'Bebas Neue, cursive', fontSize: 20, letterSpacing: 3, color: C.text }}>{ticker}</span>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 1, padding: '2px 8px',
            background: direction === 'LONG' ? C.green + '20' : C.red + '20',
            color: direction === 'LONG' ? C.green : C.red,
            border: `1px solid ${direction === 'LONG' ? C.green + '40' : C.red + '40'}`,
          }}>
            {direction}
          </span>
        </div>
        {/* P&L flottant */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: isPositive ? C.green : C.red }}>
            {isPositive ? '+' : ''}{eur(pnl)}
          </div>
          <div style={{ fontSize: 10, color: isPositive ? C.green : C.red }}>
            {isPositive ? '+' : ''}{(pnlPct || 0).toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Prix live */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, padding: '8px 0', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <PriceInfo label="ENTRÉE" value={entree} />
        <PriceInfo label="PRIX ACTUEL" value={prixActuel} highlight />
        <PriceInfo label="QTÉ" value={quantite + ' act.'} />
      </div>

      {/* Barres de progression */}
      <div style={{ marginBottom: 14 }}>
        <ProgressBar label="▸ TP2" value={tp2} current={prixActuel} entree={entree} color={C.green} direction={direction} />
        <ProgressBar label="▸ TP1" value={tp1} current={prixActuel} entree={entree} color={C.blue} direction={direction} />
        <ProgressBar label="▸ STOP" value={stop} current={prixActuel} entree={entree} color={C.red} direction={direction === 'LONG' ? 'SHORT' : 'LONG'} />
      </div>

      {/* Date ouverture */}
      <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 12 }}>
        OUVERT LE {dateOuverture ? new Date(dateOuverture).toLocaleString('fr-FR') : '—'}
      </div>

      {/* Fermer */}
      <button
        onClick={() => onClose(ticker, prixActuel)}
        style={{
          width: '100%',
          background: 'transparent',
          border: `1px solid ${C.red}`,
          color: C.red,
          padding: '8px 0',
          fontSize: 11,
          letterSpacing: 2,
          cursor: 'pointer',
          fontFamily: 'IBM Plex Mono, monospace',
          textTransform: 'uppercase',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => { e.target.style.background = C.red; e.target.style.color = '#fff'; }}
        onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = C.red; }}
      >
        Fermer le trade
      </button>
    </div>
  );
}

function PriceInfo({ label, value, highlight }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: highlight ? C.blue : C.text, fontWeight: highlight ? 600 : 400 }}>{value}</div>
    </div>
  );
}

/** Formulaire d'ouverture de trade */
function OpenTradeForm({ onSuccess }) {
  const [form, setForm] = useState({
    ticker: '', direction: 'LONG', entree: '', stop: '', tp1: '', tp2: '', quantite: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const rr = calcRR(form.entree, form.stop, form.tp1);
  const montantRisque = form.entree && form.stop && form.quantite
    ? Math.abs((parseFloat(form.entree) - parseFloat(form.stop)) * parseInt(form.quantite)).toFixed(2)
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const r = await fetch('/api/trade/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          ticker: form.ticker.toUpperCase(),
          quantite: parseInt(form.quantite),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Erreur');
      setForm({ ticker: '', direction: 'LONG', entree: '', stop: '', tp1: '', tp2: '', quantite: '' });
      onSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    background: C.bg,
    border: `1px solid ${C.border}`,
    color: C.text,
    padding: '8px 10px',
    fontSize: 12,
    fontFamily: 'IBM Plex Mono, monospace',
    width: '100%',
  };

  const labelStyle = {
    display: 'block',
    fontSize: 9,
    color: C.muted,
    letterSpacing: 2,
    marginBottom: 5,
    textTransform: 'uppercase',
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Ticker</label>
          <input style={inputStyle} value={form.ticker} onChange={e => set('ticker', e.target.value.toUpperCase())}
            placeholder="AAPL" maxLength={6} required />
        </div>
        <div>
          <label style={labelStyle}>Direction</label>
          <select style={inputStyle} value={form.direction} onChange={e => set('direction', e.target.value)}>
            <option value="LONG">LONG</option>
            <option value="SHORT">SHORT</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Prix d'entrée</label>
          <input style={inputStyle} type="number" step="0.01" value={form.entree}
            onChange={e => set('entree', e.target.value)} placeholder="150.00" required />
        </div>
        <div>
          <label style={labelStyle}>Stop Loss</label>
          <input style={inputStyle} type="number" step="0.01" value={form.stop}
            onChange={e => set('stop', e.target.value)} placeholder="145.00" required />
        </div>
        <div>
          <label style={labelStyle}>TP1</label>
          <input style={inputStyle} type="number" step="0.01" value={form.tp1}
            onChange={e => set('tp1', e.target.value)} placeholder="160.00" />
        </div>
        <div>
          <label style={labelStyle}>TP2</label>
          <input style={inputStyle} type="number" step="0.01" value={form.tp2}
            onChange={e => set('tp2', e.target.value)} placeholder="170.00" />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={labelStyle}>Quantité (actions)</label>
          <input style={inputStyle} type="number" min="1" value={form.quantite}
            onChange={e => set('quantite', e.target.value)} placeholder="10" required />
        </div>
      </div>

      {/* Calculs auto */}
      {(rr || montantRisque) && (
        <div style={{
          display: 'flex', gap: 16, padding: '10px 12px',
          background: C.bg3, border: `1px solid ${C.border}`,
          marginBottom: 12, fontSize: 11,
        }}>
          {rr && <span style={{ color: parseFloat(rr) >= 1.5 ? C.green : C.yellow }}>R:R 1:{rr}</span>}
          {montantRisque && <span style={{ color: C.red }}>Risque : {eur(montantRisque)}</span>}
        </div>
      )}

      {error && (
        <div style={{ color: C.red, fontSize: 11, marginBottom: 10, padding: '8px 10px', background: C.red + '10', border: `1px solid ${C.red}30` }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          width: '100%', background: C.green, color: '#fff', border: 'none',
          padding: '10px 0', fontSize: 12, letterSpacing: 2, cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? 'OUVERTURE...' : '+ OUVRIR LE TRADE'}
      </button>
    </form>
  );
}

/** Composant principal */
export default function TradePanel() {
  const [trades, setTrades] = useState({});
  const [lastReport, setLastReport] = useState(null);
  const [closing, setClosing] = useState(null);

  const fetchTrades = useCallback(async () => {
    try {
      const r = await fetch('/api/trade/active');
      if (!r.ok) return;
      const data = await r.json();
      setTrades(data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchTrades();
    const interval = setInterval(fetchTrades, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchTrades]);

  const handleClose = async (ticker, prixActuel) => {
    const prixSortie = prompt(`Fermer ${ticker} — Prix de sortie (actuel: ${prixActuel}):`, prixActuel);
    if (!prixSortie) return;

    setClosing(ticker);
    try {
      const r = await fetch('/api/trade/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, prixSortie: parseFloat(prixSortie), raison: 'Fermeture manuelle' }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      if (data.rapport) setLastReport({ ticker, ...data });
      await fetchTrades();

      // Son de notification si alerte critique
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.connect(ctx.destination);
        osc.frequency.value = data.pnl >= 0 ? 880 : 440;
        osc.start();
        setTimeout(() => osc.stop(), 200);
      } catch {}
    } catch (err) {
      alert(`Erreur : ${err.message}`);
    } finally {
      setClosing(null);
    }
  };

  const tradeKeys = Object.keys(trades);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: 22, letterSpacing: 4, color: C.text, marginBottom: 20 }}>
        GESTION DES TRADES
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Formulaire ouverture */}
        <div>
          <div style={{
            background: C.panel, border: `1px solid ${C.border}`, padding: 18, marginBottom: 16,
          }}>
            <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: 14, letterSpacing: 3, color: C.text, marginBottom: 14 }}>
              OUVRIR UN TRADE
            </div>
            <OpenTradeForm onSuccess={fetchTrades} />
          </div>

          {/* Dernier rapport Marcus */}
          {lastReport && (
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, padding: 16 }}>
              <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: 14, letterSpacing: 3, color: C.text, marginBottom: 10 }}>
                RAPPORT MARCUS — {lastReport.ticker}
              </div>
              <div style={{
                fontSize: 11,
                color: lastReport.pnl >= 0 ? C.green : C.red,
                marginBottom: 8,
                fontWeight: 600,
              }}>
                P&L : {lastReport.pnl >= 0 ? '+' : ''}{eur(lastReport.pnl)}
                ({lastReport.pnlPct >= 0 ? '+' : ''}{lastReport.pnlPct?.toFixed(2)}%)
              </div>
              <div style={{
                fontSize: 11,
                color: C.text2,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}>
                {lastReport.rapport}
              </div>
            </div>
          )}
        </div>

        {/* Trades actifs */}
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
          }}>
            <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: 14, letterSpacing: 3, color: C.text }}>
              TRADES ACTIFS ({tradeKeys.length})
            </div>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1 }}>
              Mis à jour toutes les 15s
            </div>
          </div>

          {tradeKeys.length === 0 ? (
            <div style={{
              padding: 40, textAlign: 'center', color: C.muted,
              fontSize: 11, letterSpacing: 2,
              border: `1px dashed ${C.border}`,
            }}>
              Aucun trade actif
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {tradeKeys.map(ticker => (
                <ActiveTradeCard
                  key={ticker}
                  ticker={ticker}
                  trade={trades[ticker]}
                  onClose={handleClose}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

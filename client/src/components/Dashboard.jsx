/**
 * AXIOM — Dashboard Capital & Performance
 * Courbe de capital, métriques, P&L par jour, rapports Marcus.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

const C = {
  bg: 'var(--bg)',
  panel: 'var(--bg2)',
  bg3: 'var(--bg3)',
  border: 'var(--border)',
  green: 'var(--green)',
  red: 'var(--red)',
  yellow: 'var(--yellow)',
  blue: 'var(--blue)',
  purple: 'var(--purple)',
  muted: 'var(--text3)',
  text: 'var(--text)',
  text2: 'var(--text2)',
};

/** Formate en euros FR */
function eur(n, showSign = false) {
  if (n == null || isNaN(n)) return '—';
  const val = new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
  }).format(Math.abs(n));
  if (showSign) return (n >= 0 ? '+' : '-') + val;
  return (n < 0 ? '-' : '') + val;
}

/** Formate en % */
function pct(n) {
  if (n == null || isNaN(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

/** Formate une date courte (DD/MM) */
function shortDate(d) {
  if (!d) return '';
  const [year, month, day] = d.split('-');
  return `${day}/${month}`;
}

/** Vérifie si le marché américain est ouvert */
function isMarketOpen() {
  const now = new Date();
  const nyTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = nyTime.getDay(); // 0=dim, 6=sam
  const hours = nyTime.getHours();
  const minutes = nyTime.getMinutes();
  const timeNum = hours * 100 + minutes;
  return day >= 1 && day <= 5 && timeNum >= 930 && timeNum < 1600;
}

/** Carte métrique */
function MetricCard({ label, value, color, sub }) {
  return (
    <div style={{
      background: C.panel,
      border: `1px solid ${C.border}`,
      padding: '14px 16px',
    }}>
      <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || C.text, letterSpacing: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

/** Tooltip personnalisé pour les graphiques */
function CustomTooltip({ active, payload, label, isCurrency }) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div style={{
      background: C.panel,
      border: `1px solid ${C.border}`,
      padding: '8px 12px',
      fontSize: 11,
    }}>
      <div style={{ color: C.muted, marginBottom: 4 }}>{label}</div>
      <div style={{ color: val >= 0 ? C.green : C.red, fontWeight: 600 }}>
        {isCurrency ? eur(val, true) : val?.toFixed(2)}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [stats, setStats] = useState(null);
  const [capitalCurve, setCapitalCurve] = useState([]);
  const [dailyPnL, setDailyPnL] = useState([]);
  const [tradeHistory, setTradeHistory] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [marketOpen, setMarketOpen] = useState(isMarketOpen());

  const [capitalInitial, setCapitalInitial] = useState(() => {
    const saved = localStorage.getItem('axiom_capital_initial');
    return saved ? parseFloat(saved) : parseFloat(process.env.CAPITAL_INITIAL || '5000');
  });
  const [editingCapital, setEditingCapital] = useState(false);
  const [capitalInput, setCapitalInput] = useState(String(capitalInitial));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryR, statsR, curveR, dailyR, historyR] = await Promise.all([
        fetch('/api/stats/summary'),
        fetch('/api/analytics/stats'),
        fetch('/api/analytics/capital-curve'),
        fetch('/api/analytics/daily-pnl'),
        fetch('/api/trade/history?limit=5'),
      ]);

      if (summaryR.ok) setSummary(await summaryR.json());
      if (statsR.ok) setStats(await statsR.json());
      if (curveR.ok) setCapitalCurve(await curveR.json());
      if (dailyR.ok) setDailyPnL(await dailyR.json());
      if (historyR.ok) setTradeHistory(await historyR.json());
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(() => {
      setMarketOpen(isMarketOpen());
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const handleSaveCapital = () => {
    const val = parseFloat(capitalInput);
    if (!isNaN(val) && val > 0) {
      setCapitalInitial(val);
      localStorage.setItem('axiom_capital_initial', String(val));
    }
    setEditingCapital(false);
  };

  const capitalActuel = summary?.capitalActuel || capitalInitial;
  const pnlTotal = capitalActuel - capitalInitial;
  const pnlTotalPct = capitalInitial > 0 ? (pnlTotal / capitalInitial) * 100 : 0;

  // Courbe de capital : ajouter le capital initial si vide
  const curveData = capitalCurve.length > 0
    ? capitalCurve.map(d => ({ ...d, date: shortDate(d.date) }))
    : [{ date: 'Auj.', capital: capitalActuel }];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: 22, letterSpacing: 4, color: C.text }}>
          DASHBOARD PERFORMANCE
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Indicateur marché */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px',
            border: `1px solid ${marketOpen ? C.green + '40' : C.border}`,
            background: marketOpen ? C.green + '10' : 'transparent',
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: marketOpen ? C.green : C.muted,
              animation: marketOpen ? 'pulse 1.5s ease infinite' : 'none',
            }} />
            <span style={{ fontSize: 10, color: marketOpen ? C.green : C.muted, letterSpacing: 2 }}>
              MARCHÉ {marketOpen ? 'OUVERT' : 'FERMÉ'}
            </span>
          </div>
          <button
            onClick={fetchAll}
            disabled={loading}
            style={{
              background: 'transparent', border: `1px solid ${C.border}`,
              color: C.muted, padding: '5px 12px', fontSize: 10,
              letterSpacing: 2, cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace',
            }}
          >
            ↻ REFRESH
          </button>
        </div>
      </div>

      {/* Capital initial configurable */}
      <div style={{
        background: C.panel, border: `1px solid ${C.border}`,
        padding: '12px 16px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 10, color: C.muted, letterSpacing: 2 }}>CAPITAL INITIAL :</span>
        {editingCapital ? (
          <>
            <input
              value={capitalInput}
              onChange={e => setCapitalInput(e.target.value)}
              style={{
                background: C.bg3, border: `1px solid ${C.border2}`,
                color: C.text, padding: '4px 8px', fontSize: 12,
                fontFamily: 'IBM Plex Mono, monospace', width: 120,
              }}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSaveCapital(); if (e.key === 'Escape') setEditingCapital(false); }}
            />
            <button onClick={handleSaveCapital} style={{ fontSize: 10, color: C.green, background: 'none', border: 'none', cursor: 'pointer' }}>✓ OK</button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{eur(capitalInitial)}</span>
            <button onClick={() => { setCapitalInput(String(capitalInitial)); setEditingCapital(true); }}
              style={{ fontSize: 9, color: C.blue, background: 'none', border: 'none', cursor: 'pointer', letterSpacing: 1 }}>
              ✎ modifier
            </button>
          </>
        )}
      </div>

      {/* Carte capital principal */}
      <div style={{
        background: C.panel, border: `1px solid ${pnlTotal >= 0 ? C.green + '50' : C.red + '50'}`,
        padding: '20px 24px', marginBottom: 20,
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 20,
      }}>
        <div>
          <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 6 }}>CAPITAL ACTUEL</div>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 1, color: C.text }}>{eur(capitalActuel)}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 6 }}>P&L JOUR</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: (summary?.pnlJour || 0) >= 0 ? C.green : C.red }}>
            {eur(summary?.pnlJour || 0, true)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 6 }}>P&L TOTAL</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: pnlTotal >= 0 ? C.green : C.red }}>
            {eur(pnlTotal, true)}
          </div>
          <div style={{ fontSize: 11, color: pnlTotal >= 0 ? C.green : C.red }}>{pct(pnlTotalPct)}</div>
        </div>
      </div>

      {/* Grille de métriques */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
          <MetricCard label="Win Rate" value={`${stats.winRate}%`} color={stats.winRate >= 50 ? C.green : C.red} />
          <MetricCard label="Profit Factor" value={stats.profitFactor === Infinity ? '∞' : stats.profitFactor}
            color={stats.profitFactor >= 1.5 ? C.green : C.yellow} />
          <MetricCard label="Nb Trades" value={stats.nbTrades} color={C.blue} />
          <MetricCard label="Drawdown Max" value={eur(stats.maxDrawdown)} color={C.red}
            sub={`Sharpe : ${stats.sharpe}`} />
          <MetricCard label="Meilleur Trade"
            value={stats.bestTrade ? eur(stats.bestTrade.pnl) : '—'}
            color={C.green}
            sub={stats.bestTrade?.ticker} />
          <MetricCard label="Pire Trade"
            value={stats.worstTrade ? eur(stats.worstTrade.pnl) : '—'}
            color={C.red}
            sub={stats.worstTrade?.ticker} />
        </div>
      )}

      {/* Streak */}
      {stats?.nbTrades > 0 && (
        <div style={{
          padding: '10px 14px', marginBottom: 24,
          border: `1px solid ${stats.streakType === 'WIN' ? C.green + '40' : C.red + '40'}`,
          background: stats.streakType === 'WIN' ? C.green + '08' : C.red + '08',
          fontSize: 11, color: C.text2,
        }}>
          Streak actuelle : <strong style={{ color: stats.streakType === 'WIN' ? C.green : C.red }}>
            {stats.streakActuelle} {stats.streakType === 'WIN' ? 'victoire(s) consécutive(s)' : 'perte(s) consécutive(s)'}
          </strong>
        </div>
      )}

      {/* Graphique courbe de capital */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, padding: 18, marginBottom: 20 }}>
        <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: 14, letterSpacing: 3, color: C.text, marginBottom: 14 }}>
          COURBE DE CAPITAL
        </div>
        {curveData.length <= 1 ? (
          <div style={{ textAlign: 'center', padding: 30, color: C.muted, fontSize: 11 }}>
            Pas encore de données de performance (snapshots à 16h05 EST)
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={curveData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.muted }} />
              <YAxis tick={{ fontSize: 10, fill: C.muted }} tickFormatter={v => `${(v / 1000).toFixed(1)}k€`} />
              <Tooltip content={<CustomTooltip isCurrency />} />
              <ReferenceLine y={capitalInitial} stroke={C.muted} strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="capital"
                stroke={capitalActuel >= capitalInitial ? C.green : C.red}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Graphique P&L par jour */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, padding: 18, marginBottom: 20 }}>
        <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: 14, letterSpacing: 3, color: C.text, marginBottom: 14 }}>
          P&L PAR JOUR (30 JOURS)
        </div>
        {dailyPnL.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: C.muted, fontSize: 11 }}>
            Aucun trade fermé sur les 30 derniers jours
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={dailyPnL.map(d => ({ ...d, jour: shortDate(d.jour) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="jour" tick={{ fontSize: 9, fill: C.muted }} />
              <YAxis tick={{ fontSize: 9, fill: C.muted }} tickFormatter={v => `${v}€`} />
              <Tooltip content={<CustomTooltip isCurrency />} />
              <ReferenceLine y={0} stroke={C.border2} />
              <Bar dataKey="pnl_total" name="P&L"
                fill={C.green}
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Rapports Marcus */}
      {tradeHistory.length > 0 && (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, padding: 18 }}>
          <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: 14, letterSpacing: 3, color: C.text, marginBottom: 14 }}>
            DERNIERS RAPPORTS MARCUS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tradeHistory.slice(0, 5).map((trade) => (
              <div key={trade.id}>
                <button
                  onClick={() => setSelectedReport(selectedReport?.id === trade.id ? null : trade)}
                  style={{
                    width: '100%', background: 'transparent',
                    border: `1px solid ${trade.pnl >= 0 ? C.green + '30' : C.red + '30'}`,
                    padding: '10px 14px', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    fontFamily: 'IBM Plex Mono, monospace',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{trade.ticker}</span>
                    <span style={{ fontSize: 10, color: C.muted }}>{trade.direction}</span>
                    <span style={{ fontSize: 10, color: C.muted }}>
                      {trade.date_fermeture ? new Date(trade.date_fermeture).toLocaleDateString('fr-FR') : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: trade.pnl >= 0 ? C.green : C.red, fontWeight: 600 }}>
                      {eur(trade.pnl, true)}
                    </span>
                    <span style={{ fontSize: 10, color: C.muted }}>
                      {selectedReport?.id === trade.id ? '▲' : '▼'}
                    </span>
                  </div>
                </button>
                {selectedReport?.id === trade.id && trade.rapport_marcus && (
                  <div style={{
                    padding: '12px 14px',
                    background: C.bg3,
                    border: `1px solid ${C.border}`,
                    borderTop: 'none',
                    fontSize: 11,
                    color: C.text2,
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                    fontStyle: 'italic',
                  }}>
                    {trade.rapport_marcus}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

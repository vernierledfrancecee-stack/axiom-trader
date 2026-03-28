import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, CandlestickSeries, LineStyle } from 'lightweight-charts';

// Parse "$52-54" → 53, "$58" → 58
function parsePrice(str) {
  if (!str) return null;
  const nums = (str.match(/[\d.]+/g) || []).map(Number).filter(Boolean);
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

const INTERVALS = [
  { label: '1M',  interval: '1m',  range: '1d'  },
  { label: '5M',  interval: '5m',  range: '1d'  },
  { label: '15M', interval: '15m', range: '5d'  },
  { label: '1H',  interval: '60m', range: '5d'  },
];

export default function LiveChart({ ticker, signal, entryZone, stopLoss, target1, target2 }) {
  const containerRef = useRef(null);
  const chartRef     = useRef(null);
  const seriesRef    = useRef(null);
  const [ivIdx, setIvIdx]             = useState(1);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [error, setError]             = useState(null);
  const [lastUpdate, setLastUpdate]   = useState(null);

  // ── Init chart once ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width:  containerRef.current.clientWidth,
      height: 340,
      layout: { background: { color: '#FFFFFF' }, textColor: '#0F172A' },
      grid:   { vertLines: { color: '#E2E8F0' }, horzLines: { color: '#E2E8F0' } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#CBD5E1' },
      timeScale: { borderColor: '#CBD5E1', timeVisible: true, secondsVisible: false },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor:       '#00A855',
      downColor:     '#E53E3E',
      borderVisible: false,
      wickUpColor:   '#00A855',
      wickDownColor: '#E53E3E',
    });

    chartRef.current  = chart;
    seriesRef.current = series;

    // Price lines
    const entry = parsePrice(entryZone);
    const sl    = parsePrice(stopLoss);
    const tp1   = parsePrice(target1);
    const tp2   = parsePrice(target2);

    if (entry) series.createPriceLine({ price: entry, color: '#2563EB', lineWidth: 2, lineStyle: LineStyle.Dashed,  axisLabelVisible: true, title: 'ENTRÉE' });
    if (sl)    series.createPriceLine({ price: sl,    color: '#E53E3E', lineWidth: 2, lineStyle: LineStyle.Dashed,  axisLabelVisible: true, title: 'STOP'   });
    if (tp1)   series.createPriceLine({ price: tp1,   color: '#00A855', lineWidth: 1, lineStyle: LineStyle.Dashed,  axisLabelVisible: true, title: 'TP1'    });
    if (tp2)   series.createPriceLine({ price: tp2,   color: '#00A855', lineWidth: 1, lineStyle: LineStyle.Dotted,  axisLabelVisible: true, title: 'TP2'    });

    const ro = new ResizeObserver(() => {
      if (containerRef.current && containerRef.current.clientWidth > 0) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    // Resize + reload quand la fenêtre/onglet redevient visible
    const onVisible = () => {
      if (!document.hidden && containerRef.current && containerRef.current.clientWidth > 0) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
        chart.timeScale().fitContent();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [entryZone, stopLoss, target1, target2]);

  // ── Fetch & update candles ───────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!seriesRef.current || !ticker) return;
    const { interval, range } = INTERVALS[ivIdx];
    try {
      const res = await fetch(`/api/candles/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`);
      if (!res.ok) throw new Error('Données indisponibles');
      const { candles } = await res.json();
      if (!candles?.length) throw new Error('Aucune donnée');
      seriesRef.current.setData(candles);
      setCurrentPrice(candles[candles.length - 1].close);
      setLastUpdate(new Date().toLocaleTimeString('fr-FR'));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [ticker, ivIdx]);

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 15_000);
    return () => clearInterval(id);
  }, [loadData]);

  const isLong = signal === 'LONG';
  const priceColor = isLong ? '#00A855' : signal === 'SHORT' ? '#E53E3E' : '#94A3B8';

  return (
    <div className="card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'Bebas Neue', fontSize: 20, letterSpacing: 2, color: '#0F172A' }}>{ticker}</span>
          {currentPrice && (
            <span style={{ fontFamily: 'Bebas Neue', fontSize: 20, color: priceColor, letterSpacing: 1 }}>
              ${currentPrice.toFixed(2)}
            </span>
          )}
          <span style={{ fontSize: 9, color: '#94A3B8', letterSpacing: 1 }}>
            {lastUpdate ? `MÀJ ${lastUpdate}` : 'CHARGEMENT…'}
          </span>
        </div>

        {/* Interval selector */}
        <div style={{ display: 'flex', gap: 4 }}>
          {INTERVALS.map((iv, i) => (
            <button
              key={iv.label}
              onClick={() => setIvIdx(i)}
              style={{
                padding: '3px 9px', fontSize: 10, letterSpacing: 1,
                fontFamily: 'monospace', cursor: 'pointer', border: 'none',
                background: i === ivIdx ? '#00A855' : '#F0F2F8',
                color:      i === ivIdx ? '#fff'    : '#475569',
              }}
            >
              {iv.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {error
        ? <div style={{ padding: 20, color: '#E53E3E', fontSize: 11, textAlign: 'center', letterSpacing: 1 }}>
            ⚠ {error}
          </div>
        : <div ref={containerRef} style={{ width: '100%', height: 340 }} />
      }

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, padding: '8px 14px', borderTop: '1px solid #E2E8F0', flexWrap: 'wrap' }}>
        <Legend color="#2563EB" label={`ENTRÉE ${entryZone || '—'}`}  dash="dashed" />
        <Legend color="#E53E3E" label={`STOP    ${stopLoss  || '—'}`}  dash="dashed" />
        <Legend color="#00A855" label={`TP1     ${target1   || '—'}`}  dash="dashed" />
        <Legend color="#00A855" label={`TP2     ${target2   || '—'}`}  dash="dotted" />
      </div>
    </div>
  );
}

function Legend({ color, label, dash }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#475569', letterSpacing: 1 }}>
      <svg width="20" height="8">
        <line x1="0" y1="4" x2="20" y2="4"
          stroke={color} strokeWidth="2"
          strokeDasharray={dash === 'dotted' ? '2,3' : '5,3'}
        />
      </svg>
      {label}
    </div>
  );
}

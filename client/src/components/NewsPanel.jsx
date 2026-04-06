/**
 * AXIOM — Panneau Actualités
 * Affiche les news financières en français, filtrées par la watchlist.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

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
  text2: 'var(--text2)',
};

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Formate une date en temps relatif (ex: "il y a 2h")
 */
function formatRelative(isoDate) {
  try {
    const diff = Date.now() - new Date(isoDate).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "à l'instant";
    if (minutes < 60) return `il y a ${minutes}min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    return `il y a ${days}j`;
  } catch {
    return '';
  }
}

/**
 * Skeleton card pour le chargement.
 */
function SkeletonCard() {
  return (
    <div style={{
      background: C.panel,
      border: `1px solid ${C.border}`,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      {[80, 100, 60, 40].map((w, i) => (
        <div
          key={i}
          style={{
            height: i === 0 ? 14 : 10,
            width: `${w}%`,
            background: 'var(--bg3)',
            animation: 'pulse 1.5s ease infinite',
          }}
        />
      ))}
    </div>
  );
}

/**
 * Carte d'article de news.
 */
function ArticleCard({ article }) {
  const {
    titreFR,
    titre,
    resumeFR,
    resume,
    lien,
    date,
    image,
    source,
    tickersMentionnes = [],
  } = article;

  const displayTitle = titreFR || titre || 'Sans titre';
  const displayResume = (resumeFR || resume || '').replace(/<[^>]+>/g, '').substring(0, 140);

  return (
    <a
      href={lien || '#'}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        textDecoration: 'none',
        color: 'inherit',
        display: 'block',
        background: C.panel,
        border: `1px solid ${C.border}`,
        transition: 'border-color 0.2s, transform 0.1s',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = C.blue;
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = C.border;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Image */}
      {image && (
        <div style={{ width: '100%', height: 140, overflow: 'hidden' }}>
          <img
            src={image}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { e.target.parentElement.style.display = 'none'; }}
          />
        </div>
      )}

      <div style={{ padding: 14 }}>
        {/* Badges tickers */}
        {tickersMentionnes.length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
            {tickersMentionnes.map(t => (
              <span
                key={t}
                style={{
                  background: C.green + '20',
                  color: C.green,
                  border: `1px solid ${C.green}40`,
                  padding: '1px 6px',
                  fontSize: 9,
                  letterSpacing: 1,
                  fontWeight: 600,
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Titre */}
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: C.text,
          lineHeight: 1.4,
          marginBottom: 8,
          letterSpacing: 0.3,
        }}>
          {displayTitle}
        </div>

        {/* Résumé */}
        {displayResume && (
          <div style={{
            fontSize: 11,
            color: C.text2,
            lineHeight: 1.5,
            marginBottom: 10,
          }}>
            {displayResume}{displayResume.length >= 140 ? '...' : ''}
          </div>
        )}

        {/* Source + date */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: C.muted, letterSpacing: 1, textTransform: 'uppercase' }}>
            {source || 'Yahoo Finance'}
          </span>
          <span style={{ fontSize: 9, color: C.muted }}>
            {formatRelative(date)}
          </span>
        </div>
      </div>
    </a>
  );
}

/**
 * Composant principal NewsPanel.
 */
export default function NewsPanel({ watchlist = [] }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [source, setSource] = useState('');
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000);
  const refreshTimerRef = useRef(null);
  const countdownRef = useRef(null);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);

    const tickers = watchlist.join(',');
    try {
      const r = await fetch(`/api/news${tickers ? `?tickers=${tickers}` : ''}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setArticles(data.articles || []);
      setLastUpdated(data.lastUpdated);
      setSource(data.source || 'yahoo');
      setCountdown(REFRESH_INTERVAL / 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [watchlist.join(',')]);

  // Chargement initial + refresh automatique
  useEffect(() => {
    fetchNews();

    refreshTimerRef.current = setInterval(fetchNews, REFRESH_INTERVAL);

    // Countdown visuel
    countdownRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) return REFRESH_INTERVAL / 1000;
        return c - 1;
      });
    }, 1000);

    return () => {
      clearInterval(refreshTimerRef.current);
      clearInterval(countdownRef.current);
    };
  }, [fetchNews]);

  const formatCountdown = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 10,
      }}>
        <div>
          <div style={{
            fontFamily: 'Bebas Neue, cursive',
            fontSize: 22,
            letterSpacing: 4,
            color: C.text,
          }}>
            ACTUALITÉS MARCHÉS
          </div>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, marginTop: 2 }}>
            {lastUpdated
              ? `Mis à jour ${formatRelative(lastUpdated)} · Actualisation dans ${formatCountdown(countdown)}`
              : 'Chargement...'}
            {source === 'claude' && ' · via IA'}
          </div>
        </div>
        <button
          onClick={fetchNews}
          disabled={loading}
          style={{
            background: 'transparent',
            border: `1px solid ${C.border}`,
            color: loading ? C.muted : C.text,
            padding: '7px 16px',
            fontSize: 11,
            letterSpacing: 2,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'IBM Plex Mono, monospace',
            textTransform: 'uppercase',
          }}
        >
          {loading ? '↻ ...' : '↻ ACTUALISER'}
        </button>
      </div>

      {/* Filtre watchlist actif */}
      {watchlist.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
          padding: '8px 12px',
          background: C.blue + '10',
          border: `1px solid ${C.blue}30`,
          fontSize: 10,
          color: C.blue,
          letterSpacing: 1,
        }}>
          <span>FILTRAGE WATCHLIST :</span>
          {watchlist.map(t => (
            <span key={t} style={{ fontWeight: 600 }}>{t}</span>
          ))}
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div style={{
          padding: 14,
          background: C.red + '10',
          border: `1px solid ${C.red}40`,
          color: C.red,
          fontSize: 11,
          marginBottom: 16,
          letterSpacing: 1,
        }}>
          ⚠ Erreur : {error}
        </div>
      )}

      {/* Skeleton ou grille */}
      {loading && articles.length === 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}>
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : articles.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: 60,
          color: C.muted,
          fontSize: 12,
          letterSpacing: 2,
        }}>
          Aucune actualité disponible pour le moment
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}>
          {articles.map((article, i) => (
            <ArticleCard key={`${article.lien}-${i}`} article={article} />
          ))}
        </div>
      )}
    </div>
  );
}

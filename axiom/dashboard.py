# ============================================================
# AXIOM — Dashboard Bloomberg-style
# Streamlit · Plotly · dark theme · 3 colonnes fixes
# ============================================================

import streamlit as st

# ─── Configuration de la page (doit être en premier) ────────────────────────
st.set_page_config(
    page_title="AXIOM — Autonomous Trading Intelligence",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ============================================================
# BLOC 1 — INJECTION CSS GLOBALE
# Tout le design visuel est ici. Rien dans les widgets natifs.
# ============================================================

CSS = """
<style>
/* ── Imports de polices ─────────────────────────────────── */
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

/* ── Reset et base ──────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body, [data-testid="stAppViewContainer"], [data-testid="stApp"] {
    background-color: #050810 !important;
    color: #e0e6f0 !important;
    font-family: 'JetBrains Mono', monospace !important;
}

/* Supprime le padding par défaut de Streamlit */
[data-testid="stAppViewContainer"] > .main { padding: 0 !important; }
[data-testid="block-container"] { padding: 0 !important; max-width: 100% !important; }
.main .block-container { padding: 0 !important; max-width: 100% !important; }
[data-testid="stVerticalBlock"] { gap: 0 !important; }

/* Cache la barre de déploiement Streamlit */
#MainMenu, footer, header { visibility: hidden; }
[data-testid="stToolbar"] { display: none; }

/* ── Grille Bloomberg en arrière-plan ───────────────────── */
body::before {
    content: '';
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background-image:
        linear-gradient(rgba(0, 170, 255, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0, 170, 255, 0.03) 1px, transparent 1px);
    background-size: 40px 40px;
}

/* ── Variables CSS ──────────────────────────────────────── */
:root {
    --bg:        #050810;
    --bg2:       #070f1a;
    --bg3:       #0d1425;
    --bg4:       #0d1a2e;
    --border:    #1a2540;
    --green:     #00FF88;
    --red:       #FF3B5C;
    --yellow:    #FFD600;
    --blue:      #00AAFF;
    --muted:     #4a6080;
    --text:      #e0e6f0;
    --font-mono: 'JetBrains Mono', monospace;
    --font-syne: 'Syne', sans-serif;
}

/* ── Scrollbar globale ──────────────────────────────────── */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

/* ──────────────────────────────────────────────────────── */
/* HEADER                                                    */
/* ──────────────────────────────────────────────────────── */
.ax-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 56px;
    padding: 0 24px;
    background: var(--bg);
    border-bottom: 1px solid var(--blue);
    position: sticky;
    top: 0;
    z-index: 200;
    flex-shrink: 0;
}
.ax-header-left {
    display: flex;
    align-items: baseline;
    gap: 10px;
}
.ax-logo {
    font-family: var(--font-syne);
    font-size: 28px;
    font-weight: 800;
    color: var(--green);
    letter-spacing: 6px;
    line-height: 1;
}
.ax-subtitle {
    font-size: 10px;
    color: var(--muted);
    letter-spacing: 3px;
    text-transform: uppercase;
}
.ax-header-center {
    display: flex;
    align-items: center;
    gap: 10px;
}
.ax-market-label {
    font-size: 12px;
    letter-spacing: 3px;
    text-transform: uppercase;
    font-weight: 600;
}
.ax-market-open  { color: var(--green); }
.ax-market-close { color: var(--red); }

.ax-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    display: inline-block;
    flex-shrink: 0;
}
.ax-dot-green {
    background: var(--green);
    box-shadow: 0 0 6px var(--green);
    animation: pulse 1.8s ease-in-out infinite;
}
.ax-dot-red { background: var(--red); }

@keyframes pulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 6px var(--green); }
    50%       { opacity: 0.5; box-shadow: 0 0 2px var(--green); }
}

.ax-header-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
}
.ax-capital-label {
    font-size: 10px;
    color: var(--muted);
    letter-spacing: 2px;
}
.ax-capital-value {
    font-family: var(--font-syne);
    font-size: 18px;
    color: var(--text);
    letter-spacing: 1px;
}
.ax-pnl-pos { color: var(--green); font-size: 12px; font-weight: 600; }
.ax-pnl-neg { color: var(--red);   font-size: 12px; font-weight: 600; }

/* ──────────────────────────────────────────────────────── */
/* LAYOUT 3 COLONNES                                         */
/* ──────────────────────────────────────────────────────── */
.ax-layout {
    display: grid;
    grid-template-columns: 280px 1fr 360px;
    grid-template-rows: 1fr;
    height: calc(100vh - 56px);
    overflow: hidden;
    position: relative;
    z-index: 1;
}
.ax-col {
    overflow-y: auto;
    overflow-x: hidden;
    border-right: 1px solid var(--border);
    background: var(--bg);
}
.ax-col:last-child { border-right: none; }

.ax-col-left   { /* 280px — watchlist */ }
.ax-col-center { /* flexible — zone principale */ }
.ax-col-right  { /* 360px — Marcus Reid */ display: flex; flex-direction: column; }

/* ──────────────────────────────────────────────────────── */
/* SECTION TITRE                                             */
/* ──────────────────────────────────────────────────────── */
.ax-section-title {
    font-size: 10px;
    color: var(--muted);
    letter-spacing: 3px;
    text-transform: uppercase;
    font-variant: small-caps;
    padding: 14px 16px 10px;
    border-bottom: 1px solid var(--border);
}

/* ──────────────────────────────────────────────────────── */
/* WATCHLIST                                                 */
/* ──────────────────────────────────────────────────────── */
.ax-ticker-row {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    transition: background 0.15s;
    position: relative;
}
.ax-ticker-row:hover { background: rgba(0, 170, 255, 0.04); }
.ax-ticker-row.active {
    background: rgba(0, 170, 255, 0.06);
    border-left: 3px solid var(--blue);
    padding-left: 11px;
}

.ax-ticker-main { flex: 1; min-width: 0; }
.ax-ticker-sym {
    font-family: var(--font-syne);
    font-size: 15px;
    color: var(--text);
    font-weight: 700;
    letter-spacing: 1px;
}
.ax-ticker-price {
    font-size: 12px;
    color: var(--text);
    margin-top: 2px;
}
.ax-ticker-chg {
    font-size: 11px;
    font-weight: 600;
    margin-left: 6px;
}
.ax-ticker-chg.pos { color: var(--green); }
.ax-ticker-chg.neg { color: var(--red); }

/* Barre de volume */
.ax-vol-bar-wrap {
    height: 3px;
    background: var(--border);
    border-radius: 2px;
    margin-top: 6px;
    overflow: hidden;
}
.ax-vol-bar {
    height: 100%;
    border-radius: 2px;
    transition: width 0.4s ease;
}
.ax-vol-bar.high { background: var(--green); }
.ax-vol-bar.low  { background: var(--muted); }

/* Badge signal */
.ax-badge {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1.5px;
    padding: 3px 7px;
    border-radius: 2px;
    text-transform: uppercase;
    flex-shrink: 0;
}
.ax-badge-buy  { color: var(--green);  border: 1px solid var(--green);  background: rgba(0,255,136,0.08); box-shadow: 0 0 8px rgba(0,255,136,0.2); }
.ax-badge-sell { color: var(--red);    border: 1px solid var(--red);    background: rgba(255,59,92,0.08);  box-shadow: 0 0 8px rgba(255,59,92,0.2); }
.ax-badge-hold { color: var(--yellow); border: 1px solid var(--yellow); background: rgba(255,214,0,0.08); }
.ax-badge-watch{ color: var(--blue);   border: 1px solid var(--blue);   background: rgba(0,170,255,0.08); }
.ax-badge-none { color: var(--muted);  border: 1px solid var(--muted);  background: transparent; }

/* ──────────────────────────────────────────────────────── */
/* PANNEAU RISQUE (bas colonne gauche)                       */
/* ──────────────────────────────────────────────────────── */
.ax-risk-panel {
    border-top: 1px solid var(--border);
    padding: 14px 16px;
}
.ax-risk-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 0;
    font-size: 11px;
}
.ax-risk-label { color: var(--muted); letter-spacing: 1px; }
.ax-risk-value { font-weight: 600; }

/* Barre de progression drawdown */
.ax-progress-wrap {
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    margin: 8px 0 4px;
    overflow: hidden;
}
.ax-progress-bar {
    height: 100%;
    border-radius: 2px;
    transition: width 0.4s, background 0.4s;
}

/* ──────────────────────────────────────────────────────── */
/* INDICATEURS (top zone centrale)                          */
/* ──────────────────────────────────────────────────────── */
.ax-indicators {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    border-bottom: 1px solid var(--border);
}
.ax-indic-cell {
    padding: 12px 14px;
    border-right: 1px solid var(--border);
    position: relative;
}
.ax-indic-cell:last-child { border-right: none; }

.ax-indic-name {
    font-size: 9px;
    color: var(--muted);
    letter-spacing: 2px;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 5px;
    margin-bottom: 4px;
}
.ax-indic-val {
    font-family: var(--font-syne);
    font-size: 20px;
    color: var(--text);
    line-height: 1;
    margin-bottom: 4px;
}
.ax-indic-status {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
}
.ax-indic-status.bull { color: var(--green); }
.ax-indic-status.bear { color: var(--red); }
.ax-indic-status.neut { color: var(--muted); }

/* Tooltip "?" */
.ax-tooltip-wrap { position: relative; display: inline-block; cursor: help; }
.ax-tooltip-icon {
    font-size: 9px;
    color: var(--muted);
    border: 1px solid var(--muted);
    border-radius: 50%;
    width: 13px; height: 13px;
    display: flex; align-items: center; justify-content: center;
    line-height: 1;
}
.ax-tooltip-text {
    display: none;
    position: absolute;
    bottom: calc(100% + 6px);
    left: 0;
    background: var(--bg3);
    border: 1px solid var(--border);
    color: var(--text);
    font-size: 10px;
    line-height: 1.5;
    padding: 8px 10px;
    width: 220px;
    z-index: 300;
    letter-spacing: 0;
}
.ax-tooltip-wrap:hover .ax-tooltip-text { display: block; }

/* ──────────────────────────────────────────────────────── */
/* ZONE CHART                                               */
/* ──────────────────────────────────────────────────────── */
.ax-chart-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding: 16px 20px 10px;
}
.ax-ticker-big {
    font-family: var(--font-syne);
    font-size: 42px;
    font-weight: 800;
    color: var(--text);
    letter-spacing: 3px;
    line-height: 1;
}
.ax-price-big {
    font-family: var(--font-syne);
    font-size: 32px;
    font-weight: 700;
    line-height: 1;
}
.ax-price-big.pos { color: var(--green); }
.ax-price-big.neg { color: var(--red); }
.ax-chg-big { font-size: 16px; font-weight: 600; margin-left: 10px; }

/* Sélecteur timeframe */
.ax-tf-selector { display: flex; gap: 4px; }
.ax-tf-btn {
    font-family: var(--font-mono);
    font-size: 11px;
    padding: 5px 10px;
    background: transparent;
    border: 1px solid var(--border);
    color: var(--muted);
    cursor: pointer;
    letter-spacing: 1px;
    transition: all 0.15s;
    border-radius: 2px;
}
.ax-tf-btn:hover  { color: var(--text); border-color: var(--blue); }
.ax-tf-btn.active { color: var(--blue); border-color: var(--blue); background: rgba(0,170,255,0.08); }

/* ──────────────────────────────────────────────────────── */
/* TABS (bas colonne centrale)                               */
/* ──────────────────────────────────────────────────────── */
.ax-tabs {
    display: flex;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    background: var(--bg);
}
.ax-tab-btn {
    font-family: var(--font-mono);
    font-size: 11px;
    padding: 10px 18px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--muted);
    cursor: pointer;
    letter-spacing: 1px;
    transition: all 0.15s;
    white-space: nowrap;
}
.ax-tab-btn:hover  { color: var(--text); }
.ax-tab-btn.active { color: var(--blue); border-bottom-color: var(--blue); }

/* ──────────────────────────────────────────────────────── */
/* JOURNAL TABLE                                            */
/* ──────────────────────────────────────────────────────── */
.ax-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.ax-table th {
    font-size: 9px;
    color: var(--muted);
    letter-spacing: 2px;
    text-transform: uppercase;
    text-align: left;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    font-weight: 500;
}
.ax-table td {
    padding: 9px 12px;
    border-bottom: 1px solid rgba(26,37,64,0.5);
}
.ax-table tr.win  td { background: rgba(0,255,136,0.03); }
.ax-table tr.win  td:first-child { border-left: 2px solid var(--green); }
.ax-table tr.loss td { background: rgba(255,59,92,0.03); }
.ax-table tr.loss td:first-child { border-left: 2px solid var(--red); }
.ax-table tr:nth-child(even) td { background: rgba(13,20,37,0.4); }
.ax-table tr.win:nth-child(even)  td { background: rgba(0,255,136,0.05); }
.ax-table tr.loss:nth-child(even) td { background: rgba(255,59,92,0.05); }

/* ──────────────────────────────────────────────────────── */
/* COLONNE DROITE — MARCUS REID                             */
/* ──────────────────────────────────────────────────────── */
.ax-agent-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--green);
    flex-shrink: 0;
}
.ax-avatar {
    width: 42px; height: 42px;
    border-radius: 50%;
    background: linear-gradient(135deg, #00FF88, #00AAFF);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-syne);
    font-size: 14px;
    font-weight: 800;
    color: #050810;
    flex-shrink: 0;
}
.ax-agent-name {
    font-family: var(--font-syne);
    font-size: 15px;
    font-weight: 700;
    color: var(--text);
    letter-spacing: 1px;
}
.ax-agent-status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: var(--green);
    letter-spacing: 1.5px;
    margin-top: 2px;
}

/* Boutons action rapide */
.ax-quick-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 12px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
}
.ax-quick-btn {
    font-family: var(--font-mono);
    font-size: 11px;
    padding: 9px 8px;
    background: var(--bg2);
    border: 1px solid var(--border);
    color: var(--muted);
    cursor: pointer;
    text-align: center;
    letter-spacing: 1px;
    transition: all 0.15s;
    border-radius: 2px;
}
.ax-quick-btn:hover {
    border-color: var(--blue);
    color: var(--blue);
    background: rgba(0,170,255,0.06);
}

/* Zone conversation */
.ax-chat-zone {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

/* Bulle agent */
.ax-msg-agent {
    background: var(--bg3);
    border-left: 2px solid var(--green);
    padding: 10px 12px;
    font-size: 11px;
    line-height: 1.7;
}
.ax-msg-agent-label {
    font-size: 9px;
    color: var(--green);
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 6px;
    font-weight: 700;
}

/* Carte signal dans bulle */
.ax-signal-card {
    background: var(--bg);
    border: 1px solid var(--border);
    padding: 10px 12px;
    margin-top: 8px;
    font-size: 11px;
    line-height: 1.8;
    font-family: var(--font-mono);
}
.ax-signal-sep {
    color: var(--muted);
    font-size: 10px;
    letter-spacing: 1px;
}
.ax-signal-entry { color: var(--green); font-weight: 600; }
.ax-signal-stop  { color: var(--red);   font-weight: 600; }
.ax-signal-tp    { color: var(--text);  }
.ax-signal-rr    { color: var(--yellow); font-weight: 600; }

/* Bulle utilisateur */
.ax-msg-user {
    background: var(--bg4);
    border-right: 2px solid var(--blue);
    padding: 10px 12px;
    font-size: 11px;
    line-height: 1.7;
    align-self: flex-end;
    max-width: 90%;
}

/* Zone saisie */
.ax-input-zone {
    border-top: 1px solid var(--border);
    padding: 10px 12px;
    flex-shrink: 0;
    background: var(--bg);
}
.ax-input-row {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
}
.ax-input-field {
    flex: 1;
    background: var(--bg2);
    border: 1px solid var(--border);
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 9px 12px;
    outline: none;
    transition: border-color 0.15s;
}
.ax-input-field:focus { border-color: var(--blue); }
.ax-input-field::placeholder { color: var(--muted); }
.ax-send-btn {
    background: var(--green);
    color: #050810;
    border: none;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    padding: 9px 16px;
    cursor: pointer;
    letter-spacing: 2px;
    transition: opacity 0.15s;
}
.ax-send-btn:hover { opacity: 0.85; }

/* Raccourcis rapides */
.ax-shortcuts {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}
.ax-shortcut {
    font-size: 10px;
    color: var(--muted);
    border: 1px solid var(--border);
    padding: 3px 8px;
    cursor: pointer;
    border-radius: 2px;
    transition: all 0.15s;
    letter-spacing: 1px;
}
.ax-shortcut:hover { color: var(--blue); border-color: var(--blue); }

/* ──────────────────────────────────────────────────────── */
/* TIMESTAMP dernière MAJ                                   */
/* ──────────────────────────────────────────────────────── */
.ax-footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
    padding: 4px 20px;
    font-size: 9px;
    color: var(--muted);
    letter-spacing: 1.5px;
    border-top: 1px solid var(--border);
    background: var(--bg);
}
.ax-spinner {
    width: 10px; height: 10px;
    border: 1px solid var(--border);
    border-top-color: var(--blue);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    display: inline-block;
}
@keyframes spin {
    to { transform: rotate(360deg); }
}

/* ──────────────────────────────────────────────────────── */
/* POSITIONS & ALERTES                                      */
/* ──────────────────────────────────────────────────────── */
.ax-position-card {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-left: 3px solid var(--blue);
    padding: 12px 14px;
    margin-bottom: 8px;
}
.ax-pos-ticker {
    font-family: var(--font-syne);
    font-size: 18px;
    font-weight: 700;
    color: var(--text);
    letter-spacing: 2px;
}
.ax-pos-detail {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-top: 8px;
}
.ax-pos-kv { }
.ax-pos-key {
    font-size: 9px;
    color: var(--muted);
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 2px;
}
.ax-pos-val { font-size: 13px; font-weight: 600; }

.ax-alert-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
    font-size: 11px;
}
.ax-alert-icon { font-size: 14px; flex-shrink: 0; }
.ax-alert-text { flex: 1; color: var(--text); line-height: 1.5; }
.ax-alert-time { font-size: 10px; color: var(--muted); flex-shrink: 0; }

/* ──────────────────────────────────────────────────────── */
/* PERFORMANCE                                              */
/* ──────────────────────────────────────────────────────── */
.ax-perf-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1px;
    background: var(--border);
    border: 1px solid var(--border);
    margin-bottom: 16px;
}
.ax-perf-cell {
    background: var(--bg2);
    padding: 14px;
    text-align: center;
}
.ax-perf-key {
    font-size: 9px;
    color: var(--muted);
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 6px;
}
.ax-perf-val {
    font-family: var(--font-syne);
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 1px;
}

/* Masque le haut-de-page Streamlit et le sidebar toggle */
[data-testid="collapsedControl"] { display: none !important; }
section[data-testid="stSidebar"] { display: none !important; }
</style>
"""

st.markdown(CSS, unsafe_allow_html=True)

# ============================================================
# BLOC 2 — DONNÉES MOCK + ÉTAT SESSION + HEADER
# ============================================================

import datetime
import random

# ─── Données mock watchlist ─────────────────────────────────
WATCHLIST_DATA = [
    {"sym": "NVDA",  "price": 875.20,  "chg": +2.31,  "vol_ratio": 1.42, "signal": "BUY"},
    {"sym": "TSLA",  "price": 182.45,  "chg": -1.87,  "vol_ratio": 0.78, "signal": "HOLD"},
    {"sym": "AAPL",  "price": 213.10,  "chg": +0.54,  "vol_ratio": 0.91, "signal": "WATCH"},
    {"sym": "META",  "price": 512.30,  "chg": +3.12,  "vol_ratio": 1.85, "signal": "BUY"},
    {"sym": "AMZN",  "price": 198.75,  "chg": -0.32,  "vol_ratio": 0.65, "signal": "NO TRADE"},
    {"sym": "MSFT",  "price": 421.90,  "chg": +0.87,  "vol_ratio": 1.10, "signal": "WATCH"},
    {"sym": "AMD",   "price": 162.50,  "chg": +4.20,  "vol_ratio": 2.31, "signal": "BUY"},
    {"sym": "GOOGL", "price": 175.40,  "chg": +1.23,  "vol_ratio": 1.05, "signal": "WATCH"},
    {"sym": "NFLX",  "price": 638.90,  "chg": -2.15,  "vol_ratio": 0.88, "signal": "SELL"},
    {"sym": "MSTR",  "price": 342.10,  "chg": +6.80,  "vol_ratio": 3.10, "signal": "BUY"},
    {"sym": "PLTR",  "price": 24.85,   "chg": +1.95,  "vol_ratio": 1.67, "signal": "BUY"},
    {"sym": "COIN",  "price": 218.70,  "chg": -3.42,  "vol_ratio": 1.22, "signal": "HOLD"},
]

# ─── Données mock indicateurs ────────────────────────────────
INDICATORS = {
    "RSI":      {"val": "62.4",  "status": "bull", "label": "HAUSSIER",
                 "tip": "Mesure si l'action est survendue (< 30) ou surachetée (> 70). Ici : momentum positif sans excès."},
    "MACD":     {"val": "2.14",  "status": "bull", "label": "HAUSSIER",
                 "tip": "Montre la force et la direction de la tendance. Positif = momentum haussier en cours."},
    "VWAP":     {"val": "$871",  "status": "bull", "label": "AU-DESSUS",
                 "tip": "Prix moyen de la journée pondéré par le volume — référence des pros. Prix > VWAP = force."},
    "BOLLINGER":{"val": "MILIEU", "status": "neut", "label": "NEUTRE",
                 "tip": "Zones de prix extrêmes. Rupture de bande = signal fort. Ici : prix dans la bande centrale."},
    "VOLUME":   {"val": "×1.42", "status": "bull", "label": "ÉLEVÉ",
                 "tip": "Volume actuel vs moyenne 20 jours. ×1.42 = 42% au-dessus de la moyenne. Confirme le mouvement."},
}

# ─── Données mock journal ────────────────────────────────────
JOURNAL_DATA = [
    {"heure": "09:35", "ticker": "NVDA", "style": "SCALP",    "entree": "$870.00", "sortie": "$878.50", "pnl": "+$42.50", "win": True,  "note": "Bull flag confirmé, volume ×2"},
    {"heure": "10:12", "ticker": "AMD",  "style": "DAY TRADE", "entree": "$158.30", "sortie": "$156.10", "pnl": "-$11.00", "win": False, "note": "Stop touché — macro adverse"},
    {"heure": "11:48", "ticker": "META", "style": "DAY TRADE", "entree": "$507.80", "sortie": "$514.20", "pnl": "+$32.00", "win": True,  "note": "Break résistance + MACD cross"},
    {"heure": "13:20", "ticker": "MSTR", "style": "SWING 24H", "entree": "$335.50", "sortie": "OUVERT", "pnl": "+$32.80", "win": True,  "note": "Position en cours"},
]

# ─── Données mock positions ──────────────────────────────────
POSITIONS_DATA = [
    {"ticker": "MSTR", "direction": "LONG", "entree": "$335.50", "actuel": "$342.10",
     "pnl": "+$32.80", "pnl_pct": "+1.97%", "taille": "5 actions", "win": True},
]

# ─── Données mock alertes ────────────────────────────────────
ALERTES_DATA = [
    {"icon": "🟢", "text": "NVDA franchit $875 — résistance clé. Setup BUY actif.", "time": "11:42"},
    {"icon": "🔴", "text": "AMD stop-loss touché à $156.10. Position clôturée automatiquement.", "time": "10:14"},
    {"icon": "🟡", "text": "VIX monte à 18.4 — vigilance accrue. Réduire taille de position.", "time": "09:58"},
    {"icon": "🔵", "text": "META : earnings dans 3 jours. Éviter swing trade au-delà de 48h.", "time": "09:30"},
]

# ─── État session ─────────────────────────────────────────────
if "selected_ticker" not in st.session_state:
    st.session_state.selected_ticker = "NVDA"
if "active_tf" not in st.session_state:
    st.session_state.active_tf = "5m"
if "active_tab" not in st.session_state:
    st.session_state.active_tab = "journal"
if "messages" not in st.session_state:
    st.session_state.messages = [
        {
            "role": "agent",
            "text": "Bonjour. Marcus Reid en ligne. Analyse du marché en cours — VIX à 16.2, structure haussière intacte sur le Nasdaq.",
            "signal": None,
        },
        {
            "role": "agent",
            "text": "NVDA présente un setup Bull Flag sur 5min. Voici mon analyse :",
            "signal": {
                "setup": "Bull Flag", "style": "DAY TRADE", "urgence": "IMMÉDIAT",
                "entree": "$875.50", "stop": "$862.00", "stop_pct": "-1.5%",
                "tp1": "$895.00", "tp1_pct": "+2.2%",
                "tp2": "$915.00", "tp2_pct": "+4.5%",
                "rr": "1:2.1", "taille": "5 actions ($437)",
            },
        },
    ]

# ─── Helpers ─────────────────────────────────────────────────
def badge_class(signal):
    m = {"BUY": "buy", "SELL": "sell", "HOLD": "hold", "WATCH": "watch"}
    return f"ax-badge ax-badge-{m.get(signal, 'none')}"

def pnl_class(chg):
    return "pos" if chg >= 0 else "neg"

def sign(v):
    return f"+{v:.2f}%" if v >= 0 else f"{v:.2f}%"

def is_market_open():
    now = datetime.datetime.now(datetime.timezone.utc)
    # NYSE : 13h30 → 20h00 UTC en semaine
    if now.weekday() >= 5:
        return False
    t = now.hour * 60 + now.minute
    return 810 <= t <= 1200  # 13h30 → 20h00

# ─── HEADER ──────────────────────────────────────────────────
market_open = is_market_open()
market_dot  = "ax-dot ax-dot-green" if market_open else "ax-dot ax-dot-red"
market_cls  = "ax-market-label ax-market-open" if market_open else "ax-market-label ax-market-close"
market_txt  = "MARCHÉ OUVERT" if market_open else "MARCHÉ FERMÉ"

capital_total = 5_000.00
daily_pnl     = +64.30   # mock
pnl_cls       = "ax-pnl-pos" if daily_pnl >= 0 else "ax-pnl-neg"
pnl_txt       = f"+${daily_pnl:.2f}" if daily_pnl >= 0 else f"-${abs(daily_pnl):.2f}"

now_str = datetime.datetime.now().strftime("%H:%M:%S")

st.markdown(f"""
<div class="ax-header">
  <div class="ax-header-left">
    <span class="ax-logo">AXIOM</span>
    <span class="ax-subtitle">Autonomous Trading Intelligence</span>
  </div>
  <div class="ax-header-center">
    <span class="{market_dot}"></span>
    <span class="{market_cls}">{market_txt}</span>
  </div>
  <div class="ax-header-right">
    <span class="ax-capital-label">CAPITAL</span>
    <span class="ax-capital-value">${capital_total:,.2f}</span>
    <span class="{pnl_cls}">P&L JOUR : {pnl_txt}</span>
  </div>
</div>
""", unsafe_allow_html=True)

# ============================================================
# BLOC 3 — LAYOUT 3 COLONNES + COLONNE GAUCHE
# Watchlist cliquable + panneau risque
# ============================================================

# Streamlit ne supporte pas les clics HTML natifs dans st.markdown.
# On contourne avec des st.button invisibles superposés sur chaque row.
# Astuce : on ouvre le layout HTML manuellement autour des colonnes Streamlit.

# ── Ouverture du wrapper layout ──────────────────────────────
st.markdown('<div class="ax-layout">', unsafe_allow_html=True)

# ── COLONNE GAUCHE ───────────────────────────────────────────
col_left, col_center, col_right = st.columns([280, 1, 360], gap="small")

with col_left:
    # CSS override pour coller aux dimensions fixes
    st.markdown("""
    <style>
    /* Force la colonne gauche à rester dans le layout */
    [data-testid="stHorizontalBlock"] > div:nth-child(1) {
        min-width: 260px !important;
        max-width: 280px !important;
        border-right: 1px solid #1a2540;
        background: #050810;
        height: calc(100vh - 56px);
        overflow-y: auto;
        overflow-x: hidden;
        padding: 0 !important;
    }
    [data-testid="stHorizontalBlock"] > div:nth-child(3) {
        min-width: 340px !important;
        max-width: 360px !important;
        border-left: 1px solid #1a2540;
        background: #050810;
        height: calc(100vh - 56px);
        overflow-y: auto;
        overflow-x: hidden;
        padding: 0 !important;
    }
    [data-testid="stHorizontalBlock"] {
        gap: 0 !important;
        align-items: flex-start !important;
    }
    /* Supprime les paddings internes des colonnes */
    [data-testid="stVerticalBlockBorderWrapper"] { padding: 0 !important; }
    </style>
    """, unsafe_allow_html=True)

    # Titre section
    st.markdown('<div class="ax-section-title">Surveillance</div>', unsafe_allow_html=True)

    # ── Watchlist ─────────────────────────────────────────────
    for ticker in WATCHLIST_DATA:
        sym        = ticker["sym"]
        price      = ticker["price"]
        chg        = ticker["chg"]
        vol_ratio  = ticker["vol_ratio"]
        signal     = ticker["signal"]
        is_active  = (sym == st.session_state.selected_ticker)

        chg_cls    = pnl_class(chg)
        chg_txt    = sign(chg)
        vol_pct    = min(int(vol_ratio / 3.5 * 100), 100)  # normalise sur 100%
        vol_cls    = "high" if vol_ratio >= 1.0 else "low"
        badge_cls  = badge_class(signal)
        row_cls    = "ax-ticker-row active" if is_active else "ax-ticker-row"

        st.markdown(f"""
        <div class="{row_cls}" id="row-{sym}">
          <div class="ax-ticker-main">
            <div style="display:flex;align-items:center;gap:6px;">
              <span class="ax-ticker-sym">{sym}</span>
              <span class="ax-ticker-chg {chg_cls}">{chg_txt}</span>
            </div>
            <div class="ax-ticker-price">${price:,.2f}</div>
            <div class="ax-vol-bar-wrap">
              <div class="ax-vol-bar {vol_cls}" style="width:{vol_pct}%"></div>
            </div>
          </div>
          <span class="{badge_cls}">{signal}</span>
        </div>
        """, unsafe_allow_html=True)

        # Bouton Streamlit invisible qui capture le clic
        btn_key = f"btn_ticker_{sym}"
        if st.button(sym, key=btn_key, help=f"Analyser {sym}",
                     use_container_width=True):
            st.session_state.selected_ticker = sym
            st.rerun()
        # Masque le bouton visuellement — le HTML ci-dessus est l'UI visible
        st.markdown(f"""
        <style>
        [data-testid="stBaseButton-secondary"][kind="secondary"] {{
            display: none !important;
        }}
        div[data-testid="element-container"]:has(button[kind="secondary"]) {{
            margin: 0 !important; padding: 0 !important;
            height: 0 !important; overflow: hidden !important;
        }}
        </style>
        """, unsafe_allow_html=True)

    # ── Panneau risque ─────────────────────────────────────────
    drawdown_pct    = 1.29   # % du capital perdu aujourd'hui (mock)
    positions_open  = len(POSITIONS_DATA)
    exposition_pct  = round(sum(
        float(p["entree"].replace("$","").replace(",","")) * 5
        for p in POSITIONS_DATA
    ) / capital_total * 100, 1)

    if drawdown_pct < 1.0:
        dd_color = "#00FF88"
        dd_cls   = "ax-risk-value"
        bar_color = "#00FF88"
    elif drawdown_pct < 2.0:
        dd_color = "#FFD600"
        dd_cls   = "ax-risk-value"
        bar_color = "#FFD600"
    else:
        dd_color = "#FF3B5C"
        dd_cls   = "ax-risk-value"
        bar_color = "#FF3B5C"

    drawdown_bar_pct = min(int(drawdown_pct / 3.0 * 100), 100)  # 3% = max

    st.markdown(f"""
    <div class="ax-risk-panel">
      <div class="ax-section-title" style="padding:0 0 10px 0;border:none;">Risque</div>

      <div class="ax-risk-row">
        <span class="ax-risk-label">Capital disponible</span>
        <span class="ax-risk-value" style="color:#e0e6f0;">${capital_total:,.2f}</span>
      </div>
      <div class="ax-risk-row">
        <span class="ax-risk-label">Drawdown du jour</span>
        <span class="ax-risk-value" style="color:{dd_color};">{drawdown_pct:.2f}%</span>
      </div>
      <div class="ax-progress-wrap">
        <div class="ax-progress-bar" style="width:{drawdown_bar_pct}%;background:{bar_color};"></div>
      </div>
      <div class="ax-risk-row">
        <span class="ax-risk-label">Positions ouvertes</span>
        <span class="ax-risk-value" style="color:#00AAFF;">{positions_open} / 3</span>
      </div>
      <div class="ax-risk-row">
        <span class="ax-risk-label">Exposition totale</span>
        <span class="ax-risk-value" style="color:#e0e6f0;">{exposition_pct:.1f}%</span>
      </div>
    </div>
    """, unsafe_allow_html=True)

# ============================================================
# BLOC 4 — COLONNE CENTRALE
# Indicateurs · Chart Plotly · Tabs (Journal/Positions/Alertes/Perf)
# ============================================================

import numpy as np
import plotly.graph_objects as go

with col_center:

    sel = st.session_state.selected_ticker
    sel_data = next((t for t in WATCHLIST_DATA if t["sym"] == sel), WATCHLIST_DATA[0])

    # ── Barre indicateurs ──────────────────────────────────────
    indic_html = '<div class="ax-indicators">'
    for name, d in INDICATORS.items():
        indic_html += f"""
        <div class="ax-indic-cell">
          <div class="ax-indic-name">
            {name}
            <span class="ax-tooltip-wrap">
              <span class="ax-tooltip-icon">?</span>
              <span class="ax-tooltip-text">{d['tip']}</span>
            </span>
          </div>
          <div class="ax-indic-val">{d['val']}</div>
          <div class="ax-indic-status {d['status']}">{d['label']}</div>
        </div>"""
    indic_html += '</div>'
    st.markdown(indic_html, unsafe_allow_html=True)

    # ── En-tête chart : ticker + prix + timeframe ──────────────
    price_cls = pnl_class(sel_data["chg"])
    chg_txt   = sign(sel_data["chg"])

    # Sélecteur timeframe (boutons Streamlit déguisés)
    tf_options = ["1m", "5m", "15m", "1h", "1D"]
    tf_cols = st.columns(len(tf_options) + 2)

    with tf_cols[0]:
        st.markdown(f"""
        <div class="ax-chart-header" style="padding-bottom:0;">
          <div>
            <div class="ax-ticker-big">{sel}</div>
            <div style="display:flex;align-items:baseline;gap:6px;margin-top:4px;">
              <span class="ax-price-big {price_cls}">${sel_data['price']:,.2f}</span>
              <span class="ax-chg-big" style="color:{'#00FF88' if sel_data['chg']>=0 else '#FF3B5C'};">{chg_txt}</span>
            </div>
          </div>
        </div>
        """, unsafe_allow_html=True)

    # Boutons timeframe
    for i, tf in enumerate(tf_options):
        with tf_cols[i + 1]:
            is_active_tf = (tf == st.session_state.active_tf)
            btn_style = (
                "background:rgba(0,170,255,0.08);border:1px solid #00AAFF;color:#00AAFF;"
                if is_active_tf else
                "background:transparent;border:1px solid #1a2540;color:#4a6080;"
            )
            st.markdown(f"""
            <div style="padding-top:18px;">
              <div style="font-family:'JetBrains Mono',monospace;font-size:11px;
                          padding:5px 10px;cursor:pointer;letter-spacing:1px;
                          border-radius:2px;text-align:center;{btn_style}">
                {tf}
              </div>
            </div>
            """, unsafe_allow_html=True)
            if st.button(tf, key=f"tf_{tf}", help=f"Timeframe {tf}"):
                st.session_state.active_tf = tf
                st.rerun()
            st.markdown("""
            <style>
            div[data-testid="element-container"]:has(button[key^="tf_"]) {
                margin:0!important;padding:0!important;height:0!important;overflow:hidden!important;
            }
            </style>""", unsafe_allow_html=True)

    # ── Génération des bougies mock ────────────────────────────
    def gen_candles(base_price, n=80):
        """Génère des OHLCV réalistes autour d'un prix de base."""
        rng   = np.random.default_rng(42)
        dates = [
            datetime.datetime.now() - datetime.timedelta(minutes=(n - i) * 5)
            for i in range(n)
        ]
        opens  = [base_price]
        for _ in range(n - 1):
            opens.append(opens[-1] + rng.normal(0, base_price * 0.002))

        highs  = [o + abs(rng.normal(0, base_price * 0.003)) for o in opens]
        lows   = [o - abs(rng.normal(0, base_price * 0.003)) for o in opens]
        closes = [l + rng.uniform(0, h - l) for h, l in zip(highs, lows)]
        vols   = [rng.integers(500_000, 3_000_000) for _ in range(n)]
        return dates, opens, highs, lows, closes, vols

    dates, opens, highs, lows, closes, vols = gen_candles(sel_data["price"])

    # VWAP simplifié
    vwap_line = [sum(closes[:i+1]) / (i+1) for i in range(len(closes))]
    # EMA helper
    def ema(data, period):
        result, k = [], 2 / (period + 1)
        for i, v in enumerate(data):
            if i == 0:
                result.append(v)
            else:
                result.append(v * k + result[-1] * (1 - k))
        return result
    ema9  = ema(closes, 9)
    ema21 = ema(closes, 21)

    # Niveaux signal mock
    entry_price = sel_data["price"] * 0.999
    stop_price  = sel_data["price"] * 0.984
    tp1_price   = sel_data["price"] * 1.022
    tp2_price   = sel_data["price"] * 1.045

    # ── Figure Plotly ─────────────────────────────────────────
    fig = go.Figure()

    # Bougies
    fig.add_trace(go.Candlestick(
        x=dates, open=opens, high=highs, low=lows, close=closes,
        name=sel,
        increasing=dict(line=dict(color="#00FF88", width=1), fillcolor="rgba(0,255,136,0.3)"),
        decreasing=dict(line=dict(color="#FF3B5C", width=1), fillcolor="rgba(255,59,92,0.3)"),
        showlegend=False,
    ))

    # VWAP
    fig.add_trace(go.Scatter(
        x=dates, y=vwap_line, name="VWAP",
        line=dict(color="#00AAFF", width=1.5, dash="dash"),
    ))

    # EMA 9
    fig.add_trace(go.Scatter(
        x=dates, y=ema9, name="EMA 9",
        line=dict(color="#FFD600", width=1),
    ))

    # EMA 21
    fig.add_trace(go.Scatter(
        x=dates, y=ema21, name="EMA 21",
        line=dict(color="#a855f7", width=1),
    ))

    # Niveaux signal (lignes horizontales)
    level_defs = [
        (entry_price, "#00AAFF",  f"ENTRÉE ${entry_price:.2f}",  "dash"),
        (stop_price,  "#FF3B5C",  f"STOP   ${stop_price:.2f}",   "dot"),
        (tp1_price,   "#e0e6f0",  f"TP1    ${tp1_price:.2f}",    "dashdot"),
        (tp2_price,   "#e0e6f0",  f"TP2    ${tp2_price:.2f}",    "dashdot"),
    ]
    for lvl, color, label, dash in level_defs:
        fig.add_hline(
            y=lvl,
            line=dict(color=color, width=1, dash=dash),
            annotation_text=label,
            annotation_position="left",
            annotation=dict(
                font=dict(color=color, size=10, family="JetBrains Mono"),
                bgcolor="rgba(5,8,16,0.8)",
                bordercolor=color,
                borderwidth=1,
            ),
        )

    # Mise en page
    fig.update_layout(
        paper_bgcolor="#050810",
        plot_bgcolor="#070f1a",
        font=dict(family="JetBrains Mono", color="#4a6080", size=10),
        margin=dict(l=60, r=20, t=10, b=30),
        xaxis=dict(
            gridcolor="#1a2540",
            showgrid=True,
            rangeslider=dict(visible=False),
            tickfont=dict(color="#4a6080", size=9),
            linecolor="#1a2540",
        ),
        yaxis=dict(
            gridcolor="#1a2540",
            showgrid=True,
            tickfont=dict(color="#4a6080", size=9),
            linecolor="#1a2540",
            side="right",
        ),
        legend=dict(
            x=0.01, y=0.99,
            bgcolor="rgba(7,15,26,0.8)",
            bordercolor="#1a2540",
            borderwidth=1,
            font=dict(size=10, color="#4a6080"),
        ),
        dragmode="pan",
    )
    fig.update_xaxes(showspikes=True, spikecolor="#1a2540", spikethickness=1)
    fig.update_yaxes(showspikes=True, spikecolor="#1a2540", spikethickness=1)

    st.plotly_chart(fig, use_container_width=True, config={
        "displayModeBar": False,
        "scrollZoom": True,
    })

    # ── Tabs bas colonne centrale ──────────────────────────────
    TAB_DEFS = [
        ("journal",     "📋 JOURNAL DU JOUR"),
        ("positions",   "📊 POSITIONS"),
        ("alertes",     "🔔 ALERTES"),
        ("performance", "📈 PERFORMANCE"),
    ]

    # Rendu des boutons tabs
    tab_btns_html = '<div class="ax-tabs">'
    for key, label in TAB_DEFS:
        cls = "ax-tab-btn active" if st.session_state.active_tab == key else "ax-tab-btn"
        tab_btns_html += f'<span class="{cls}">{label}</span>'
    tab_btns_html += '</div>'
    st.markdown(tab_btns_html, unsafe_allow_html=True)

    # Boutons Streamlit invisibles pour la navigation tabs
    tab_btn_cols = st.columns(len(TAB_DEFS))
    for i, (key, label) in enumerate(TAB_DEFS):
        with tab_btn_cols[i]:
            if st.button(label, key=f"tab_{key}"):
                st.session_state.active_tab = key
                st.rerun()
    st.markdown("""
    <style>
    div[data-testid="element-container"]:has(button[key^="tab_"]) {
        margin:0!important;padding:0!important;height:0!important;overflow:hidden!important;
    }
    </style>""", unsafe_allow_html=True)

    active_tab = st.session_state.active_tab

    # ── Contenu tab JOURNAL ────────────────────────────────────
    if active_tab == "journal":
        rows_html = ""
        for tr in JOURNAL_DATA:
            row_cls = "win" if tr["win"] else "loss"
            pnl_color = "#00FF88" if tr["win"] else "#FF3B5C"
            rows_html += f"""
            <tr class="{row_cls}">
              <td style="color:#4a6080;">{tr['heure']}</td>
              <td style="font-family:'Syne',sans-serif;font-weight:700;letter-spacing:1px;">{tr['ticker']}</td>
              <td><span style="font-size:10px;letter-spacing:1px;color:#00AAFF;">{tr['style']}</span></td>
              <td>{tr['entree']}</td>
              <td>{tr['sortie']}</td>
              <td style="color:{pnl_color};font-weight:600;">{tr['pnl']}</td>
              <td style="color:#4a6080;font-size:10px;">{tr['note']}</td>
            </tr>"""

        st.markdown(f"""
        <div style="padding:0 4px;">
          <table class="ax-table">
            <thead>
              <tr>
                <th>Heure</th><th>Ticker</th><th>Style</th>
                <th>Entrée</th><th>Sortie</th><th>P&L</th><th>Note</th>
              </tr>
            </thead>
            <tbody>{rows_html}</tbody>
          </table>
        </div>
        """, unsafe_allow_html=True)

    # ── Contenu tab POSITIONS ──────────────────────────────────
    elif active_tab == "positions":
        if not POSITIONS_DATA:
            st.markdown("""
            <div style="padding:24px;text-align:center;color:#4a6080;font-size:12px;letter-spacing:2px;">
              AUCUNE POSITION OUVERTE
            </div>""", unsafe_allow_html=True)
        else:
            for pos in POSITIONS_DATA:
                pnl_color = "#00FF88" if pos["win"] else "#FF3B5C"
                st.markdown(f"""
                <div class="ax-position-card" style="margin:8px 4px;">
                  <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span class="ax-pos-ticker">{pos['ticker']}</span>
                    <span class="ax-badge {'ax-badge-buy' if pos['direction']=='LONG' else 'ax-badge-sell'}">{pos['direction']}</span>
                  </div>
                  <div class="ax-pos-detail">
                    <div class="ax-pos-kv"><div class="ax-pos-key">Entrée</div>
                      <div class="ax-pos-val">{pos['entree']}</div></div>
                    <div class="ax-pos-kv"><div class="ax-pos-key">Actuel</div>
                      <div class="ax-pos-val">{pos['actuel']}</div></div>
                    <div class="ax-pos-kv"><div class="ax-pos-key">P&L</div>
                      <div class="ax-pos-val" style="color:{pnl_color};">{pos['pnl']} ({pos['pnl_pct']})</div></div>
                    <div class="ax-pos-kv"><div class="ax-pos-key">Taille</div>
                      <div class="ax-pos-val">{pos['taille']}</div></div>
                  </div>
                </div>
                """, unsafe_allow_html=True)

    # ── Contenu tab ALERTES ────────────────────────────────────
    elif active_tab == "alertes":
        alerts_html = '<div style="padding:4px 0;">'
        for a in ALERTES_DATA:
            alerts_html += f"""
            <div class="ax-alert-row">
              <span class="ax-alert-icon">{a['icon']}</span>
              <span class="ax-alert-text">{a['text']}</span>
              <span class="ax-alert-time">{a['time']}</span>
            </div>"""
        alerts_html += '</div>'
        st.markdown(alerts_html, unsafe_allow_html=True)

    # ── Contenu tab PERFORMANCE ────────────────────────────────
    elif active_tab == "performance":
        wins_count    = sum(1 for t in JOURNAL_DATA if t["win"])
        total_trades  = len(JOURNAL_DATA)
        win_rate      = round(wins_count / total_trades * 100) if total_trades else 0
        total_pnl_day = sum(
            float(t["pnl"].replace("+$","").replace("-$","").replace("$",""))
            * (1 if t["win"] else -1)
            for t in JOURNAL_DATA if t["sortie"] != "OUVERT"
        )
        avg_win  = 37.25
        avg_loss = 11.00
        exp_val  = round((win_rate/100 * avg_win) - ((1 - win_rate/100) * avg_loss), 2)

        st.markdown(f"""
        <div class="ax-perf-grid" style="margin:8px 4px 0;">
          <div class="ax-perf-cell">
            <div class="ax-perf-key">Trades du jour</div>
            <div class="ax-perf-val" style="color:#00AAFF;">{total_trades}</div>
          </div>
          <div class="ax-perf-cell">
            <div class="ax-perf-key">Win rate</div>
            <div class="ax-perf-val" style="color:{'#00FF88' if win_rate>=60 else '#FFD600' if win_rate>=40 else '#FF3B5C'};">{win_rate}%</div>
          </div>
          <div class="ax-perf-cell">
            <div class="ax-perf-key">P&L total</div>
            <div class="ax-perf-val" style="color:{'#00FF88' if total_pnl_day>=0 else '#FF3B5C'};">
              {'+'  if total_pnl_day>=0 else ''}${total_pnl_day:.2f}
            </div>
          </div>
          <div class="ax-perf-cell">
            <div class="ax-perf-key">Gain moyen</div>
            <div class="ax-perf-val" style="color:#00FF88;">+${avg_win:.2f}</div>
          </div>
          <div class="ax-perf-cell">
            <div class="ax-perf-key">Perte moyenne</div>
            <div class="ax-perf-val" style="color:#FF3B5C;">-${avg_loss:.2f}</div>
          </div>
          <div class="ax-perf-cell">
            <div class="ax-perf-key">Espérance</div>
            <div class="ax-perf-val" style="color:{'#00FF88' if exp_val>=0 else '#FF3B5C'};">
              {'+'  if exp_val>=0 else ''}${exp_val:.2f}
            </div>
          </div>
        </div>
        """, unsafe_allow_html=True)

    # ── Footer timestamp ───────────────────────────────────────
    st.markdown(f"""
    <div class="ax-footer">
      <span class="ax-spinner"></span>
      <span>DERNIÈRE MAJ : {now_str}</span>
    </div>
    """, unsafe_allow_html=True)

# ============================================================
# BLOC 5 — COLONNE DROITE : MARCUS REID
# Avatar · Actions rapides · Conversation · Saisie
# ============================================================

with col_right:

    # ── En-tête agent ──────────────────────────────────────────
    st.markdown("""
    <div class="ax-agent-header">
      <div class="ax-avatar">MR</div>
      <div>
        <div class="ax-agent-name">MARCUS REID</div>
        <div class="ax-agent-status">
          <span class="ax-dot ax-dot-green"></span>
          EN LIGNE — ANALYSE EN COURS
        </div>
      </div>
    </div>
    """, unsafe_allow_html=True)

    # ── Boutons action rapide ──────────────────────────────────
    st.markdown("""
    <div class="ax-quick-grid">
      <div class="ax-quick-btn">📊 ANALYSER</div>
      <div class="ax-quick-btn">⚠️ RISK CHECK</div>
      <div class="ax-quick-btn">🌅 BRIEFING</div>
      <div class="ax-quick-btn">📓 DÉBRIEF</div>
    </div>
    """, unsafe_allow_html=True)

    # Boutons Streamlit invisibles pour les actions
    action_labels = ["ANALYSER", "RISK CHECK", "BRIEFING", "DÉBRIEF"]
    action_msgs   = [
        f"Analyse complète de {st.session_state.selected_ticker} maintenant.",
        "Vérifie mon exposition et mes risques actuels.",
        "Briefing marché complet pour aujourd'hui.",
        "Débrief de mes trades du jour.",
    ]
    qa_cols = st.columns(2)
    for i, (label, msg) in enumerate(zip(action_labels, action_msgs)):
        with qa_cols[i % 2]:
            if st.button(label, key=f"qa_{i}"):
                st.session_state.messages.append({"role": "user", "text": msg, "signal": None})
                # Réponse mock de l'agent
                responses = {
                    "ANALYSER": f"J'analyse {st.session_state.selected_ticker}. Setup actif : Bull Flag sur 5min. Momentum haussier confirmé par MACD et volume ×1.4. Signal BUY valide.",
                    "RISK CHECK": f"Exposition actuelle : {exposition_pct:.1f}% du capital. Drawdown journalier : {drawdown_pct:.2f}%. {positions_open}/3 positions ouvertes. Risque sous contrôle.",
                    "BRIEFING": "Marché : structure haussière sur le Nasdaq. VIX à 16.2 — volatilité modérée. Secteur tech en tête. SPY au-dessus du VWAP. Biais : acheteur.",
                    "DÉBRIEF": f"{wins_count if 'wins_count' in dir() else 2} trades gagnants sur {total_trades if 'total_trades' in dir() else 3}. Erreur principale : stop trop serré sur AMD. Règle à revoir : ne pas trader dans les 15min post-ouverture.",
                }
                st.session_state.messages.append({
                    "role": "agent",
                    "text": responses.get(label, "Analyse en cours..."),
                    "signal": None,
                })
                st.rerun()
    st.markdown("""
    <style>
    div[data-testid="element-container"]:has(button[key^="qa_"]) {
        margin:0!important;padding:0!important;height:0!important;overflow:hidden!important;
    }
    </style>""", unsafe_allow_html=True)

    # ── Zone conversation ──────────────────────────────────────
    chat_html = '<div class="ax-chat-zone" id="chat-zone">'

    for msg in st.session_state.messages:
        if msg["role"] == "agent":
            chat_html += f"""
            <div class="ax-msg-agent">
              <div class="ax-msg-agent-label">MARCUS REID</div>
              <div style="color:#e0e6f0;">{msg['text']}</div>"""

            # Carte signal si présente
            if msg.get("signal"):
                s = msg["signal"]
                chat_html += f"""
              <div class="ax-signal-card">
                <div class="ax-signal-sep">━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
                <div>📌 <strong>SETUP</strong> : {s['setup']}</div>
                <div>🎯 <strong>STYLE</strong> : {s['style']}</div>
                <div>⚡ <strong>URGENCE</strong> : {s['urgence']}</div>
                <div class="ax-signal-sep">━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
                <div class="ax-signal-entry">ENTRÉE  → {s['entree']}</div>
                <div class="ax-signal-stop" >STOP    → {s['stop']} ({s['stop_pct']})</div>
                <div class="ax-signal-tp"   >TP1     → {s['tp1']} ({s['tp1_pct']})</div>
                <div class="ax-signal-tp"   >TP2     → {s['tp2']} ({s['tp2_pct']})</div>
                <div class="ax-signal-sep">━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
                <div class="ax-signal-rr"   >R/R     → {s['rr']}</div>
                <div style="color:#e0e6f0;" >TAILLE  → {s['taille']}</div>
                <div class="ax-signal-sep">━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
              </div>"""

            chat_html += '</div>'

        else:
            chat_html += f"""
            <div class="ax-msg-user">
              <div style="color:#e0e6f0;">{msg['text']}</div>
            </div>"""

    chat_html += '</div>'
    # Auto-scroll vers le bas
    chat_html += """
    <script>
      const zone = document.getElementById('chat-zone');
      if (zone) zone.scrollTop = zone.scrollHeight;
    </script>"""
    st.markdown(chat_html, unsafe_allow_html=True)

    # ── Zone saisie ────────────────────────────────────────────
    with st.form(key="chat_form", clear_on_submit=True):
        user_input = st.text_input(
            label="",
            placeholder="Parle à Marcus Reid...",
            label_visibility="collapsed",
            key="chat_input",
        )
        # CSS sur le champ de saisie
        st.markdown("""
        <style>
        div[data-testid="stForm"] {
            border: none !important;
            padding: 0 !important;
            background: transparent !important;
        }
        div[data-testid="stForm"] input[type="text"] {
            background: #070f1a !important;
            border: 1px solid #1a2540 !important;
            color: #e0e6f0 !important;
            font-family: 'JetBrains Mono', monospace !important;
            font-size: 12px !important;
            border-radius: 0 !important;
        }
        div[data-testid="stForm"] input[type="text"]:focus {
            border-color: #00AAFF !important;
            box-shadow: none !important;
        }
        </style>
        """, unsafe_allow_html=True)

        submitted = st.form_submit_button(
            "ENVOYER",
            use_container_width=True,
        )
        st.markdown("""
        <style>
        div[data-testid="stForm"] button[kind="primaryFormSubmit"] {
            background: #00FF88 !important;
            color: #050810 !important;
            font-family: 'JetBrains Mono', monospace !important;
            font-weight: 700 !important;
            letter-spacing: 2px !important;
            border-radius: 0 !important;
            border: none !important;
            font-size: 11px !important;
        }
        div[data-testid="stForm"] button[kind="primaryFormSubmit"]:hover {
            opacity: 0.85 !important;
        }
        </style>""", unsafe_allow_html=True)

        if submitted and user_input.strip():
            st.session_state.messages.append({"role": "user", "text": user_input.strip(), "signal": None})
            # Réponse mock contextuelle
            u = user_input.lower()
            if any(w in u for w in ["nvda", "tsla", "aapl", "amd", "meta", "mstr", "pltr"]):
                ticker_mentioned = next((t for t in ["NVDA","TSLA","AAPL","AMD","META","MSTR","PLTR"] if t.lower() in u), "ce titre")
                reply = f"Analyse de {ticker_mentioned} : momentum positif, structure technique intacte. Attends la confirmation du volume avant d'entrer."
            elif any(w in u for w in ["stop", "stop-loss", "risque"]):
                reply = "Règle absolue : stop-loss défini avant l'entrée, jamais après. Maximum 2% du capital par trade."
            elif any(w in u for w in ["briefing", "marché", "marche"]):
                reply = "Structure haussière sur le Nasdaq. VIX bas à 16.2. Secteur tech en tête. Biais acheteur — favorise les setups LONG sur momentum."
            elif any(w in u for w in ["r/r", "ratio", "rr"]):
                reply = "Minimum 1:1.5 pour valider un trade. En dessous, je ne génère pas de signal. La asymétrie est non-négociable."
            else:
                reply = "Reçu. Je traite ta demande. Pour un signal précis, donne-moi un ticker spécifique."
            st.session_state.messages.append({"role": "agent", "text": reply, "signal": None})
            st.rerun()

    # Raccourcis rapides
    st.markdown("""
    <div class="ax-input-zone" style="padding-top:0;border-top:none;">
      <div class="ax-shortcuts">
        <span class="ax-shortcut">ANALYSE NVDA</span>
        <span class="ax-shortcut">BRIEFING</span>
        <span class="ax-shortcut">RISK CHECK</span>
        <span class="ax-shortcut">DÉBRIEF</span>
      </div>
    </div>
    """, unsafe_allow_html=True)

# ── Fermeture du wrapper layout ───────────────────────────────
st.markdown('</div>', unsafe_allow_html=True)

# ============================================================
# FIN — Dashboard AXIOM complet
# Lancement : streamlit run axiom/dashboard.py
# ============================================================

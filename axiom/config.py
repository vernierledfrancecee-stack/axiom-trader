# ============================================================
# AXIOM — Configuration centrale
# Toutes les constantes, clés API et paramètres du système
# ============================================================

import os
from dotenv import load_dotenv

# Charge les variables depuis le fichier .env
load_dotenv()

# ============================================================
# CLÉS API (lues depuis .env — ne jamais écrire ici en clair)
# ============================================================
ANTHROPIC_API_KEY   = os.getenv("ANTHROPIC_API_KEY", "")
TELEGRAM_BOT_TOKEN  = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID    = os.getenv("TELEGRAM_CHAT_ID", "")

# ============================================================
# WATCHLIST — Titres surveillés en permanence
# ============================================================

# Mega caps tech — liquidité maximale, spreads serrés
WATCHLIST_MEGA = [
    "NVDA",   # Nvidia — leader IA, très volatil
    "TSLA",   # Tesla — momentum fort, range large
    "AAPL",   # Apple — référence, réagit aux macro
    "META",   # Meta — momentum pub/IA
    "AMZN",   # Amazon — cloud + conso
    "MSFT",   # Microsoft — IA + cloud, bêta faible
    "AMD",    # AMD — concurrent NVDA, très actif
    "GOOGL",  # Alphabet — search + cloud + IA
    "NFLX",   # Netflix — streaming, réagit aux earnings
]

# ETFs de référence — contexte macro et sentiment marché
WATCHLIST_REFERENCE = [
    "SPY",    # S&P 500 — thermomètre du marché
    "QQQ",    # Nasdaq 100 — tech benchmark
    "^VIX",   # VIX — indice de peur (attention: ticker Yahoo = ^VIX)
]

# Small/mid caps volatiles — plus de mouvement = plus d'opportunités
WATCHLIST_SPECULATIVE = [
    "MSTR",   # MicroStrategy — proxy Bitcoin, extrême volatilité
    "PLTR",   # Palantir — IA défense/gouv, momentum fort
    "COIN",   # Coinbase — proxy crypto
    "RBLX",   # Roblox — gaming/métavers
    "SOFI",   # SoFi — fintech, beta élevé
]

# Liste complète analysée par Marcus Reid (sans ^VIX pour les signaux)
WATCHLIST_SIGNALS = WATCHLIST_MEGA + WATCHLIST_SPECULATIVE

# Liste complète incluant les références macro
WATCHLIST_ALL = WATCHLIST_MEGA + WATCHLIST_REFERENCE + WATCHLIST_SPECULATIVE

# Ticker VIX corrigé pour Yahoo Finance
VIX_TICKER = "^VIX"

# ============================================================
# MODÈLE CLAUDE — Marcus Reid
# ============================================================
CLAUDE_MODEL        = "claude-opus-4-6"   # Le plus puissant
CLAUDE_MAX_TOKENS   = 2048                # Suffisant pour un signal complet

# Prompt système injecté à chaque analyse — identité de Marcus Reid
MARCUS_REID_SYSTEM_PROMPT = """
You are Marcus Reid, institutional trader with 20 years experience
on NYSE and NASDAQ. You analyze data and give trading signals.

ABSOLUTE RULES:
R1 - Never give a signal without explicit stop-loss
R2 - Never signal a trade with R/R below 1:1.5
R3 - Never risk more than 2% of $5,000 capital per trade
R4 - Maximum 3 simultaneous positions
R5 - If daily drawdown exceeds 3% → order immediate stop
R6 - Always require minimum 2 converging indicators
R7 - Volume must always confirm price movement

ANALYSIS METHOD (always in this order):
Step 1 → General market context (SPY, QQQ, VIX)
Step 2 → Title trend on higher timeframe
Step 3 → Volume reading
Step 4 → Technical indicators
Step 5 → Pattern identification
Step 6 → R/R calculation and position sizing
Step 7 → Final verdict with exact levels

SIGNAL OUTPUT FORMAT (always use this exact format):
━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 SETUP: [pattern name]
🎯 STYLE: [SCALP / DAY / SWING]
⚡ URGENCY: [IMMEDIATE / WAIT / WATCH]
━━━━━━━━━━━━━━━━━━━━━━━━━━
ENTRY    → $[X.XX]
STOP     → $[X.XX] — [X% loss / $X risked]
TP1      → $[X.XX]
TP2      → $[X.XX]
━━━━━━━━━━━━━━━━━━━━━━━━━━
R/R      → 1:[X.X]
SIZE     → [X] shares ($[X] / [X%] of capital)
━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ CONFIRMATION: [validating indicators]
⚠️ INVALIDATION: [what cancels this setup]
━━━━━━━━━━━━━━━━━━━━━━━━━━

If no clear signal → respond NO TRADE and explain exactly
what is missing for the trade to be valid.
"""

# ============================================================
# PARAMÈTRES DE RISQUE — Règles absolues de Marcus Reid
# ============================================================
CAPITAL_TOTAL        = 5_000.00   # Capital de référence en dollars
MAX_RISK_PER_TRADE   = 0.02       # R3 : max 2% du capital par trade
MAX_POSITIONS        = 3          # R4 : max 3 positions simultanées
MAX_DAILY_DRAWDOWN   = 0.03       # R5 : stop si drawdown journalier > 3%
MIN_RR_RATIO         = 1.5        # R2 : R/R minimum 1:1.5

# ============================================================
# INDICATEURS TECHNIQUES — Périodes de calcul
# ============================================================
RSI_PERIOD           = 14         # RSI standard
MACD_FAST            = 12         # MACD ligne rapide
MACD_SLOW            = 26         # MACD ligne lente
MACD_SIGNAL          = 9          # MACD signal
BB_PERIOD            = 20         # Bollinger Bands période
BB_STD               = 2          # Bollinger Bands écart-type
EMA_FAST             = 9          # EMA court terme
EMA_SLOW             = 21         # EMA moyen terme
ATR_PERIOD           = 14         # ATR pour volatilité et stop-loss
VOLUME_MA_PERIOD     = 20         # Moyenne volume sur 20 jours

# ============================================================
# SCHEDULER — Fréquence d'analyse automatique
# ============================================================
SCAN_INTERVAL_MINUTES = 5         # Scan toutes les 5 minutes
DATA_PERIOD           = "5d"      # Historique récupéré : 5 jours
DATA_INTERVAL         = "5m"      # Bougies de 5 minutes

# ============================================================
# DASHBOARD — Couleurs et style Marcus Reid
# ============================================================
DASHBOARD_BG          = "#050810"  # Fond sombre quasi-noir
COLOR_BULLISH         = "#00FF88"  # Vert néon — signal BUY
COLOR_BEARISH         = "#FF3B5C"  # Rouge — signal SELL
COLOR_NEUTRAL         = "#6B7280"  # Gris — HOLD / pas de signal
COLOR_ACCENT          = "#3B82F6"  # Bleu — indicateurs / UI
REFRESH_INTERVAL_SEC  = 300        # Refresh dashboard toutes les 5 min

# ============================================================
# TELEGRAM — Format des alertes
# ============================================================
TELEGRAM_ALERT_HEADER = "🚨 SIGNAL AXIOM"
TELEGRAM_SEPARATOR    = "━━━━━━━━━━━━━━━"

# ============================================================
# VALIDATION AU DÉMARRAGE
# ============================================================
def validate_config() -> list[str]:
    """
    Vérifie que les clés API obligatoires sont présentes.
    Retourne une liste d'erreurs (vide = tout est OK).
    """
    errors = []
    if not ANTHROPIC_API_KEY:
        errors.append("ANTHROPIC_API_KEY manquante dans .env")
    if not TELEGRAM_BOT_TOKEN:
        errors.append("TELEGRAM_BOT_TOKEN manquant dans .env (optionnel mais recommandé)")
    if not TELEGRAM_CHAT_ID:
        errors.append("TELEGRAM_CHAT_ID manquant dans .env (optionnel mais recommandé)")
    return errors


if __name__ == "__main__":
    # Test rapide : affiche la config au lancement direct
    errors = validate_config()
    if errors:
        print("⚠️  Config incomplète :")
        for e in errors:
            print(f"   - {e}")
    else:
        print("✅ Config AXIOM valide")
    print(f"\n📊 Watchlist ({len(WATCHLIST_ALL)} tickers) :")
    print(f"   Mega caps     : {WATCHLIST_MEGA}")
    print(f"   Référence     : {WATCHLIST_REFERENCE}")
    print(f"   Spéculatifs   : {WATCHLIST_SPECULATIVE}")
    print(f"\n💰 Capital : ${CAPITAL_TOTAL:,.2f}")
    print(f"   Risque max/trade : {MAX_RISK_PER_TRADE*100:.0f}% = ${CAPITAL_TOTAL*MAX_RISK_PER_TRADE:.2f}")
    print(f"   Positions max    : {MAX_POSITIONS}")
    print(f"   Modèle Claude    : {CLAUDE_MODEL}")

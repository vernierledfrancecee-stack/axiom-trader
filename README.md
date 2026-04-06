# AXIOM v2.0 — Agent de Trading Autonome

Agent de trading intelligent combinant analyse technique et fondamentale, alertes Telegram en temps réel, et interface React/Vite.

---

## Architecture

```
axiom-trader/
├── server/
│   ├── index.js          # Express — API principale, sécurité, routes
│   ├── telegram.js       # Bot Telegram (alertes, commandes)
│   ├── cron.js           # Scan automatique 09h25 EST (lun-ven)
│   ├── tradeTracker.js   # Surveillance trades actifs, alertes P&L
│   ├── news.js           # Actualités Yahoo RSS, traduction FR
│   ├── analytics.js      # Métriques performance, snapshots capital
│   ├── database.js       # SQLite — trades, snapshots
│   ├── fundamental.js    # Données fondamentales Yahoo Finance
│   └── technical.js      # Indicateurs techniques (EMA, RSI, MACD)
├── client/src/
│   ├── App.jsx           # Navigation principale (7 onglets)
│   ├── api.js            # Appels Claude API (huntMarket, deepDive)
│   ├── LiveChart.jsx     # Graphique OHLC lightweight-charts v5
│   └── components/
│       ├── Dashboard.jsx  # Courbe capital, métriques, rapports
│       ├── NewsPanel.jsx  # Actualités financières en français
│       ├── TradePanel.jsx # Trades actifs, suivi P&L temps réel
│       └── SignalCard.jsx # Carte signal enrichie (technique + fondamental)
├── data/                 # Base de données SQLite (auto-créé)
├── logs/                 # Logs d'erreurs (auto-créé)
└── .env.example          # Template variables d'environnement
```

---

## Installation locale

### Prérequis
- Node.js >= 18.0.0
- npm >= 8

### Installation

```bash
# Cloner le projet
git clone <repo>
cd axiom-trader

# Installer les dépendances serveur
npm install

# Installer les dépendances client
cd client && npm install && cd ..

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos valeurs
```

### Développement

```bash
# Terminal 1 — Backend (port 3001)
npm run dev:server

# Terminal 2 — Frontend (port 5173)
npm run dev:client
```

### Production

```bash
# Build du frontend
npm run build

# Démarrer le serveur (sert aussi le frontend statique)
npm start
```

---

## Variables d'environnement

| Variable | Requis | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Clé API Anthropic (Claude) |
| `TELEGRAM_BOT_TOKEN` | Recommandé | Token du bot Telegram |
| `TELEGRAM_CHAT_ID` | Recommandé | ID du chat pour les alertes |
| `TELEGRAM_POLLING` | Non | `true` pour activer les commandes Telegram |
| `ADMIN_KEY` | Recommandé | Clé secrète pour les routes admin |
| `ALLOWED_ORIGINS` | Non | Origines CORS autorisées |
| `CAPITAL_INITIAL` | Non | Capital initial en euros (défaut: 5000) |
| `PORT` | Non | Port serveur (défaut: 3001) |
| `NODE_ENV` | Non | `production` en déploiement |

---

## Configuration Telegram

### 1. Créer le bot

1. Ouvrir Telegram et chercher **@BotFather**
2. Envoyer `/newbot`
3. Choisir un nom (ex: "AXIOM Trading Bot")
4. Choisir un username (ex: "axiom_trading_bot")
5. BotFather vous envoie le **token** → copier dans `TELEGRAM_BOT_TOKEN`

### 2. Récupérer votre Chat ID

1. Chercher **@userinfobot** sur Telegram
2. Envoyer `/start`
3. Le bot vous répond avec votre ID → copier dans `TELEGRAM_CHAT_ID`

### 3. Démarrer la conversation

Envoyer un message à votre bot pour initialiser la conversation (obligatoire avant de recevoir des messages).

---

## Commandes Telegram

| Commande | Description |
|---|---|
| `/status` | Résumé du portefeuille (capital, P&L, trades actifs) |
| `/trades` | Liste de tous les trades actifs avec P&L flottant |
| `/stop TICKER` | Ferme le trade sur ce ticker au prix actuel |
| `acheté TICKER` | Confirmation d'achat (demande enregistrement des détails) |

---

## Routes API

### Marché
| Route | Méthode | Description |
|---|---|---|
| `/api/candles/:ticker` | GET | Données OHLCV Yahoo Finance |
| `/api/fundamentals/:ticker` | GET | Données fondamentales (P/E, FCF, analystes...) |
| `/api/technicals/:ticker` | GET | Indicateurs techniques (EMA, RSI, MACD) |

### Intelligence Artificielle
| Route | Méthode | Description |
|---|---|---|
| `/api/axiom` | POST | Proxy Claude API avec streaming SSE |
| `/api/scan-manual` | POST | Scan Hunt Market manuel (header `X-Admin-Key`) |

### Actualités
| Route | Méthode | Description |
|---|---|---|
| `/api/news` | GET | News financières traduites en français |
| `/api/news?tickers=AAPL,NVDA` | GET | News filtrées par tickers |

### Trades
| Route | Méthode | Description |
|---|---|---|
| `/api/trade/open` | POST | Ouvrir un trade avec surveillance automatique |
| `/api/trade/close` | POST | Fermer un trade et générer rapport Marcus |
| `/api/trade/active` | GET | Trades actifs avec prix live et P&L flottant |
| `/api/trade/history` | GET | Historique des trades depuis SQLite |

### Analytics
| Route | Méthode | Description |
|---|---|---|
| `/api/analytics/stats` | GET | Statistiques complètes (win rate, profit factor...) |
| `/api/analytics/capital-curve` | GET | Courbe de capital historique |
| `/api/analytics/daily-pnl` | GET | P&L par jour sur 30 jours |
| `/api/stats/summary` | GET | Résumé rapide pour le dashboard |

### Monitoring
| Route | Méthode | Description |
|---|---|---|
| `/health` | GET | Statut serveur, uptime, connexions |

---

## Modules

### Module 1 — Bot Telegram + CRON
- Scan automatique à **09h25 EST** (lundi-vendredi)
- Envoi des signaux détectés sur Telegram avec format structuré
- Alerte si aucun setup qualifié

### Module 2 — Actualités en Français
- Flux RSS Yahoo Finance parsé et traduit par Claude Haiku
- Cache 5 minutes, filtrage par watchlist
- Fallback sur Claude web search si RSS indisponible

### Module 3 — Suivi des Trades
- Surveillance des prix toutes les 15 secondes
- Alertes automatiques : stop proche, stop déclenché, TP1/TP2 atteints
- Rapport post-trade généré par Marcus (Claude Haiku)

### Module 4 — Dashboard Capital
- Courbe de capital (recharts LineChart)
- Snapshot automatique à 16h05 EST
- Métriques : win rate, profit factor, Sharpe, drawdown max
- Rapports Marcus des 5 derniers trades

### Module 5 — Sécurité
- Helmet (headers de sécurité)
- Rate limiting (100 req/15min par IP)
- Validation de tous les inputs
- Logs d'erreurs horodatés

### Module 6 — Analyse Fondamentale
- Données Yahoo Finance : P/E, FCF, consensus analystes, earnings date
- Indicateurs techniques : EMA 20/50/200, RSI 14, MACD
- Prompt Marcus enrichi avec analyse bi-dimensionnelle
- Phrase de verdict combinant technique + fondamental

---

## Déploiement sur Railway

1. Connecter le repo GitHub sur [railway.app](https://railway.app)
2. Configurer les variables d'environnement dans le dashboard Railway
3. Railway détecte automatiquement `package.json` et lance `npm start`
4. Mettre `ALLOWED_ORIGINS` avec l'URL Railway de votre projet

---

## Licence

Usage éducatif uniquement. Pas de conseil financier. Les performances passées ne garantissent pas les résultats futurs.

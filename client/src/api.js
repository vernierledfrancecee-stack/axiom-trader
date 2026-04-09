function buildProfileContext(profile) {
  if (!profile) return '';
  return `
PROFIL DU TRADER : ${profile.name} — ${profile.experience} d'expérience en trading institutionnel. Marchés : ${profile.markets.join('/')} UNIQUEMENT. Styles : ${profile.tradingStyles.join(', ')}. Capital : $${profile.capital.toLocaleString()}.`;
}

const RULES = `Marcus Reid, trader institutionnel 20 ans NYSE/NASDAQ. Français uniquement. Froid, factuel.
R1:stop-loss obligatoire R2:R/R≥1:1.5 R3:max 2% capital R4:max 3 positions R5:drawdown>3%→stop R6:2 indicateurs min R7:volume confirme prix
R8:Zone d'entrée sur niveau technique réel (support pour LONG, résistance pour SHORT). Max 6% d'écart acceptable. Au-delà, marquer INVALIDE.
JSON VALIDE UNIQUEMENT:`;

const HUNTER_SYSTEM = RULES + `
{
  "marketBrief": "string — résumé du marché en 2-3 phrases",
  "marketCondition": "BULLISH" | "BEARISH" | "NEUTRAL" | "VOLATILE",
  "vixLevel": "string — niveau VIX actuel et interprétation",
  "sectorFocus": "string — secteur le plus actif aujourd'hui et pourquoi",
  "bestSetups": [
    {
      "rank": 1,
      "ticker": "string",
      "direction": "LONG" | "SHORT",
      "timeframe": "SCALP" | "DAY TRADE" | "SWING 24H" | "SWING 48H",
      "conviction": number (0-100),
      "prixActuel": "string — prix actuel du titre au moment du scan",
      "entryZone": "string — zone de prix PROCHE du prix actuel",
      "setupStatus": "IMMÉDIAT" | "EN ATTENTE" | "INVALIDE",
      "stopLoss": "string — niveau de stop",
      "target1": "string — premier objectif",
      "target2": "string — deuxième objectif",
      "riskReward": "string — ex: 1:2.5",
      "catalyst": "string — pourquoi ce titre bouge",
      "technicalSetup": "string — pattern / confluence d'indicateurs",
      "volumeContext": "string — analyse du volume",
      "invalidationNote": "string — ce qui invalide ce trade",
      "urgency": "HIGH" | "MEDIUM" | "LOW"
    }
  ],
  "avoidList": ["ticker1", "ticker2"]
}`;

const SINGLE_SYSTEM = RULES + `
FORMAT "thesis" OBLIGATOIRE :
━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 SETUP : [pattern]
🎯 STYLE : [SCALP / DAY / SWING]
⚡ URGENCE : [IMMÉDIAT / ATTENDRE / SURVEILLER]
━━━━━━━━━━━━━━━━━━━━━━━━━━
ENTRÉE  → $[X.XX]
STOP    → $[X.XX] (-[X%])
TP1     → $[X.XX] (+[X%])
TP2     → $[X.XX] (+[X%])
━━━━━━━━━━━━━━━━━━━━━━━━━━
R/R     → 1:[X.X]
TAILLE  → [X] actions ($[X])
━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ CONFIRMATIONS : [indicateurs]
⚠️ INVALIDATION : [ce qui annule]
━━━━━━━━━━━━━━━━━━━━━━━━━━

Si pas de signal clair → signal = "NO TRADE" avec la raison exacte dans "thesis".

RÉPONDS UNIQUEMENT AVEC DU JSON VALIDE — pas de markdown, pas d'explication hors du JSON :
{
  "ticker": "string",
  "signal": "LONG" | "SHORT" | "NO TRADE",
  "timeframe": "SCALP" | "DAY TRADE" | "SWING 24H" | "SWING 48H",
  "conviction": number (0-100),
  "prixActuel": "string — prix actuel au moment de l'analyse",
  "setupStatus": "IMMÉDIAT" | "EN ATTENTE" | "INVALIDE",
  "entryZone": "string",
  "stopLoss": "string",
  "target1": "string",
  "target2": "string",
  "riskReward": "string",
  "maxRiskPct": "string — ex: 1.5%",
  "catalyst": "string",
  "technicalSetup": "string",
  "invalidationNote": "string",
  "urgency": "HIGH" | "MEDIUM" | "LOW",
  "thesis": "string — format de signal obligatoire ci-dessus",
  "warning": "string — risques clés ou points de vigilance"
}`;

async function callAxiom(system, userMessage, model, useWebSearch = false) {
  const res = await fetch('/api/axiom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, user: userMessage, model, useWebSearch }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'API call failed');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (!data) continue;
      try {
        const event = JSON.parse(data);
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          fullText += event.delta.text;
        }
      } catch {}
    }
  }

  const jsonMatch = fullText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in response');
  return JSON.parse(jsonMatch[0]);
}

/**
 * Récupère le prix actuel d'un ticker.
 */
async function fetchCurrentPrice(ticker) {
  try {
    const r = await fetch(`/api/candles/${ticker}?interval=1m&range=1d`);
    if (!r.ok) return null;
    const data = await r.json();
    const candles = data.candles || [];
    if (!candles.length) return null;
    return candles[candles.length - 1].close;
  } catch {
    return null;
  }
}

/**
 * Parse un prix depuis une chaîne ("$121.50 - $123" → 122.25, "$595" → 595)
 * Priorité : plage → premier $ → premier nombre
 */
function parsePrice(str) {
  if (!str) return null;
  const s = String(str);
  // Plage : "$595-600" ou "595 - 600" ou "$595–$600"
  const rangeMatch = s.match(/\$?([\d,]+\.?\d*)\s*[-–]\s*\$?([\d,]+\.?\d*)/);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1].replace(',', ''));
    const high = parseFloat(rangeMatch[2].replace(',', ''));
    if (!isNaN(low) && !isNaN(high) && high > low && high < low * 1.5) {
      return (low + high) / 2;
    }
  }
  // Premier prix précédé de $
  const priceMatch = s.match(/\$\s*([\d,]+\.?\d+)/);
  if (priceMatch) {
    const val = parseFloat(priceMatch[1].replace(',', ''));
    if (!isNaN(val) && val > 0) return val;
  }
  // Premier nombre dans la chaîne
  const firstNum = s.match(/([\d,]+\.?\d+)/);
  if (firstNum) {
    const val = parseFloat(firstNum[1].replace(',', ''));
    if (!isNaN(val) && val > 0) return val;
  }
  return null;
}

/**
 * Valide les setups Hunt Market contre les prix actuels.
 * Ajoute prixActuelLive, ecartPct et met à jour setupStatus si nécessaire.
 */
async function validateSetupsWithLivePrices(result) {
  if (!result?.bestSetups?.length) return result;

  const validated = await Promise.all(
    result.bestSetups.map(async (setup) => {
      const livePrice = await fetchCurrentPrice(setup.ticker);
      if (!livePrice) return setup;

      const entree = parsePrice(setup.entryZone);
      let ecartPct = null;
      let newStatus = setup.setupStatus;
      let newConviction = setup.conviction;

      if (entree) {
        ecartPct = ((livePrice - entree) / entree) * 100;
        const direction = (setup.direction || setup.signal || 'LONG').toUpperCase();

        if (direction === 'LONG') {
          // LONG : on veut acheter sur un pullback vers l'entrée
          if (livePrice < entree * 0.98) {
            // Support cassé — le prix est tombé sous la zone d'entrée
            newStatus = 'INVALIDE';
            newConviction = Math.min(newConviction, 20);
          } else if (livePrice <= entree * 1.015) {
            // Dans la zone d'entrée (±1.5%) — ordre déclenchable maintenant
            newStatus = newStatus || 'IMMÉDIAT';
          } else if (livePrice <= entree * 1.06) {
            // Prix au-dessus de l'entrée — attendre le pullback (comportement normal)
            newStatus = 'EN ATTENTE';
            // Conviction préservée : c'est un setup valide en attente de recul
          } else {
            // Prix >6% au-dessus de l'entrée — opportunité manquée
            newStatus = 'INVALIDE';
            newConviction = Math.min(newConviction, 20);
          }
        } else {
          // SHORT : on veut vendre sur un rebond vers l'entrée
          if (livePrice > entree * 1.02) {
            // Résistance cassée — le prix est monté au-dessus de la zone d'entrée
            newStatus = 'INVALIDE';
            newConviction = Math.min(newConviction, 20);
          } else if (livePrice >= entree * 0.985) {
            // Dans la zone d'entrée (±1.5%) — ordre déclenchable maintenant
            newStatus = newStatus || 'IMMÉDIAT';
          } else if (livePrice >= entree * 0.94) {
            // Prix sous l'entrée — attendre le rebond (comportement normal)
            newStatus = 'EN ATTENTE';
            // Conviction préservée
          } else {
            // Prix >6% sous l'entrée — opportunité manquée
            newStatus = 'INVALIDE';
            newConviction = Math.min(newConviction, 20);
          }
        }
      }

      return {
        ...setup,
        prixActuelLive: livePrice,
        ecartPct: ecartPct !== null ? parseFloat(ecartPct.toFixed(2)) : null,
        setupStatus: newStatus,
        conviction: newConviction,
      };
    })
  );

  // Trier : IMMÉDIAT en premier, INVALIDE en dernier
  const order = { 'IMMÉDIAT': 0, 'EN ATTENTE': 1, 'INVALIDE': 2 };
  validated.sort((a, b) => (order[a.setupStatus] ?? 1) - (order[b.setupStatus] ?? 1));

  return { ...result, bestSetups: validated };
}

// Watchlist de 28 actions liquides S&P500/NASDAQ (grandes capitalisations uniquement)
const WATCHLIST = [
  'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'GOOGL', 'NFLX',
  'AMD', 'INTC', 'QCOM', 'AVGO',
  'JPM', 'BAC', 'GS', 'V', 'MA',
  'XOM', 'CVX',
  'UNH', 'LLY', 'JNJ',
  'BA', 'CAT', 'GE',
  'SPY', 'QQQ', 'GLD',
];

export async function huntMarket(capital, mode, profile) {
  const profileCtx = buildProfileContext(profile);

  // Pré-charger les prix réels de la watchlist
  const priceMap = {};
  await Promise.all(
    WATCHLIST.map(async (ticker) => {
      const price = await fetchCurrentPrice(ticker);
      if (price) priceMap[ticker] = price;
    })
  );

  // Construire la table des prix pour le prompt
  const priceTable = WATCHLIST
    .filter(t => priceMap[t])
    .map(t => `${t}:$${priceMap[t].toFixed(2)}`)
    .join(' | ');

  const system = HUNTER_SYSTEM + profileCtx;
  const userMessage = `Scanne le marché MAINTENANT. Capital disponible : $${capital}. Mode : ${mode}.

WATCHLIST AUTORISÉE — tu dois choisir UNIQUEMENT parmi ces titres :
${priceTable}

Ces prix sont RÉELS et datent de moins de 2 minutes. Tu DOIS utiliser ces prix comme base pour tes zones d'entrée.
Zone d'entrée : pour un LONG, place l'entrée sur le support technique (max 6% sous le prix actuel). Pour un SHORT, place l'entrée sur la résistance (max 6% au-dessus). Évite les entrées trop loin (>6%) qui rendraient le trade irreprenable.

Utilise la recherche web pour identifier les catalyseurs, actualités et momentum du jour sur ces titres.
Sélectionne les 4 meilleurs setups parmi la watchlist, avec des niveaux cohérents avec les prix ci-dessus.
Retourne le JSON.`;

  const result = await callAxiom(system, userMessage, null, true);

  // Validation live des prix après la réponse IA
  return validateSetupsWithLivePrices(result);
}

export async function deepDive(ticker, profile) {
  const t = ticker.toUpperCase();
  const profileCtx = buildProfileContext(profile);
  const system = SINGLE_SYSTEM + profileCtx;

  // Pré-charger prix live + technicals en parallèle
  const [livePrice, techData] = await Promise.all([
    fetchCurrentPrice(t),
    fetch(`/api/technicals/${t}`).then(r => r.ok ? r.json() : null).catch(() => null),
  ]);

  // Construire le contexte de données réelles à injecter dans le prompt
  let dataContext = '';

  if (livePrice) {
    dataContext += `\nPRIX ACTUEL (temps réel) : $${livePrice.toFixed(2)}`;
  }

  if (techData) {
    const td = techData;
    dataContext += `\n\nINDICATEURS TECHNIQUES (calculés sur données Yahoo Finance) :`;
    if (td.ema20) dataContext += `\n• EMA 20 : $${td.ema20.toFixed(2)}`;
    if (td.ema50) dataContext += `\n• EMA 50 : $${td.ema50.toFixed(2)}`;
    if (td.ema200) dataContext += `\n• EMA 200 : $${td.ema200.toFixed(2)}`;
    if (td.rsi14 != null) dataContext += `\n• RSI 14 : ${td.rsi14.toFixed(1)}${td.rsi14 > 70 ? ' ⚠️ SURACHETÉ' : td.rsi14 < 30 ? ' ⚠️ SURVENDU' : ''}`;
    if (td.macd) dataContext += `\n• MACD : ${td.macd.macd?.toFixed(3)} | Signal : ${td.macd.signal?.toFixed(3)} | Histo : ${td.macd.histogram?.toFixed(3)}`;
    if (td.volumeRatio) dataContext += `\n• Volume ratio (vs moy 20j) : x${td.volumeRatio.toFixed(2)}`;
    if (td.tendance) dataContext += `\n• Tendance globale : ${td.tendance}`;
  }

  const userMessage = `Analyse ${t} maintenant.
${dataContext || ''}

${dataContext ? 'Utilise CES données réelles comme base de ton analyse.' : ''}
Utilise la recherche web pour les actualités, catalyseurs et contexte macro du jour.
Génère un signal actionnable avec des niveaux précis basés sur le prix actuel.
Retourne le JSON.`;

  return callAxiom(system, userMessage, null, true);
}

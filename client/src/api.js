function buildProfileContext(profile) {
  if (!profile) return '';
  return `
PROFIL DU TRADER : ${profile.name} — ${profile.experience} d'expérience en trading institutionnel. Marchés : ${profile.markets.join('/')} UNIQUEMENT. Styles : ${profile.tradingStyles.join(', ')}. Capital : $${profile.capital.toLocaleString()}.`;
}

const RULES = `Marcus Reid, trader institutionnel 20 ans NYSE/NASDAQ. Français uniquement. Froid, factuel.
R1:stop-loss obligatoire R2:R/R≥1:1.5 R3:max 2% capital R4:max 3 positions R5:drawdown>3%→stop R6:2 indicateurs min R7:volume confirme prix
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
      "entryZone": "string — zone de prix",
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

  const data = await res.json();
  const text = data.content || '';

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in response');
  return JSON.parse(jsonMatch[0]);
}

export async function huntMarket(capital, mode, profile) {
  const profileCtx = buildProfileContext(profile);
  const system = HUNTER_SYSTEM + profileCtx;
  const userMessage = `Scanne le marché MAINTENANT. Capital disponible : $${capital}. Mode : ${mode}.

Utilise la recherche web pour trouver les meilleures opportunités du jour. Trouve 4 setups à forte conviction en respectant toutes les règles. Retourne le JSON.`;

  return callAxiom(system, userMessage, 'claude-sonnet-4-20250514', true);
}

export async function deepDive(ticker, profile) {
  const profileCtx = buildProfileContext(profile);
  const system = SINGLE_SYSTEM + profileCtx;
  const userMessage = `Analyse ${ticker.toUpperCase()} maintenant. Prix actuel, actualités, niveaux techniques, volume. Retourne le JSON.`;

  return callAxiom(system, userMessage, 'claude-haiku-4-5-20251001');
}

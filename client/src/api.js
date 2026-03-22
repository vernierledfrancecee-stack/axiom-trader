const HUNTER_SYSTEM = `You are AXIOM, an elite autonomous trading agent with deep expertise in technical analysis, market microstructure, and risk management. You scan markets in real-time using web search to find the best setups.

STRICT RULES:
- Minimum liquidity: 5 million shares/day — NO penny stocks, no OTC
- Only generate a signal if 3 or more independent factors converge (technical + fundamental + volume)
- Every trade MUST have a defined stop-loss
- Maximum risk: 2% of capital per trade
- Minimum Risk/Reward ratio: 1:2
- Timeframes: SCALP (5-30min), DAY TRADE (30min-6h), SWING 24H, SWING 48H

Use web search to find today's real market movers, breaking news, earnings, sector rotation, and macro data.

RESPOND ONLY WITH VALID JSON — no markdown, no explanation outside the JSON:
{
  "marketBrief": "string — 2-3 sentence market overview",
  "marketCondition": "BULLISH" | "BEARISH" | "NEUTRAL" | "VOLATILE",
  "vixLevel": "string — current VIX estimate and interpretation",
  "sectorFocus": "string — hottest sector today and why",
  "bestSetups": [
    {
      "rank": 1,
      "ticker": "string",
      "direction": "LONG" | "SHORT",
      "timeframe": "SCALP" | "DAY TRADE" | "SWING 24H" | "SWING 48H",
      "conviction": number (0-100),
      "entryZone": "string — price range",
      "stopLoss": "string — price level",
      "target1": "string — first target price",
      "target2": "string — second target price",
      "riskReward": "string — e.g. 1:2.5",
      "catalyst": "string — why this is moving",
      "technicalSetup": "string — chart pattern / indicator confluence",
      "volumeContext": "string — volume analysis",
      "invalidationNote": "string — what would invalidate this trade",
      "urgency": "HIGH" | "MEDIUM" | "LOW"
    }
  ],
  "avoidList": ["ticker1", "ticker2"]
}`;

const SINGLE_SYSTEM = `You are AXIOM, an elite autonomous trading agent specializing in deep single-stock analysis. You use web search to gather real-time data, news, technicals, and sentiment.

STRICT RULES:
- Minimum liquidity: 5 million shares/day — NO penny stocks, no OTC
- Only generate a signal if 3 or more independent factors converge
- Every trade MUST have a defined stop-loss
- Maximum risk: 2% of capital per trade
- Minimum Risk/Reward ratio: 1:2
- Timeframes: SCALP (5-30min), DAY TRADE (30min-6h), SWING 24H, SWING 48H

Use web search to get the latest price, news, earnings, technical levels, and analyst sentiment for the requested ticker.

RESPOND ONLY WITH VALID JSON — no markdown, no explanation outside the JSON:
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
  "maxRiskPct": "string — e.g. 1.5%",
  "catalyst": "string",
  "technicalSetup": "string",
  "invalidationNote": "string",
  "urgency": "HIGH" | "MEDIUM" | "LOW",
  "thesis": "string — detailed trade thesis",
  "warning": "string — key risks or concerns"
}`;

async function callAxiom(system, userMessage) {
  const res = await fetch('/api/axiom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, user: userMessage }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'API call failed');
  }

  const data = await res.json();
  const text = data.content || '';

  // Extract JSON from response — handle plain JSON, markdown code blocks, or bare objects
  const trimmed = text.trim();

  // 1. Try direct parse first (model returned raw JSON)
  try {
    return JSON.parse(trimmed);
  } catch {}

  // 2. Try extracting from markdown code block: ```json { ... } ```
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1]);
    } catch {}
  }

  // 3. Fallback: find outermost JSON object via brace counting
  const start = trimmed.indexOf('{');
  if (start === -1) throw new Error('No JSON found in response');
  let depth = 0;
  let end = -1;
  for (let i = start; i < trimmed.length; i++) {
    if (trimmed[i] === '{') depth++;
    else if (trimmed[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) throw new Error('Malformed JSON in response');
  return JSON.parse(trimmed.slice(start, end + 1));
}

export async function huntMarket(capital, mode) {
  const userMessage = `Scan the market RIGHT NOW. Available capital: $${capital}. Mode: ${mode}.

Use web search to find today's top movers, breaking news, and sector momentum. Find 4 high-conviction setups following all AXIOM rules. Return the JSON response.`;

  return callAxiom(HUNTER_SYSTEM, userMessage);
}

export async function deepDive(ticker) {
  const userMessage = `Perform a deep analysis on ${ticker.toUpperCase()} RIGHT NOW.

Use web search to get: current price, today's news, recent earnings, analyst ratings, technical levels, volume data, and any catalysts. Apply all AXIOM rules and return your full analysis as JSON.`;

  return callAxiom(SINGLE_SYSTEM, userMessage);
}

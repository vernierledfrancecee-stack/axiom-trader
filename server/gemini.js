/**
 * AXIOM — Helper Gemini 2.0 Flash
 * Wrapper partagé pour tous les appels à l'API Google Gemini.
 */

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_RETRIES = 3;

/**
 * Extrait le délai de retry depuis une réponse 429 Gemini.
 * Retourne le délai en ms, ou un défaut de 60s.
 */
function parseRetryDelay(errBody) {
  try {
    const parsed = typeof errBody === 'string' ? JSON.parse(errBody) : errBody;
    const retryInfo = parsed?.error?.details?.find(d => d['@type']?.includes('RetryInfo'));
    if (retryInfo?.retryDelay) {
      // Format : "59s" ou "59.444409955s"
      const seconds = parseFloat(retryInfo.retryDelay);
      if (!isNaN(seconds)) return Math.ceil(seconds) * 1000;
    }
  } catch {}
  return 60000; // défaut 60s
}

/**
 * Vérifie si le quota journalier est dépassé (limit: 0 sur FreeTier daily).
 * Dans ce cas, retry inutile — il faut activer la facturation.
 */
function isDailyQuotaExhausted(errBody) {
  try {
    const parsed = typeof errBody === 'string' ? JSON.parse(errBody) : errBody;
    const violations = parsed?.error?.details?.find(d => d.violations)?.violations || [];
    return violations.some(v =>
      v.quotaId?.includes('PerDay') ||
      v.message?.toLowerCase().includes('billing')
    );
  } catch {}
  return false;
}

/**
 * Appelle Gemini 2.0 Flash et retourne le texte généré.
 * Retry automatique sur 429 (rate limit par minute), avec backoff.
 *
 * @param {string} system - Instruction système (persona, règles)
 * @param {string} userMessage - Message utilisateur
 * @param {object} opts
 * @param {number} [opts.maxTokens=4096]
 * @param {boolean} [opts.useWebSearch=false] - Active Google Search grounding
 * @returns {Promise<string>} Texte généré
 */
async function callGemini(system, userMessage, { maxTokens = 8192, useWebSearch = false } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY absent');

  const url = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    generationConfig: { maxOutputTokens: maxTokens },
  };

  if (system) {
    body.systemInstruction = { parts: [{ text: system }] };
  }

  if (useWebSearch) {
    body.tools = [{ google_search: {} }];
  }

  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const data = await response.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const text = parts.map(p => p.text || '').join('');
      if (!text) throw new Error('Gemini: réponse vide ou format inattendu');
      return text;
    }

    const errText = await response.text();

    if (response.status === 429) {
      // Quota journalier épuisé → pas la peine de retenter
      if (isDailyQuotaExhausted(errText)) {
        throw new Error(
          'Gemini quota journalier épuisé (free tier limit: 0). ' +
          'Active la facturation sur https://ai.dev/rate-limit pour résoudre.'
        );
      }

      // Rate limit par minute → attendre puis retenter
      if (attempt < MAX_RETRIES) {
        const delay = parseRetryDelay(errText);
        console.warn(`[Gemini] 429 rate limit — retry ${attempt}/${MAX_RETRIES} dans ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
    }

    lastError = new Error(`Gemini API error ${response.status}: ${errText}`);
    break;
  }

  throw lastError || new Error('Gemini: toutes les tentatives ont échoué');
}

module.exports = { callGemini };

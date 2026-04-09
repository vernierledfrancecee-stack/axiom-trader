/**
 * AXIOM — Helper Gemini 2.0 Flash
 * Wrapper partagé pour tous les appels à l'API Google Gemini.
 */

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Appelle Gemini 2.0 Flash et retourne le texte généré.
 *
 * @param {string} system - Instruction système (persona, règles)
 * @param {string} userMessage - Message utilisateur
 * @param {object} opts
 * @param {number} [opts.maxTokens=4096]
 * @param {boolean} [opts.useWebSearch=false] - Active Google Search grounding
 * @returns {Promise<string>} Texte généré
 */
async function callGemini(system, userMessage, { maxTokens = 4096, useWebSearch = false } = {}) {
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

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();

  // Extraire le texte depuis la réponse Gemini
  const parts = data.candidates?.[0]?.content?.parts || [];
  const text = parts.map(p => p.text || '').join('');

  if (!text) throw new Error('Gemini: réponse vide ou format inattendu');

  return text;
}

module.exports = { callGemini };

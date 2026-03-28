const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// GET /api/candles/:ticker — proxy Yahoo Finance OHLCV
app.get('/api/candles/:ticker', async (req, res) => {
  const { ticker } = req.params;
  const { interval = '5m', range = '1d' } = req.query;
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${interval}&range=${range}&includePrePost=false`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await r.json();
    const result = data.chart?.result?.[0];
    if (!result) return res.status(404).json({ error: 'Ticker introuvable' });
    const { timestamp, indicators: { quote: [q] } } = result;
    const candles = timestamp
      .map((t, i) => ({ time: t, open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i] }))
      .filter(c => c.open != null && c.close != null);
    res.json({ candles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/axiom — proxy to Anthropic API
app.post('/api/axiom', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const { system, user, model, useWebSearch = false } = req.body;
  if (!user) {
    return res.status(400).json({ error: 'Missing user message' });
  }

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };
  if (useWebSearch) headers['anthropic-beta'] = 'web-search-2025-03-05';

  const body = {
    model: model || 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: system || '',
    messages: [{ role: 'user', content: user }],
  };
  if (useWebSearch) {
    body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1 }];
  }

  // Stream response to avoid Railway 30s timeout
  body.stream = true;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }

    res.end();
  } catch (err) {
    console.error('Anthropic API error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// Serve static frontend
const distPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(distPath));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`AXIOM server running on port ${PORT}`);
});

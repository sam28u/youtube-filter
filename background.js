const PROVIDERS = {
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'openai/gpt-oss-120b'
  },
  cerebras: {
    url: 'https://api.cerebras.ai/v1/chat/completions',
    model: 'gpt-oss-120b'
  }
};

const THRESHOLD = 0.5;
const TIMEOUT_MS = 20000;
const MAX_RETRIES = 2;

function httpError(status, providerName) {
  if (status === 401 || status === 403) return `${providerName} API key rejected. Check your key.`;
  if (status === 404) return `${providerName} model not found. Provider may have deprecated it.`;
  if (status === 429) return `${providerName} rate limited. Switching provider or waiting...`;
  if (status >= 500) return `${providerName} server error (HTTP ${status}).`;
  return `${providerName} error: HTTP ${status}`;
}

function buildPrompt(titles, topic) {
  return `You are a relevance scorer for YouTube videos.

User's focus topic: "${topic}"

For each video title below, return a relevance score between 0.0 and 1.0.
1.0 = clearly about the topic. 0.0 = completely unrelated.

Titles:
${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Respond ONLY with a JSON array of ${titles.length} numbers.
Example: [0.9, 0.1, 0.75, 0.3]`;
}

function parseScores(text, expected) {
  const match = text.match(/\[[\s\S]*?\]/);
  if (!match) return new Array(expected).fill(1);
  try {
    const arr = JSON.parse(match[0]);
    const nums = arr.map(n => Math.max(0, Math.min(1, Number(n) || 0)));
    while (nums.length < expected) nums.push(1);
    return nums.slice(0, expected);
  } catch {
    return new Array(expected).fill(1);
  }
}

async function callProvider(provider, apiKey, titles, topic) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(provider.url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: 'user', content: buildPrompt(titles, topic) }],
        temperature: 0
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const retryAfter = res.headers.get('Retry-After');
      return { ok: false, status: res.status, retryAfter: retryAfter ? parseInt(retryAfter, 10) : null };
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    const scores = parseScores(text, titles.length);
    return { ok: true, results: scores.map(s => s >= THRESHOLD) };
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') return { ok: false, error: 'Request timed out.' };
    return { ok: false, error: err.message };
  }
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req?.action !== 'classifyBatch') return;

  (async () => {
    const { apiKey, fallbackApiKey } = await chrome.storage.local.get(['apiKey', 'fallbackApiKey']);

    if (!apiKey) {
      sendResponse({ success: false, error: 'Add your Groq API key in the popup.' });
      return;
    }

    // --- Try primary (Groq) with retries ---
    let result = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      result = await callProvider(PROVIDERS.groq, apiKey, req.titles, req.topic);

      if (result.ok) break;

      if (result.status === 429 && attempt < MAX_RETRIES) {
        const delay = result.retryAfter ? result.retryAfter * 1000 : 1000 * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      break; // Non-retryable error, exit loop
    }

    // --- Fallback to Cerebras on failure ---
    if (!result.ok && fallbackApiKey) {
      console.log('Groq failed, falling back to Cerebras...');

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        result = await callProvider(PROVIDERS.cerebras, fallbackApiKey, req.titles, req.topic);

        if (result.ok) break;

        if (result.status === 429 && attempt < MAX_RETRIES) {
          const delay = result.retryAfter ? result.retryAfter * 1000 : 1000 * Math.pow(2, attempt);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        break;
      }
    }

    // --- Report final result ---
    if (result.ok) {
      sendResponse({ success: true, results: result.results });
    } else if (result.status) {
      sendResponse({ success: false, error: httpError(result.status, 'Groq/Cerebras') });
    } else {
      sendResponse({ success: false, error: result.error || 'Unknown error.' });
    }
  })();

  return true;
});
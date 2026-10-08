const HF_URL =
  'https://router.huggingface.co/hf-inference/models/facebook/bart-large-mnli';
const THRESHOLD = 0.45;
const MAX_RETRIES = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function extractScore(data) {
  if (Array.isArray(data) && data.length && typeof data[0]?.score === 'number') {
    return Math.max(...data.map((d) => d.score));
  }
  const obj = Array.isArray(data) ? data[0] : data;
  if (obj && Array.isArray(obj.scores) && obj.scores.length) {
    return Math.max(...obj.scores);
  }
  return undefined;
}

function describeHttpError(status) {
  if (status === 401 || status === 403) {
    return 'Token rejected. Make sure it has the "Inference Providers" permission.';
  }
  if (status === 404 || status === 410) {
    return 'Hugging Face model endpoint unavailable (HTTP ' + status + ').';
  }
  if (status === 429) return 'Rate limited by Hugging Face. Will retry shortly.';
  return 'API error: HTTP ' + status;
}

async function classify(title, topic) {
  const { hfToken } = await chrome.storage.local.get('hfToken');
  if (!hfToken) {
    return {
      success: false,
      error: 'Add your Hugging Face token in the extension popup.',
      retryable: false
    };
  }

  const body = JSON.stringify({
    inputs: String(title).slice(0, 200),
    parameters: {
      candidate_labels: [topic],
      multi_label: true, 
      hypothesis_template: 'This video is about {}.'
    }
  });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res;
    try {
      res = await fetch(HF_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hfToken}`,
          'Content-Type': 'application/json'
        },
        body
      });
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        return { success: false, error: 'Network error', retryable: true };
      }
      await sleep(1500 * (attempt + 1));
      continue;
    }

    if (res.ok) {
      let data;
      try {
        data = await res.json();
      } catch (err) {
        return { success: false, error: 'Invalid JSON from API', retryable: true };
      }
      const score = extractScore(data);
      if (score === undefined) {
        return { success: false, error: 'Unexpected API response format', retryable: false };
      }
      return { success: true, isRelevant: score > THRESHOLD, score };
    }

    if ((res.status === 503 || res.status === 429) && attempt < MAX_RETRIES) {
      await sleep(2000 * (attempt + 1));
      continue;
    }

    return {
      success: false,
      error: describeHttpError(res.status),
      retryable: res.status === 429 || res.status >= 500
    };
  }

  return { success: false, error: 'Unknown error', retryable: true };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.action !== 'classifyCloud') return;

  classify(request.title, request.topic)
    .then(sendResponse)
    .catch((err) =>
      sendResponse({ success: false, error: 'Background error: ' + err.message, retryable: true })
    );

  return true; 
});
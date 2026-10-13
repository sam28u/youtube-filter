// In content.js

// Use a cache object to store results
const relevanceCache = new Map();

// Helper to generate a consistent cache key
function cacheKey(title, topic) {
  return `${topic.toLowerCase()}|${title.toLowerCase()}`;
}

async function scan() {
  if (!topic || scanning) { pending = true; return; }
  scanning = true;
  pending = false;

  try {
    const videos = [...document.querySelectorAll(VIDEO_SELECTOR)]
      .filter(v => !v.dataset.affDone && getTitle(v));

    for (let i = 0; i < videos.length; i += BATCH_SIZE) {
      const batch = videos.slice(i, i + BATCH_SIZE);
      const titles = batch.map(getTitle);

      // Separate videos already in cache from those needing an API call
      const needed = [];
      const cachedResults = {};

      batch.forEach((v, idx) => {
        const title = titles[idx];
        const key = cacheKey(title, topic);

        // Check cache first
        if (relevanceCache.has(key)) {
          const isRelevant = relevanceCache.get(key);
          if (!isRelevant) v.classList.add('aff-hidden');
          v.dataset.affDone = '1';
          return; // Skip API call for this video
        }

        // Check for substring match (free win)
        if (title.toLowerCase().includes(topic.toLowerCase())) {
          relevanceCache.set(key, true); // Cache the result
          v.dataset.affDone = '1';
          return; // Skip API call
        }

        needed.push(idx);
      });

      if (!needed.length) continue;

      const res = await chrome.runtime.sendMessage({
        action: 'classifyBatch',
        titles: needed.map(idx => titles[idx]),
        topic
      });

      if (!res || !res.success) {
        setError(res?.error || 'Background script did not respond.');
        // On error, we don't cache the result, so it can be retried later
        return;
      }

      // Store new results in cache and apply them
      needed.forEach((idx, j) => {
        const video = batch[idx];
        const title = titles[idx];
        const key = cacheKey(title, topic);

        const isRelevant = res.results[j];
        relevanceCache.set(key, isRelevant);

        video.dataset.affDone = '1';
        if (!isRelevant) video.classList.add('aff-hidden');
      });

      setError('');
    }
  } finally {
    scanning = false;
    if (pending) scan();
  }
}

// Clear the cache when the topic changes
function load() {
  chrome.storage.local.get(['filterTopic'], (data) => {
    topic = (data.filterTopic || '').trim();
    relevanceCache.clear(); // Clear cache on topic change
    reset();
    if (topic) scan();
  });
}
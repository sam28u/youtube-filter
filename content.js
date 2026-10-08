(() => {
  'use strict';

  const CONCURRENCY = 3;
  const SCAN_THROTTLE_MS = 300;
  const FALLBACK_SCAN_MS = 2500; 
  const RETRY_DELAY_MS = 20000; 


  const VIDEO_SELECTOR = [
    'ytd-rich-item-renderer',
    'ytd-video-renderer',
    'ytd-compact-video-renderer',
    'ytd-grid-video-renderer',
    'yt-lockup-view-model:not(ytd-rich-item-renderer yt-lockup-view-model)'
  ].join(',');

  const TITLE_SELECTOR = '#video-title, .yt-lockup-metadata-view-model-wiz__title, h3';

  const state = {
    topic: '',
    generation: 0, 
    scanning: false,
    dirty: false,
    observer: null,
    timer: null,
    lastReportedError: undefined
  };

  const cache = new Map();
  const failed = new Map(); 

  const style = document.createElement('style');
  style.textContent = `
    .aff-pending { opacity: 0.25 !important; transition: opacity 0.2s ease; }
    .aff-hidden  { display: none !important; }
  `;
  (document.head || document.documentElement).appendChild(style);

  function getTitle(video) {
    const el = video.querySelector(TITLE_SELECTOR);
    if (!el) return '';
    return (el.getAttribute('title') || el.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);
  }

  function setVideoState(video, mode) {
    video.classList.remove('aff-pending', 'aff-hidden');
    if (mode === 'pending') video.classList.add('aff-pending');
    if (mode === 'hidden') video.classList.add('aff-hidden');
  }

  function clearAll() {
    document.querySelectorAll('.aff-pending, .aff-hidden').forEach((el) => {
      el.classList.remove('aff-pending', 'aff-hidden');
    });
    document.querySelectorAll('[data-focus-key]').forEach((el) => {
      delete el.dataset.focusKey;
    });
  }

  function reportError(message) {
    const value = message || '';
    if (value === state.lastReportedError) return;
    state.lastReportedError = value;
    try {
      chrome.storage.local.set({ lastError: value });
    } catch (err) {
    }
  }

  async function runPool(items, limit, worker) {
    let index = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (index < items.length) {
        const item = items[index++];
        await worker(item);
      }
    });
    await Promise.all(runners);
  }

  async function checkRelevance(title, topic) {
    if (title.toLowerCase().includes(topic.toLowerCase())) {
      return { relevant: true };
    }

    const cacheKey = `${topic}|${title}`;
    if (cache.has(cacheKey)) return { relevant: cache.get(cacheKey) };

    let res;
    try {
      res = await chrome.runtime.sendMessage({ action: 'classifyCloud', title, topic });
    } catch (err) {
      return { error: 'Extension was reloaded. Refresh this tab.', retryable: false };
    }

    if (!res) return { error: 'No response from background script', retryable: true };
    if (!res.success) return { error: res.error, retryable: !!res.retryable };

    cache.set(cacheKey, res.isRelevant);
    return { relevant: res.isRelevant };
  }

  async function scan() {
    if (!state.topic || document.hidden) return;
    if (state.scanning) {
      state.dirty = true;
      return;
    }

    state.scanning = true;
    const generation = state.generation;
    const topic = state.topic;

    try {
      const todo = [];
      const now = Date.now();

      document.querySelectorAll(VIDEO_SELECTOR).forEach((video) => {
        const title = getTitle(video);
        if (!title) return; 

        const key = `${topic}|${title}`;
        if (video.dataset.focusKey === key) return;
        if ((failed.get(key) || 0) > now) return;

        setVideoState(video, 'pending');
        todo.push({ video, title, key });
      });

      await runPool(todo, CONCURRENCY, async (item) => {
        if (generation !== state.generation) return;

        const result = await checkRelevance(item.title, topic);
        if (generation !== state.generation) return;

        if (getTitle(item.video) !== item.title) return;

        if (result.error) {
          setVideoState(item.video, null); 
          failed.set(item.key, result.retryable ? Date.now() + RETRY_DELAY_MS : Infinity);
          reportError(result.error);
          return;
        }

        reportError('');
        item.video.dataset.focusKey = item.key;
        setVideoState(item.video, result.relevant ? null : 'hidden');
      });
    } finally {
      state.scanning = false;
      if (state.dirty || generation !== state.generation) {
        state.dirty = false;
        scheduleScan(0);
      }
    }
  }

  function scheduleScan(delay = SCAN_THROTTLE_MS) {
    if (state.timer) return; 
    state.timer = setTimeout(() => {
      state.timer = null;
      scan();
    }, delay);
  }

  function startObserver() {
    if (state.observer || !document.body) return;
    state.observer = new MutationObserver(() => scheduleScan());
    state.observer.observe(document.body, { childList: true, subtree: true });
  }

  function stopObserver() {
    if (!state.observer) return;
    state.observer.disconnect();
    state.observer = null;
  }

  // ---------- Settings ----------
  function applySettings(items) {
    state.generation++;
    state.dirty = false;
    cache.clear();
    failed.clear();
    clearAll();

    state.topic = ((items && items.filterTopic) || '').trim();

    if (state.topic) {
      startObserver();
      scheduleScan(0);
    } else {
      stopObserver();
      reportError('');
    }
  }

  function loadSettings() {
    chrome.storage.local.get(['filterTopic', 'hfToken'], applySettings);
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if ('filterTopic' in changes || 'hfToken' in changes) loadSettings();
  });

  window.addEventListener('yt-navigate-finish', () => scheduleScan(0));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleScan(0);
  });
  setInterval(() => {
    if (state.topic) scheduleScan(0);
  }, FALLBACK_SCAN_MS);

  loadSettings();
})();
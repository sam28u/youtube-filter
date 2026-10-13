const keyEl = document.getElementById('api-key');
const fallbackKeyEl = document.getElementById('fallback-api-key');
const topicEl = document.getElementById('filter-topic');
const statusEl = document.getElementById('status-msg');
const errorEl = document.getElementById('error-msg');

let timer = null;

function showStatus(text) {
  statusEl.textContent = text;
  clearTimeout(timer);
  timer = setTimeout(() => (statusEl.textContent = ''), 3000);
}

function showError(text) { errorEl.textContent = text || ''; }

chrome.storage.local.get(
  ['apiKey', 'fallbackApiKey', 'filterTopic', 'lastError'],
  (data) => {
    if (data.apiKey) keyEl.value = data.apiKey;
    if (data.fallbackApiKey) fallbackKeyEl.value = data.fallbackApiKey;
    if (data.filterTopic) topicEl.value = data.filterTopic;
    showError(data.lastError);
  }
);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && 'lastError' in changes) showError(changes.lastError.newValue);
});

document.getElementById('save-btn').addEventListener('click', () => {
  const apiKey = keyEl.value.trim();
  const fallbackApiKey = fallbackKeyEl.value.trim();
  const filterTopic = topicEl.value.trim();

  if (!filterTopic) return showStatus('Enter a topic first');
  if (!apiKey) return showStatus('Add your Groq API key first');

  chrome.storage.local.set(
    { apiKey, fallbackApiKey, filterTopic, lastError: '' },
    () => showStatus('Filter applied')
  );
});

document.getElementById('clear-btn').addEventListener('click', () => {
  topicEl.value = '';
  chrome.storage.local.set({ filterTopic: '', lastError: '' });
  showStatus('Filter cleared');
});
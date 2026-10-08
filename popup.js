const tokenEl = document.getElementById('hf-token');
const topicEl = document.getElementById('filter-topic');
const statusEl = document.getElementById('status-msg');
const errorEl = document.getElementById('error-msg');

let statusTimer = null;

function showStatus(text) {
  statusEl.textContent = text;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    statusEl.textContent = '';
  }, 3000);
}

function showError(text) {
  errorEl.textContent = text || '';
}

chrome.storage.local.get(['hfToken', 'filterTopic', 'lastError'], (data) => {
  if (data.hfToken) tokenEl.value = data.hfToken;
  if (data.filterTopic) topicEl.value = data.filterTopic;
  showError(data.lastError);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && 'lastError' in changes) {
    showError(changes.lastError.newValue);
  }
});

document.getElementById('save-btn').addEventListener('click', () => {
  const hfToken = tokenEl.value.trim();
  const filterTopic = topicEl.value.trim();

  if (!filterTopic) {
    showStatus('Enter a topic first');
    return;
  }
  if (!hfToken) {
    showStatus('Add your Hugging Face token first');
    return;
  }

  chrome.storage.local.set({ hfToken, filterTopic, lastError: '' }, () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0] && tabs[0].url;
      if (url && url.includes('youtube.com')) {
        showStatus('Filter applied!');
      } else {
        showStatus('Saved. Open YouTube to see it in action.');
      }
    });
  });
});

document.getElementById('clear-btn').addEventListener('click', () => {
  topicEl.value = '';
  chrome.storage.local.set({ filterTopic: '', lastError: '' }, () => {
    showError('');
    showStatus('Filter cleared');
  });
});
# AI YouTube Focus Filter

A Chrome extension that uses AI to hide YouTube videos that do not match your chosen focus topic. It helps keep your feed aligned with the subjects you actually care about while reducing distraction.

## Features
- Smart relevance filtering using an LLM-based classifier
- Works with Groq as the primary provider and Cerebras as an optional fallback
- Automatically scans new videos as YouTube loads more content
- Avoids direct browser-to-YouTube API restrictions by using a Manifest V3 service worker
- Stores your API keys and topic locally in Chrome storage
- Shows clear status and error messages in the popup

## What it does
The extension watches the YouTube page for new video cards, sends each batch of titles to the AI provider, and hides anything below the relevance threshold. You can set a focus topic such as:

- Python tutorials
- Space documentaries
- Productivity and focus music
- Machine learning

## Installation
1. Clone or download this repository.
2. Open Google Chrome and go to `chrome://extensions/`.
3. Turn on Developer mode.
4. Click Load unpacked.
5. Select the root folder of this repository (the folder containing `manifest.json`).

## Setup
1. Click the extension icon in Chrome and pin the extension if needed.
2. Open the popup.
3. Add your Groq API key from the Groq Console.
4. Optionally add a Cerebras API key for fallback.
5. Enter your focus topic, such as `Learn Python` or `Space documentaries`.
6. Click Apply Filter.
7. Refresh YouTube or open a YouTube page to see the filter take effect.

## API providers
This project is currently configured to use:

- Primary: Groq (`https://api.groq.com/openai/v1/chat/completions`)
- Fallback: Cerebras (`https://api.cerebras.ai/v1/chat/completions`)

You can generate a Groq key here:
- https://console.groq.com/keys

You can generate a Cerebras key here:
- https://cloud.cerebras.ai

## Project structure
- `manifest.json` — Chrome extension manifest for Manifest V3
- `background.js` — service worker that calls the AI APIs and handles retries/fallbacks
- `content.js` — injected script that observes YouTube DOM changes and hides irrelevant videos
- `popup.html` — popup UI
- `popup.js` — handles popup form logic and saves settings

## Notes
- API keys are stored in `chrome.storage.local`.
- Filters are applied only to the YouTube page that matches the extension's content script permissions.
- The extension uses a relevance threshold of `0.5` by default.

## License
MIT License

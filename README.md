# AI YouTube Focus Filter 

A powerful Chrome Extension that uses AI (Zero-Shot Classification) to filter your YouTube feed, keeping you focused only on the topics you care about and removing distractions. 

##  Features
- **Smart Filtering:** Uses Hugging Face's `facebook/bart-large-mnli` model to semantically analyze video titles against your custom topic.
- **Dynamic DOM Scanning:** Automatically detects and filters new videos as you scroll through your YouTube feed without lagging your browser.
- **Highly Optimized:** Implements intelligent caching, concurrency limits, and exponential backoff retry logic to respect API rate limits.
- **CSP Compliant:** Utilizes a Manifest V3 Service Worker architecture to securely interact with the Hugging Face API, completely bypassing YouTube's strict Content Security Policy.
- **Error Handling:** Gracefully surfaces API errors (like invalid tokens or rate limits) directly in the extension popup.

##  Installation (Developer Mode)
1. Download or clone this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Toggle on **Developer mode** in the top right corner.
4. Click the **Load unpacked** button in the top left.
5. Select the `youtube-focus-purifier` folder.

##  Usage
1. Click the puzzle piece icon  in Chrome and pin the **AI YouTube Focus Filter** extension.
2. Open the extension popup.
3. Paste in a free [Hugging Face Access Token](https://huggingface.co/settings/tokens). 
   *(Note: Ensure your token has the **"Inference Providers"** permission checked!)*
4. Type in your desired **Topic** (e.g., "Python Tutorials", "Space", "Focus Music").
5. Click **Apply Filter**.
6. Open YouTube (or refresh the page) and watch the distracting videos disappear!

##  Architecture
- **`manifest.json`**: Configured for Manifest V3, requesting only necessary permissions (`storage`).
- **`content.js`**: Injected into YouTube. Uses a `MutationObserver` to watch for newly loaded video elements. Manages UI state, caching, and applies CSS to hide non-relevant videos.
- **`background.js`**: A Service Worker that acts as a secure proxy to the Hugging Face API, handling the heavy lifting of network requests, parsing results, and managing retry/backoff logic.
- **`popup.js` & `popup.html`**: The user interface that syncs preferences with `chrome.storage.local` and displays real-time status and error messages.

##  License
MIT License

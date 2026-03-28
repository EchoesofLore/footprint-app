// background.js — Footprint service worker.
// Holds decrypted vault items in chrome.storage.session for the duration of
// the browser session. Session storage is automatically cleared when the
// browser is closed, so no plaintext credentials persist on disk.

const SESSION_KEY = "footprint_session";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "STORE_VAULT") {
    const items = Array.isArray(message.items) ? message.items : [];
    chrome.storage.session.set({ [SESSION_KEY]: items }, () => {
      sendResponse({ ok: true, count: items.length });
    });
    return true; // keep the message channel open for the async callback
  }

  if (message.type === "GET_VAULT") {
    chrome.storage.session.get(SESSION_KEY, (result) => {
      const items = result[SESSION_KEY] ?? null;
      sendResponse({ ok: true, items });
    });
    return true;
  }

  if (message.type === "CLEAR_VAULT") {
    chrome.storage.session.remove(SESSION_KEY, () => {
      sendResponse({ ok: true });
    });
    return true;
  }
});

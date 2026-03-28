// content.js
// Runs on all pages. Receives FILL_CREDENTIALS messages from the popup
// and fills the username/email and password fields on the current page.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "FILL_CREDENTIALS") return;

  const { username, password } = message;
  let filled = false;

  const usernameField = findUsernameField();
  const passwordField = document.querySelector('input[type="password"]');

  if (usernameField && username) {
    setFieldValue(usernameField, username);
    filled = true;
  }

  if (passwordField && password) {
    setFieldValue(passwordField, password);
    filled = true;
  }

  sendResponse({ ok: true, filled });
  return true;
});

// Try selectors in priority order to find the best username/email field.
function findUsernameField() {
  const selectors = [
    'input[autocomplete="username"]',
    'input[autocomplete="email"]',
    'input[type="email"]',
    'input[name*="user" i]',
    'input[name*="email" i]',
    'input[id*="user" i]',
    'input[id*="email" i]',
    'input[type="text"]',
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el && isVisible(el)) return el;
  }

  return null;
}

// Use the native value setter so React/Vue/Angular synthetic events fire correctly.
function setFieldValue(el, value) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;

  if (nativeSetter) {
    nativeSetter.call(el, value);
  } else {
    el.value = value;
  }

  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function isVisible(el) {
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

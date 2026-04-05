// vault-bridge.js
// Runs on the vault page (localhost:3000/vault).
// Listens for the VAULT_DECRYPTED postMessage the vault emits on unlock/save,
// then forwards the decrypted items to the background service worker via
// chrome.runtime.sendMessage (primary) and localStorage (fallback).

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.source !== "footprint") return;

  if (event.data.type === "AUTOFILL_REQUEST") {
    const { username, password } = event.data.payload ?? {};
    console.log("[Footprint] Autofill request received from web app");
    chrome.runtime.sendMessage({ type: "AUTOFILL_REQUEST", username, password }).catch(() => {});
    return;
  }

  if (event.data.type !== "VAULT_DECRYPTED") return;

  const vault = event.data.vault;
  const entries = Array.isArray(vault?.entries) ? vault.entries : [];

  // Mirror the same shape as the vault's manual autofill export.
  const items = entries
    .filter((e) => !e.deletedAt)
    .map((e) => ({
      id: e.id,
      domain: e.domain || extractDomain(e.site) || "",
      site: e.site || "",
      username: e.username || "",
      password: e.password || "",
    }))
    .filter((x) => x.domain && x.username && x.password);

  // Primary: send to background service worker (survives popup close/reopen).
  chrome.runtime.sendMessage({ type: "STORE_VAULT", items }).catch(() => {
    // Background worker unavailable — localStorage fallback below is sufficient.
  });

  // Fallback: also write to localStorage so the popup can read it directly
  // via executeScript if the background worker is not available.
  const payload = {
    type: "footprint_autofill",
    version: 1,
    exportedAt: new Date().toISOString(),
    items,
  };
  localStorage.setItem("footprint_autofill", JSON.stringify(payload));
});

function extractDomain(site) {
  if (!site) return "";
  try {
    const url = site.startsWith("http") ? site : `https://${site}`;
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return site.toLowerCase().replace(/^www\./, "");
  }
}

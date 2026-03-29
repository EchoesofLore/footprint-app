// popup.js
document.addEventListener("DOMContentLoaded", () => {
  const openVaultBtn = document.getElementById("openVault");
  const siteEl = document.getElementById("site");
  const matchesEl = document.getElementById("matches");

  if (!siteEl || !matchesEl) return;

  if (openVaultBtn) {
    openVaultBtn.addEventListener("click", async () => {
      await chrome.tabs.create({ url: "https://footprint-app-gbag.vercel.app/vault" });
    });
  }

  initPopup();

  async function initPopup() {
    const activeTab = await getActiveTab();
    const url = activeTab?.url || "";
    let domain = "";

    try {
      domain = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      domain = "";
    }

    siteEl.textContent = domain || "unknown";

    const payload = await getAutofillPayload();

    if (!payload) {
      setStatus("Open and unlock your vault tab first.");
      return;
    }

    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      setStatus("No vault entries found.");
      return;
    }

    const matches = payload.items.filter((item) => {
      const itemDomain = (item.domain || "").toLowerCase();
      return (
        itemDomain &&
        domain &&
        (itemDomain === domain ||
          itemDomain.endsWith("." + domain) ||
          domain.endsWith("." + itemDomain))
      );
    });

    if (matches.length === 0) {
      setStatus(`No matches for ${domain || "this site"}.`);
      return;
    }

    matchesEl.innerHTML = "";

    for (const item of matches) {
      const card = document.createElement("div");
      card.className = "match-card";

      const info = document.createElement("div");
      info.className = "match-info";

      const siteDiv = document.createElement("div");
      siteDiv.className = "match-site";
      siteDiv.textContent = item.site || item.domain || "Unknown";

      const userDiv = document.createElement("div");
      userDiv.className = "match-user";
      userDiv.textContent = item.username || "";

      info.appendChild(siteDiv);
      info.appendChild(userDiv);

      const btn = document.createElement("button");
      btn.className = "autofill-btn";
      btn.textContent = "Fill";

      // Capture credentials in closure — never stored in DOM attributes.
      const username = item.username || "";
      const password = item.password || "";

      btn.addEventListener("click", async () => {
        try {
          if (!activeTab?.id) throw new Error("No active tab");

          await chrome.tabs.sendMessage(activeTab.id, {
            type: "FILL_CREDENTIALS",
            username,
            password,
          });

          btn.textContent = "Filled ✓";
          btn.classList.add("success");
          setTimeout(() => {
            btn.textContent = "Fill";
            btn.classList.remove("success");
          }, 2000);
        } catch {
          btn.textContent = "Failed";
          btn.classList.add("error");
          setTimeout(() => {
            btn.textContent = "Fill";
            btn.classList.remove("error");
          }, 2000);
        }
      });

      card.appendChild(info);
      card.appendChild(btn);
      matchesEl.appendChild(card);
    }
  }

  // Primary: ask the background service worker for cached session items.
  // Fallback: read localStorage directly from the vault tab via executeScript.
  async function getAutofillPayload() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_VAULT" });
      if (response?.items && response.items.length > 0) {
        return { items: response.items };
      }
    } catch {
      // Background worker not available — fall through to localStorage.
    }

    return readAutofillFromVaultTab();
  }

  async function readAutofillFromVaultTab() {
    try {
      const tabs = await chrome.tabs.query({});
      const vaultTab = tabs.find(
        (tab) => tab.url && tab.url.startsWith("https://footprint-app-gbag.vercel.app/vault")
      );

      if (!vaultTab?.id) return null;

      const results = await chrome.scripting.executeScript({
        target: { tabId: vaultTab.id },
        func: () => localStorage.getItem("footprint_autofill"),
      });

      const raw = results?.[0]?.result;
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  function setStatus(msg) {
    matchesEl.innerHTML = `<p class="status-msg">${msg}</p>`;
  }
});

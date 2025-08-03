// src/browser-polyfill.ts
var browser = (() => {
  if (typeof globalThis.browser !== "undefined") {
    const api = globalThis.browser;
    api._isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    api._isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    return api;
  }
  if (typeof globalThis.chrome !== "undefined" && globalThis.chrome.runtime) {
    const api = globalThis.chrome;
    api._isSafari = false;
    api._isIOS = false;
    return api;
  }
  console.error("No browser extension API found!");
  return {
    _isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent),
    _isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream,
    runtime: {
      onMessage: { addListener: () => {
      } },
      sendMessage: () => Promise.resolve(),
      getURL: (path) => path
    },
    storage: {
      sync: {
        get: () => Promise.resolve({}),
        set: () => Promise.resolve()
      },
      local: {
        get: () => Promise.resolve({}),
        set: () => Promise.resolve()
      }
    },
    action: {
      onClicked: { addListener: () => {
      } }
    },
    tabs: {
      sendMessage: () => Promise.resolve(),
      query: () => Promise.resolve([])
    }
  };
})();
if (typeof globalThis.browser === "undefined") {
  globalThis.browser = browser;
}
if (typeof globalThis.chrome === "undefined") {
  globalThis.chrome = browser;
}

// src/storage.ts
var SAFARI_STORAGE_LIMIT = 10 * 1024 * 1024;
var STORAGE_WARNING_THRESHOLD = 0.8;
var initialStorageValues = {
  annoProjectName: "",
  enableAutoInjection: true,
  debugMode: false,
  storageQuotaWarningThreshold: STORAGE_WARNING_THRESHOLD
};
async function loadSettings() {
  try {
    const syncData = await browser.storage.sync.get(initialStorageValues);
    const localData = await browser.storage.local.get();
    return { ...initialStorageValues, ...syncData, ...localData };
  } catch (error) {
    console.error("[storage] Failed to load settings:", error);
    return initialStorageValues;
  }
}
async function decryptApiKey(encryptedKey) {
  try {
    const combined = Uint8Array.from(atob(encryptedKey), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode("anno-safari-extension-key"),
      // Use the same secure key
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );
    const key = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: encoder.encode("anno-salt"),
        // Use the same salt
        iterations: 1e5,
        hash: "SHA-256"
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encrypted
    );
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error("[storage] Decryption failed:", error);
    return atob(encryptedKey);
  }
}

// src/popup.ts
async function getPageDataFromActiveTab() {
  return new Promise((resolve) => {
    browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id)
        return resolve(null);
      browser.tabs.sendMessage(tab.id, { type: "extractPageData" }, (res) => {
        resolve(res ?? null);
      });
    });
  });
}
async function requestSummaryFromBackground({ apiKey, model, text, url, maxTokens, temperature }) {
  return new Promise((resolve, reject) => {
    browser.runtime.sendMessage(
      {
        type: "generateSummary",
        apiKey,
        model,
        text,
        url,
        maxTokens,
        temperature
      },
      (res) => {
        if (res?.summary)
          return resolve(res.summary);
        reject(res?.error || "\u8981\u7D04\u751F\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
      }
    );
  });
}
function buildScrapboxBody({ summary, url, title }) {
  return [
    "> [chatgpt.icon] " + summary,
    `> [source.icon] [${url} \u30AF\u30EA\u30C3\u30D7\u5143]`,
    "> [tags] #anno #summary",
    "--",
    `> ${title}`
  ].join("\n");
}
async function postToScrapbox({ body, title }) {
  return new Promise((resolve, reject) => {
    browser.runtime.sendMessage(
      { type: "postToScrapbox", body, title },
      (res) => {
        if (res?.success)
          return resolve();
        reject(res?.error || "Scrapbox\u6295\u7A3F\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
      }
    );
  });
}
document.addEventListener("DOMContentLoaded", async () => {
  const clipBtn = document.getElementById("clip-btn");
  const openSettingsBtn = document.getElementById("open-settings-btn");
  const feedback = document.getElementById("feedback");
  const settings = await loadSettings();
  const project = settings.project || "";
  const apiKey = settings.encryptedApiKey ? await decryptApiKey(settings.encryptedApiKey) : "";
  console.log("Anno Settings:", {
    project: project || "\u672A\u8A2D\u5B9A",
    annoProjectName: settings.annoProjectName || "\u672A\u8A2D\u5B9A",
    hasApiKey: !!apiKey,
    allSettings: settings
  });
  if (!project || !apiKey) {
    clipBtn.style.display = "none";
    openSettingsBtn.style.display = "block";
    openSettingsBtn.addEventListener("click", () => {
      browser.runtime.openOptionsPage();
    });
    feedback.textContent = "\u521D\u56DE\u306FProject\u3068API Key\u306E\u8A2D\u5B9A\u304C\u5FC5\u8981\u3067\u3059";
    return;
  } else {
    clipBtn.style.display = "block";
    openSettingsBtn.style.display = "none";
  }
  document.getElementById("clip-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    feedback.textContent = "\u2026generating summary";
    clipBtn.disabled = true;
    const model = "gpt-4o";
    const maxTokens = settings.maxTokens || 160;
    const temperature = settings.temperature ?? 0.3;
    const autoInsert = settings.autoInsertSummary ?? true;
    const pageData = await getPageDataFromActiveTab();
    if (!pageData) {
      feedback.textContent = "\u672C\u6587\u62BD\u51FA\u306B\u5931\u6557\u3057\u307E\u3057\u305F";
      clipBtn.disabled = false;
      return;
    }
    let summary = "";
    try {
      summary = await requestSummaryFromBackground({
        apiKey,
        model,
        text: pageData.text,
        url: pageData.url,
        maxTokens,
        temperature
      });
      console.log("\u8981\u7D04", summary);
    } catch (e2) {
      feedback.textContent = `\u8981\u7D04\u751F\u6210\u30A8\u30E9\u30FC: ${e2}`;
      clipBtn.disabled = false;
      return;
    }
    const body = buildScrapboxBody({ summary, url: pageData.url, title: pageData.title });
    try {
      await postToScrapbox({ body, title: pageData.title });
      feedback.textContent = "done";
    } catch (e2) {
      feedback.textContent = `Scrapbox\u6295\u7A3F\u30A8\u30E9\u30FC: ${e2}`;
    }
    clipBtn.disabled = false;
  });
});
//# sourceMappingURL=popup.js.map

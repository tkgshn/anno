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

// src/scrapboxContent.ts
var handleDocumentChange = () => {
  if (!document.querySelector(".page")) {
    return;
  }
  mutationObserver.disconnect();
  const scriptElement = document.createElement("script");
  scriptElement.src = browser.runtime.getURL("dist/scrapboxUserScript.js");
  document.body.append(scriptElement);
};
var mutationObserver = new MutationObserver(handleDocumentChange);
handleDocumentChange();
mutationObserver.observe(document, {
  subtree: true,
  childList: true,
  characterData: true
});
//# sourceMappingURL=scrapboxContent.js.map

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

// src/annotation.ts
document.body.style.margin = "0px";
var searchParams = new URLSearchParams(location.search);
var id = searchParams.get("id");
if (!id) {
  throw new Error("id is empty. ");
}
var { [id]: iframeData } = await browser.storage.local.get(id);
var { url, description, iconURL, iconWidth, iconHeight } = iframeData;
var linkElement = document.createElement("a");
linkElement.href = url;
linkElement.rel = "noopener";
linkElement.target = "_blank";
linkElement.title = description;
linkElement.addEventListener("click", (event) => {
  event.preventDefault();
  const openMessage = { type: "URL_CHANGED", url };
  browser.runtime.sendMessage(openMessage);
});
var imageElement = document.createElement("img");
imageElement.src = iconURL;
imageElement.style.verticalAlign = "middle";
imageElement.style.width = `${iconWidth}px`;
imageElement.style.height = `${iconHeight}px`;
linkElement.append(imageElement);
document.body.append(linkElement);
//# sourceMappingURL=annotation.js.map

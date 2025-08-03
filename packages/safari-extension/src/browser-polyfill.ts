// Browser API compatibility layer with Safari-specific enhancements

// Type for Safari-specific properties
interface SafariExtensions {
  _isSafari?: boolean;
  _isIOS?: boolean;
}

// Create a browser API wrapper
export const browser = (() => {
  // Use native browser API if available (Safari)
  if (typeof (globalThis as any).browser !== 'undefined') {
    const api = (globalThis as any).browser;
    
    // Add Safari detection properties
    api._isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    api._isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    
    return api;
  }
  
  // Use chrome API if available (Chrome/Edge)
  if (typeof (globalThis as any).chrome !== 'undefined' && (globalThis as any).chrome.runtime) {
    const api = (globalThis as any).chrome;
    
    // Add Safari detection properties (will be false)
    api._isSafari = false;
    api._isIOS = false;
    
    return api;
  }
  
  // If neither is available, we're in a bad state
  console.error("No browser extension API found!");
  
  // Return a minimal mock to prevent crashes
  return {
    _isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent),
    _isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream,
    runtime: {
      onMessage: { addListener: () => {} },
      sendMessage: () => Promise.resolve(),
      getURL: (path: string) => path
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
      onClicked: { addListener: () => {} }
    },
    tabs: {
      sendMessage: () => Promise.resolve(),
      query: () => Promise.resolve([])
    }
  } as any;
})();

// Also export as chrome for compatibility
export const chrome = browser;

// Safari-specific API fallbacks and utilities
export const safariCompat = {
  // Safari doesn't support browser.runtime.openOptionsPage on iOS
  openOptionsPage: async (): Promise<void> => {
    try {
      if (browser.runtime.openOptionsPage && !browser._isIOS) {
        await browser.runtime.openOptionsPage();
      } else {
        // Fallback: open in new tab
        const optionsUrl = browser.runtime.getURL("options.html");
        await browser.tabs.create({ url: optionsUrl });
      }
    } catch (error) {
      console.error("[safariCompat] Failed to open options page:", error);
      // Last resort: try to open in current tab
      const optionsUrl = browser.runtime.getURL("options.html");
      window.open(optionsUrl, "_blank");
    }
  },
  
  // Check if running on Safari
  isSafari: (): boolean => browser._isSafari || false,
  
  // Check if running on iOS
  isIOS: (): boolean => browser._isIOS || false,
  
  // Safari storage fallbacks (Safari has 10MB limit vs Chrome's unlimited)
  safeStorageSet: async (items: Record<string, any>): Promise<void> => {
    try {
      await browser.storage.local.set(items);
    } catch (error: any) {
      if (error.message?.includes("quota")) {
        console.error("[safariCompat] Storage quota exceeded, attempting cleanup...");
        // Try to clear old data
        const keys = Object.keys(await browser.storage.local.get());
        if (keys.length > 100) {
          // Remove oldest entries (assuming keys have timestamps)
          const toRemove = keys.slice(0, Math.floor(keys.length * 0.2));
          await browser.storage.local.remove(toRemove);
          // Retry
          await browser.storage.local.set(items);
        }
      } else {
        throw error;
      }
    }
  },
  
  // Context menus compatibility (not supported on iOS)
  supportsContextMenus: (): boolean => {
    return !browser._isIOS && typeof browser.contextMenus !== "undefined";
  },
  
  // Permissions check with Safari fallbacks
  hasPermission: async (permission: string): Promise<boolean> => {
    if (!browser.permissions?.contains) {
      console.warn("[safariCompat] Permissions API not available");
      return false;
    }
    
    try {
      const result = await browser.permissions.contains({ permissions: [permission] });
      return result;
    } catch (error) {
      console.error(`[safariCompat] Failed to check permission ${permission}:`, error);
      return false;
    }
  }
};

// Make browser API available globally if needed
declare global {
  interface Window {
    browser?: any;
    chrome?: any;
  }
}

if (typeof (globalThis as any).browser === "undefined") {
  (globalThis as any).browser = browser;
}
if (typeof (globalThis as any).chrome === "undefined") {
  (globalThis as any).chrome = browser;
}
// Browser API compatibility layer with Safari-specific enhancements
import browserPolyfill from "webextension-polyfill";

// Type for Safari-specific properties
interface SafariExtensions {
  _isSafari?: boolean;
  _isIOS?: boolean;
}

// Create a type that combines browser API with Safari extensions
type SafariBrowserAPI = typeof browserPolyfill & SafariExtensions;

// Export the browser API with proper typing
export const browser: SafariBrowserAPI = (() => {
  const api = browserPolyfill as SafariBrowserAPI;
  
  // Detect Safari
  api._isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  api._isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  
  return api;
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
    browser?: typeof browserPolyfill;
    chrome?: typeof browserPolyfill;
  }
}

if (typeof (globalThis as any).browser === "undefined") {
  (globalThis as any).browser = browser;
}
if (typeof (globalThis as any).chrome === "undefined") {
  (globalThis as any).chrome = browser;
}
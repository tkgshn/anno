import { browser, safariCompat } from "./browser-polyfill";
import { loadSettings, cleanupStorage } from "./storage";
import {
  clearScrapboxLoaderCache,
  fetchAnnopages,
  extractAnnolink,
} from "scrapbox-loader";
import PQueue from "p-queue";
import type {
  ContentToBackgroundMessage,
  ExternalMessage,
  PopupToBackgroundMessage,
  BackgroundToContentMessage,
  InjectionData,
  InjectionPage,
  MessageResponse,
  ExtensionStatus,
} from "./types/messages";

// Constants
const IFRAME_ID_PREFIX = "iframe-";
const FETCH_QUEUE_INTERVAL = 5000; // 5 seconds
const FETCH_QUEUE_CAP = 5;
const ERROR_RETRY_DELAY = 1000; // 1 second
const MAX_RETRIES = 3;

// Queue for rate limiting fetch requests
const fetchQueue = new PQueue({
  interval: FETCH_QUEUE_INTERVAL,
  intervalCap: FETCH_QUEUE_CAP,
});

// Queued fetch with error handling
const queuedFetch: typeof fetch = async (input, init) => {
  try {
    return await fetchQueue.add(
      async () => {
        const response = await fetch(input, init);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response;
      },
      { throwOnTimeout: true }
    );
  } catch (error) {
    console.error("[background] Fetch failed:", error);
    throw error;
  }
};

// Error handling wrapper
async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string,
  retries = 0
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    console.error(`[background] ${context} failed:`, error);
    
    if (retries < MAX_RETRIES) {
      console.log(`[background] Retrying ${context} (${retries + 1}/${MAX_RETRIES})...`);
      await new Promise(resolve => setTimeout(resolve, ERROR_RETRY_DELAY * (retries + 1)));
      return withErrorHandling(operation, context, retries + 1);
    }
    
    // Send error to active tab if applicable
    try {
      const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id) {
        const errorMessage: BackgroundToContentMessage = {
          type: "UPDATE_SETTINGS",
          settings: { debugMode: true },
        };
        await browser.tabs.sendMessage(activeTab.id, errorMessage);
      }
    } catch (sendError) {
      console.error("[background] Failed to send error to tab:", sendError);
    }
    
    return null;
  }
}

// Mark selection in the current tab
async function markSelection(tabId: number): Promise<void> {
  const settings = await loadSettings();
  
  if (!settings.annoProjectName) {
    console.log("[background] No project name set, opening options page");
    await safariCompat.openOptionsPage();
    return;
  }
  
  const message: BackgroundToContentMessage = { type: "MARK_SELECTION" };
  await browser.tabs.sendMessage(tabId, message);
}

// Handle browser action click
browser.action.onClicked.addListener(async (tab) => {
  if (typeof tab.id !== "number") {
    console.error("[background] Invalid tab ID");
    return;
  }
  
  await withErrorHandling(
    () => markSelection(tab.id!),
    "Mark selection",
    0
  );
});

// Message handler with type safety
browser.runtime.onMessage.addListener(
  (
    message: ContentToBackgroundMessage | PopupToBackgroundMessage | ExternalMessage,
    sender: browser.runtime.MessageSender
  ): Promise<MessageResponse<any>> | void => {
    console.log("[background] Received message:", message.type);
    
    switch (message.type) {
      case "PAGE_LOADED":
        return handlePageLoaded(message, sender);
        
      case "URL_CHANGED":
        return handleUrlChanged(message, sender);
        
      case "ERROR":
        console.error("[background] Content script error:", message.error);
        return;
        
      case "GET_STATUS":
        return handleGetStatus();
        
      case "TOGGLE_MARKING":
        return handleToggleMarking(sender) as Promise<MessageResponse<any>>;
        
      case "COLLABORATE":
        return handleCollaborate(message, sender);
        
      case "PING":
        return Promise.resolve({ pong: true });
        
      default:
        console.warn("[background] Unknown message type:", (message as any).type);
    }
  }
);

// Handle page loaded
async function handlePageLoaded(
  message: ContentToBackgroundMessage & { type: "PAGE_LOADED" },
  sender: browser.runtime.MessageSender
): Promise<void> {
  if (!sender.tab?.id) return;
  
  await withErrorHandling(
    async () => {
      const settings = await loadSettings();
      if (settings.enableAutoInjection && message.url) {
        // Auto-inject annotations if enabled
        const injectionData = await fetchInjectionData(message.url);
        if (injectionData) {
          const injectMessage: BackgroundToContentMessage = {
            type: "INJECT_ANNOTATIONS",
            data: injectionData,
          };
          await browser.tabs.sendMessage(sender.tab!.id!, injectMessage);
        }
      }
    },
    "Handle page loaded"
  );
}

// Handle URL change
async function handleUrlChanged(
  message: ContentToBackgroundMessage & { type: "URL_CHANGED" },
  sender: browser.runtime.MessageSender
): Promise<void> {
  if (!sender.tab?.id) return;
  
  await withErrorHandling(
    async () => {
      const settings = await loadSettings();
      if (settings.enableAutoInjection && message.url) {
        const injectionData = await fetchInjectionData(message.url);
        if (injectionData) {
          const injectMessage: BackgroundToContentMessage = {
            type: "INJECT_ANNOTATIONS",
            data: injectionData,
          };
          await browser.tabs.sendMessage(sender.tab!.id!, injectMessage);
        }
      }
    },
    "Handle URL changed"
  );
}

// Get extension status
async function handleGetStatus(): Promise<ExtensionStatus> {
  const settings = await loadSettings();
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  
  const status: ExtensionStatus = {
    isActive: !!settings.annoProjectName,
    settings,
  };
  
  if (activeTab) {
    // Get annotation count from content script
    try {
      const response = await browser.tabs.sendMessage(activeTab.id!, {
        type: "GET_ANNOTATION_COUNT",
      });
      
      status.currentTab = {
        url: activeTab.url || "",
        hasAnnotations: response?.count > 0,
        annotationCount: response?.count || 0,
      };
    } catch (error) {
      // Content script might not be loaded
      status.currentTab = {
        url: activeTab.url || "",
        hasAnnotations: false,
        annotationCount: 0,
      };
    }
  }
  
  // Get storage usage
  try {
    const { getStorageInfo } = await import("./storage");
    const storageInfo = await getStorageInfo();
    status.storageUsage = {
      bytesUsed: storageInfo.bytesUsed,
      quotaBytes: storageInfo.quotaBytes,
    };
  } catch (error) {
    console.error("[background] Failed to get storage info:", error);
  }
  
  return status;
}

// Toggle marking
async function handleToggleMarking(
  sender: browser.runtime.MessageSender
): Promise<{ isActive: boolean }> {
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  
  if (!activeTab?.id) {
    throw new Error("No active tab found");
  }
  
  await markSelection(activeTab.id);
  return { isActive: true };
}

// Handle collaboration request from Scrapbox
async function handleCollaborate(
  message: ExternalMessage & { type: "COLLABORATE" },
  sender: browser.runtime.MessageSender
): Promise<void> {
  if (!sender.tab?.id || !sender.url?.includes("scrapbox.io")) {
    console.error("[background] Invalid collaboration request");
    return;
  }
  
  await withErrorHandling(
    async () => {
      const { projectName, pageTitle, annolinks } = message;
      console.log(`[background] Collaboration request for ${projectName}/${pageTitle}`);
      
      // Process annolinks and inject
      const injectionData: InjectionData = {
        annoProjectName: projectName,
        pageRecord: {},
        collaboratedPage: {
          projectName,
          title: pageTitle,
          configs: annolinks
            .map(link => extractAnnolink(link))
            .filter((extracted): extracted is NonNullable<typeof extracted> => extracted !== null)
            .map(extracted => ({
              textQuoteSelector: extracted.textQuoteSelector,
              markerText: extracted.markerText || "",
              iframes: [],
            })),
        },
      };
      
      const injectMessage: BackgroundToContentMessage = {
        type: "INJECT_ANNOTATIONS",
        data: injectionData,
      };
      await browser.tabs.sendMessage(sender.tab!.id!, injectMessage);
    },
    "Handle collaboration"
  );
}

// Fetch injection data for a URL
async function fetchInjectionData(url: string): Promise<InjectionData | null> {
  const settings = await loadSettings();
  if (!settings.annoProjectName) return null;
  
  try {
    const pages = await fetchAnnopages(
      settings.annoProjectName,
      { url },
      queuedFetch
    );
    
    if (!pages || pages.length === 0) return null;
    
    const pageRecord: Record<string, InjectionPage> = {};
    
    for (const page of pages) {
      const configs = page.lines
        .map(line => extractAnnolink(line.text))
        .filter((anno): anno is NonNullable<typeof anno> => anno !== null)
        .map(anno => ({
          textQuoteSelector: anno.textQuoteSelector,
          markerText: anno.markerText || "",
          iframes: anno.iframeUrls?.map((url) => ({
            url,
            width: 300,
            height: 200,
          })) || [],
        }));
      
      if (configs.length > 0) {
        pageRecord[page.title] = {
          projectName: settings.annoProjectName || "",
          title: page.title,
          configs,
        };
      }
    }
    
    return {
      annoProjectName: settings.annoProjectName || "",
      pageRecord,
    };
  } catch (error) {
    console.error("[background] Failed to fetch injection data:", error);
    return null;
  }
}

// Context menu setup
async function setupContextMenus(): Promise<void> {
  if (!safariCompat.supportsContextMenus()) {
    console.log("[background] Context menus not supported on this platform");
    return;
  }
  
  await withErrorHandling(
    async () => {
      await browser.contextMenus.removeAll();
      
      await browser.contextMenus.create({
        id: "anno-mark",
        title: "Mark with Anno",
        contexts: ["selection"],
      });
      
      browser.contextMenus.onClicked.addListener(async (info, tab) => {
        if (info.menuItemId === "anno-mark" && tab?.id) {
          await markSelection(tab.id);
        }
      });
    },
    "Setup context menus"
  );
}

// Storage cleanup on startup
async function performStartupCleanup(): Promise<void> {
  await withErrorHandling(
    async () => {
      await cleanupStorage();
      console.log("[background] Startup cleanup completed");
    },
    "Startup cleanup"
  );
}

// Initialize extension
async function initialize(): Promise<void> {
  console.log("[background] Initializing Safari extension...");
  
  await setupContextMenus();
  await performStartupCleanup();
  
  // Clear cache periodically
  setInterval(() => {
    clearScrapboxLoaderCache();
    console.log("[background] Cache cleared");
  }, 30 * 60 * 1000); // 30 minutes
  
  console.log("[background] Initialization complete");
}

// Start initialization
initialize().catch(error => {
  console.error("[background] Failed to initialize:", error);
});
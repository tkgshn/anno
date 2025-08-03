import { browser } from "./browser-polyfill";
import { encodeForScrapboxReadableLink } from "./url";
import { Annolink, getAnnolink } from "scrapbox-loader";
import { getCanonicalURL, injectByTextQuote } from "text-quote-injection";
import {
  TextQuoteSelector,
  getTextIndex,
  getTextRange,
  quoteText,
  textQuoteSelectorAll,
} from "text-quote-selector";

// Use unified message types
import type {
  BackgroundToContentMessage,
  ContentToBackgroundMessage,
  InjectionData,
  InjectionPage,
  ErrorInfo,
} from "./types/messages";

// Constants
const STYLE_ID = "anno-styles";
const SCROLL_TIMEOUT = 5000;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;

// Global state
let prevInjectionData: InjectionData | undefined;
let isHighlighted = false;
let prevURL: string | undefined;

// Error handling wrapper
async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string,
  retries = 0
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    const errorInfo: ErrorInfo = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context: { operation: context, retries },
      timestamp: Date.now(),
    };
    
    console.error(`[content] ${context} failed:`, errorInfo);
    
    // Send error to background
    const errorMessage: ContentToBackgroundMessage = {
      type: "ERROR",
      error: errorInfo,
    };
    
    try {
      await browser.runtime.sendMessage(errorMessage);
    } catch (sendError) {
      console.error("[content] Failed to report error to background:", sendError);
    }
    
    // Retry if applicable
    if (retries < MAX_RETRY_ATTEMPTS) {
      console.log(`[content] Retrying ${context} (${retries + 1}/${MAX_RETRY_ATTEMPTS})...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retries + 1)));
      return withErrorHandling(operation, context, retries + 1);
    }
    
    return null;
  }
}

// Initialize styles
function initializeStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  
  const styleElement = document.createElement("style");
  styleElement.id = STYLE_ID;
  styleElement.textContent = `
    .anno {
      &.barmap {
        all: unset;
        position: fixed;
        width: 16px;
        border-top: 8px solid transparent;
        border-bottom: 8px solid transparent;
        background-clip: padding-box;
        cursor: pointer;
        opacity: 0.5;
        z-index: 2147483647;
        transition: opacity 0.2s ease;
        
        &:hover {
          opacity: 0.8;
        }
      }

      &.icon {
        all: revert;
        border: none;
        vertical-align: text-bottom;
      }

      &.marker {
        all: revert;
        transition: background-color 0.2s ease;
      }
    }
  `;
  document.head.appendChild(styleElement);
}

// Mark selected text
const mark = async (): Promise<void> => {
  console.log("[content] mark() called");
  console.log("[content] prevInjectionData:", prevInjectionData);
  
  if (!prevInjectionData) {
    console.warn("[content] No injection data available for marking");
    // Create default injection data with fixed project name
    prevInjectionData = {
      annoProjectName: "tkgshn-private",
      pageRecord: {}
    };
    console.log("[content] Created default injection data");
  }

  await withErrorHandling(async () => {
    const title = document.title || new Date().toLocaleString();
    const headerLines: string[] = [];

    if (!prevInjectionData?.collaboratedPage) {
      const gyazoIDMatch = location.pathname.match(/^\/([0-9a-z]{32})$/);
      if (location.host.match(/^([0-9a-z\-]+\.)?gyazo.com$/) && gyazoIDMatch) {
        const response = await fetch(
          `/${encodeURIComponent(gyazoIDMatch[1])}.json`
        );
        if (!response.ok) {
          throw new Error(`Failed to fetch gyazo.com: ${response.status}`);
        }
        const { desc, metadata, permalink_url } = await response.json();

        headerLines.push(
          ...[
            `[${permalink_url} ${permalink_url}]`,
            desc || undefined,
            metadata.url
              ? metadata.title
                ? `[${metadata.title} ${metadata.url}]`
                : `[${metadata.url}]`
              : metadata.title,
            metadata.exif_normalized?.latitude &&
            `[N${metadata.exif_normalized.latitude},E${metadata.exif_normalized.longitude},Z17]`,
          ].flatMap((data) => (typeof data === "string" ? data.split("\n") : []))
        );
      } else {
        headerLines.push(`[${title} ${getCanonicalURL()}]`);

        // Extract metadata safely
        const metaTags = {
          ogImage: document.querySelector('meta[property="og:image" i]'),
          description: document.querySelector('meta[name="description" i]'),
          ogDescription: document.querySelector('meta[property="og:description" i]'),
          keywords: document.querySelector('meta[name="keywords" i]'),
        };

        const ogImageURL = metaTags.ogImage instanceof HTMLMetaElement ? metaTags.ogImage.content : null;
        if (ogImageURL) {
          headerLines.push(`[${ogImageURL}#.png]`);
        }

        const description = 
          (metaTags.ogDescription instanceof HTMLMetaElement && metaTags.ogDescription.content) ||
          (metaTags.description instanceof HTMLMetaElement && metaTags.description.content);
        if (description) {
          headerLines.push(...description.split("\n").map((line) => `> ${line}`));
        }

        const keywords = metaTags.keywords instanceof HTMLMetaElement ? metaTags.keywords.content : null;
        if (keywords) {
          headerLines.push(keywords);
        }
      }

      // Add date and icon
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = today.getMonth() + 1;
      const dd = today.getDate();
      const dateBracket = `[${yyyy}/${mm}/${dd}]`;
      headerLines.push(dateBracket);
      headerLines.push('[public.icon]');
      headerLines.push(
        `#annopage [${decodeURI(getAnnolink(getCanonicalURL()))}]`,
        ""
      );
    }

    await write({
      annopageLink: prevInjectionData.collaboratedPage ?? {
        projectName: prevInjectionData.annoProjectName,
        title,
      },
      headerLines,
      includesPrefix: true,
      includesSuffix: true,
      markerText:
        prevInjectionData?.collaboratedPage?.configs.at(-1)?.markerText || "🍀",
    });
  }, "Mark selection");
};

// Write to Scrapbox
const write = async ({
  annopageLink,
  headerLines,
  includesPrefix,
  includesSuffix,
  markerText,
}: {
  annopageLink: Annolink;
  headerLines: string[];
  includesPrefix: boolean;
  includesSuffix: boolean;
  markerText: string;
}): Promise<void> => {
  const lines = [...headerLines];

  const selection = getSelection();
  const isSelected =
    selection && !selection.isCollapsed && selection.rangeCount >= 1;
  
  console.log("[content] write() - selection:", {
    isSelected,
    isCollapsed: selection?.isCollapsed,
    rangeCount: selection?.rangeCount,
    selectedText: isSelected ? selection.toString() : null
  });
    
  if (isSelected) {
    const range = selection.getRangeAt(0);
    const textQuoteSelector = quoteText(
      getTextIndex(document.body),
      range
    );

    lines.push(
      `[${markerText} ${getCanonicalURL()}#${[
        `e=${encodeForScrapboxReadableLink(textQuoteSelector.exact)}`,
        ...(includesPrefix && textQuoteSelector.prefix
          ? [`p=${encodeForScrapboxReadableLink(textQuoteSelector.prefix)}`]
          : []),
        ...(includesSuffix && textQuoteSelector.suffix
          ? [`s=${encodeForScrapboxReadableLink(textQuoteSelector.suffix)}`]
          : []),
      ].join("&")}]`
    );
    
    lines.push(
      ...textQuoteSelector.exact
        .trim()
        .replaceAll(/^ +/gm, "")
        .replaceAll(/\n{2,}/g, "\n")
        .split("\n")
        .map((line) => `> ${line}`)
    );
  }

  const scrapboxUrl = `https://scrapbox.io/${encodeURIComponent(
    annopageLink.projectName
  )}/${encodeURIComponent(annopageLink.title)}?${new URLSearchParams({
    body: lines.join("\n"),
    followRename: "true",
  })}`;
  
  console.log("[content] Opening Scrapbox URL:", scrapboxUrl);
  
  const openMessage: ContentToBackgroundMessage = {
    type: "OPEN_TAB",
    url: scrapboxUrl,
  };
  
  await browser.runtime.sendMessage(openMessage);
  await new Promise((resolve) => setTimeout(resolve, SCROLL_TIMEOUT));
  prevURL = undefined;
  handleDocumentChange();
};

// Message handler
browser.runtime.onMessage.addListener(
  async (message: BackgroundToContentMessage): Promise<any> => {
    console.log("[content] Received message:", message.type);
    
    switch (message.type) {
      case "MARK_SELECTION":
        await mark();
        break;

      case "INJECT_ANNOTATIONS":
        await withErrorHandling(async () => {
          const configs = Object.values(
            message.data.pageRecord
          ).flatMap(({ configs }) => configs);

          injectByTextQuote(
            configs.map((config) => ({
              id: JSON.stringify(config),
              textQuoteSelector: config.textQuoteSelector,
              inject: (range) => createAnnotation(range, config),
            }))
          );

          prevInjectionData = message.data;
        }, "Inject annotations");
        break;

      case "CLEAR_ANNOTATIONS":
        clearAnnotations();
        prevInjectionData = undefined;
        break;

      case "UPDATE_SETTINGS":
        // Handle settings update if needed
        console.log("[content] Settings updated:", message.settings);
        break;

      default:
        console.warn("[content] Unknown message type:", (message as any).type);
    }
    
    // Special handling for annotation count requests
    if ((message as any).type === "GET_ANNOTATION_COUNT") {
      const annotations = document.querySelectorAll(".anno.marker");
      return { count: annotations.length };
    }
  }
);

// Create annotation elements
function createAnnotation(range: Range, config: any) {
  const textRange = getTextRange(range);
  const splittedStartTextNode = textRange.start.textNode.splitText(
    textRange.start.offset
  );
  const end =
    textRange.start.textNode === textRange.end.textNode
      ? {
          textNode: splittedStartTextNode,
          offset: textRange.end.offset - textRange.start.offset,
        }
      : textRange.end;
  end.textNode.splitText(end.offset);

  const splittedRange = new Range();
  splittedRange.setStart(splittedStartTextNode, 0);
  splittedRange.setEnd(end.textNode, end.offset);

  const textNodes: Text[] = [];
  const nodeIterator = document.createNodeIterator(
    splittedRange.commonAncestorContainer,
    NodeFilter.SHOW_TEXT
  );
  let currentNode;
  let isInRange = false;
  while ((currentNode = nodeIterator.nextNode())) {
    if (currentNode === splittedRange.startContainer) {
      isInRange = true;
    }

    if (isInRange && currentNode instanceof Text) {
      textNodes.push(currentNode);
    }

    if (currentNode === splittedRange.endContainer) {
      break;
    }
  }

  const colorMap = new Map([
    ["🟥", "hsl(0 100% 87.5%)"],
    ["🟧", "hsl(40 100% 87.5%)"],
    ["🟨", "hsl(60 100% 87.5%)"],
    ["🟩", "hsl(120 100% 87.5%)"],
    ["🟦", "hsl(240 100% 87.5%)"],
    ["🟪", "hsl(300 100% 87.5%)"],
    ["🟫", "hsl(0 25% 75%)"],
    ["⬛", "hsl(0 0% 75%)"],
    ["⬜", "transparent"],
  ]);
  
  const color = colorMap.get(config.markerText) ?? "hsl(120 50% 85%)";

  const markElements = textNodes.map((textNode) => {
    const markElement = document.createElement("mark");
    markElement.classList.add("anno", "marker");
    markElement.style.backgroundColor = color;

    textNode.after(markElement);
    markElement.append(textNode);
    return markElement;
  });

  const iframeElements = config.iframes.map((iframe: any) => {
    const iframeElement = document.createElement("iframe");
    iframeElement.src = iframe.url;
    iframeElement.sandbox.add(
      "allow-popups",
      "allow-popups-to-escape-sandbox",
      "allow-scripts"
    );
    iframeElement.classList.add("anno", "icon");
    iframeElement.style.width = `${iframe.width}px`;
    iframeElement.style.height = `${iframe.height}px`;
    return iframeElement;
  });
  
  markElements.at(-1)?.after(...iframeElements);

  // Find scrollable ancestor
  let ancestorElement =
    splittedRange.commonAncestorContainer instanceof Element
      ? splittedRange.commonAncestorContainer
      : splittedRange.commonAncestorContainer.parentElement;
      
  while (ancestorElement) {
    if (!ancestorElement.scrollTop) {
      ancestorElement.scrollTop = 1;
    }
    if (
      ancestorElement.scrollTop &&
      ancestorElement.scrollHeight > ancestorElement.clientHeight &&
      getComputedStyle(ancestorElement).overflowY !== "hidden"
    ) {
      break;
    }
    ancestorElement = ancestorElement.parentElement;
  }
  
  const scrollableAncestorElement = ancestorElement ?? document.documentElement;

  // Create barmap
  const barmapElement = document.createElement("button");
  barmapElement.classList.add("anno", "barmap");
  barmapElement.style.backgroundColor = color;
  barmapElement.setAttribute("aria-label", "Scroll to annotation");

  const nextRange = new Range();
  const firstTextNode = textNodes[0];
  const lastTextNode = textNodes[textNodes.length - 1];
  
  if (firstTextNode) {
    nextRange.setStart(firstTextNode, 0);
  }
  if (lastTextNode) {
    nextRange.setEnd(lastTextNode, lastTextNode.textContent?.length ?? 0);
  }

  barmapElement.addEventListener("click", () => {
    const { exact, prefix, suffix } = quoteText(
      getTextIndex(document.body),
      nextRange
    );

    const url = new URL(location.href);
    url.hash = `#${[
      `e=${encodeForScrapboxReadableLink(exact)}`,
      ...(prefix ? [`p=${encodeForScrapboxReadableLink(prefix)}`] : []),
      ...(suffix ? [`s=${encodeForScrapboxReadableLink(suffix)}`] : []),
    ].join("&")}`;
    
    history.pushState(null, "", url);
    prevURL = undefined;
    handleDocumentChange();
  });

  document.body.append(barmapElement);

  // Handle resize
  const handleResize = () => {
    const elements = [...markElements, ...iframeElements];
    const isVisible = elements.some((element) => element.offsetParent);

    if (!isVisible) {
      barmapElement.style.display = "none";
      return;
    }

    const scrollableAncestorDOMRect =
      scrollableAncestorElement === document.documentElement
        ? new DOMRect()
        : scrollableAncestorElement.getBoundingClientRect();
        
    const domRects = elements.map((element) =>
      element.getBoundingClientRect()
    );

    const top = Math.min(...domRects.map((domRect) => domRect.top));
    const bottom = Math.max(...domRects.map((domRect) => domRect.bottom));

    const clientTop =
      ((scrollableAncestorElement.scrollTop +
        (top - scrollableAncestorDOMRect.top)) /
        scrollableAncestorElement.scrollHeight) *
      scrollableAncestorElement.clientHeight;
      
    const clientBottom =
      ((scrollableAncestorElement.scrollTop +
        (bottom - scrollableAncestorDOMRect.top)) /
        scrollableAncestorElement.scrollHeight) *
      scrollableAncestorElement.clientHeight;

    barmapElement.style.display = "block";
    barmapElement.style.left = `${
      scrollableAncestorDOMRect.left +
      scrollableAncestorElement.clientWidth -
      16
    }px`;
    barmapElement.style.top = `${
      scrollableAncestorDOMRect.top + clientTop - 16
    }px`;
    barmapElement.style.height = `${Math.max(
      clientBottom - clientTop,
      4
    )}px`;
  };
  
  const resizeObserver = new ResizeObserver(handleResize);
  resizeObserver.observe(document.body);
  handleResize();

  return {
    range: nextRange,
    cleanUp: () => {
      resizeObserver.disconnect();
      markElements.forEach((markElement) => {
        markElement.after(...markElement.childNodes);
        markElement.remove();
      });
      iframeElements.forEach((iframeElement) => {
        iframeElement.remove();
      });
      barmapElement.remove();
    },
  };
}

// Clear all annotations
function clearAnnotations(): void {
  document.querySelectorAll(".anno").forEach((element) => {
    if (element.classList.contains("marker")) {
      element.after(...element.childNodes);
    }
    element.remove();
  });
}

// Highlight from URL hash
const highlight = (): void => {
  if (isHighlighted) return;

  let searchParams: URLSearchParams;
  try {
    searchParams = new URLSearchParams(location.hash.slice(1));
  } catch {
    return;
  }

  const exact = searchParams.get("e");
  if (!exact) return;

  const selection = getSelection();
  if (!selection) return;

  const results = textQuoteSelectorAll(getTextIndex(document.body), {
    exact,
    prefix: searchParams.get("p") ?? undefined,
    suffix: searchParams.get("s") ?? undefined,
  });
  
  const range = results[0]?.range;
  if (!range) return;

  selection.removeAllRanges();
  selection.addRange(range);
  
  const startElement =
    range.startContainer instanceof Element
      ? range.startContainer
      : range.startContainer.parentElement;
      
  startElement?.scrollIntoView({ block: "center", behavior: "smooth" });
  isHighlighted = true;
};

// Check for URL changes
const checkURLChange = (): void => {
  if (prevURL !== location.href) {
    const urlChangeMessage: ContentToBackgroundMessage = {
      type: "URL_CHANGED",
      url: getCanonicalURL(),
      prevInjectionData,
    };
    
    withErrorHandling(
      () => browser.runtime.sendMessage(urlChangeMessage),
      "Send URL change"
    );
    
    isHighlighted = false;
  }
  prevURL = location.href;
};

// Handle document changes
const handleDocumentChange = (): void => {
  checkURLChange();
  highlight();
};

// Initialize mutation observer
const mutationObserver = new MutationObserver(handleDocumentChange);

// Initialize on load
function initialize(): void {
  console.log("[content] Initializing anno content script...");
  console.log("[content] Current URL:", window.location.href);
  console.log("[content] Browser API available:", typeof browser !== 'undefined');
  
  initializeStyles();
  handleDocumentChange();
  
  mutationObserver.observe(document, {
    subtree: true,
    childList: true,
    characterData: true,
  });

  // Send page loaded message
  const pageLoadedMessage: ContentToBackgroundMessage = {
    type: "PAGE_LOADED",
    url: getCanonicalURL(),
  };
  
  withErrorHandling(
    () => browser.runtime.sendMessage(pageLoadedMessage),
    "Send page loaded"
  );
  
  console.log("[content] Initialization complete");
}

// Keyboard shortcut handler
document.body.addEventListener("pointerdown", async (event) => {
  const selection = getSelection();
  const selectedElement = document.elementFromPoint(
    event.clientX,
    event.clientY
  );
  
  if (
    !(event.ctrlKey || event.metaKey) ||
    !event.altKey ||
    !selection ||
    !selectedElement
  ) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const range = new Range();
  range.selectNode(selectedElement);
  selection.removeAllRanges();
  selection.addRange(range);

  await mark();
});

// Start initialization when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
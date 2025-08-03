// Unified message type definitions for type-safe communication

import type { TextQuoteSelector } from "text-quote-selector";
import type { Annolink } from "scrapbox-loader";

// Background to Content messages
export type BackgroundToContentMessage =
  | { type: "MARK_SELECTION" }
  | { type: "INJECT_ANNOTATIONS"; data: InjectionData }
  | { type: "CLEAR_ANNOTATIONS" }
  | { type: "UPDATE_SETTINGS"; settings: ExtensionSettings };

// Content to Background messages
export type ContentToBackgroundMessage =
  | { type: "PAGE_LOADED"; url: string }
  | { type: "SELECTION_MARKED"; selection: SelectionData }
  | { type: "ANNOTATION_CLICKED"; annotationId: string }
  | { type: "ERROR"; error: ErrorInfo }
  | { type: "URL_CHANGED"; url: string; prevInjectionData?: InjectionData };

// External messages (from Scrapbox)
export type ExternalMessage =
  | {
      type: "COLLABORATE";
      projectName: string;
      pageTitle: string;
      annolinks: string[];
    }
  | { type: "PING" };

// Popup to Background messages
export type PopupToBackgroundMessage =
  | { type: "GET_STATUS" }
  | { type: "TOGGLE_MARKING" }
  | { type: "OPEN_OPTIONS" };

// Background to Popup messages
export type BackgroundToPopupMessage =
  | { type: "STATUS"; data: ExtensionStatus }
  | { type: "MARKING_TOGGLED"; isActive: boolean };

// Unified message type with proper discrimination
export type Message =
  | BackgroundToContentMessage
  | ContentToBackgroundMessage
  | ExternalMessage
  | PopupToBackgroundMessage
  | BackgroundToPopupMessage;

// Response types
export type MessageResponse<T extends Message> = T extends { type: "GET_STATUS" }
  ? ExtensionStatus
  : T extends { type: "PING" }
  ? { pong: true }
  : void;

// Data structures
export interface InjectionData {
  annoProjectName: string;
  pageRecord: Record<string, InjectionPage>;
  collaboratedPage?: InjectionPage;
}

export interface InjectionPage {
  projectName: string;
  title: string;
  configs: AnnotationConfig[];
}

export interface AnnotationConfig {
  textQuoteSelector: TextQuoteSelector;
  markerText: string;
  iframes: IframeConfig[];
}

export interface IframeConfig {
  url: string;
  width: number;
  height: number;
}

export interface SelectionData {
  text: string;
  textQuoteSelector: TextQuoteSelector;
  pageUrl: string;
  timestamp: number;
}

export interface ExtensionSettings {
  annoProjectName?: string;
  enableAutoInjection?: boolean;
  debugMode?: boolean;
  storageQuotaWarningThreshold?: number;
}

export interface ExtensionStatus {
  isActive: boolean;
  currentTab?: {
    url: string;
    hasAnnotations: boolean;
    annotationCount: number;
  };
  settings: ExtensionSettings;
  storageUsage?: {
    bytesUsed: number;
    quotaBytes: number;
  };
}

export interface ErrorInfo {
  message: string;
  stack?: string;
  context?: Record<string, any>;
  timestamp: number;
}

// Type guards
export function isBackgroundToContentMessage(
  message: Message
): message is BackgroundToContentMessage {
  return ["MARK_SELECTION", "INJECT_ANNOTATIONS", "CLEAR_ANNOTATIONS", "UPDATE_SETTINGS"].includes(
    message.type
  );
}

export function isContentToBackgroundMessage(
  message: Message
): message is ContentToBackgroundMessage {
  return ["PAGE_LOADED", "SELECTION_MARKED", "ANNOTATION_CLICKED", "ERROR", "URL_CHANGED"].includes(
    message.type
  );
}

export function isExternalMessage(message: Message): message is ExternalMessage {
  return ["COLLABORATE", "PING"].includes(message.type);
}

// Message sender utility with proper typing
export async function sendMessage<T extends Message>(
  message: T,
  tabId?: number
): Promise<MessageResponse<T>> {
  const { browser } = await import("../browser-polyfill");
  
  try {
    if (tabId !== undefined) {
      return await browser.tabs.sendMessage(tabId, message);
    } else {
      return await browser.runtime.sendMessage(message);
    }
  } catch (error) {
    console.error("[sendMessage] Failed to send message:", error, message);
    throw error;
  }
}
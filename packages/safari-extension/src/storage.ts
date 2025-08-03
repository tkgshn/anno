import { browser, safariCompat } from "./browser-polyfill";
import type { ExtensionSettings } from "./types/messages";

// Safari storage limits
const SAFARI_STORAGE_LIMIT = 10 * 1024 * 1024; // 10MB
const STORAGE_WARNING_THRESHOLD = 0.8; // Warn at 80% usage

export const initialStorageValues: ExtensionSettings = {
  annoProjectName: "",
  enableAutoInjection: true,
  debugMode: false,
  storageQuotaWarningThreshold: STORAGE_WARNING_THRESHOLD,
};

export interface Settings extends ExtensionSettings {
  project?: string;
  encryptedApiKey?: string;
  maxTokens?: number;
  temperature?: number;
  autoInsertSummary?: boolean;
}

// Storage usage monitoring
export interface StorageInfo {
  bytesUsed: number;
  quotaBytes: number;
  percentUsed: number;
  isNearQuota: boolean;
}

/**
 * Get current storage usage information
 */
export async function getStorageInfo(): Promise<StorageInfo> {
  try {
    // Safari doesn't support browser.storage.local.getBytesInUse
    if ('getBytesInUse' in browser.storage.local && typeof browser.storage.local.getBytesInUse === 'function') {
      const bytesUsed = await browser.storage.local.getBytesInUse();
      const quotaBytes = SAFARI_STORAGE_LIMIT;
      const percentUsed = bytesUsed / quotaBytes;
      
      return {
        bytesUsed,
        quotaBytes,
        percentUsed,
        isNearQuota: percentUsed >= STORAGE_WARNING_THRESHOLD,
      };
    } else {
      // Fallback: estimate storage usage
      const allData = await browser.storage.local.get();
      const dataString = JSON.stringify(allData);
      const bytesUsed = new Blob([dataString]).size;
      const quotaBytes = SAFARI_STORAGE_LIMIT;
      const percentUsed = bytesUsed / quotaBytes;
      
      return {
        bytesUsed,
        quotaBytes,
        percentUsed,
        isNearQuota: percentUsed >= STORAGE_WARNING_THRESHOLD,
      };
    }
  } catch (error) {
    console.error("[storage] Failed to get storage info:", error);
    return {
      bytesUsed: 0,
      quotaBytes: SAFARI_STORAGE_LIMIT,
      percentUsed: 0,
      isNearQuota: false,
    };
  }
}

/**
 * Load settings from browser storage with error handling
 */
export async function loadSettings(): Promise<Settings> {
  try {
    // Try sync storage first (smaller quota but syncs across devices)
    const syncData = await browser.storage.sync.get(initialStorageValues);
    
    // Merge with local storage for larger data
    const localData = await browser.storage.local.get();
    
    return { ...initialStorageValues, ...syncData, ...localData } as Settings;
  } catch (error) {
    console.error("[storage] Failed to load settings:", error);
    return initialStorageValues as Settings;
  }
}

/**
 * Save settings to browser storage with Safari compatibility
 */
export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  try {
    // Separate small settings for sync storage
    const syncSettings: Partial<Settings> = {
      annoProjectName: settings.annoProjectName,
      enableAutoInjection: settings.enableAutoInjection,
      debugMode: settings.debugMode,
    };
    
    // Large data goes to local storage
    const localSettings: Partial<Settings> = {
      project: settings.project,
      encryptedApiKey: settings.encryptedApiKey,
      maxTokens: settings.maxTokens,
      temperature: settings.temperature,
      autoInsertSummary: settings.autoInsertSummary,
    };
    
    // Remove undefined values
    const cleanSyncSettings = Object.fromEntries(
      Object.entries(syncSettings).filter(([_, v]) => v !== undefined)
    );
    const cleanLocalSettings = Object.fromEntries(
      Object.entries(localSettings).filter(([_, v]) => v !== undefined)
    );
    
    // Save to appropriate storage
    if (Object.keys(cleanSyncSettings).length > 0) {
      await browser.storage.sync.set(cleanSyncSettings);
    }
    
    if (Object.keys(cleanLocalSettings).length > 0) {
      await safariCompat.safeStorageSet(cleanLocalSettings);
    }
    
    // Check storage usage after save
    const storageInfo = await getStorageInfo();
    if (storageInfo.isNearQuota) {
      console.warn(
        `[storage] Storage usage is at ${(storageInfo.percentUsed * 100).toFixed(1)}% of quota`
      );
    }
  } catch (error) {
    console.error("[storage] Failed to save settings:", error);
    throw error;
  }
}

/**
 * Clear old or unnecessary data to free up storage
 */
export async function cleanupStorage(): Promise<void> {
  try {
    const storageInfo = await getStorageInfo();
    if (!storageInfo.isNearQuota) {
      return;
    }
    
    console.log("[storage] Cleaning up storage...");
    
    // Get all stored data
    const allData = await browser.storage.local.get();
    const keys = Object.keys(allData);
    
    // Identify old or large entries (customize based on your data structure)
    const keysToRemove: string[] = [];
    
    for (const key of keys) {
      // Remove old cache entries (assuming they have timestamps)
      if (key.startsWith("cache_") && allData[key]?.timestamp) {
        const age = Date.now() - allData[key].timestamp;
        if (age > 7 * 24 * 60 * 60 * 1000) { // 7 days
          keysToRemove.push(key);
        }
      }
      
      // Remove large entries that aren't critical
      const dataSize = new Blob([JSON.stringify(allData[key])]).size;
      if (dataSize > 100 * 1024 && !isEssentialData(key)) { // 100KB
        keysToRemove.push(key);
      }
    }
    
    if (keysToRemove.length > 0) {
      await browser.storage.local.remove(keysToRemove);
      console.log(`[storage] Removed ${keysToRemove.length} entries`);
    }
  } catch (error) {
    console.error("[storage] Cleanup failed:", error);
  }
}

/**
 * Check if a storage key contains essential data
 */
function isEssentialData(key: string): boolean {
  const essentialKeys = [
    "annoProjectName",
    "encryptedApiKey",
    "settings",
    "userPreferences",
  ];
  
  return essentialKeys.some(essential => key.includes(essential));
}

/**
 * Encrypt API key using Web Crypto API
 */
export async function encryptApiKey(apiKey: string): Promise<string> {
  try {
    // Generate a key from a passphrase (in production, use a secure key)
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode("anno-safari-extension-key"), // Use a secure key in production
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: encoder.encode("anno-salt"), // Use a random salt in production
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    
    // Encrypt the API key
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(apiKey)
    );
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    // Convert to base64
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error("[storage] Encryption failed:", error);
    // Fallback to simple encoding (not secure)
    return btoa(apiKey);
  }
}

/**
 * Decrypt API key using Web Crypto API
 */
export async function decryptApiKey(encryptedKey: string): Promise<string> {
  try {
    // Convert from base64
    const combined = Uint8Array.from(atob(encryptedKey), c => c.charCodeAt(0));
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    // Generate the same key
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode("anno-safari-extension-key"), // Use the same secure key
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: encoder.encode("anno-salt"), // Use the same salt
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    
    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encrypted
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error("[storage] Decryption failed:", error);
    // Fallback to simple decoding
    return atob(encryptedKey);
  }
}
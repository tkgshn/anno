// Simple test background script for Safari extension
console.log("=== Anno Safari Extension Test Background Script ===");
console.log("Background script loaded at:", new Date().toISOString());

// Check if browser API is available
if (typeof browser !== 'undefined') {
  console.log("✓ Browser API is available");
  
  // Check specific APIs
  console.log("browser.action available:", typeof browser.action !== 'undefined');
  console.log("browser.runtime available:", typeof browser.runtime !== 'undefined');
  console.log("browser.tabs available:", typeof browser.tabs !== 'undefined');
  console.log("browser.storage available:", typeof browser.storage !== 'undefined');
  
  // Set up action click handler
  if (browser.action && browser.action.onClicked) {
    browser.action.onClicked.addListener((tab) => {
      console.log("=== Action clicked! ===");
      console.log("Tab info:", tab);
      
      // Try to send a message to the content script
      if (tab.id) {
        browser.tabs.sendMessage(tab.id, { type: "TEST_MESSAGE" })
          .then(() => console.log("Message sent successfully"))
          .catch(err => console.error("Failed to send message:", err));
      }
    });
    console.log("✓ Action click handler registered");
  } else {
    console.error("✗ browser.action.onClicked not available");
  }
  
  // Set up message handler
  if (browser.runtime && browser.runtime.onMessage) {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log("Message received:", message);
      console.log("From sender:", sender);
      return true;
    });
    console.log("✓ Message handler registered");
  }
} else {
  console.error("✗ Browser API not available!");
}

console.log("=== Background script initialization complete ===");
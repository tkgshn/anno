// src/options.ts
var FIXED_PROJECT_NAME = "tkgshn-private";
async function initializeOptions() {
  console.log("Options page loaded");
  const browserAPI = window.browser || window.chrome;
  if (!browserAPI || !browserAPI.storage) {
    console.error("Browser storage API not available");
    updateUI(FIXED_PROJECT_NAME, true);
    return;
  }
  try {
    const syncData = await browserAPI.storage.sync.get(null);
    const localData = await browserAPI.storage.local.get(null);
    const settings = { ...syncData, ...localData };
    console.log("Current settings:", settings);
    if (settings.project !== FIXED_PROJECT_NAME || settings.annoProjectName !== FIXED_PROJECT_NAME) {
      console.log("Setting fixed project name:", FIXED_PROJECT_NAME);
      await browserAPI.storage.sync.set({
        project: FIXED_PROJECT_NAME,
        annoProjectName: FIXED_PROJECT_NAME
      });
    }
    updateUI(FIXED_PROJECT_NAME);
    if (settings.encryptedApiKey) {
      const apiStatusElement = document.getElementById("api-status");
      if (apiStatusElement) {
        apiStatusElement.textContent = "Configured";
        apiStatusElement.className = "value success";
      }
    }
    console.log("Settings initialized with project:", FIXED_PROJECT_NAME);
    if (browserAPI.runtime && browserAPI.runtime.sendMessage) {
      browserAPI.runtime.sendMessage({
        type: "settingsUpdated",
        settings: {
          project: FIXED_PROJECT_NAME,
          annoProjectName: FIXED_PROJECT_NAME
        }
      }).catch((error) => {
        console.log("Background notification skipped:", error);
      });
    }
  } catch (error) {
    console.error("Failed to initialize settings:", error);
    const statusElement = document.getElementById("status");
    if (statusElement) {
      statusElement.textContent = "Error loading settings";
      statusElement.className = "value warning";
    }
  }
}
function updateUI(projectName, isStatic = false) {
  const projectNameElement = document.getElementById("project-name");
  const statusElement = document.getElementById("status");
  const apiStatusElement = document.getElementById("api-status");
  if (projectNameElement) {
    projectNameElement.textContent = projectName;
    projectNameElement.className = "value success";
  }
  if (statusElement) {
    statusElement.textContent = isStatic ? "Static Mode" : "Ready";
    statusElement.className = "value success";
  }
  if (apiStatusElement) {
    apiStatusElement.textContent = "Not configured";
    apiStatusElement.className = "value";
  }
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeOptions);
} else {
  initializeOptions();
}
//# sourceMappingURL=options.js.map

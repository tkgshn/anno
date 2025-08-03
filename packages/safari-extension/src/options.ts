// 固定のプロジェクト名
const FIXED_PROJECT_NAME = "tkgshn-private";

// 初期化関数
async function initializeOptions() {
  console.log("Options page loaded");
  
  // browser APIの取得（Safari互換性のため）
  const browserAPI = (window as any).browser || (window as any).chrome;
  
  // APIが利用できない場合は静的な表示
  if (!browserAPI || !browserAPI.storage) {
    console.error("Browser storage API not available");
    updateUI(FIXED_PROJECT_NAME, true);
    return;
  }
  
  try {
    // 既存の設定を読み込み（直接Storage APIを使用）
    const syncData = await browserAPI.storage.sync.get(null);
    const localData = await browserAPI.storage.local.get(null);
    const settings = { ...syncData, ...localData };
    console.log("Current settings:", settings);
    
    // プロジェクト名が設定されていない場合、または異なる場合は固定値を保存
    if (settings.project !== FIXED_PROJECT_NAME || settings.annoProjectName !== FIXED_PROJECT_NAME) {
      console.log("Setting fixed project name:", FIXED_PROJECT_NAME);
      await browserAPI.storage.sync.set({
        project: FIXED_PROJECT_NAME,
        annoProjectName: FIXED_PROJECT_NAME
      });
    }
    
    // UI要素を更新
    updateUI(FIXED_PROJECT_NAME);
    
    // API Keyが設定されている場合は更新
    if (settings.encryptedApiKey) {
      const apiStatusElement = document.getElementById("api-status");
      if (apiStatusElement) {
        apiStatusElement.textContent = "Configured";
        apiStatusElement.className = "value success";
      }
    }
    
    // 設定が完了したことをコンソールに表示
    console.log("Settings initialized with project:", FIXED_PROJECT_NAME);
    
    // バックグラウンドスクリプトにも通知
    if (browserAPI.runtime && browserAPI.runtime.sendMessage) {
      browserAPI.runtime.sendMessage({
        type: "settingsUpdated",
        settings: {
          project: FIXED_PROJECT_NAME,
          annoProjectName: FIXED_PROJECT_NAME
        }
      }).catch((error: any) => {
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

// UI更新関数
function updateUI(projectName: string, isStatic: boolean = false) {
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

// DOMが読み込まれるのを待ってから実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeOptions);
} else {
  // すでに読み込まれている場合は直接実行
  initializeOptions();
}

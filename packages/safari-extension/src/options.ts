import { browser } from "./browser-polyfill";
import { loadSettings, saveSettings, encryptApiKey } from "./storage";

// ページ読み込み時に設定を表示
document.addEventListener("DOMContentLoaded", async () => {
  // 既存の設定を読み込み
  const settings = await loadSettings();
  
  // プロジェクト名の入力フィールド
  const projectNameInput = document.querySelector("#anno-project-name-input") as HTMLInputElement;
  if (!projectNameInput) {
    throw new Error("Couldn't find the project name input element");
  }
  
  // 設定値を表示
  projectNameInput.value = settings.project || settings.annoProjectName || "";
  
  // API Key入力フィールドを追加（HTMLにも追加が必要）
  const apiKeyInput = document.querySelector("#api-key-input") as HTMLInputElement;
  if (apiKeyInput && settings.encryptedApiKey) {
    // 暗号化されているので、入力済みであることだけ表示
    apiKeyInput.placeholder = "API Key は設定済みです";
  }
  
  // 保存状態を表示する要素
  const statusElement = document.querySelector("#save-status");
  
  // 入力時に自動保存
  projectNameInput.addEventListener("input", async () => {
    try {
      await saveSettings({
        project: projectNameInput.value,
        annoProjectName: projectNameInput.value // 互換性のため両方に保存
      });
      
      if (statusElement) {
        statusElement.textContent = "✓ 保存しました";
        setTimeout(() => {
          statusElement.textContent = "";
        }, 2000);
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      if (statusElement) {
        statusElement.textContent = "保存に失敗しました";
      }
    }
  });
  
  // API Key入力時の処理
  if (apiKeyInput) {
    apiKeyInput.addEventListener("input", async () => {
      if (apiKeyInput.value) {
        try {
          const encrypted = await encryptApiKey(apiKeyInput.value);
          await saveSettings({
            encryptedApiKey: encrypted
          });
          
          if (statusElement) {
            statusElement.textContent = "✓ API Keyを保存しました";
            apiKeyInput.value = ""; // セキュリティのためクリア
            apiKeyInput.placeholder = "API Key は設定済みです";
            setTimeout(() => {
              statusElement.textContent = "";
            }, 2000);
          }
        } catch (error) {
          console.error("Failed to save API key:", error);
          if (statusElement) {
            statusElement.textContent = "API Keyの保存に失敗しました";
          }
        }
      }
    });
  }
});

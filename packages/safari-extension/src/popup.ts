// Anno Safari拡張 Popup UI ロジック雛形
// JSDoc付き

import { browser } from "./browser-polyfill";
import { loadSettings, saveSettings, encryptApiKey, decryptApiKey, Settings } from "./storage";

/**
 * 現在のアクティブタブにextractPageDataメッセージを送り、本文データを取得
 */
async function getPageDataFromActiveTab(): Promise<{ title: string; url: string; text: string } | null> {
    return new Promise((resolve) => {
        browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab?.id) return resolve(null);
            browser.tabs.sendMessage(tab.id, { type: "extractPageData" }, (res) => {
                resolve(res ?? null);
            });
        });
    });
}

/**
 * backgroundに要約生成リクエストを送り、要約を受け取る
 */
async function requestSummaryFromBackground({ apiKey, model, text, url, maxTokens, temperature }: {
    apiKey: string;
    model: string;
    text: string;
    url: string;
    maxTokens: number;
    temperature: number;
}): Promise<string> {
    return new Promise((resolve, reject) => {
        browser.runtime.sendMessage(
            {
                type: "generateSummary",
                apiKey,
                model,
                text,
                url,
                maxTokens,
                temperature,
            },
            (res) => {
                if (res?.summary) return resolve(res.summary);
                reject(res?.error || "要約生成に失敗しました");
            }
        );
    });
}

/**
 * Scrapbox投稿用フォーマットを生成
 */
function buildScrapboxBody({ summary, url, title }: { summary: string; url: string; title: string }): string {
    return [
        '> [chatgpt.icon] ' + summary,
        `> [source.icon] [${url} クリップ元]`,
        '> [tags] #anno #summary',
        '--',
        `> ${title}`,
    ].join('\n');
}

/**
 * backgroundにScrapbox投稿リクエストを送る
 */
async function postToScrapbox({ body, title }: { body: string; title: string }): Promise<void> {
    return new Promise((resolve, reject) => {
        browser.runtime.sendMessage(
            { type: "postToScrapbox", body, title },
            (res) => {
                if (res?.success) return resolve();
                reject(res?.error || "Scrapbox投稿に失敗しました");
            }
        );
    });
}

/**
 * Popupフォームの初期化・イベントハンドラ登録
 */
document.addEventListener("DOMContentLoaded", async () => {
    const clipBtn = document.getElementById("clip-btn") as HTMLButtonElement;
    const openSettingsBtn = document.getElementById("open-settings-btn") as HTMLButtonElement;
    const feedback = document.getElementById("feedback") as HTMLDivElement;

    // 設定値をbrowser.storageから取得
    const settings: Settings = await loadSettings();
    const project = settings.project || "";
    const apiKey = settings.encryptedApiKey ? await decryptApiKey(settings.encryptedApiKey) : "";
    
    // デバッグ用：設定内容をコンソールに出力
    console.log("Anno Settings:", {
        project: project || "未設定",
        annoProjectName: settings.annoProjectName || "未設定",
        hasApiKey: !!apiKey,
        allSettings: settings
    });

    // 設定未完了ならClipボタン非表示＆設定ボタン表示
    if (!project || !apiKey) {
        clipBtn.style.display = "none";
        openSettingsBtn.style.display = "block";
        openSettingsBtn.addEventListener("click", () => {
            browser.runtime.openOptionsPage();
        });
        feedback.textContent = "初回はProjectとAPI Keyの設定が必要です";
        return;
    } else {
        clipBtn.style.display = "block";
        openSettingsBtn.style.display = "none";
    }

    // Clipボタン押下時の処理（既存の要約・投稿フローをここに）
    document.getElementById("clip-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        feedback.textContent = "…generating summary";
        clipBtn.disabled = true;

        // モデルは常にgpt-4oに固定
        const model = "gpt-4o";
        const maxTokens = settings.maxTokens || 160;
        const temperature = settings.temperature ?? 0.3;
        const autoInsert = settings.autoInsertSummary ?? true;

        // 本文データをcontent scriptから取得
        const pageData = await getPageDataFromActiveTab();
        if (!pageData) {
            feedback.textContent = "本文抽出に失敗しました";
            clipBtn.disabled = false;
            return;
        }

        // backgroundに要約生成リクエスト
        let summary = "";
        try {
            summary = await requestSummaryFromBackground({
                apiKey,
                model,
                text: pageData.text,
                url: pageData.url,
                maxTokens,
                temperature,
            });
            console.log("要約", summary);
        } catch (e) {
            feedback.textContent = `要約生成エラー: ${e}`;
            clipBtn.disabled = false;
            return;
        }

        // Scrapbox投稿用フォーマット生成
        const body = buildScrapboxBody({ summary, url: pageData.url, title: pageData.title });
        try {
            await postToScrapbox({ body, title: pageData.title });
            feedback.textContent = "done";
        } catch (e) {
            feedback.textContent = `Scrapbox投稿エラー: ${e}`;
        }
        clipBtn.disabled = false;
    });
});

/**
 * 今後の拡張ポイント:
 * - browser.storageとの連携
 * - AES-GCM暗号化/復号
 * - OpenAI API呼び出し
 * - i18n対応
 */

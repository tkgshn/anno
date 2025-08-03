# Anno Chrome 拡張 ストレージ設計 & API Key 暗号化方式

## 1. 保存対象とスキーマ

### 保存対象

- OpenAI API Key（暗号化）
- モデル選択（例: gpt-3.5-turbo, gpt-4o）
- Max Tokens, Temperature（詳細設定）
- 要約自動挿入 ON/OFF

### スキーマ例

```json
{
  "openai": {
    "encryptedApiKey": "...base64...", // AES-GCM暗号化済み
    "model": "gpt-3.5-turbo",
    "maxTokens": 160,
    "temperature": 0.3,
    "autoInsertSummary": true
  }
}
```

- `chrome.storage.sync`（PC 間同期）
- `chrome.storage.local`（ローカルバックアップ）

## 2. API Key 暗号化保存方式

### 暗号化方式

- アルゴリズム: AES-GCM
- キー生成: `chrome.identity.getProfileUserInfo().email` を SHA-256 でハッシュ化し、暗号化キーとする
- IV: ランダム生成（12 バイト）
- 保存形式: `{iv: base64, ciphertext: base64}` を JSON 化し、base64 エンコード

### 暗号化フロー

1. `chrome.identity.getProfileUserInfo().email` 取得
2. email を SHA-256 でハッシュ化 → 32 バイトキー生成
3. ランダム IV 生成
4. AES-GCM で API Key を暗号化
5. `{iv, ciphertext}` を JSON 化し、base64 で保存

### 復号フロー

1. email 取得 →SHA-256 でキー生成
2. 保存値を base64 デコード →JSON パース
3. IV と暗号文で AES-GCM 復号

### 注意点

- email が変わると復号不可（再設定必要）
- Popup/Options 以外に API Key を露出しない
- console.log 等で API Key を出力しない

## 3. バックアップ・同期

- `chrome.storage.sync`に保存し、同期失敗時は`chrome.storage.local`にもバックアップ
- 読み出し時は sync→local の順で参照

## 4. 参考

- [Chrome 拡張ストレージ API](https://developer.chrome.com/docs/extensions/reference/storage/)
- [Web Crypto API AES-GCM](https://developer.mozilla.org/ja/docs/Web/API/SubtleCrypto/encrypt)

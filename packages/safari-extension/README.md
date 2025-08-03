# anno Safari Extension

WebページにアノテーションをつけてScrapboxに保存するSafari拡張機能です。

## Chrome拡張機能からSafari拡張機能への移植手順

### 前提条件
- macOS 12.0以降
- Safari 15.4以降
- Xcode 12以降（またはXcode-beta）
- Node.js/npm
- Apple Developer Account（無料版でも可）

### 手順

#### 1. リポジトリのクローンと依存関係のインストール

```bash
# リポジトリをクローン
git clone https://github.com/hata6502/anno.git
cd anno

# 依存関係をインストール
npm install
```

#### 2. Safari拡張機能パッケージの作成

##### 2.1 ディレクトリ構造の作成
```bash
mkdir -p packages/safari-extension/src
mkdir -p packages/safari-extension/public/images
```

##### 2.2 package.jsonの作成
```bash
cd packages/safari-extension
```

`package.json`を作成：
```json
{
  "name": "safari-extension",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "node build.js",
    "convert": "xcrun safari-web-extension-converter --bundle-identifier jp.anno.safari --force dist",
    "test": "tsc --noEmit"
  },
  "dependencies": {
    "webextension-polyfill": "^0.10.0"
  },
  "devDependencies": {
    "@types/webextension-polyfill": "^0.10.7",
    "esbuild": "^0.19.5",
    "typescript": "^5.1.6"
  }
}
```

##### 2.3 ビルドスクリプトの作成
`build.js`を作成し、Chrome拡張機能のビルドスクリプトを参考に実装

##### 2.4 manifest.jsonの作成
Chrome版の`manifest.json`をベースに、Safari互換性のための修正を加える：
- `browser_specific_settings`を追加
- 高解像度アイコン（512px, 1024px）の参照を追加

#### 3. ソースコードの移植

##### 3.1 browser-polyfill.tsの作成
```typescript
import browser from "webextension-polyfill";
export { browser, browser as chrome };
```

##### 3.2 Chrome拡張機能のソースコードをコピー
```bash
cp -r ../chrome-extension/src/* src/
cp ../chrome-extension/popup.html .
cp -r ../chrome-extension/public/images/* public/images/
```

##### 3.3 API互換性の修正
すべてのソースファイルで以下の変更を実施：
- `chrome.*` API呼び出しを `browser.*` に置換
- 各ファイルの先頭に `import { browser } from "./browser-polyfill";` を追加

#### 4. 環境変数の設定

`.env`ファイルを作成：
```
EXTENSION_ID=jp.anno.safari
```

#### 5. ビルドとSafari Web Extensionへの変換

##### 5.1 依存関係のインストール
```bash
npm install
```

##### 5.2 拡張機能のビルド
```bash
npm run build
```

##### 5.3 Xcodeプロジェクトへの変換
```bash
# Xcodeがインストールされている場合
npm run convert

# Xcode-betaを使用する場合は、先に以下を実行
sudo xcode-select -s /path/to/Xcode-beta.app/Contents/Developer
```

#### 6. Xcodeでのビルドと署名

1. 生成された`anno.xcodeproj`をXcodeで開く
2. 左サイドバーで「anno」プロジェクトを選択
3. 「Signing & Capabilities」タブで：
   - 「Team」ドロップダウンから開発チームを選択（個人のApple IDでも可）
   - 必要に応じて「Add an Account...」からアカウントを追加
4. ターゲットデバイスが「My Mac」になっていることを確認
5. Product → Build（⌘B）でビルド

#### 7. Safariで拡張機能を有効化

1. Safari → 設定 → 拡張機能を開く
2. 左側のリストから「anno」を探す
3. チェックボックスをオンにして有効化
4. 必要に応じて権限を許可

#### 8. 開発者向け設定（オプション）

デバッグが必要な場合：
1. Safari → 設定 → 詳細
2. 「メニューバーに"開発"メニューを表示」をチェック
3. 開発メニューから「未署名の拡張機能を許可」を選択（開発時のみ）

### トラブルシューティング

#### エラー: "Embedded binary is not signed with the same certificate"
- Xcodeで正しい開発チームが選択されているか確認
- Build Settingsで署名設定が正しいか確認

#### エラー: "safari-web-extension-converter not found"
- Xcodeがインストールされているか確認
- `xcode-select -p`で正しいXcodeパスが設定されているか確認
- 必要に応じて`sudo xcode-select -s /path/to/Xcode.app/Contents/Developer`を実行

## 使い方

1. Safari > 設定 > 拡張機能 > anno > 設定 でScrapboxプロジェクト名を設定
2. Webページ上で`Alt+N`を押すか、ツールバーアイコンをクリック
3. テキストを選択してマーキング
4. Scrapboxに自動的に保存される

## 既知の問題

- 高解像度アイコン（512px、1024px）は仮のものです。正式なアイコンの作成が必要です
- webRequest APIの制限により、一部の機能はChrome版と異なる場合があります
- `persistent`フラグはSafariでサポートされていませんが、機能に影響はありません

## Chrome版との違い

- `chrome.*` APIの代わりに `browser.*` APIを使用（webextension-polyfillによる互換性レイヤー）
- Safari App Extensionコンテナアプリが必要
- App Store経由での配布が必要（エンタープライズ配布を除く）
- Chrome版とSafari版でAPIの制限により一部機能が異なる場合があります
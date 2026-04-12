# テスト実装計画

> anyfolio-web のテスト戦略と進捗管理

---

## 方針

- **ユニットテスト**: Vitest + React Testing Library + jsdom
- **E2Eテスト**: Playwright（未導入）
- テストしやすい純粋関数 → hooks → コンポーネント → E2E の順で段階的に拡充する
- カバレッジ目標: hooks と変換ロジックを優先的にカバー

---

## Phase 1: テスト基盤の構築 ✅ 完了

### 導入済みパッケージ

| パッケージ | 用途 |
|-----------|------|
| `vitest` | テストランナー |
| `jsdom` | DOM 環境 |
| `@testing-library/react` | React コンポーネントテスト |
| `@testing-library/dom` | DOM テストユーティリティ |
| `@testing-library/jest-dom` | カスタムマッチャー |
| `unified`, `remark-parse`, `@types/mdast` | remark-wikilink テスト用 |

### 設定済み

- `vite.config.ts` に `test` ブロック追加（jsdom 環境、globals 有効）
- `src/test/setup.ts` で jest-dom マッチャー読み込み
- `package.json` に `test` / `test:watch` スクリプト追加

---

## Phase 2: 純粋関数のユニットテスト ✅ 完了

| テストファイル | テスト対象 | テスト数 | 状態 |
|--------------|-----------|---------|------|
| `src/lib/__tests__/utils.test.ts` | `cn()` — クラス名マージ | 6 | ✅ |
| `src/lib/__tests__/remark-wikilink.test.ts` | WikiLink パーサー | 5 | ✅ |
| `src/lib/__tests__/docx-to-txt.test.ts` | DOCX → TXT 変換（mock） | 3 | ✅ |
| `src/lib/__tests__/text-extraction.test.ts` | テキスト抽出・キャッシュ（mock） | 6 | ✅ |
| `src/lib/__tests__/pptx-helpers.test.ts` | XML パース・EMU 変換・スタイル解析 | 30 | ✅ |

### リファクタリング

- `pptx-to-pdf.ts` から純粋ヘルパー関数と型定義を `pptx-helpers.ts` に切り出し
  - テスト可能化のため export 化
  - `pptx-to-pdf.ts` は `pptx-helpers.ts` からインポートする形に変更

**合計: 50 テスト / 5 ファイル**

---

## Phase 3: hooks のユニットテスト（未着手）

`@testing-library/react` の `renderHook` を使用。Supabase クライアントは mock する。

| テストファイル | テスト対象 | 主なテスト観点 |
|--------------|-----------|--------------|
| `src/hooks/__tests__/use-files.test.ts` | `useFiles` | ファイル一覧取得、フィルタ、エラーハンドリング |
| `src/hooks/__tests__/use-folders.test.ts` | `useFolders` | フォルダツリー取得、CRUD操作 |
| `src/hooks/__tests__/use-all-files.test.ts` | `useAllFiles` | 全ファイル取得 |
| `src/hooks/__tests__/use-content-search.test.ts` | `useContentSearch` | デバウンス、RPC 呼び出し、検索結果 |

### 補助

| テストファイル | テスト対象 | 主なテスト観点 |
|--------------|-----------|--------------|
| `src/lib/__tests__/backfill-content-text.test.ts` | `backfillContentText` | 非同期キュー処理、エラー時のリトライ |

---

## Phase 4: コンポーネントのユニットテスト（未着手）

### ビューア（優先度高）

| テストファイル | テスト対象 | 主なテスト観点 |
|--------------|-----------|--------------|
| `src/components/file-viewer/__tests__/markdown-viewer.test.tsx` | MarkdownViewer | Markdown レンダリング、WikiLink 表示 |
| `src/components/file-viewer/__tests__/text-viewer.test.tsx` | TextViewer | テキスト表示、エンコーディング |
| `src/components/file-viewer/__tests__/image-viewer.test.tsx` | ImageViewer | 画像表示、ズーム |
| `src/components/file-viewer/__tests__/pdf-viewer.test.tsx` | PdfViewer | PDF 読み込み（mock） |
| `src/components/file-viewer/__tests__/excel-viewer.test.tsx` | ExcelViewer | Excel データ表示（mock） |
| `src/components/file-viewer/__tests__/pptx-viewer.test.tsx` | PptxViewer | 変換・表示フロー（mock） |

### レイアウト・ダイアログ（優先度中）

| テストファイル | テスト対象 | 主なテスト観点 |
|--------------|-----------|--------------|
| `src/components/__tests__/sidebar.test.tsx` | Sidebar | フォルダツリー表示、D&D、検索 |
| `src/components/__tests__/upload-dialog.test.tsx` | UploadDialog | ファイル選択、アップロードフロー |
| `src/components/__tests__/content-search-dialog.test.tsx` | ContentSearchDialog | 検索 UI、キーボードショートカット |
| `src/components/__tests__/protected-route.test.tsx` | ProtectedRoute | 認証ガード、リダイレクト |

---

## Phase 5: E2E テスト（未着手）

### 導入が必要なパッケージ

| パッケージ | 用途 |
|-----------|------|
| `@playwright/test` | E2E テストフレームワーク |

### テストシナリオ

| シナリオ | 内容 |
|---------|------|
| 認証フロー | サインアップ、ログイン、ログアウト、未認証時リダイレクト |
| ファイルアップロード | 各形式（md, txt, pdf, docx, xlsx, pptx, 画像）のアップロード |
| ファイル閲覧 | 各ビューアでのファイル表示確認 |
| フォルダ操作 | 作成、リネーム、削除、D&D 移動 |
| コンテンツ検索 | Cmd+K で検索ダイアログ、全文検索の結果表示 |

---

## 実行コマンド

```bash
# ユニットテスト（全件）
npm test

# ウォッチモード
npm run test:watch

# E2E テスト（Phase 5 導入後）
npx playwright test
```

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

## Phase 3: hooks のユニットテスト ✅ 完了

`@testing-library/react` の `renderHook` を使用。Supabase クライアントは共通モックヘルパー
`src/test/supabase-mock.ts` を経由して mock する。

| テストファイル | テスト対象 | テスト数 | 状態 |
|--------------|-----------|---------|------|
| `src/hooks/__tests__/use-folders.test.ts` | `useFolders` — CRUD・循環防止 | 10 | ✅ |
| `src/hooks/__tests__/use-all-files.test.ts` | `useAllFiles` — 全件取得・エラー処理 | 3 | ✅ |
| `src/hooks/__tests__/use-files.test.ts` | `useFiles` — フィルタ・アップロード・変換・CRUD | 12 | ✅ |
| `src/hooks/__tests__/use-content-search.test.ts` | `useContentSearch` — デバウンス・RPC・リセット | 8 | ✅ |
| `src/lib/__tests__/backfill-content-text.test.ts` | `backfillContentText` — 非同期キュー・エラー継続 | 7 | ✅ |

**合計: 40 テスト / 5 ファイル追加（Phase 全体: 91 テスト / 10 ファイル）**

---

## Phase 4: コンポーネントのユニットテスト ✅ 完了

`@testing-library/react` の `render` + `screen` + `userEvent` を使用。重い外部ライブラリ
（react-pdf / xlsx / JSZip など）は `vi.mock` で置き換える。

### ビューア

| テストファイル | テスト対象 | テスト数 | 状態 |
|--------------|-----------|---------|------|
| `src/components/file-viewer/__tests__/text-viewer.test.tsx` | TextViewer — ダウンロード・表示・エラー | 3 | ✅ |
| `src/components/file-viewer/__tests__/image-viewer.test.tsx` | ImageViewer — createObjectURL・表示・エラー | 3 | ✅ |
| `src/components/file-viewer/__tests__/markdown-viewer.test.tsx` | MarkdownViewer — MD レンダリング・リンク・エラー | 4 | ✅ |
| `src/components/file-viewer/__tests__/excel-viewer.test.tsx` | ExcelViewer — テーブル表示・シートタブ切替 | 5 | ✅ |
| `src/components/file-viewer/__tests__/pdf-viewer.test.tsx` | PdfViewer — ページ遷移・初期ページ・ズーム操作 | 6 | ✅ |
| `src/components/file-viewer/__tests__/pptx-viewer.test.tsx` | PptxViewer — スライドパース・遷移・エラー | 5 | ✅ |

### レイアウト・ダイアログ

| テストファイル | テスト対象 | テスト数 | 状態 |
|--------------|-----------|---------|------|
| `src/components/__tests__/protected-route.test.tsx` | ProtectedRoute — 認証ガード・リダイレクト | 3 | ✅ |
| `src/components/__tests__/upload-dialog.test.tsx` | UploadDialog — ダイアログ開閉・D&Dアップロード・エラー | 4 | ✅ |
| `src/components/__tests__/content-search-dialog.test.tsx` | ContentSearchDialog — 結果表示・ハイライト・キー操作 | 7 | ✅ |
| `src/components/layout/__tests__/sidebar.test.tsx` | Sidebar — フォルダ/ファイル表示・検索・作成・折りたたみ | 8 | ✅ |

**合計: 48 テスト / 10 ファイル追加（Phase 全体: 139 テスト / 20 ファイル）**

### 注意点

- MarkdownViewer の **WikiLink 機能は未テスト**：react-markdown v10 のデフォルト URL フィルターが `wikilink://` スキームを空文字に置換するため、コンポーネント経由でのテストが成立しない。本番での動作確認とコンポーネント実装（`urlTransform` 追加など）の見直しが別途必要。

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

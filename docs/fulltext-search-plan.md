# フルテキスト検索 Phase A 実装計画

> クライアントサイドでファイル内容を全文検索する機能の実装計画

---

## 概要

サイドバーのファイル名検索とは独立した検索ダイアログで、ファイルの内容を全文検索する。`Cmd+K`（Mac）/ `Ctrl+K`（Windows）のショートカットで起動するモーダルダイアログ形式。

---

## 新規作成ファイル（3つ）

| # | ファイル | 役割 |
|---|---------|------|
| 1 | `src/lib/text-extraction.ts` | テキスト抽出ユーティリティ + メモリ内キャッシュ |
| 2 | `src/hooks/use-content-search.ts` | 検索ロジック（デバウンス・並行ダウンロード・マッチング） |
| 3 | `src/components/content-search-dialog.tsx` | 検索ダイアログUI |

## 修正ファイル（1つ）

| # | ファイル | 変更内容 |
|---|---------|---------|
| 4 | `src/pages/dashboard.tsx` | `Cmd+K`ショートカット追加、ダイアログ配置 |

---

## 各ファイルの詳細

### 1. `src/lib/text-extraction.ts`

テキスト抽出とキャッシュを担当するユーティリティモジュール。

**インターフェース:**

```ts
const textCache = new Map<string, string>()

export function clearTextCache(): void
export function isTextCached(storagePath: string): boolean
export async function extractText(file: FileRecord): Promise<string>
```

**ファイル形式別の抽出方法:**

| ファイル形式 | 抽出方法 |
|------------|---------|
| md / txt | Blob → `encoding-japanese` でエンコーディング検出 → 文字列化 |
| pdf | `pdfjs-dist` の `getDocument` → 各ページの `getTextContent()` → テキスト結合 |
| xlsx | `xlsx` ライブラリで `sheet_to_csv` → 全シート結合 |

- `.docx` はアップロード時に `.txt` に変換済みのため追加対応不要
- ダウンロードパターン: `supabase.storage.from("anyfolio-files").download(file.storage_path)`
- キャッシュはモジュールレベルの `Map`（セッション中のみ保持）
- PDF worker URLの設定は `pdf-viewer.tsx` と同じ `GlobalWorkerOptions.workerSrc` パターンを使用

### 2. `src/hooks/use-content-search.ts`

検索のオーケストレーションを担当するReactフック。

**インターフェース:**

```ts
type SearchResult = {
  file: FileRecord
  folderName: string | null
  matchContext: string        // マッチ箇所の前後約30文字
  matchIndex: number          // テキスト内のマッチ位置
  query: string               // 検索キーワード（ハイライト用）
}

type ContentSearchState = {
  query: string
  setQuery: (q: string) => void
  results: SearchResult[]
  isExtracting: boolean
  extractionProgress: { done: number; total: number }
}

export function useContentSearch(
  allFiles: FileRecord[],
  folders: Folder[],
  enabled: boolean              // ダイアログが開いている時のみ有効
): ContentSearchState
```

**動作:**

1. `enabled` が `true` になった時、未キャッシュのファイルのテキスト抽出を開始
2. 並行ダウンロード数は最大3（ネットワーク負荷を抑制）
3. 進捗を `extractionProgress` で管理
4. 入力を300msデバウンス（`useRef` + `setTimeout`）
5. 大文字小文字を区別しない部分一致検索
6. マッチ箇所の前後約30文字のコンテキストスニペットを生成（単語境界でトリム、省略記号付加）
7. 結果は最大50件に制限
8. フォルダ名は `folders` 配列から `Map<id, name>` を構築して解決

### 3. `src/components/content-search-dialog.tsx`

検索ダイアログのUIコンポーネント。

**インターフェース:**

```tsx
type ContentSearchDialogProps = {
  allFiles: FileRecord[]
  folders: Folder[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectFile: (file: FileRecord) => void
}
```

**使用する既存コンポーネント:**

- shadcn `Dialog`（`src/components/ui/dialog.tsx`）
- `Input`（`src/components/ui/input.tsx`）
- `ScrollArea`（`src/components/ui/scroll-area.tsx`）
- lucide-react アイコン（`Search`, `FileText`, `FileSpreadsheet`, `File`）

**UI構成:**

```
┌─────────────────────────────────────────────┐
│ 🔍 ファイル内容を検索...              [ESC] │
├─────────────────────────────────────────────┤
│ Indexing files... (12/30)                   │（抽出中のみ表示）
├─────────────────────────────────────────────┤
│ 📄 ファイル名.md — フォルダ名               │
│   ...マッチした箇所のプレビュー...           │
│                                             │
│ 📄 ファイル名.pdf — フォルダ名              │
│   ...マッチした箇所のプレビュー...           │
└─────────────────────────────────────────────┘
```

**キーボード操作:**

- 上下キー: 選択項目の移動
- Enter: 選択ファイルを開く
- ESC: ダイアログを閉じる

**空状態の表示:**

- クエリ未入力: 「Type to search file contents」
- 結果なし: 「No matches found」
- 抽出中: 「Indexing files...」

**設計判断:** `cmdk` (shadcn Command) は不使用。理由: 非同期テキスト抽出・カスタムマッチプレビュー・ハイライトなど、cmdkの抽象化と合わないカスタムロジックが多い。Dialog + Input + ScrollArea で十分制御可能。

### 4. `src/pages/dashboard.tsx` の修正

**変更内容:**

1. `searchOpen` state を追加
2. `Cmd+K` / `Ctrl+K` のキーボードイベントリスナーを `useEffect` で登録
3. `ContentSearchDialog` をレンダリング、`onSelectFile` で既存の `handleNavigateToFile` を呼び出す

```tsx
<ContentSearchDialog
  allFiles={allFiles}
  folders={folders}
  open={searchOpen}
  onOpenChange={setSearchOpen}
  onSelectFile={(file) => {
    handleNavigateToFile(file)
    setSearchOpen(false)
  }}
/>
```

---

## 実装順序

```
1. text-extraction.ts  （React非依存、独立してテスト可能）
   ↓
2. use-content-search.ts（抽出ユーティリティに依存）
   ↓
3. content-search-dialog.tsx（フックに依存）
   ↓
4. dashboard.tsx の修正（ダイアログを統合）
```

---

## 技術的な注意点

### PDF worker の初期化

`text-extraction.ts` でも `pdfjs-dist` の worker URL を設定する必要がある。`pdf-viewer.tsx` と同じ `new URL(...)` パターンで `GlobalWorkerOptions.workerSrc` を設定する。

### エンコーディング検出

`.txt` ファイルは `text-viewer.tsx` と同じ `encoding-japanese` パターンで日本語エンコーディング（Shift_JIS等）を正しく検出する。

### メモリ考慮

個人利用のアプリのため、全ファイルのテキストキャッシュは数MB程度に収まる想定。将来的に問題になればLRUキャッシュに変更可能。

### 新規依存パッケージ

不要。`pdfjs-dist`, `xlsx`, `encoding-japanese` は全て既存の依存関係。

---

## Phase B への移行パス

Phase A の実装後、以下の手順で DB 全文検索に移行する（別計画として策定予定）:

1. `anyfolio_files` テーブルに `content_text` (text) と `content_tsv` (tsvector) カラムを追加
2. アップロード時にテキスト抽出して `content_text` に保存
3. Supabase RPC でサーバーサイド全文検索を実行
4. `use-content-search.ts` の検索ロジックを RPC 呼び出しに差し替え
5. `text-extraction.ts` のクライアントサイド抽出はアップロード時のみ使用に変更

---

*作成日: 2026-04-07*

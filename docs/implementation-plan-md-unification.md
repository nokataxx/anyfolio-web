# 実装計画：Markdown統一化 + 編集機能

> `.txt` / `.docx` / `.doc` をアップロード時にMarkdownへ変換する仕様への移行と、その上に乗せるMarkdown編集機能の実装計画。

## 前提・背景

- 現状: `.docx` はテキスト抽出後に `.txt` として保存、`.txt` はそのまま保存、`type="txt"` でテキストビューア表示。
- 目標: テキスト系ファイルはすべてアップロード時に `.md` へ変換し、`type="md"` に統一。これにより閲覧・編集・検索が Markdown一本に収束する。
- 関連要件: [requirements.md](./requirements.md) Section 3-1, 3-6, 7

---

## 全体ステップ

| # | ステップ | 目的 | 想定工数 |
|---|---------|------|---------|
| 1 | mammoth導入 + `.docx → .md` 変換 | Word→Markdownを本格変換に差し替え | 0.5日 |
| 2 | `.txt → .md` 変換 | 拡張子変更のみで `.md` 化 | 0.2日 |
| 3 | `.doc → .md` 変換 | 既存テキスト抽出をMD拡張子で保存 | 0.2日 |
| 4 | マイグレーションスクリプト | 既存 `type='txt'` を一括で `.md` 化 | 0.5日 |
| 5 | `type="txt"` と text-viewer の削除 | 型・UIの単純化 | 0.3日 |
| 6 | CodeMirror 6 導入 + 編集UI | MD編集基盤 | 1日 |
| 7 | 保存・競合検知・再インデックス | 保存フロー実装 | 0.5日 |
| 8 | モバイル対応・最終テスト | UX仕上げ | 0.5日 |

**合計: 約4日**

---

## Step 1: mammoth + turndown 導入 + `.docx → .md` 変換 ✅

### ゴール
`.docx` アップロード時に mammoth.js で HTML に変換し、turndown で Markdown に変換して `.md` として保存する。

> **補足**: mammoth.js は `convertToMarkdown` を持たないため、HTML経由で変換する。

### 作業内容

- [x] `npm install turndown` + `npm install --save-dev @types/turndown`（mammoth は既に依存済み）
- [x] 新規 [src/lib/docx-to-md.ts](../src/lib/docx-to-md.ts) を作成
  ```ts
  import mammoth from "mammoth"
  import TurndownService from "turndown"

  export async function convertDocxToMd(file: File): Promise<File> {
    const buffer = await file.arrayBuffer()
    const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buffer })
    const turndown = new TurndownService({
      headingStyle: "atx",
      bulletListMarker: "-",
      codeBlockStyle: "fenced",
      emDelimiter: "*",
    })
    const markdown = turndown.turndown(html)
    const mdName = file.name.replace(/\.docx?$/i, ".md")
    return new File([markdown], mdName, { type: "text/markdown" })
  }
  ```
- [x] [src/hooks/use-files.ts](../src/hooks/use-files.ts) の `uploadFile` で `.docx` のみ `convertDocxToMd` 経由に差し替え（`.doc` は Step 3 まで既存経路を維持）
- [x] [src/components/upload-dialog.tsx](../src/components/upload-dialog.tsx) の変換メッセージを `.docx` 用に更新
- [x] [src/lib/docx-to-txt.ts](../src/lib/docx-to-txt.ts) は Step 3 で `.doc` 用に流用するため残す

### テスト
- [x] 新規: [src/lib/\_\_tests\_\_/docx-to-md.test.ts](../src/lib/__tests__/docx-to-md.test.ts)
  - 見出し・太字・斜体・リスト・リンクが Markdown 記法で出力されること
- [x] [src/hooks/\_\_tests\_\_/use-files.test.ts](../src/hooks/__tests__/use-files.test.ts) を更新（`.docx → .md`、`.doc → .txt` のケース追加）
- [x] 既存 `docx-to-txt.test.ts` は残置（`.doc` 変換で使用）

### 確認
- [ ] 実機で `.docx` をアップロードし、MarkdownViewerで見出し・太字・リストが正しく表示される

---

## Step 2: `.txt → .md` 変換 ✅

### ゴール
`.txt` アップロード時に拡張子を `.md` に差し替えるだけで保存する。

### 作業内容

- [x] [src/hooks/use-files.ts](../src/hooks/use-files.ts) の `uploadFile`:
  - 判定: `fileType === "txt"` の場合、`uploadTarget` を新しい File に包み直す（名前を `.md`、MIMEは `text/markdown`）
  - `finalType = "md"`、`finalExt = "md"`
  - `displayName` は `.txt → .md` に置換
- [x] [src/components/upload-dialog.tsx](../src/components/upload-dialog.tsx) の変換メッセージ・説明文を `.txt` も対象に更新

### テスト
- [x] [src/hooks/\_\_tests\_\_/use-files.test.ts](../src/hooks/__tests__/use-files.test.ts) に追加
  - `.txt` アップロードで `type='md'` として insert されること
  - `storage_path` の拡張子が `.md` であること

---

## Step 3: `.doc → .md` 変換 ✅

### ゴール
旧バイナリ `.doc` は既存のテキスト抽出ロジックを流用し、結果を `.md` として保存する。

### 作業内容

- [x] [src/hooks/use-files.ts](../src/hooks/use-files.ts) の `uploadFile`:
  - `ext === "doc"` の場合は `convertDocxToTxt` を呼び出し（mammoth の `extractRawText` で抽出）
  - 戻り値の File の名前を `.md` に包み直してアップロード
  - `finalType = "md"`、`finalExt = "md"`
  - `displayName` も `.doc → .md` に置換
- [x] [src/components/upload-dialog.tsx](../src/components/upload-dialog.tsx) の "Converting ... to text" 分岐を削除し、`.doc` も "Converting ... to Markdown" に統合

### テスト
- [x] [src/hooks/\_\_tests\_\_/use-files.test.ts](../src/hooks/__tests__/use-files.test.ts) の `.doc` テストを更新
  - `.doc` アップロードで `type='md'` として保存されること
  - `storage_path` の拡張子が `.md` であること

---

## Step 4: 既存データのマイグレーション ✅（スクリプト実装完了・実行は未）

### ゴール
既存ユーザーの `type='txt'` ファイルを一括で `.md` に移行する。

### 作業内容

- [x] 新規 [scripts/migrate-txt-to-md.ts](../scripts/migrate-txt-to-md.ts) を作成
  - `SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` を `.env.local` から読み込む（`node --env-file`）
  - `type='txt'` のレコードを全件取得
  - 各ファイルに対して:
    1. Storage から旧パスをダウンロード
    2. 新パス（`.txt → .md`）に `contentType: text/markdown` でアップロード
    3. DB の `type` / `storage_path` / `name` を更新（失敗時は新パスをロールバック削除）
    4. 旧パスを削除（失敗は warning のみ）
  - `content_text` / `content_pages` は保持
  - `--dry-run` モード対応
- [x] `tsx` を devDependencies に追加
- [x] `package.json` に `"migrate:txt-to-md": "node --env-file=.env.local --import tsx scripts/migrate-txt-to-md.ts"` を追加
- [x] 処理件数・成功数・失敗数のサマリ出力
- [x] [scripts/README.md](../scripts/README.md) に実行手順・前提・ロールバック方針を記載

### 実行手順
1. Supabase ダッシュボードで事前にバックアップを取得（必須）
2. `.env.local` に `SUPABASE_SERVICE_ROLE_KEY` を追加
3. `npm run migrate:txt-to-md -- --dry-run` で対象件数を確認
4. `npm run migrate:txt-to-md` で本番実行
5. ダッシュボードで `type='txt'` が 0 件になったことを確認

### ロールバック
バックアップからの復元手順を [scripts/README.md](../scripts/README.md) に明記。実行前に必ずStorageのバケット・DBのスナップショットを取得すること。

> ⚠️ **注意**: 実際のマイグレーション実行はユーザーが手動で行う。Step 5 (text-viewer 削除) は実行完了後に着手すること。

---

## Step 5: `type="txt"` と text-viewer の削除 ✅

### ゴール
コード上から `txt` 型の概念を消し、Markdown一本に統一する。

### 作業内容

- [x] [src/lib/types.ts](../src/lib/types.ts): `FileRecord.type` から `"txt"` を削除
- [x] [src/components/file-viewer/text-viewer.tsx] を削除
- [x] [src/components/file-viewer/\_\_tests\_\_/text-viewer.test.tsx] を削除
- [x] [src/pages/dashboard.tsx](../src/pages/dashboard.tsx) から TextViewer の import/lazy/呼び出しを削除
- [x] [src/components/layout/sidebar/file-icon.tsx](../src/components/layout/sidebar/file-icon.tsx) の `txt` 分岐を削除
- [x] [src/components/content-search-dialog.tsx](../src/components/content-search-dialog.tsx) の `case "txt"` を削除
- [x] [src/lib/text-extraction.ts](../src/lib/text-extraction.ts): `extractTextFromBlob` と `extractText` の `case "txt"` を削除
- [x] [src/lib/backfill-content-text.ts](../src/lib/backfill-content-text.ts): `SEARCHABLE_TYPES` から `"txt"` を削除
- [x] [src/hooks/use-files.ts](../src/hooks/use-files.ts): `finalType` の型から `"txt"` を削除（入力の `fileType` 判定は互換維持のため残す）
- [x] [src/components/upload-dialog.tsx](../src/components/upload-dialog.tsx): 説明文は既にStep 3で更新済み、`accept` 属性はそのまま

### テスト
- [x] 既存テストから `txt` を参照する不要なケースを削除（`extractTextFromBlob("txt")` のテスト）
- [x] `npm run lint` `npm run build` `npm test` がすべてパス（148 tests）

---

## Step 6: CodeMirror 6 導入 + 編集UI ✅

### ゴール
MarkdownViewer に編集モードを追加し、CodeMirror 6 でMarkdownを編集できるようにする。

### 作業内容

- [x] `npm install @codemirror/state @codemirror/view @codemirror/lang-markdown @codemirror/commands @codemirror/language`
- [x] 新規 [src/components/file-viewer/markdown-editor.tsx](../src/components/file-viewer/markdown-editor.tsx)
  - CodeMirror の `EditorView` をラップ
  - 行番号・履歴（undo/redo）・ブラケットマッチ・自動インデント・Markdown シンタックスハイライト・行ラップを有効化
  - props: `initialContent`, `onChange`, `onSave`
  - `Mod-s` キーマップで onSave コールバック発火
  - 外部からの `initialContent` 変更を反映する同期ロジック
- [x] [src/components/file-viewer/markdown-viewer.tsx](../src/components/file-viewer/markdown-viewer.tsx)
  - ヘッダーに Edit / View / Save ボタン追加
  - 編集モード状態（`mode`, `editedContent`, `mobilePane`）を管理
  - ファイル切替時に「derived state」パターンでリセット（useEffect を使わず、React 公式推奨のインライン `setState` 方式）
  - PC (`md:`): 左右分割（エディタ + プレビュー）
  - モバイル: Editor / Preview タブ切替
  - 未保存変更がある場合は View ボタンで `window.confirm` による破棄確認
  - onSave は **Step 7 で実装**予定のスタブ（`toast.info`）
- [x] [src/test/setup.ts](../src/test/setup.ts) に jsdom 用の `Range.getClientRects` ポリフィルを追加（CodeMirror の測定処理のため）

### テスト
- [x] 新規: [src/components/file-viewer/\_\_tests\_\_/markdown-editor.test.tsx](../src/components/file-viewer/__tests__/markdown-editor.test.tsx)
  - 初期コンテンツが表示される
  - タイピングで `onChange` が発火
  - Ctrl+S で `onSave` が発火
- [x] [src/components/file-viewer/\_\_tests\_\_/markdown-viewer.test.tsx](../src/components/file-viewer/__tests__/markdown-viewer.test.tsx) に追加
  - Edit 押下で編集モードに入り Save ボタンが表示される（初期 disabled）
  - 内容変更で Save が enabled になる
  - ファイル切替時に View モードに戻る

---

## Step 7: 保存・競合検知・再インデックス ✅

### ゴール
編集内容をSupabaseに保存し、競合検知と全文検索インデックスの更新を行う。

### 作業内容

- [x] [src/hooks/use-files.ts](../src/hooks/use-files.ts) に `updateFileContent(fileRecord, content, options)` を追加
  - `options.overwrite` が false の場合: DB の現在の `updated_at` を SELECT して比較
  - 差があれば `{ error: "CONFLICT", conflict: true, latestUpdatedAt }` を返す（storage は触らない）
  - 一致 or `overwrite: true` の場合:
    1. Storage に `upsert: true`, `contentType: text/markdown` でアップロード
    2. `extractTextFromBlob` で `content_text` を再抽出
    3. DB の `content_text` と `updated_at` を更新
- [x] [src/pages/dashboard.tsx](../src/pages/dashboard.tsx) で `useFiles().updateFileContent` をラップし、成功時に `refetchAllFiles` と選択中ファイルの `updated_at` を更新
- [x] [src/components/file-viewer/markdown-viewer.tsx](../src/components/file-viewer/markdown-viewer.tsx)
  - 編集モード開始時に `snapshotUpdatedAt` をセット
  - 保存時に `onSaveContent` を呼び出し、成功時は `content` をローカル更新 + snapshot 更新 + トースト
  - 競合検知時: `AlertDialog` で「他の端末で編集されています」→「上書き保存」/「キャンセル」
  - 未保存で閉じようとした時: `window.confirm` で確認（既存実装）
  - `onSaveContent` が未提供なら Edit ボタンを disabled
- [x] Sonner でトースト通知（保存成功 "Saved" / 保存失敗 "Save failed: ..."）

### テスト
- [x] [use-files.test.ts](../src/hooks/__tests__/use-files.test.ts)
  - `updated_at` 一致時の保存成功（upload + update 両方呼ばれること、`content_text` と `updated_at` が更新されること）
  - `updated_at` 不一致時の CONFLICT 返却（storage は呼ばれない）
  - `overwrite: true` で SELECT がスキップされる
- [x] [markdown-viewer.test.tsx](../src/components/file-viewer/__tests__/markdown-viewer.test.tsx)
  - `onSaveContent` 未提供で Edit ボタンが disabled
  - Save ボタン押下で `onSaveContent` が正しい引数（`expectedUpdatedAt`, `overwrite: false`）で呼ばれる
  - 保存成功後に Save が dirty 解除で disabled になる
  - CONFLICT 応答でダイアログが表示され、「上書き保存」で `overwrite: true` でリトライされる

---

## Step 8: モバイル対応・最終テスト

### コード側の対応（実装済み）

- [x] `index.html` の viewport meta に `viewport-fit=cover` を追加（iOS ノッチ/セーフエリア対応の前提）
- [x] [src/pages/dashboard.tsx](../src/pages/dashboard.tsx) のルートを `h-screen` → `h-dvh`（ソフトキーボード出現時の100vhバグ対策）
- [x] [src/components/file-viewer/markdown-editor.tsx](../src/components/file-viewer/markdown-editor.tsx) の CodeMirror
  - `.cm-content` を `text-base` (16px) に → iOS Safari のフォーカス時自動ズームを抑止
  - `touch-manipulation` を付与 → タップ遅延を除去
  - 行番号 (`.cm-gutters`) は引き続き `text-sm` で視認性維持
- [x] タブ切替UIの `aria-selected` 切替テストを追加（[markdown-viewer.test.tsx](../src/components/file-viewer/__tests__/markdown-viewer.test.tsx)）
- [x] `npm run lint` `npm run build` `npm test` がパス

### ユーザー手動確認チェックリスト

実機/別リポジトリが必要なため、以下は手動で確認する:

#### iOS Safari 実機
- [ ] `.md` ファイルを開いて Edit ボタン押下で編集モードに入る
- [ ] タブで Editor / Preview を切り替えられる
- [ ] エディタにテキスト入力できる（フォーカス時に画面がズームしない）
- [ ] ソフトキーボード表示時にエディタが隠れない・レイアウトが崩れない
- [ ] Save ボタンで保存できる、Saved トーストが出る
- [ ] Cmd/外部キーボード接続時に Ctrl+S で保存できる（任意）
- [ ] ノッチ / ホームインジケータ領域にコンテンツが潜り込まない

#### Android Chrome 実機
- [ ] 同上（iOS Safari と同じ項目）
- [ ] Back ボタンの挙動が期待通り（編集モード中にアプリから出ない、など）

#### anyfolio-app (`nokataxx/anyfolio-app`)
- [ ] Web 側で編集保存したファイルがアプリ側で最新内容で表示される
- [ ] 変換元が `.txt` / `.docx` / `.doc` だったファイルもアプリ側で正しく MD レンダリングされる
- [ ] 全文検索で編集後の新しい内容がヒットする

#### 任意（ブラウザDevTools）
- [ ] Chrome DevTools のデバイスモード(iPhone 14 Pro など)で上記をシミュレート確認
- [ ] Lighthouse の Mobile Performance スコアに著しい劣化がないか

---

## 依存関係・順序

```
Step 1 ─┐
Step 2 ─┼─→ Step 4 ─→ Step 5 ─→ Step 6 ─→ Step 7 ─→ Step 8
Step 3 ─┘
```

- Step 1〜3 は並行可能（いずれもアップロードフローへの追加で、互いに独立）
- Step 4（マイグレーション）は Step 1〜3 完了後、本番デプロイ前に実施
- Step 5 はマイグレーション完了後に実施（既存の `type='txt'` レコードが残っていると壊れる）
- Step 6〜8 は編集機能の実装

## リスクと対策

| リスク | 対策 |
|-------|------|
| マイグレーションで一部ファイルが壊れる | ドライラン実装、事前バックアップ、失敗ファイルのログ出力 |
| mammoth の変換結果が期待と違う | テストでケース網羅、ユーザー目視確認フェーズを設ける |
| 編集中のネットワーク切断 | Cmd/Ctrl+S が失敗したらエラー表示、ローカルステートは保持 |
| モバイルでCodeMirrorの動作が重い | 大きなファイル（>1MB）は編集モード警告、将来的にvirtualization検討 |
| 既存モバイルアプリ（anyfolio-app）での `.txt` 表示 | マイグレーション後は全て `.md` になるため、app側のMD表示でそのまま対応可能 |

## 完了条件（DoD）

- [ ] アップロードした `.txt` / `.docx` / `.doc` がすべて `.md` として表示・検索・編集できる
- [ ] `type='txt'` のレコードが DB に1件も存在しない
- [ ] `text-viewer.tsx` がリポジトリから削除されている
- [ ] Markdown編集機能が Cmd/Ctrl+S で保存でき、競合検知が動作する
- [ ] モバイル実機で編集ができる
- [ ] `npm run lint` `npm run build` `npm test` がすべてパス

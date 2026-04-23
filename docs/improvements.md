# anyfolio-web 改善計画

> 2026年4月時点の評価に基づく改善項目と推奨アクション

---

## 改善が必要な項目

### 高優先度

| 課題 | 詳細 | 状態 |
|------|------|------|
| ~~テストがない~~ | ~~単体・E2Eテストがゼロ。Vitest + Playwright の導入推奨~~ | ✅ ユニットテスト 139件導入（E2E は未着手） |
| ~~CI/CDがない~~ | ~~GitHub Actions で lint / build / test の自動化が必要~~ | ✅ `.github/workflows/ci.yml` 追加（PR・main push で lint / build / test） |
| ~~Error Boundaryがない~~ | ~~ビューアがクラッシュするとアプリ全体が白画面になる~~ | ✅ `ViewerErrorBoundary` 追加（ビューア単位でフォールバックUI、「Try again」で再試行） |
| ~~バンドルサイズが大きい~~ | ~~メインチャンク 2.87MB。ビューアのコード分割（lazy import）が必要~~ | ✅ 2.87MB → 600KB（gzip 858KB → 177KB、約80%削減）。ビューアと変換処理を動的 import に変更 |
| ~~Markdown XSS 対策~~ | ~~`react-markdown` は素の設定で `<script>` / `onerror` 等の悪意ある HTML を通しうる。将来の共有機能より前に `rehype-sanitize` を導入~~ | ✅ `rehype-sanitize` を導入し、GitHub の defaultSchema ＋ `wikilink://` プロトコルを許可する schema で運用。`urlTransform` で react-markdown 側のフィルタも整合。`<script>` / on\* ハンドラ / `javascript:` URL を検証するテスト追加 |
| アップロードサイズの client-side 上限チェック | Supabase Storage の上限（プラン依存：50MB〜5GB）超過で汎用エラーになる。アップロード前に検知して分かりやすいエラーを出す | ⏳ 未着手 |

### 中優先度

| 課題 | 詳細 | 状態 |
|------|------|------|
| ~~Sidebarコンポーネントが巨大~~ | ~~637行で責務が多すぎる。FolderItem / FileList 等に分割すべき~~ | ✅ 637行 → 統合103行 + 7ファイルに分割（最大179行） |
| ~~Lintエラー~~ | ~~button.tsx の export が react-refresh 違反、image-viewer の useEffect deps 漏れ~~ | ✅ 修正済み |
| `dashboard.tsx` の肥大化 | 400行超。viewer 状態 / Markdown・Excel 編集ステータス / ハンドラ wrapper / pendingEditRef などが混在。`useDashboardViewer` 等の hook へ切り出し | ⏳ 未着手 |
| `refetchAllFiles` 多用による UI フリッカー | アップロード・削除・移動・リネーム・新規作成の度に全ファイル再取得。サイドバーが一瞬空になる。楽観的更新、または react-query / SWR 導入検討 | ⏳ 未着手 |
| Supabase Realtime 非対応 | 他デバイスで削除・リネームされても反映されない。モバイルアプリ併用時にズレが出る。`supabase.channel().on('postgres_changes')` で同期 | ⏳ 未着手 |
| 新規機能のユニットテスト未整備 | download / 新規 MD 作成 / `useTransferQueue` / `UploadButton` / `GlobalDropUpload` にテストなし。特に状態遷移を持つ `useTransferQueue` はテスト価値が高い | ⏳ 未着手 |
| キーボードショートカットが少ない | `Cmd+K`（検索）のみ。`Cmd+N`（新規ファイル）、`Cmd+Shift+N`（新規フォルダ）、矢印キーでのサイドバー移動など、ナレッジ閲覧アプリの標準導線を追加 | ⏳ 未着手 |
| Markdown 画像の相対参照 | `![](image.png)` 形式で vault 内の画像を参照するケースが Obsidian では一般的。WikiLink 同様のファイル名解決を実装しないと Obsidian Vault の MD が正しく表示されない可能性 | ⏳ 未検証 |

### 低優先度

| 課題 | 詳細 | 状態 |
|------|------|------|
| 監視/ログがない | Sentry等の導入でプロダクションエラーを把握できるようにする | ⏳ 未着手 |
| 大量ファイル対応 | `useAllFiles()` が全件メモリ取得。1万件超で問題になる可能性 | ⏳ 未着手 |

---

## 進捗サマリ（2026-04-20 時点）

### ✅ 完了

- **テスト基盤とユニットテスト**: Vitest + React Testing Library + jsdom 導入
  - Phase 1: 基盤構築
  - Phase 2: 純粋関数（`utils`, `remark-wikilink`, `docx-to-txt`, `text-extraction`, `pptx-helpers`）— 50テスト
  - Phase 3: hooks + `backfillContentText`（Supabase モックヘルパー含む）— 40テスト
  - Phase 4: コンポーネント（ビューア6種、ダイアログ/レイアウト4種）— 48テスト
  - **合計: 20ファイル / 139テスト、実行時間 約3秒**
  - 詳細: [testing-plan.md](./testing-plan.md)
- **リファクタリング**: `pptx-to-pdf.ts` から純粋ヘルパーを `pptx-helpers.ts` に分離（テスト容易性向上）
- **Lintエラー修正**: `button.tsx` の `buttonVariants` を `button-variants.ts` に分離、`image-viewer.tsx` の useEffect 依存修正ほか
- **CI/CD**: GitHub Actions ワークフロー追加（[.github/workflows/ci.yml](../.github/workflows/ci.yml)）— PR および main への push で `npm run lint` / `npm run build` / `npm test` を自動実行
- **Error Boundary**: `ViewerErrorBoundary` を追加し、ダッシュボードの各ビューアを包む。ビューアがクラッシュしてもアプリ全体は生存、ファイル切り替え時は自動リセット、ユーザーは「Try again」で再試行可能
- **バンドルサイズ最適化**: ビューア6種を `React.lazy` + `Suspense` でコード分割。さらに `use-files.ts` の変換処理（pptx→pdf、docx→txt、テキスト抽出）と `backfillContentText` を動的 import に変更。結果: メイン 2.87MB → 600KB（gzip 177KB）、xlsx 重複 import 警告も解消
- **Sidebar リファクタリング**: [sidebar.tsx](../src/components/layout/sidebar.tsx) を 637行 → 103行の統合コンポーネントに縮小。責務を [sidebar/](../src/components/layout/sidebar/) 配下の 7ファイルに分割: `types.ts` / `file-icon.tsx` / `file-item.tsx` / `folder-item.tsx` / `folder-tree.tsx` / `search-result-item.tsx` / `sidebar-search.tsx` / `sidebar-header.tsx`

### ⏳ 未着手（推奨アクションの残り）

### 1. E2E テスト（Phase 5）

- **Playwright** で認証フロー、アップロード、ファイル閲覧を検証
- 事前に決める必要がある: テスト用 Supabase プロジェクトの運用、CI 実行戦略、認証の扱い
- 手動テストの負担が増えた段階で着手するのがおすすめ

### 2. Vercel プレビューデプロイ（任意）

- Vercel 側の GitHub 連携で PR プレビューを自動生成
- GitHub Actions とは独立して設定する

### 3. 監視 / エラーログ

- Sentry 等の導入でプロダクションエラーを把握

### 4. 大量ファイル対応

- `useAllFiles()` のページング or 仮想スクロール化（1万件超でのメモリ対策）

# anyfolio-web 改善計画

> 2026年4月時点の評価に基づく改善項目と推奨アクション

---

## 改善が必要な項目

### 高優先度

| 課題 | 詳細 | 状態 |
|------|------|------|
| ~~テストがない~~ | ~~単体・E2Eテストがゼロ。Vitest + Playwright の導入推奨~~ | ✅ ユニットテスト 139件導入（E2E は未着手） |
| ~~CI/CDがない~~ | ~~GitHub Actions で lint / build / test の自動化が必要~~ | ✅ `.github/workflows/ci.yml` 追加（PR・main push で lint / build / test） |
| Error Boundaryがない | ビューアがクラッシュするとアプリ全体が白画面になる | ⏳ 未着手 |
| バンドルサイズが大きい | メインチャンク 2.87MB。ビューアのコード分割（lazy import）が必要 | ⏳ 未着手 |

### 中優先度

| 課題 | 詳細 | 状態 |
|------|------|------|
| Sidebarコンポーネントが巨大 | 637行で責務が多すぎる。FolderItem / FileList 等に分割すべき | ⏳ 未着手 |
| ~~Lintエラー~~ | ~~button.tsx の export が react-refresh 違反、image-viewer の useEffect deps 漏れ~~ | ✅ 修正済み |

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

### ⏳ 未着手（推奨アクションの残り）

### 1. E2E テスト（Phase 5）

- **Playwright** で認証フロー、アップロード、ファイル閲覧を検証
- 事前に決める必要がある: テスト用 Supabase プロジェクトの運用、CI 実行戦略、認証の扱い
- 手動テストの負担が増えた段階で着手するのがおすすめ

### 2. Vercel プレビューデプロイ（任意）

- Vercel 側の GitHub 連携で PR プレビューを自動生成
- GitHub Actions とは独立して設定する

### 3. Error Boundary の追加

- React Error Boundary をビューア周りに設置
- クラッシュ時にフォールバックUIを表示し、アプリ全体の白画面を防ぐ

### 4. バンドルサイズの最適化

- **React.lazy + Suspense** で各ビューアをコード分割
  - MarkdownViewer, PdfViewer, ExcelViewer, TextViewer, ImageViewer, PptxViewer
- PDF Worker の遅延読み込み
- `npm run build` 後のチャンクサイズを500KB以下に抑える

### 5. Sidebar リファクタリング

- 現在の637行を以下に分割:
  - `FolderItem` — 単一フォルダの表示・編集・D&D
  - `FileItem` — 既存だが独立ファイルへ抽出
  - `FolderTree` — ツリー再帰ロジック
  - `SidebarSearch` — 検索UI
  - `Sidebar` — 統合コンポーネント

### 6. 監視 / エラーログ

- Sentry 等の導入でプロダクションエラーを把握

### 7. 大量ファイル対応

- `useAllFiles()` のページング or 仮想スクロール化（1万件超でのメモリ対策）

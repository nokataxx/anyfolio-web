# anyfolio-web 改善計画

> 2026年4月時点の評価に基づく改善項目と推奨アクション

---

## 改善が必要な項目

### 高優先度

| 課題 | 詳細 |
|------|------|
| テストがない | 単体・E2Eテストがゼロ。Vitest + Playwright の導入推奨 |
| CI/CDがない | GitHub Actions で lint / build / test の自動化が必要 |
| Error Boundaryがない | ビューアがクラッシュするとアプリ全体が白画面になる |
| バンドルサイズが大きい | メインチャンク 2.86MB。ビューアのコード分割（lazy import）が必要 |

### 中優先度

| 課題 | 詳細 |
|------|------|
| Sidebarコンポーネントが巨大 | 637行で責務が多すぎる。FolderItem / FileList 等に分割すべき |
| Lintエラー | button.tsx の export が react-refresh 違反、image-viewer の useEffect deps 漏れ |

### 低優先度

| 課題 | 詳細 |
|------|------|
| 監視/ログがない | Sentry等の導入でプロダクションエラーを把握できるようにする |
| 大量ファイル対応 | `useAllFiles()` が全件メモリ取得。1万件超で問題になる可能性 |

---

## Phase 2 に進む前の推奨アクション

### 1. テスト基盤の構築

- **Vitest + React Testing Library** でユニットテスト導入
- **Playwright** でE2Eテスト（認証フロー、アップロード、ファイル閲覧）
- カバレッジ目標: hooks と変換ロジック（docx-to-txt, pptx-to-pdf）を優先

### 2. CI/CD パイプライン構築

- **GitHub Actions** ワークフローを追加
  - `npm run lint` — PR時にLintチェック
  - `npm run build` — TypeScript型チェック + ビルド検証
  - テスト実行
  - Vercelへのプレビューデプロイ

### 3. Error Boundary の追加

- React Error Boundary をビューア周りに設置
- クラッシュ時にフォールバックUIを表示し、アプリ全体の白画面を防ぐ

### 4. バンドルサイズの最適化

- **React.lazy + Suspense** で各ビューアをコード分割
  - MarkdownViewer, PdfViewer, ExcelViewer, TextViewer, ImageViewer
- PDF Worker の遅延読み込み
- `npm run build` 後のチャンクサイズを500KB以下に抑える

### 5. Sidebar リファクタリング

- 現在の637行を以下に分割:
  - `FolderItem` — 単一フォルダの表示・編集・D&D
  - `FileItem` — 既存だが独立ファイルへ抽出
  - `FolderTree` — ツリー再帰ロジック
  - `SidebarSearch` — 検索UI
  - `Sidebar` — 統合コンポーネント

### 6. Lint エラーの修正

- `button.tsx` の `buttonVariants` export を別ファイルに分離（react-refresh 違反）
- `image-viewer.tsx` の useEffect 依存配列に `url` を追加

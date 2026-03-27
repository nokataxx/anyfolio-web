# anyfolio 要件定義書

> 自分のナレッジを、どのデバイスからでも美しく閲覧できるアプリケーション

---

## 1. プロジェクト概要

### コンセプト
Obsidian・GdriveなどでMarkdownファイルを管理しているユーザーが、スマホや外出先のPCからでも、認証された安全な環境でナレッジを美しく閲覧できるWebアプリ＋スマホアプリ。

### 背景・課題
- GdriveのMDファイルをスマホで開くとプレーンテキストで表示されるだけ
- Obsidian Syncは有料で敷居が高い
- Markdownを綺麗にレンダリングしてくれるスマホアプリが少ない
- PDFも含めたナレッジを一元管理・閲覧できる場所がない

### ターゲットユーザー
- Obsidianユーザー
- Markdownで情報管理しているフリーランス・エンジニア
- マルチデバイスでナレッジにアクセスしたいユーザー

---

## 2. リポジトリ構成

| リポジトリ | 内容 |
|-----------|------|
| `nokataxx/anyfolio-web` | React + Vite のWebアプリ |
| `nokataxx/anyfolio-app` | Expo (React Native) のスマホアプリ |

---

## 3. 共通要件

### 3-1. 対応ファイル形式

| ファイル形式 | フェーズ |
|------------|---------|
| `.md` (Markdown) | Phase 1 |
| `.pdf` | Phase 1 |
| その他ドキュメント・画像 | Phase 2以降 |

### 3-2. 認証

- **Supabase Auth** を使用
- メールアドレス＋パスワードによるログイン
- 将来的にGoogle OAuthも対応可能
- 未認証状態でのアクセスはログイン画面にリダイレクト
- セッションはブラウザ・アプリに保持（次回自動ログイン）

### 3-3. Supabaseデータベース設計

#### `folders` テーブル
| カラム | 型 | 説明 |
|-------|-----|------|
| `id` | uuid | PK |
| `user_id` | uuid | 所有者（auth.uid） |
| `name` | text | フォルダ名 |
| `parent_id` | uuid | 親フォルダ（nullはルート） |
| `created_at` | timestamp | 作成日時 |

#### `files` テーブル
| カラム | 型 | 説明 |
|-------|-----|------|
| `id` | uuid | PK |
| `user_id` | uuid | 所有者（auth.uid） |
| `folder_id` | uuid | 所属フォルダ |
| `name` | text | ファイル名 |
| `type` | text | `md` / `pdf` |
| `storage_path` | text | Supabase Storage上のパス |
| `created_at` | timestamp | 作成日時 |
| `updated_at` | timestamp | 更新日時 |

### 3-4. Supabase Storage

- バケット名：`anyfolio-files`
- Row Level Security（RLS）を適用
- 自分のファイルのみアクセス可能（URLを知っていてもアクセス不可）

### 3-5. セキュリティ（RLS）

```sql
-- 自分のファイルのみ操作可能
create policy "自分のファイルのみ"
on files for all
using (auth.uid() = user_id);

create policy "自分のフォルダのみ"
on folders for all
using (auth.uid() = user_id);
```

---

## 4. Webアプリ要件（anyfolio-web）

### 4-1. 技術スタック

| 役割 | 技術 |
|------|------|
| フレームワーク | React + Vite |
| スタイリング | Tailwind CSS |
| 認証・DB・Storage | Supabase |
| Markdownレンダリング | react-markdown |
| PDFビューア | react-pdf |
| WikiLink対応 | remark-wiki-link |
| デプロイ | Vercel |

### 4-2. 画面構成

#### ログイン画面
- メールアドレス＋パスワード入力フォーム
- ログインボタン
- 未認証の場合、全ページからここにリダイレクト

#### メイン画面（ログイン後）
```
┌──────────────────────────────────────────┐
│ ヘッダー：anyfolio ロゴ　　　　ログアウト │
├────────────┬─────────────────────────────┤
│ サイドバー │ メインエリア                │
│            │                             │
│ 📁 フォルダ│ ファイルの内容が            │
│   📄 .md  │ ここに表示される            │
│   📋 .pdf │                             │
│ 📁 フォルダ│ .md → Markdownレンダリング │
│            │ .pdf → PDFビューア          │
│ [+ 追加]  │                             │
└────────────┴─────────────────────────────┘
```

### 4-3. 機能一覧

| 機能 | 説明 | 優先度 |
|------|------|-------|
| ファイルアップロード | ドラッグ&ドロップ・複数ファイル一括 | 高 |
| フォルダ管理 | 作成・削除・ネスト構造 | 高 |
| Markdownレンダリング | 見出し・リスト・コードブロック等 | 高 |
| PDFビューア | ページめくり・ズーム | 高 |
| WikiLink対応 | `[[リンク]]` でファイル間ナビゲーション | 中 |
| ファイル検索 | ファイル名で検索 | 中 |
| フルテキスト検索 | ファイル内容で検索 | 低（Phase 2） |

### 4-4. 開発フェーズ

| フェーズ | 内容 |
|---------|------|
| Phase 1 | 認証・フォルダ管理・MD/PDFアップロード・閲覧 |
| Phase 2 | WikiLink・全文検索・その他ファイル形式対応 |

---

## 5. スマホアプリ要件（anyfolio-app）

### 5-1. 技術スタック

| 役割 | 技術 |
|------|------|
| フレームワーク | Expo (React Native) |
| スタイリング | NativeWind |
| 認証・DB・Storage | Supabase（Webと共通） |
| Markdownレンダリング | react-native-markdown-display |
| PDFビューア | expo-pdf |
| 配布 | Expo Go → App Store / Google Play |

### 5-2. 画面構成

- ログイン画面
- ファイルツリー画面（フォルダ・ファイル一覧）
- ファイル閲覧画面（MD / PDF）

### 5-3. 機能一覧

| 機能 | 説明 | 優先度 |
|------|------|-------|
| 認証 | ログイン・ログアウト | 高 |
| ファイルツリー表示 | フォルダ・ファイル一覧 | 高 |
| Markdownレンダリング | 綺麗な閲覧 | 高 |
| PDFビューア | ページめくり | 高 |
| ファイル検索 | ファイル名で検索 | 中 |
| ファイルアップロード | スマホからのアップロード | 低（Phase 2） |

### 5-4. 開発フェーズ

| フェーズ | 内容 |
|---------|------|
| Phase 1 | Webアプリ完成後に着手。閲覧機能に集中 |
| Phase 2 | アップロード・プッシュ通知等 |

---

## 6. 開発ロードマップ

```
Step 1: anyfolio-web Phase 1
  └─ 認証・フォルダ管理・MD/PDF閲覧

Step 2: anyfolio-web Phase 2
  └─ WikiLink・検索・追加ファイル形式

Step 3: anyfolio-app Phase 1
  └─ スマホでの閲覧機能

Step 4: anyfolio-app Phase 2
  └─ スマホからのアップロード・通知
```

---

## 7. Gdrive連携要件

### 基本方針

| フェーズ | 方式 | 内容 |
|---------|------|------|
| Phase 1 | Supabaseアップロード | 手動でファイルをアップロードして管理 |
| Phase 2 | Gdrive直接参照 | Google Drive APIでファイルを取得・表示 |

### Phase 2 Gdrive連携の仕様

#### 認証
- Google OAuth 2.0 でGdriveへのアクセス権を取得
- Supabase AuthのGoogle OAuth と統合

#### 動作イメージ
```
ユーザーがGdriveフォルダを指定
        ↓ Google Drive API
  フォルダ内のMD・PDFを取得
        ↓
  anyfolioで綺麗にレンダリング
```

#### 機能
| 機能 | 説明 |
|------|------|
| フォルダ指定 | GdriveのフォルダをanyfolioにマウントするUIで指定 |
| 自動同期 | Gdrive上のファイル変更を自動反映 |
| Obsidian Vault対応 | GdriveにバックアップしたVaultフォルダをそのまま参照 |
| キャッシュ | 一度取得したファイルをSupabaseにキャッシュして高速表示 |

#### メリット
- アップロード作業が不要になる
- Gdriveが唯一のソースとして管理がシンプル
- ObsidianのVaultフォルダをそのままanyfolioで閲覧可能
- スマホからもGdrive上のファイルをリアルタイムで閲覧可能

---

## 8. 開発ロードマップ（更新）

```
Step 1: anyfolio-web Phase 1
  └─ 認証・フォルダ管理・MD/PDFアップロード・閲覧

Step 2: anyfolio-web Phase 2
  └─ WikiLink・検索・Gdrive連携・追加ファイル形式

Step 3: anyfolio-app Phase 1
  └─ スマホでの閲覧機能（Supabase参照）

Step 4: anyfolio-app Phase 2
  └─ Gdrive連携・アップロード・プッシュ通知
```

---

## 9. 将来的な展開

- 他ユーザーへの公開サービス化
- XMindファイル対応
- 画像・動画ファイル対応
- チーム共有機能

---

*作成日：2026年3月*

# Scripts

## migrate-txt-to-md.ts

既存 `anyfolio_files` レコードの `type='txt'` を `type='md'` へ一括移行するスクリプト。ストレージ上の `.txt` ファイルも `.md` にリネームする。

### 前提

- Node.js 20.6+ (現在 v22 を想定)
- `.env.local` に以下を定義
  - `SUPABASE_URL` (または既存の `VITE_SUPABASE_URL` で可)
  - `SUPABASE_SERVICE_ROLE_KEY` (Service Role Key — RLS を越えて全ユーザーのレコードにアクセスするため)

### 実行手順

1. **バックアップ取得**（必須）
   - Supabase ダッシュボード → Database → Backups でスナップショット作成
   - Storage の `anyfolio-files` バケットを別バケットへコピー (必要に応じて)

2. **ドライラン**
   ```bash
   npm run migrate:txt-to-md -- --dry-run
   ```
   対象件数と変換先パスが出力されるだけで、実際の書き込みは行わない。

3. **本番実行**
   ```bash
   npm run migrate:txt-to-md
   ```
   各レコードに対して以下の順で実行:
   1. Storage から旧パスをダウンロード
   2. 新パス（`.txt` → `.md`）へアップロード（`contentType: text/markdown`）
   3. DB の `type` / `storage_path` / `name` を更新
   4. 旧パスを削除
   
   DB 更新が失敗した場合は新パスのアップロードを即ロールバックする。旧パス削除のみ失敗した場合は warning を出して続行する（孤立ファイルは `Summary` の後に手動クリーンアップ）。

4. **確認**
   - `anyfolio_files` で `type='txt'` が 0 件になっていること
   - 数件をUIで開いて表示できること
   - 失敗ログの `[fail]` エントリを確認し、必要なら個別リトライ

### 保持されるもの

- `content_text` / `content_pages`（全文検索インデックス）はそのまま
- `created_at` / `updated_at` はDB側で自然に更新（`updated_at` は `update` によって自動更新されるため変換日に置き換わる）
- `folder_id` / `user_id` は変更しない

### ロールバック

失敗時は Supabase ダッシュボードで取得したバックアップから復元する。

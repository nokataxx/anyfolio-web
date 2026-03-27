# anyfolio-web

> 自分のナレッジを、どのデバイスからでも美しく閲覧できるWebアプリケーション

Obsidian や Google Drive で管理している Markdown ファイルや PDF を、スマホや外出先の PC からでも認証された安全な環境で美しく閲覧できる Web アプリです。

## Tech Stack

| Role | Technology |
|------|-----------|
| Framework | React 19 + Vite 8 |
| Language | TypeScript 5.9 (strict) |
| Styling | Tailwind CSS 4 |
| UI Components | shadcn (Radix UI) |
| Auth / DB / Storage | Supabase |
| Markdown Rendering | react-markdown |
| PDF Viewer | react-pdf |
| Deployment | Vercel |

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

### Environment Variables

Supabase の接続情報を `.env` に設定してください。

```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | TypeScript check + Vite production build |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build locally |

## Features

### Phase 1 (Current)

- Email + password authentication (Supabase Auth)
- Folder management (create, delete, nested structure)
- File upload (drag & drop, bulk upload)
- Markdown rendering (headings, lists, code blocks, etc.)
- PDF viewer (page navigation, zoom)

### Phase 2

- WikiLink support (`[[link]]` for inter-file navigation)
- File name search
- Full-text search
- Google Drive integration
- Additional file format support

## Related Repositories

| Repository | Description |
|-----------|-------------|
| `nokataxx/anyfolio-web` | React + Vite Web app (this repo) |
| `nokataxx/anyfolio-app` | Expo (React Native) mobile app |

## License

Private

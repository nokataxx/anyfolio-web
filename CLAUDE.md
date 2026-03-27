# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

anyfolio-web is a React SPA for viewing Markdown files and PDFs from Obsidian/Google Drive on any device. Built with React 19 + Vite + Tailwind CSS 4 + Supabase. Companion mobile app lives in `nokataxx/anyfolio-app` (Expo). Requirements spec is in `docs/requirements.md` (Japanese).

## Commands

- `npm run dev` — Start Vite dev server with HMR
- `npm run build` — TypeScript check (`tsc -b`) + Vite production build
- `npm run lint` — ESLint across all TS/TSX files
- `npm run preview` — Preview production build locally

No test framework is configured yet.

## Architecture

**Stack:** React 19, Vite 8, TypeScript 5.9 (strict), Tailwind CSS 4, Supabase (auth + DB + storage), React Router 7, shadcn (radix-nova style)

**Path alias:** `@/*` maps to `./src/*` (configured in tsconfig, vite, and components.json)

**UI system:** shadcn components in `src/components/ui/` using Radix UI primitives + CVA variants. Add new components via `npx shadcn@latest add <component>`. The `cn()` helper in `src/lib/utils.ts` merges Tailwind classes.

**Styling:** Tailwind 4 with `@theme` inline config in `src/index.css`. Uses oklch color space, CSS custom properties for theming, and `prefers-color-scheme` + `.dark` class for dark mode. Geist variable font.

**Build pipeline:** Vite with `@vitejs/plugin-react` (Oxc compiler) and `@tailwindcss/vite` plugin. Output to `dist/`. Deployment target is Vercel.

**Backend:** Supabase JS SDK (`@supabase/supabase-js`) for auth (email+password), PostgreSQL with RLS, and file storage bucket `anyfolio-files`. DB schema: `folders` (nested via parent_id) and `files` tables, both scoped by user_id.

## Code Conventions

- TypeScript strict mode with `noUnusedLocals` and `noUnusedParameters` enabled
- ESLint 9 flat config with react-hooks and react-refresh plugins
- ES modules (`"type": "module"` in package.json)
- Target: ES2023

## Git

- Commit messages should be written in English

## TypeScript

Strict mode enabled. Key settings in `tsconfig.app.json`:
- `noUnusedLocals`, `noUnusedParameters`
- `erasableSyntaxOnly` (type-only imports)
- Target ES2022, JSX react-jsx



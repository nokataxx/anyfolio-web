-- ============================================================
-- folders テーブル
-- ============================================================
create table public.folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  parent_id  uuid references public.folders(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.folders enable row level security;

create policy "Users can manage own folders"
  on public.folders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- files テーブル
-- ============================================================
create table public.files (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  folder_id    uuid not null references public.folders(id) on delete cascade,
  name         text not null,
  type         text not null check (type in ('md', 'pdf')),
  storage_path text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.files enable row level security;

create policy "Users can manage own files"
  on public.files for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- Storage バケット: anyfolio-files
-- ============================================================
insert into storage.buckets (id, name, public)
  values ('anyfolio-files', 'anyfolio-files', false);

create policy "Users can manage own storage objects"
  on storage.objects for all
  using (auth.uid()::text = (storage.foldername(name))[1])
  with check (auth.uid()::text = (storage.foldername(name))[1]);

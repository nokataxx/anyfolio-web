-- Allow files to exist at the root level (no folder)
alter table public.anyfolio_files alter column folder_id drop not null;

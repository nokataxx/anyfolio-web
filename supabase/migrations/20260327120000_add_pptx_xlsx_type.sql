-- Allow xlsx and pptx file types in anyfolio_files
alter table public.anyfolio_files
  drop constraint if exists files_type_check,
  add constraint files_type_check check (type in ('md', 'pdf', 'xlsx', 'pptx', 'image'));

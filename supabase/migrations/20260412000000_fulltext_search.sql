-- Enable pg_trgm extension for trigram-based search (Japanese compatible)
create extension if not exists pg_trgm;

-- Add content_text column for fulltext search
alter table public.anyfolio_files
  add column if not exists content_text text;

-- Add content_pages column for PDF per-page texts (JSONB array of strings)
alter table public.anyfolio_files
  add column if not exists content_pages jsonb;

-- GIN trigram index for fast ILIKE searches
create index if not exists idx_anyfolio_files_content_trgm
  on public.anyfolio_files
  using gin (content_text gin_trgm_ops);

-- Update type check constraint to include 'txt' if not already present
alter table public.anyfolio_files
  drop constraint if exists files_type_check;
alter table public.anyfolio_files
  add constraint files_type_check check (type in ('md', 'pdf', 'xlsx', 'pptx', 'image', 'txt'));

-- RPC function: search file contents using ILIKE (trigram-accelerated)
create or replace function search_file_contents(
  search_query text,
  max_results int default 50
)
returns table (
  file_id uuid,
  file_user_id uuid,
  file_folder_id uuid,
  file_name text,
  file_type text,
  file_storage_path text,
  file_created_at timestamptz,
  file_updated_at timestamptz,
  match_context text,
  match_index int,
  pdf_page int
)
language plpgsql
security invoker
as $$
declare
  escaped_query text;
  query_len int;
begin
  -- Escape LIKE special characters
  escaped_query := replace(replace(replace(search_query, '\', '\\'), '%', '\%'), '_', '\_');
  query_len := length(search_query);

  return query
  select
    f.id,
    f.user_id,
    f.folder_id,
    f.name,
    f.type,
    f.storage_path,
    f.created_at,
    f.updated_at,
    -- Extract context snippet: ~30 chars before and after match
    substring(
      f.content_text
      from greatest(1, position(lower(search_query) in lower(f.content_text)) - 30)
      for query_len + 60
    ),
    position(lower(search_query) in lower(f.content_text)) - 1,
    -- For PDFs, find the 1-based page number containing the match
    case
      when f.type = 'pdf' and f.content_pages is not null then (
        select i + 1
        from generate_series(0, jsonb_array_length(f.content_pages) - 1) as i
        where lower(f.content_pages ->> i) ilike '%' || escaped_query || '%'
        limit 1
      )
      else null
    end
  from public.anyfolio_files f
  where f.user_id = auth.uid()
    and f.content_text ilike '%' || escaped_query || '%'
  limit max_results;
end;
$$;

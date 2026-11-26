-- =====================================================================
--  Адвент-календар — схема бази даних Supabase
--  Запуск: Supabase → SQL Editor → вставити весь файл → Run.
--  Скрипт можна запускати повторно (він нічого не видаляє з даних).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Таблиці ---------------------------------------------------

create table if not exists public.calendars (
  code        text primary key,
  name        text not null default '',
  title       text,
  design      text not null default 'windows' check (design in ('windows','tree')),
  status      text not null default 'draft'   check (status in ('draft','ready')),
  views       int  not null default 0,
  created_at  timestamptz not null default now(),
  ready_at    timestamptz,
  last_view_at timestamptz,
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  constraint calendars_code_len check (char_length(code) = 24)
);
create index if not exists calendars_owner_idx on public.calendars(owner_id);

create table if not exists public.cells (
  calendar_code text not null references public.calendars(code) on delete cascade,
  number      int  not null check (number between 1 and 13), -- 13 = двері (лист)
  kind        text not null check (kind in ('photo','video','qr','letter')),
  file_path   text,
  mime        text,
  size        bigint,
  duration    real,
  link_url    text,
  link_label  text,
  show_qr     boolean not null default false, -- фото/відео показати отримувачу як QR-код
  letter      text check (letter is null or char_length(letter) <= 1000),
  letter_from text check (letter_from is null or char_length(letter_from) <= 120),
  open_at     date,
  opened_at   timestamptz,
  updated_at  timestamptz not null default now(),
  primary key (calendar_code, number)
);

-- ---------- RLS: адмін бачить лише своє --------------------------------

alter table public.calendars enable row level security;
alter table public.cells     enable row level security;

drop policy if exists calendars_owner_all on public.calendars;
create policy calendars_owner_all on public.calendars
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists cells_owner_all on public.cells;
create policy cells_owner_all on public.cells
  for all to authenticated
  using (exists (select 1 from public.calendars c
                 where c.code = cells.calendar_code and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.calendars c
                 where c.code = cells.calendar_code and c.owner_id = auth.uid()));

-- Гість (anon) таблиці напряму не бачить узагалі.
revoke all on public.calendars from anon;
revoke all on public.cells     from anon;

-- ---------- Функції для гостя ----------------------------------------

-- Календар + комірки. Лише status = 'ready'. Збільшує лічильник переглядів.
-- Вміст зачиненої (за датою) комірки не віддається.
create or replace function public.open_calendar(p_code text, p_today date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cal   public.calendars;
  today date := coalesce(p_today, (now() at time zone 'Europe/Kyiv')::date);
begin
  -- клієнт може передати свою дату, але не далі ніж ±1 день від серверної (часові пояси)
  if p_today is not null and abs(p_today - (now() at time zone 'Europe/Kyiv')::date) > 1 then
    today := (now() at time zone 'Europe/Kyiv')::date;
  end if;

  select * into cal from public.calendars
   where code = p_code and status = 'ready';
  if not found then
    return null;
  end if;

  update public.calendars
     set views = views + 1, last_view_at = now()
   where code = p_code;

  return jsonb_build_object(
    'code',   cal.code,
    'title',  cal.title,
    'design', cal.design,
    'cells', coalesce((
      select jsonb_agg(
        case when c.open_at is not null and c.open_at > today then
          jsonb_build_object('number', c.number, 'locked', true, 'open_at', c.open_at,
                             'opened', false)
        else
          jsonb_build_object(
            'number', c.number, 'locked', false, 'open_at', c.open_at,
            'kind', c.kind, 'file_path', c.file_path, 'mime', c.mime, 'show_qr', c.show_qr,
            'link_url', c.link_url, 'link_label', c.link_label,
            'letter', c.letter, 'letter_from', c.letter_from,
            'opened', c.opened_at is not null)
        end order by c.number)
      from public.cells c where c.calendar_code = cal.code
    ), '[]'::jsonb)
  );
end $$;

-- Позначити комірку відкритою (перше відкриття).
create or replace function public.open_cell(p_code text, p_number int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cells c
     set opened_at = coalesce(c.opened_at, now())
    from public.calendars k
   where k.code = c.calendar_code
     and k.code = p_code and k.status = 'ready'
     and c.number = p_number
     and (c.open_at is null or c.open_at <= (now() at time zone 'Europe/Kyiv')::date + 1);
  return found;
end $$;

revoke all on function public.open_calendar(text, date) from public;
revoke all on function public.open_cell(text, int)      from public;
grant execute on function public.open_calendar(text, date) to anon, authenticated;
grant execute on function public.open_cell(text, int)      to anon, authenticated;

-- ---------- Сховище файлів -------------------------------------------
-- Бакет «advent»: публічні посилання на файли за випадковими іменами
-- (32 символи), але СПИСОК файлів гостю закритий (немає select-політики для anon).
-- Адмін пише лише у свою папку: <user_id>/<випадковий_код>.<розширення>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('advent', 'advent', true, 52428800,
        array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists advent_owner_select on storage.objects;
create policy advent_owner_select on storage.objects
  for select to authenticated
  using (bucket_id = 'advent' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists advent_owner_insert on storage.objects;
create policy advent_owner_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'advent' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists advent_owner_update on storage.objects;
create policy advent_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'advent' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists advent_owner_delete on storage.objects;
create policy advent_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'advent' and (storage.foldername(name))[1] = auth.uid()::text);

-- Скільки місця займають УСІ файли проєкту (ліміт Free — 1 ГБ на весь проєкт,
-- включно з файлами «QR-подарунка», якщо він у цьому ж проєкті)
create or replace function public.advent_storage_used()
returns bigint
language sql
security definer
set search_path = public, storage
as $$
  select coalesce(sum((metadata->>'size')::bigint), 0)
    from storage.objects;
$$;
revoke all on function public.advent_storage_used() from public;
grant execute on function public.advent_storage_used() to authenticated;

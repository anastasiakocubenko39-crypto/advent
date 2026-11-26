-- =====================================================================
--  Оновлення (листопад): 
--   1) двері будинку — окрема комірка №13 (лист без фото);
--   2) фото/відео можна показати отримувачу як QR-код.
--  Supabase → SQL Editor → вставити весь файл → Run. Можна запускати повторно.
-- =====================================================================
alter table public.cells drop constraint if exists cells_number_check;
alter table public.cells add constraint cells_number_check check (number between 1 and 13);
alter table public.cells drop constraint if exists cells_kind_check;
alter table public.cells add constraint cells_kind_check check (kind in ('photo','video','qr','letter'));
alter table public.cells add column if not exists show_qr boolean not null default false;

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


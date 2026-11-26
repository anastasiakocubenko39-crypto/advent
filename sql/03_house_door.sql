-- =====================================================================
--  Оновлення для 3D-будинку: двері — окрема комірка №13 (лист без фото).
--  Supabase → SQL Editor → вставити → Run. Запускати один раз (можна й повторно).
-- =====================================================================
alter table public.cells drop constraint if exists cells_number_check;
alter table public.cells add constraint cells_number_check check (number between 1 and 13);
alter table public.cells drop constraint if exists cells_kind_check;
alter table public.cells add constraint cells_kind_check check (kind in ('photo','video','qr','letter'));

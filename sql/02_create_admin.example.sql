-- =====================================================================
--  Створення адміна (логін + пароль). ПРИКЛАД.
--  1) Скопіюйте цей файл як 02_create_admin.sql (він у .gitignore — НЕ комітиться!)
--     або просто вставте текст у Supabase → SQL Editor.
--  2) Замініть логін і пароль. По одному блоку select на кожного адміна.
--  3) Run.
--  Логін — латиницею/цифрами (a-z, 0-9, крапка, дефіс, підкреслення).
--  Всередині логін стає службовою адресою <логін>@advent.local — пошта не потрібна.
--  Повторний запуск з тим самим логіном просто змінює пароль.
-- =====================================================================

create or replace function pg_temp.advent_admin(p_login text, p_password text)
returns text language plpgsql as $$
declare
  v_email text := lower(trim(p_login)) || '@advent.local';
  v_id uuid;
begin
  if p_login !~ '^[A-Za-z0-9._-]{3,40}$' then
    raise exception 'Логін має містити 3–40 символів: латиниця, цифри, . _ -';
  end if;
  if length(p_password) < 8 then
    raise exception 'Пароль має бути щонайменше 8 символів';
  end if;

  select id into v_id from auth.users where email = v_email;
  if v_id is not null then
    update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')),
                          updated_at = now()
     where id = v_id;
    return 'пароль оновлено: ' || p_login;
  end if;

  v_id := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at,
                          raw_app_meta_data, raw_user_meta_data,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
          v_email, crypt(p_password, gen_salt('bf')), now(), now(), now(),
          '{"provider":"email","providers":["email"]}', jsonb_build_object('login', p_login),
          '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider,
                               last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
          jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
          'email', now(), now(), now());
  return 'створено: ' || p_login;
end $$;

-- ↓↓↓ ВАШІ АДМІНИ ↓↓↓
select pg_temp.advent_admin('olena',  'ЗамінітьЦейПароль-1');
-- select pg_temp.advent_admin('andrii', 'ІншийНадійнийПароль-2');

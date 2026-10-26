-- Plateforme de formation : tables et fonctions (à exécuter dans SQL Editor)
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  phone text primary key,
  name text not null,
  is_admin boolean not null default false
);

create table if not exists public.access_codes (
  id bigint generated always as identity primary key,
  phone text not null references public.profiles(phone) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table if not exists public.sessions (
  token uuid primary key default gen_random_uuid(),
  phone text not null references public.profiles(phone) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.videos (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  url text not null,
  created_at timestamptz not null default now()
);

-- Verrouillage : aucun accès direct aux tables, tout passe par les fonctions
alter table public.profiles enable row level security;
alter table public.access_codes enable row level security;
alter table public.sessions enable row level security;
alter table public.videos enable row level security;
revoke all on all tables in schema public from anon, authenticated;

-- Session valable 30 jours
create or replace function public.session_phone(p_token uuid)
returns text language sql stable security definer set search_path = public as $$
  select phone from public.sessions
  where token = p_token and created_at > now() - interval '30 days';
$$;

create or replace function public.is_admin(p_token uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.is_admin from public.sessions s
    join public.profiles p on p.phone = s.phone
    where s.token = p_token and s.created_at > now() - interval '30 days'
  ), false);
$$;

-- Connexion : numéro + code à usage unique -> jeton de session
create or replace function public.login(p_phone text, p_code text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare c_id bigint; t uuid;
begin
  select id into c_id from public.access_codes
  where phone = p_phone and used_at is null and expires_at > now()
    and code_hash = encode(digest(upper(trim(p_code)), 'sha256'), 'hex')
  limit 1;
  if c_id is null then raise exception 'Numéro ou code invalide'; end if;
  update public.access_codes set used_at = now() where id = c_id;
  insert into public.sessions (phone) values (p_phone) returning token into t;
  return t;
end $$;

create or replace function public.logout(p_token uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.sessions where token = p_token;
$$;

-- Admin : crée un code de 8 caractères (24 h, usage unique) pour un membre
create or replace function public.admin_create_code(p_token uuid, p_phone text, p_name text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_code text := upper(encode(gen_random_bytes(4), 'hex'));
begin
  if not public.is_admin(p_token) then raise exception 'Accès réservé à l''administrateur'; end if;
  insert into public.profiles (phone, name) values (p_phone, p_name)
  on conflict (phone) do update set name = excluded.name;
  insert into public.access_codes (phone, code_hash, expires_at)
  values (p_phone, encode(digest(v_code, 'sha256'), 'hex'), now() + interval '24 hours');
  return v_code;
end $$;

create or replace function public.list_videos(p_token uuid)
returns setof public.videos language plpgsql security definer set search_path = public as $$
begin
  if public.session_phone(p_token) is null then
    raise exception 'Session expirée, reconnectez-vous';
  end if;
  return query select * from public.videos order by created_at desc;
end $$;

create or replace function public.admin_add_video(p_token uuid, p_title text, p_description text, p_url text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.is_admin(p_token) then raise exception 'Accès réservé à l''administrateur'; end if;
  insert into public.videos (title, description, url) values (p_title, p_description, p_url)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.admin_delete_video(p_token uuid, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(p_token) then raise exception 'Accès réservé à l''administrateur'; end if;
  delete from public.videos where id = p_id;
end $$;

-- Déconnexion admin : génère un code de secours (30 jours, usage unique), invalide les anciens
create or replace function public.admin_prepare_logout(p_token uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_phone text;
  v_code text := upper(encode(gen_random_bytes(4), 'hex'));
begin
  if not public.is_admin(p_token) then raise exception 'Accès réservé à l''administrateur'; end if;
  select s.phone into v_phone from public.sessions s where s.token = p_token;
  update public.access_codes set used_at = now() where phone = v_phone and used_at is null;
  insert into public.access_codes (phone, code_hash, expires_at)
  values (v_phone, encode(digest(v_code, 'sha256'), 'hex'), now() + interval '30 days');
  return v_code;
end $$;

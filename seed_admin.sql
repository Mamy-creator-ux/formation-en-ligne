-- Compte administrateur : Mamy Hervé. À exécuter une seule fois, après schema.sql.
-- 1) Remplacez 0XXXXXXXXX par son numéro (ex : 0388517134).
-- 2) Remplacez A7K9Q2M4 par le code de première connexion de votre choix (8 caractères).
insert into public.profiles (phone, name, is_admin)
values ('0XXXXXXXXX', 'Mamy Hervé', true)
on conflict (phone) do update set name = excluded.name, is_admin = true;

insert into public.access_codes (phone, code_hash, expires_at)
values ('0XXXXXXXXX', encode(extensions.digest('A7K9Q2M4', 'sha256'), 'hex'), now() + interval '30 days');

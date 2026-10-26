-- Compte administrateur : Mamy Hervé. À exécuter une seule fois, après schema.sql.
-- Le code de connexion n'est PAS stocké dans ce fichier (le dépôt est public).
-- Il se génère ensuite depuis l'espace Administration ("Inviter un membre").
insert into public.profiles (phone, name, is_admin)
values ('0388517134', 'Mamy Hervé', true)
on conflict (phone) do update set name = excluded.name, is_admin = true;

-- Actes de cession : structure de la base et règles d'accès (à exécuter dans Supabase > SQL Editor).

create table if not exists public.lots (
  lot   text primary key,
  civ   text not null,
  nom   text not null,
  cni   text not null,
  sup   text not null,
  nicad text not null,
  loc   text not null
);

-- La clé primaire sur "lot" garantit UN SEUL acte enregistré par lot : un second insert est refusé par la base.
create table if not exists public.actes (
  lot        text primary key references public.lots(lot) on delete restrict,
  acq_nom    text not null,
  data       jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.lots  enable row level security;
alter table public.actes enable row level security;

-- Seuls les utilisateurs connectés lisent et écrivent. Sans connexion, rien n'est visible.
drop policy if exists "lots lecture"  on public.lots;
drop policy if exists "actes tout"    on public.actes;
create policy "lots lecture" on public.lots  for select to authenticated using (true);
create policy "actes tout"   on public.actes for all    to authenticated using (true) with check (true);

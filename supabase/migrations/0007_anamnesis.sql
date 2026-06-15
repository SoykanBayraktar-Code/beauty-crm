-- 0007_anamnesis.sql — Anamnez (hassas sağlık, versiyonlu) + klinik erişim RLS yardımcısı (Faz 2.1)

-- ── Klinik erişim kuralı (KVKK): owner tümünü, uzman yalnızca randevusu olduğu müşteriyi görür ──
create or replace function public.can_access_clinical(target_customer uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.customers c
    join public.org_members m
      on m.org_id = c.org_id and m.user_id = auth.uid() and m.deleted_at is null
    where c.id = target_customer
      and (
        m.role = 'owner'
        or (
          m.role = 'specialist'
          and exists (
            select 1
            from public.appointments a
            join public.staff s on s.id = a.staff_id
            where a.customer_id = target_customer
              and s.member_id = m.id
              and a.deleted_at is null
          )
        )
      )
  );
$$;
grant execute on function public.can_access_clinical(uuid) to authenticated;

-- ── customer_anamnesis (her güncelleme yeni sürüm) ──
create table public.customer_anamnesis (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  customer_id       uuid not null references public.customers(id) on delete cascade,
  version           integer not null default 1,
  allergies         text,
  chronic_conditions text,
  medications       text,
  pregnancy         boolean not null default false,
  fitzpatrick       text check (fitzpatrick in ('I','II','III','IV','V','VI')),
  skin_type         text,
  contraindications text,
  notes             text,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index customer_anamnesis_customer_idx
  on public.customer_anamnesis(customer_id, version desc);

-- ── RLS: klinik erişim kuralına bağlı ──
alter table public.customer_anamnesis enable row level security;

create policy anamnesis_select on public.customer_anamnesis
  for select using (public.can_access_clinical(customer_id));
create policy anamnesis_insert on public.customer_anamnesis
  for insert with check (
    org_id = public.current_org_id()
    and public.role_in_org(org_id) in ('owner', 'specialist')
    and public.can_access_clinical(customer_id)
  );

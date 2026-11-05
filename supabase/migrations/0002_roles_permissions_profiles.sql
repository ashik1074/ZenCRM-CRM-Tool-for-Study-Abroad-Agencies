-- 0002: roles, permissions, profiles, permission helpers.

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  is_system boolean not null default false,       -- built-in roles cannot be deleted
  portal text not null default 'staff' check (portal in ('staff','student')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  module text not null,
  action text not null check (action in ('view','create','edit','delete','export')),
  description text,
  created_at timestamptz not null default now(),
  unique (module, action)
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);
create index if not exists idx_role_permissions_perm on public.role_permissions(permission_id);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  full_name text not null,
  email text not null,
  phone text,
  avatar_path text,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz
);
create index if not exists idx_profiles_role on public.profiles(role_id);
create index if not exists idx_profiles_name_trgm on public.profiles using gin (full_name gin_trgm_ops);

select public.attach_std_triggers('roles');
select public.attach_std_triggers('profiles');

-- Role key of the current user (null when not logged in / inactive)
create or replace function public.current_role_key()
returns text language sql stable security definer set search_path = public as $$
  select r.key
  from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.id = auth.uid() and p.is_active and p.deleted_at is null
$$;

create or replace function public.is_system_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role_key() = 'system_admin', false)
$$;

-- Core permission check used by every RLS policy.
-- System Administrator implicitly has every permission.
-- Modules 'users' and 'roles' are reserved for the System Administrator only.
create or replace function public.has_permission(p_module text, p_action text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid()
      and p.is_active
      and p.deleted_at is null
      and (
        r.key = 'system_admin'
        or (
          p_module not in ('users','roles')
          and exists (
            select 1 from public.role_permissions rp
            join public.permissions pm on pm.id = rp.permission_id
            where rp.role_id = r.id and pm.module = p_module and pm.action = p_action
          )
        )
      )
  )
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p join public.roles r on r.id = p.role_id
    where p.id = auth.uid() and p.is_active and p.deleted_at is null and r.portal = 'staff'
  )
$$;

-- All permissions of the current user as "module:action" strings (used by the app)
create or replace function public.my_permissions()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(pm.module || ':' || pm.action order by pm.module, pm.action), '{}')
  from public.permissions pm
  where public.has_permission(pm.module, pm.action)
$$;

-- Everything the app needs about the current user in one round trip
create or replace function public.my_context()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'full_name', p.full_name, 'email', p.email, 'phone', p.phone, 'avatar_path', p.avatar_path,
    'is_active', p.is_active and p.deleted_at is null,
    'role_key', r.key, 'role_name', r.name, 'portal', r.portal,
    'permissions', public.my_permissions())
  from public.profiles p join public.roles r on r.id = p.role_id
  where p.id = auth.uid()
$$;

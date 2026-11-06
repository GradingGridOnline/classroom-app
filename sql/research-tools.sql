-- =====================================================================
-- Research Tools (Study Item Coding Tool) — run this ONCE in Supabase:
--   Dashboard → SQL Editor → New query → paste this whole file → Run.
-- Safe to run again later (it only creates what is missing / replaces functions).
--
-- How it keeps data safe
--  * You (signed in) can only ever see and change your own tools (Row Level Security).
--  * A researcher never touches the tables. They call the rt_* functions below with the
--    tool link + their username + password. Passwords are stored hashed (bcrypt), a login
--    locks for 15 minutes after 8 wrong tries, and a researcher only ever receives the
--    columns you chose to show them (never the other columns of your spreadsheet).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.rt_tools (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind        text not null default 'coding',
  title       text not null default 'Untitled tool',
  token       text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  config      jsonb not null default '{}'::jsonb,
  item_count  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.rt_items (
  tool_id uuid not null references public.rt_tools(id) on delete cascade,
  idx     integer not null,
  data    jsonb not null,
  primary key (tool_id, idx)
);

create table if not exists public.rt_access (
  id           uuid primary key default gen_random_uuid(),
  tool_id      uuid not null references public.rt_tools(id) on delete cascade,
  username     text not null,
  pass_hash    text not null,
  label        text,
  revoked      boolean not null default false,
  failed       integer not null default 0,
  locked_until timestamptz,
  created_at   timestamptz not null default now(),
  last_login   timestamptz,
  unique (tool_id, username)
);

-- coder = a researcher's rt_access id (as text), or 'owner' for the tool's owner coding it themselves
create table if not exists public.rt_codings (
  tool_id  uuid not null references public.rt_tools(id) on delete cascade,
  coder    text not null,
  idx      integer not null,
  codes    jsonb not null default '[]'::jsonb,
  note     text not null default '',
  coded_at timestamptz not null default now(),
  primary key (tool_id, coder, idx)
);

alter table public.rt_tools   enable row level security;
alter table public.rt_items   enable row level security;
alter table public.rt_access  enable row level security;
alter table public.rt_codings enable row level security;

revoke all on public.rt_tools, public.rt_items, public.rt_access, public.rt_codings from anon;
revoke all on public.rt_tools, public.rt_items, public.rt_access, public.rt_codings from authenticated;
grant select, insert, update, delete on public.rt_tools, public.rt_items, public.rt_codings to authenticated;
-- researcher logins are created by rt_create_access(); the owner can see them (but never the password hash), rename, revoke or delete them
grant select (id, tool_id, username, label, revoked, failed, locked_until, created_at, last_login) on public.rt_access to authenticated;
grant update (label, revoked, failed, locked_until) on public.rt_access to authenticated;
grant delete on public.rt_access to authenticated;

drop policy if exists rt_tools_owner on public.rt_tools;
create policy rt_tools_owner on public.rt_tools for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists rt_items_owner on public.rt_items;
create policy rt_items_owner on public.rt_items for all to authenticated
  using (exists (select 1 from public.rt_tools t where t.id = tool_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from public.rt_tools t where t.id = tool_id and t.owner_id = auth.uid()));

drop policy if exists rt_access_owner on public.rt_access;
create policy rt_access_owner on public.rt_access for all to authenticated
  using (exists (select 1 from public.rt_tools t where t.id = tool_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from public.rt_tools t where t.id = tool_id and t.owner_id = auth.uid()));

drop policy if exists rt_codings_owner on public.rt_codings;
create policy rt_codings_owner on public.rt_codings for all to authenticated
  using (exists (select 1 from public.rt_tools t where t.id = tool_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from public.rt_tools t where t.id = tool_id and t.owner_id = auth.uid()));

-- ---------- helpers ----------
create or replace function public.rt_random(n integer, alphabet text) returns text
language plpgsql volatile set search_path = public, extensions as $$
declare s text := ''; b bytea := gen_random_bytes(n); i integer;
begin
  for i in 0 .. n - 1 loop
    s := s || substr(alphabet, (get_byte(b, i) % length(alphabet)) + 1, 1);
  end loop;
  return s;
end $$;

-- Owner: make a new researcher login. Returns the password ONCE (only its hash is kept).
create or replace function public.rt_create_access(p_tool uuid, p_label text)
returns table (access_id uuid, username text, password text)
language plpgsql security definer set search_path = public, extensions as $$
declare v_user text; v_pw text; v_id uuid;
begin
  if auth.uid() is null or not exists (select 1 from rt_tools t where t.id = p_tool and t.owner_id = auth.uid()) then
    raise exception 'Not your tool';
  end if;
  loop
    v_user := 'res-' || rt_random(5, 'abcdefghjkmnpqrstuvwxyz23456789');
    exit when not exists (select 1 from rt_access a where a.tool_id = p_tool and a.username = v_user);
  end loop;
  v_pw := rt_random(10, 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789');
  insert into rt_access (tool_id, username, pass_hash, label)
    values (p_tool, v_user, crypt(v_pw, gen_salt('bf')), nullif(trim(p_label), ''))
    returning id into v_id;
  return query select v_id, v_user, v_pw;
end $$;

-- Owner: give an existing researcher a new password (the old one stops working, lock cleared).
create or replace function public.rt_reset_access(p_access uuid)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_pw text;
begin
  if auth.uid() is null or not exists (
    select 1 from rt_access a join rt_tools t on t.id = a.tool_id where a.id = p_access and t.owner_id = auth.uid()
  ) then raise exception 'Not your tool'; end if;
  v_pw := rt_random(10, 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789');
  update rt_access set pass_hash = crypt(v_pw, gen_salt('bf')), failed = 0, locked_until = null, revoked = false where id = p_access;
  return v_pw;
end $$;

-- Internal: check link + username + password. Returns (access id, tool id, error). Never raises, so the
-- failed-attempt counter is kept. Not callable from outside.
create or replace function public.rt_auth(p_token text, p_user text, p_pass text)
returns table (access_id uuid, tool_id uuid, err text)
language plpgsql security definer set search_path = public, extensions as $$
declare t rt_tools; a rt_access;
begin
  select * into t from rt_tools where token = coalesce(p_token, '');
  if t.id is not null then
    select * into a from rt_access where rt_access.tool_id = t.id and rt_access.username = lower(trim(coalesce(p_user, '')));
  end if;
  if t.id is null or a.id is null then
    perform pg_sleep(0.6);
    return query select null::uuid, null::uuid, 'invalid'::text; return;
  end if;
  if a.revoked then return query select null::uuid, null::uuid, 'revoked'::text; return; end if;
  if a.locked_until is not null and a.locked_until > now() then
    return query select null::uuid, null::uuid, 'locked'::text; return;
  end if;
  if crypt(coalesce(p_pass, ''), a.pass_hash) <> a.pass_hash then
    update rt_access set failed = failed + 1,
           locked_until = case when failed + 1 >= 8 then now() + interval '15 minutes' else locked_until end
     where id = a.id;
    perform pg_sleep(0.6);
    return query select null::uuid, null::uuid, 'invalid'::text; return;
  end if;
  update rt_access set failed = 0, locked_until = null, last_login = now() where id = a.id;
  return query select a.id, t.id, null::text;
end $$;
revoke all on function public.rt_auth(text, text, text) from public, anon, authenticated;

-- Researcher: sign in. Returns the tool's title / settings and how many items they have coded.
create or replace function public.rt_login(p_token text, p_user text, p_pass text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r record; t rt_tools; v_label text; v_coded integer;
begin
  select * into r from rt_auth(p_token, p_user, p_pass);
  if r.err is not null then return jsonb_build_object('ok', false, 'error', r.err); end if;
  select * into t from rt_tools where id = r.tool_id;
  select label into v_label from rt_access where id = r.access_id;
  select count(*) into v_coded from rt_codings c where c.tool_id = t.id and c.coder = r.access_id::text and (jsonb_array_length(c.codes) > 0 or c.note <> '');
  return jsonb_build_object('ok', true, 'title', t.title, 'kind', t.kind, 'config', t.config - 'shownCols',
                            'item_count', t.item_count, 'label', v_label, 'coded', v_coded);
end $$;

-- Researcher: fetch a page of items (only the columns the owner chose to show) with their own codings.
create or replace function public.rt_fetch(p_token text, p_user text, p_pass text, p_from integer, p_count integer)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r record; t rt_tools; v_items jsonb; v_cols text[];
begin
  select * into r from rt_auth(p_token, p_user, p_pass);
  if r.err is not null then return jsonb_build_object('ok', false, 'error', r.err); end if;
  select * into t from rt_tools where id = r.tool_id;
  select coalesce(array_agg(x), '{}') into v_cols from jsonb_array_elements_text(coalesce(t.config -> 'shownCols', '[]'::jsonb)) x;
  select coalesce(jsonb_agg(jsonb_build_object(
           'idx', i.idx,
           'data', (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(i.data) e(k, v) where k = any (v_cols)),
           'codes', coalesce(c.codes, '[]'::jsonb),
           'note', coalesce(c.note, '')) order by i.idx), '[]'::jsonb)
    into v_items
    from (select * from rt_items where rt_items.tool_id = t.id and idx >= greatest(coalesce(p_from, 0), 0)
          order by idx limit least(greatest(coalesce(p_count, 500), 1), 500)) i
    left join rt_codings c on c.tool_id = t.id and c.coder = r.access_id::text and c.idx = i.idx;
  return jsonb_build_object('ok', true, 'items', v_items);
end $$;

-- Researcher: save the codes (and optional note) for one item.
create or replace function public.rt_save(p_token text, p_user text, p_pass text, p_idx integer, p_codes jsonb, p_note text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r record; v_codes jsonb;
begin
  select * into r from rt_auth(p_token, p_user, p_pass);
  if r.err is not null then return jsonb_build_object('ok', false, 'error', r.err); end if;
  if not exists (select 1 from rt_items i where i.tool_id = r.tool_id and i.idx = p_idx) then
    return jsonb_build_object('ok', false, 'error', 'no such item');
  end if;
  v_codes := case when jsonb_typeof(p_codes) = 'array' then p_codes else '[]'::jsonb end;
  if jsonb_array_length(v_codes) > 50 then return jsonb_build_object('ok', false, 'error', 'too many codes'); end if;
  insert into rt_codings (tool_id, coder, idx, codes, note, coded_at)
    values (r.tool_id, r.access_id::text, p_idx, v_codes, left(coalesce(p_note, ''), 5000), now())
    on conflict (tool_id, coder, idx) do update set codes = excluded.codes, note = excluded.note, coded_at = now();
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.rt_create_access(uuid, text), public.rt_reset_access(uuid) from public, anon;
grant execute on function public.rt_create_access(uuid, text), public.rt_reset_access(uuid) to authenticated;
revoke all on function public.rt_login(text, text, text), public.rt_fetch(text, text, text, integer, integer),
  public.rt_save(text, text, text, integer, jsonb, text) from public;
grant execute on function public.rt_login(text, text, text), public.rt_fetch(text, text, text, integer, integer),
  public.rt_save(text, text, text, integer, jsonb, text) to anon, authenticated;

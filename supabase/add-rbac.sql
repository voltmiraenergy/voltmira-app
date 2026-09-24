-- add-rbac.sql
-- Turns profiles.title (add-profile-title.sql — Sales/Engineer/Manager,
-- collected at invite time) from a cosmetic label into real enforcement:
-- Sales sees/edits only their own projects, only Engineer/Manager/owner can
-- touch a project's technical config (BOM/inverter), and only Manager/owner
-- sees OTHER teammates' pipeline numbers on the Team page (lib/rbac.js).
--
-- Ships OFF. This is a real behaviour change for any teammate who already
-- has an explicit title set (most don't — the column defaults to '' and
-- only the invite form's Sales/Engineer/Manager picker, added after most
-- real teams here were built, ever writes a non-empty value) — an owner
-- should turn it on deliberately, after checking each teammate's title in
-- the Team page, not have it silently start restricting someone the moment
-- this migration runs.

alter table companies add column if not exists rbac_enabled boolean not null default false;

-- The editor autosaves DIRECTLY from the browser (supabaseBrowser().update(),
-- see app/(app)/projects/[id]/editor.jsx) — there is no server action in
-- between to strip a field, unlike saveCompany()'s owner-only engine fields.
-- So the ONLY place that can actually stop a Sales-titled member from saving
-- a BOM/kw/battery change — bypassing the UI entirely, e.g. via curl with
-- their own real session cookie — is a database trigger. Hiding the BOM card
-- client-side (lib/rbac.js's canEditTechnical, used in editor.jsx) is the
-- normal UX path; this is the real, unbypassable backstop, same spirit as
-- projects_all's existing my_company_id() RLS policy.
--
-- auth.uid() is NULL for this app's own server-side calls made with the
-- service-role key (every app/api/* route already runs its own authorization
-- before touching `projects`) — this trigger only ever fires for a normal
-- user session, never second-guessing this codebase's own service-role code.
create or replace function enforce_project_rbac() returns trigger
language plpgsql security definer as $$
declare
  co_rbac boolean;
  actor_role text;
  actor_title text;
begin
  if auth.uid() is null then
    return new;
  end if;

  select rbac_enabled into co_rbac from companies where id = new.company_id;
  if not coalesce(co_rbac, false) then
    return new;
  end if;

  select role, title into actor_role, actor_title from profiles where id = auth.uid();
  if actor_role = 'owner' or coalesce(actor_title, '') <> 'sales' then
    return new;
  end if;

  -- A Sales-titled member may still update their OWN project's client info,
  -- status, notes, etc. — only the technical/pricing-relevant columns are
  -- blocked, and only when they actually changed.
  if new.bom is distinct from old.bom
     or new.kw is distinct from old.kw
     or new.batt is distinct from old.batt
     or new.batt_kwh is distinct from old.batt_kwh then
    raise exception 'rbac: sales cannot edit technical configuration';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_project_rbac on projects;
create trigger trg_enforce_project_rbac before update on projects
  for each row execute function enforce_project_rbac();

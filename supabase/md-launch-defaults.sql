-- md-launch-defaults.sql
-- VoltMira launches in Moldova first. A new workspace should start the way a
-- Moldovan installer works: market Moldova (net billing), prices in MDL, and
-- the app in Romanian, or in the language they signed up in.
--
-- Existing workspaces are untouched; each can still change market, currency
-- and language in Settings. Idempotent: safe to run more than once.
-- Supersedes md-default-market.sql (included here, so running only this is fine).

alter table companies alter column default_market set default 'MD';
alter table companies alter column currency       set default 'MDL';
alter table companies alter column lang           set default 'ro';
alter table projects  alter column market         set default 'MD';

-- The sign-up language, so a Russian-speaking installer who registers on the
-- Russian sign-in page gets the app in Russian. The two-argument version stays
-- for older clients and simply takes the table default above.
create or replace function bootstrap_company(company_name text, user_name text, company_lang text)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if exists (select 1 from profiles where id = auth.uid()) then
    return my_company_id();
  end if;
  insert into companies (name, lang)
    values (coalesce(nullif(company_name,''), 'My Solar Company'),
            case when company_lang in ('ro','ru','en') then company_lang else 'ro' end)
    returning id into cid;
  insert into profiles (id, company_id, name, role, email)
    values (auth.uid(), cid, coalesce(user_name,''), 'owner',
            coalesce((select email from auth.users where id = auth.uid()), ''));
  return cid;
end $$;

revoke all on function bootstrap_company(text, text, text) from public;
grant execute on function bootstrap_company(text, text, text) to authenticated;

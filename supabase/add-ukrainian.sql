-- add-ukrainian.sql
-- Ukraine as a place to work in: the Ukrainian language, the UA market (green
-- tariff, oblenergo paperwork, outage plan) and the hryvnia. Until this runs,
-- the database refuses 'uk', 'UA' and 'UAH', and Settings says so. Safe to run twice.

-- the interface language
alter table companies drop constraint if exists companies_lang_check;
alter table companies add constraint companies_lang_check
  check (lang in ('en','ro','ru','uk'));

-- the country a workspace quotes in, and each quote's own market
alter table companies drop constraint if exists companies_default_market_check;
alter table companies add constraint companies_default_market_check
  check (default_market in ('RO','MD','UA'));
alter table projects drop constraint if exists projects_market_check;
alter table projects add constraint projects_market_check
  check (market in ('RO','MD','UA'));

-- the display currency
alter table companies drop constraint if exists companies_currency_check;
alter table companies add constraint companies_currency_check
  check (currency in ('EUR','RON','MDL','UAH'));

-- A Ukrainian quote's outage and loan plan (components/UaPanel.jsx): typical
-- outage hours, what stays on, generator size, Energy Credit term. Frozen into
-- the proposal with everything else.
alter table projects add column if not exists ua_plan jsonb not null default '{}'::jsonb;

-- the landing-page waitlist, where it exists
do $$
begin
  if to_regclass('public.waitlist') is not null then
    alter table waitlist drop constraint if exists waitlist_lang_check;
    alter table waitlist add constraint waitlist_lang_check
      check (lang in ('en','ro','ru','uk'));
  end if;
end $$;

-- The sign-up language. An installer who registers on the Ukrainian sign-in
-- page starts in Ukraine: Ukrainian, the UA market and hryvnia (all three can
-- be changed in Settings). Everyone else keeps the Moldovan defaults from
-- md-launch-defaults.sql.
create or replace function bootstrap_company(company_name text, user_name text, company_lang text)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if exists (select 1 from profiles where id = auth.uid()) then
    return my_company_id();
  end if;
  if company_lang = 'uk' then
    insert into companies (name, lang, default_market, currency)
      values (coalesce(nullif(company_name,''), 'My Solar Company'), 'uk', 'UA', 'UAH')
      returning id into cid;
  else
    insert into companies (name, lang)
      values (coalesce(nullif(company_name,''), 'My Solar Company'),
              case when company_lang in ('ro','ru','en') then company_lang else 'ro' end)
      returning id into cid;
  end if;
  insert into profiles (id, company_id, name, role, email)
    values (auth.uid(), cid, coalesce(user_name,''), 'owner',
            coalesce((select email from auth.users where id = auth.uid()), ''));
  return cid;
end $$;

revoke all on function bootstrap_company(text, text, text) from public;
grant execute on function bootstrap_company(text, text, text) to authenticated;

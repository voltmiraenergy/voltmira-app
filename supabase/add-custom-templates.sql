-- add-custom-templates.sql
-- White-labeling (Team+/Enterprise, lib/features.js): lets an installer save
-- their OWN wording for the two VoltMira-authored documents (the service
-- contract and the commissioning act, lib/legalDocs.js) instead of always
-- getting the built-in default text. NULL/blank = keep using the default —
-- nothing changes for a company that never opens the White-labeling section
-- in Settings.
--
-- Nullable, no default: unlike a boolean opt-in flag, an empty string and "no
-- override" mean the exact same thing here, so there's nothing to grandfather.

alter table companies add column if not exists contract_template_override text;
alter table companies add column if not exists commissioning_template_override text;

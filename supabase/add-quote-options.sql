-- add-quote-options.sql
-- Side-by-side options: an installer can attach up to a couple of alternative
-- configurations to a quote (e.g. "6 kW" vs "8 kW + battery"). Stored as a small
-- array of {label, kw, battKwh}; the base quote stays the recommended one. The
-- proposal computes each option's payback and shows them side by side.
-- Idempotent; degrades gracefully (missing column is treated as []).

alter table projects add column if not exists options jsonb not null default '[]'::jsonb;

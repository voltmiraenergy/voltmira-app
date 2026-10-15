"use server";
// lib/greenActions.js — the server side of the green-energy module: store who
// the client is on a quote (household, small business or company), which
// decides the support programmes that fit it (lib/greenSupport.js), and
// whether the client's offer shows the line about the job's area from CNED's
// register (components/RaionCard.jsx). Runs on the caller's own Supabase
// session, so row-level security scopes the write to their company.
import { revalidatePath } from "next/cache";
import { supabaseServer } from "./supabase.js";
import { CLIENT_KINDS } from "./greenSupport.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param {string} projectId
 * @param {"household"|"sme"|"company"|null} kind
 * @returns {Promise<{ ok: boolean, needsDb?: boolean, error?: string }>}
 */
export async function setClientKind(projectId, kind) {
  if (!UUID.test(String(projectId || ""))) return { ok: false, error: "bad_id" };
  const value = kind == null ? null : String(kind);
  if (value !== null && !CLIENT_KINDS.includes(value)) return { ok: false, error: "bad_kind" };
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "auth" };
  const { data, error } = await sb.from("projects").update({ client_kind: value }).eq("id", projectId).select("id");
  // the column arrives with supabase/add-client-kind.sql; until then say so
  if (error) return { ok: false, needsDb: /client_kind|schema cache|does not exist/i.test(error.message || ""), error: "write" };
  if (!data || !data.length) return { ok: false, error: "missing" };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

/**
 * Show the area line in the client's offer, or not.
 * @param {string} projectId
 * @param {boolean} on
 * @returns {Promise<{ ok: boolean, needsDb?: boolean, error?: string }>}
 */
export async function setShowRaion(projectId, on) {
  if (!UUID.test(String(projectId || ""))) return { ok: false, error: "bad_id" };
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "auth" };
  const { data, error } = await sb.from("projects").update({ show_raion: !!on }).eq("id", projectId).select("id");
  // the column arrives with supabase/add-show-raion.sql; until then say so
  if (error) return { ok: false, needsDb: /show_raion|schema cache|does not exist/i.test(error.message || ""), error: "write" };
  if (!data || !data.length) return { ok: false, error: "missing" };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

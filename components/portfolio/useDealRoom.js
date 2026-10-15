"use client";
// components/portfolio/useDealRoom.js — one plant's deal room in the browser:
// its documents, the bank's questions, the links and the access log, read and
// written through the user's own session (row-level security keeps them in
// the company; supabase/add-deal-room.sql). Files go straight from the browser
// to the private bucket, so a large scan never passes through a function.
// Reloads when the tab comes back into view, so a new question shows up.
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "../../lib/supabase-browser.js";
import { createDealLink, revokeDealLink } from "../../lib/dealActions.js";
import { DEAL_BUCKET, ITEM_IDS, checkUpload, docPath, MAX_ANSWER } from "../../lib/dealRoom.js";

const NEEDS_DB = /deal_|schema cache|does not exist|relation/i;
const EMPTY = { ready: false, needsDb: false, docs: [], questions: [], links: [], views: [] };
const nonce = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, "0")).join("");

export function useDealRoom({ portfolioId, plantId, companyId }) {
  const [state, setState] = useState(EMPTY);
  const alive = useRef(true);
  const on = !!(portfolioId && plantId);

  const load = useCallback(async () => {
    if (!on) return;
    const sb = supabaseBrowser();
    const scope = (q) => q.eq("portfolio_id", portfolioId).eq("plant_id", plantId);
    const [d, q, l, v] = await Promise.all([
      scope(sb.from("deal_documents").select("id, item_id, name, path, size_bytes, mime, created_at")).order("created_at", { ascending: true }),
      scope(sb.from("deal_questions").select("*")).order("created_at", { ascending: false }),
      scope(sb.from("deal_links").select("*")).order("created_at", { ascending: false }),
      scope(sb.from("deal_views").select("id, link_id, what, detail, visitor, agent, at")).order("at", { ascending: false }).limit(300),
    ]);
    if (!alive.current) return;
    const err = d.error || q.error || l.error || v.error;
    if (err) { setState({ ...EMPTY, ready: true, needsDb: NEEDS_DB.test(err.message || "") }); return; }
    setState({ ready: true, needsDb: false, docs: d.data || [], questions: q.data || [], links: l.data || [], views: v.data || [] });
  }, [on, portfolioId, plantId]);

  useEffect(() => {
    alive.current = true;
    // the first read happens after mount, when the browser client exists
    const t = setTimeout(load, 0);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive.current = false; clearTimeout(t); document.removeEventListener("visibilitychange", onVis); };
  }, [load]);

  /** File documents under an item. Returns the problems, one per file that was not filed. */
  const upload = useCallback(async (itemId, files) => {
    if (!ITEM_IDS.includes(itemId) || !companyId) return [{ name: "", error: "save" }];
    const sb = supabaseBrowser();
    const problems = [];
    for (const f of Array.from(files || [])) {
      const ok = checkUpload({ name: f.name, size: f.size });
      if (!ok.ok) { problems.push({ name: f.name, error: ok.error }); continue; }
      const path = docPath({ companyId, portfolioId, plantId, itemId, fileName: f.name, nonce: nonce() });
      const up = await sb.storage.from(DEAL_BUCKET).upload(path, f, { contentType: ok.mime, upsert: false });
      if (up.error) { problems.push({ name: f.name, error: "save" }); continue; }
      const ins = await sb.from("deal_documents").insert({
        portfolio_id: portfolioId, plant_id: plantId, item_id: itemId, name: f.name.slice(0, 200), path, size_bytes: f.size, mime: ok.mime,
      });
      if (ins.error) {
        // a row that could not be written leaves no file behind
        await sb.storage.from(DEAL_BUCKET).remove([path]);
        problems.push({ name: f.name, error: "save" });
      }
    }
    await load();
    return problems;
  }, [companyId, portfolioId, plantId, load]);

  const remove = useCallback(async (doc) => {
    const sb = supabaseBrowser();
    const del = await sb.from("deal_documents").delete().eq("id", doc.id);
    if (del.error) return false;
    await sb.storage.from(DEAL_BUCKET).remove([doc.path]);
    await load();
    return true;
  }, [load]);

  /** Open a document through a signed address valid for a minute. */
  const download = useCallback(async (doc) => {
    const { data, error } = await supabaseBrowser().storage.from(DEAL_BUCKET).createSignedUrl(doc.path, 60, { download: doc.name });
    if (!error && data?.signedUrl) window.location.assign(data.signedUrl);
    return !error;
  }, []);

  const answer = useCallback(async (q, { text, docId }) => {
    const sb = supabaseBrowser();
    const { data: { session } } = await sb.auth.getSession();
    const body = String(text || "").trim().slice(0, MAX_ANSWER);
    const { error } = await sb.from("deal_questions").update({
      answer: body, answer_doc_id: docId || null, answered_at: body || docId ? new Date().toISOString() : null, answered_by: session?.user?.id || null,
    }).eq("id", q.id);
    if (!error) await load();
    return !error;
  }, [load]);

  const createLink = useCallback(async (opts) => {
    const r = await createDealLink({ portfolioId, plantId, ...opts }).catch(() => ({ ok: false, error: "save" }));
    if (r.ok) await load();
    return r;
  }, [portfolioId, plantId, load]);

  /** Turn a link's email alerts on or off. */
  const setNotify = useCallback(async (link, on) => {
    const { error } = await supabaseBrowser().from("deal_links").update({ notify: !!on }).eq("id", link.id);
    if (!error) await load();
    return !error;
  }, [load]);

  const revoke = useCallback(async (id) => {
    const r = await revokeDealLink(id).catch(() => ({ ok: false }));
    if (r.ok) await load();
    return r;
  }, [load]);

  return { ...state, on, reload: load, upload, remove, download, answer, createLink, revoke, setNotify };
}

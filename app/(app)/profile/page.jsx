// app/(app)/profile/page.jsx — the individual user's own profile (the "human
// layer"), separate from the company identity in Settings. Loads the caller's
// own profile row via the service role (profiles RLS recurses on a session read).
import { redirect } from "next/navigation";
import { supabaseServer, supabaseAdmin } from "../../../lib/supabase.js";
import { currentCompany } from "../../../lib/session.js";
import { normLang } from "../../../lib/i18n.js";
import ProfileForm from "./ProfileForm.jsx";
import { appTitle } from "../../../lib/pageTitle.js";

export const dynamic = "force-dynamic";
export const generateMetadata = appTitle("pf_title");

export default async function ProfilePage() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const co = await currentCompany();
  const lang = normLang(co?.lang);
  const { data: profile } = await supabaseAdmin().from("profiles").select("*").eq("id", user.id).maybeSingle();
  return <ProfileForm lang={lang} email={user.email || ""} companyName={co?.name || ""} initial={profile || {}} userId={user.id} />;
}

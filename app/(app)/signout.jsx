"use client";
import { supabaseBrowser } from "../../lib/supabase-browser.js";
import { t } from "../../lib/i18n.js";

export default function SignOut({ lang }) {
  return (
    <button className="reset-link" onClick={async () => { await supabaseBrowser().auth.signOut(); location.href = "/login"; }}>
      {t("sign_out", lang)}
    </button>
  );
}

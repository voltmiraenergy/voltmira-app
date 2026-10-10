"use client";
import { supabaseBrowser } from "../../lib/supabase-browser.js";
import { t } from "../../lib/i18n.js";
import { clearOfflineData, pendingOutbox } from "../../lib/offline.js";

export default function SignOut({ lang }) {
  return (
    <button className="reset-link" onClick={async () => {
      // Quote edits made with no signal that never reached the server go with
      // the sign-out (nothing of this workspace stays on the device), so ask first.
      if (pendingOutbox() > 0 && !window.confirm(t("offline_signout_pending", lang))) return;
      await clearOfflineData();
      await supabaseBrowser().auth.signOut();
      location.href = "/login";
    }}>
      {t("sign_out", lang)}
    </button>
  );
}

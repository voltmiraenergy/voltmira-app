"use client";
// app/(app)/projects/StatusChip.jsx — click-to-cycle status chip as a client
// button (type="button") so it lives happily inside the bulk-select <form>
// without being nested-form invalid or accidentally submitting it.
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cycleProjectStatus } from "../../../lib/actions.js";
import { t } from "../../../lib/i18n.js";

export default function StatusChip({ id, status, lang }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" className={`chip ${status}`} disabled={pending}
      onClick={() => start(() => cycleProjectStatus(id).then(() => router.refresh()))}>
      {t("st_" + status, lang)}
    </button>
  );
}

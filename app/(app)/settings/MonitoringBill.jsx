"use client";
// app/(app)/settings/MonitoringBill.jsx — the workspace's monitoring bill on
// the Plan tab: how many systems are monitored now and what that is a month
// (lib/monitoringPricing.js, through app/api/monitoring/bill). While billing
// is off it says monitoring is free and what it will cost.
import { useEffect, useState } from "react";
import { t } from "../../../lib/i18n.js";

export default function MonitoringBill({ lang = "en" }) {
  const [b, setB] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/monitoring/bill", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (alive && j) setB(j); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!b) return null;
  const eur = (v) => Number(v).toLocaleString(lang === "en" ? "en-IE" : lang === "ro" ? "ro-RO" : lang === "ru" ? "ru-RU" : "uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <>
      <p className="st-p">{t("mb_count", lang, { n: b.systems, c: b.connected })}</p>
      {!b.billed
        ? <p className="st-p">{t("mb_free", lang, { free: b.freeSystems, eur: eur(b.eurPerSystem) })}</p>
        : b.billable > 0
          ? <p className="st-p"><b>{t("mb_due", lang, { billable: b.billable, free: b.freeSystems, amount: eur(b.monthlyEur) })}</b></p>
          : <p className="st-p">{t("mb_under", lang, { free: b.freeSystems })}</p>}
    </>
  );
}

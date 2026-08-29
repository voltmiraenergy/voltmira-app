"use client";
// app/(app)/studio/page.jsx — the Studio landing. The pill row (in the layout) is
// the nav; this page is a flat, described list of every surface. No roadmap-tier
// language — installers just see what each one does.
import { useEffect } from "react";
import Link from "next/link";
import { PREVIEW_FEATURES, PREVIEW_BASE } from "./features.js";
import { useLang, tx, FeatureIcon, PreviewBadge } from "./studio-kit.jsx";

const Chevron = () => (
  <svg className="st-row-go" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
);

export default function StudioOverview() {
  const lang = useLang();
  useEffect(() => { document.title = "Studio — VoltMira"; }, []);

  return (
    <>
      <div className="pv-head">
        <div className="pv-head-ic"><FeatureIcon slug="overview" size={20} /></div>
        <div className="pv-head-tx">
          <div className="pv-head-t">
            <h1>Studio</h1>
            <PreviewBadge lang={lang} />
          </div>
          <p>{tx({
            en: "Five tools that carry a signed offer the rest of the way: the connection and Casa Verde file, the technical annex, distributor pricing, a bank-ready P50 / P90 export, and your public calculator widget.",
            ro: "Cinci instrumente care duc o ofertă semnată mai departe: dosarul de racordare și Casa Verde, anexa tehnică, prețurile distribuitorilor, un export P50 / P90 pentru bancă și widgetul public de calcul.",
            ru: "Пять инструментов, которые доводят подписанное предложение до конца: пакет на подключение и Casa Verde, техническое приложение, цены дистрибьюторов, банковский экспорт P50 / P90 и публичный виджет-калькулятор.",
          }, lang)}</p>
        </div>
      </div>

      <div className="st-list">
        {PREVIEW_FEATURES.map((f) => {
          const L = f[lang] || f.en;
          return (
            <Link key={f.slug} href={`${PREVIEW_BASE}/${f.slug}`} className="st-row">
              <span className="st-row-ic"><FeatureIcon slug={f.slug} size={17} /></span>
              <span className="st-row-tx"><b>{L.name}</b><span>{L.short}</span></span>
              <Chevron />
            </Link>
          );
        })}
      </div>
    </>
  );
}

"use client";
// Studio · Equipment catalog.
// Real panels, inverters, batteries and mounting — specifications, stock and
// lead time, not a single hardcoded system. Picking a product here for the
// active client is the one place that choice is made: the quote, the annex and
// the install schedule all resolve the same client's equipment from here
// (systemFor(client) in catalog-data.js), so they can never disagree.
import { useMemo, useState } from "react";
import {
  useLang, tx, PreviewHeader, MockNote, NUM,
  useStudioClient, ClientBar, systemFor,
  PANELS, INVERTERS, BATTERIES, MOUNTS, SUPPLIERS, findSupplier,
} from "../studio-kit.jsx";

const TX = {
  title: { en: "Equipment catalog", ro: "Catalog echipamente", ru: "Каталог оборудования" },
  sub: {
    en: "Every SKU with real electrical specifications, stock and lead time — kept by the suppliers below, not invented per quote. Pick one for the active client, or let the offer auto-recommend it for you.",
    ro: "Fiecare SKU cu specificații electrice reale, stoc și termen de livrare — ținut de furnizorii de mai jos, nu inventat la fiecare ofertă. Alege unul pentru clientul activ, sau lasă oferta să-l recomande automat.",
    ru: "Каждый SKU с реальными характеристиками, наличием и сроком поставки — от поставщиков ниже, а не придуман под каждый расчёт. Выберите для активного клиента, или пусть расчёт порекомендует сам.",
  },
  note: {
    en: "Stock and lead time are a mock inventory snapshot (no live distributor feed yet). Prices are indicative EUR list prices, not a purchase order.",
    ro: "Stocul și termenul de livrare sunt un instantaneu mock de inventar (fără flux live de la distribuitor încă). Prețurile sunt orientative, în EUR, nu o comandă.",
    ru: "Наличие и срок поставки — мгновенный снимок (без живого канала от дистрибьютора). Цены ориентировочные, в евро.",
  },
  suppliers: { en: "Suppliers", ro: "Furnizori", ru: "Поставщики" },
  allSuppliers: { en: "All suppliers", ro: "Toți furnizorii", ru: "Все поставщики" },
  current: { en: "Current system — active client", ro: "Sistemul curent — clientul activ", ru: "Текущая система — активный клиент" },
  equipCost: { en: "Equipment cost (ex. labour)", ro: "Cost echipamente (fără manoperă)", ru: "Стоимость оборудования (без работ)" },
  all: { en: "All", ro: "Toate", ru: "Все" },
  panels: { en: "Panels", ro: "Panouri", ru: "Панели" },
  inverters: { en: "Inverters", ro: "Invertoare", ru: "Инверторы" },
  batteries: { en: "Batteries", ro: "Baterii", ru: "Батареи" },
  mounts: { en: "Mounting", ro: "Structuri", ru: "Крепления" },
  search: { en: "Search brand or model…", ro: "Caută brand sau model…", ru: "Поиск бренда или модели…" },
  inStock: { en: "in stock", ro: "în stoc", ru: "в наличии" },
  order: { en: "order", ro: "de comandat", ru: "на заказ" },
  days: { en: "d", ro: "z", ru: "дн" },
  use: { en: "Use for", ro: "Folosește pentru", ru: "Использовать для" },
  current_tag: { en: "current", ro: "curent", ru: "текущий" },
  cyclesLbl: { en: "cycle life", ro: "durată de viață (cicluri)", ru: "циклов" },
};

const KINDS = ["all", "panou", "invertor", "baterie", "structura"];
const KIND_LABEL = { all: "all", panou: "panels", invertor: "inverters", baterie: "batteries", structura: "mounts" };

export default function CatalogPreview() {
  const lang = useLang();
  const T = (o) => tx(o, lang);
  const { client, update } = useStudioClient();
  const [kind, setKind] = useState("all");
  const [supplier, setSupplier] = useState("all");
  const [q, setQ] = useState("");

  const sys = useMemo(() => systemFor(client), [client]);
  const kw = +client.kw || 0;
  const battKwh = +client.batteryKwh || 0;

  const modules = Math.max(1, Math.ceil((kw * 1000) / sys.panel.watt));
  const battUnits = battKwh > 0 ? Math.max(1, Math.ceil(battKwh / sys.battery.kwh)) : 0;
  const equipCost =
    modules * sys.panel.price +
    sys.inverter.price +
    battUnits * sys.battery.price +
    kw * sys.mount.eurPerKw;

  const rows = useMemo(() => {
    const all = [
      ...PANELS.map((p) => ({ ...p, kind: "panou" })),
      ...INVERTERS.map((p) => ({ ...p, kind: "invertor" })),
      ...BATTERIES.map((p) => ({ ...p, kind: "baterie" })),
      ...MOUNTS.map((p) => ({ ...p, kind: "structura" })),
    ];
    const needle = q.trim().toLowerCase();
    return all.filter((p) => (kind === "all" || p.kind === kind))
      .filter((p) => supplier === "all" || p.supplierId === supplier)
      .filter((p) => !needle || (p.brand + " " + p.model).toLowerCase().includes(needle));
  }, [kind, supplier, q]);

  const isCurrent = (p) =>
    (p.kind === "panou" && p.id === sys.panel.id) ||
    (p.kind === "invertor" && p.id === sys.inverter.id) ||
    (p.kind === "baterie" && p.id === sys.battery.id) ||
    (p.kind === "structura" && p.id === sys.mount.id);

  function selectProduct(p) {
    if (p.kind === "panou") update({ panelId: p.id });
    else if (p.kind === "invertor") update({ inverterId: p.id });
    else if (p.kind === "baterie") update({ batteryId: p.id });
    else if (p.kind === "structura") update({ mountId: p.id });
  }

  return (
    <>
      <PreviewHeader slug="catalog" lang={lang} title={T(TX.title)} sub={T(TX.sub)} />
      <MockNote>{T(TX.note)}</MockNote>

      <ClientBar lang={lang} />

      <div className="pv-panel">
        <h3>{T(TX.current)} · {client.name}</h3>
        <div className="cat-current">
          <div><span>{T(TX.panels)}</span><b>{modules} × {sys.panel.brand} {sys.panel.model}</b><em>{sys.panel.watt} Wp · {sys.panel.eff}%</em></div>
          <div><span>{T(TX.inverters)}</span><b>{sys.inverter.brand} {sys.inverter.model}</b><em>{sys.inverter.kw} kW · {sys.inverter.mppt} MPPT · {sys.inverter.phases === 3 ? "3~" : "1~"}</em></div>
          {battKwh > 0 && (
            <div><span>{T(TX.batteries)}</span><b>{battUnits} × {sys.battery.brand} {sys.battery.model}</b><em>{sys.battery.chem} · {NUM(sys.battery.cycles)} {tx({ ro: "cicluri", en: "cycles", ru: "циклов" }, lang)}</em></div>
          )}
          <div><span>{T(TX.mounts)}</span><b>{sys.mount.brand} {sys.mount.model}</b><em>{sys.mount.type}</em></div>
        </div>
        <div className="pv-metrics" style={{ marginTop: 14 }}>
          <div className="pv-metric good"><b>€{NUM(equipCost)}</b><span>{T(TX.equipCost)}</span></div>
        </div>
      </div>

      <div className="pv-panel">
        <h3>{T(TX.suppliers)}</h3>
        <div className="cat-suppliers">
          {SUPPLIERS.map((s) => (
            <button key={s.id} className={"cat-sup" + (supplier === s.id ? " on" : "")}
              onClick={() => setSupplier(supplier === s.id ? "all" : s.id)}>
              <b>{s.name}</b>
              <span>{s.location}</span>
              <em>{tx(s.note, lang)}</em>
            </button>
          ))}
        </div>
      </div>

      <div className="pv-panel">
        <div className="cat-toolbar">
          <div className="pv-fchips">
            {KINDS.map((k) => (
              <button key={k} className={"pv-fchip" + (kind === k ? " on" : "")} onClick={() => setKind(k)}>
                {tx(TX[KIND_LABEL[k]], lang)}
              </button>
            ))}
          </div>
          <input className="pv-input cat-search" placeholder={T(TX.search)} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {supplier !== "all" && (
          <div className="cat-supfilter">
            {T(TX.suppliers)}: <b>{findSupplier(supplier).name}</b>
            <button className="cat-supclear" onClick={() => setSupplier("all")}>{T(TX.allSuppliers)}</button>
          </div>
        )}

        <div className="cat-grid" style={{ marginTop: 16 }}>
          {rows.map((p) => {
            const cur = isCurrent(p);
            const inStock = p.kind === "structura" ? true : p.stock > 0;
            return (
              <div key={p.id} className={"cat-card" + (cur ? " cur" : "")}>
                {cur && <span className="cat-cur-tag">{T(TX.current_tag)}</span>}
                <div className="cat-card-h">
                  <span className="cat-kind">{tx(TX[KIND_LABEL[p.kind]], lang)}</span>
                  <b>{p.brand}</b>
                  <span className="cat-model">{p.model}</span>
                </div>
                <div className="cat-specs">
                  {p.kind === "panou" && (<>
                    <div><span>Wp</span><b>{p.watt}</b></div>
                    <div><span>Voc / Isc</span><b>{p.voc} V / {p.isc} A</b></div>
                    <div><span>{tx({ ro: "randament", en: "efficiency", ru: "КПД" }, lang)}</span><b>{p.eff}%</b></div>
                  </>)}
                  {p.kind === "invertor" && (<>
                    <div><span>kW</span><b>{p.kw}</b></div>
                    <div><span>{tx({ ro: "tip", en: "type", ru: "тип" }, lang)}</span><b>{p.type === "hybrid" ? tx({ ro: "hibrid", en: "hybrid", ru: "гибрид" }, lang) : "string"}</b></div>
                    <div><span>MPPT · {tx({ ro: "faze", en: "phases", ru: "фазы" }, lang)}</span><b>{p.mppt} · {p.phases === 3 ? "3~" : "1~"}</b></div>
                  </>)}
                  {p.kind === "baterie" && (<>
                    <div><span>kWh</span><b>{p.kwh}</b></div>
                    <div><span className={"cat-chem " + (p.chemClass === "LFP" ? "lfp" : "nmc")}>{p.chem}</span><b>{NUM(p.cycles)} {tx(TX.cyclesLbl, lang).split(" ").slice(-1)}</b></div>
                    <div><span>V</span><b>{p.vdc}</b></div>
                  </>)}
                  {p.kind === "structura" && (<>
                    <div><span>{tx({ ro: "tip", en: "type", ru: "тип" }, lang)}</span><b>{p.type}</b></div>
                    <div><span>€/kW</span><b>{p.eurPerKw}</b></div>
                  </>)}
                </div>
                <div className="cat-foot">
                  <span className={"cat-stock " + (inStock ? "ok" : "bad")}>
                    {p.kind === "structura" ? tx({ ro: "la comandă", en: "made to order", ru: "под заказ" }, lang)
                      : inStock ? `${NUM(p.stock)} ${T(TX.inStock)}` : T(TX.order)}
                  </span>
                  {p.leadDays > 0 && <span className="cat-lead">{p.leadDays}{T(TX.days)}</span>}
                  <b className="cat-price">€{p.kind === "structura" ? p.eurPerKw + "/kW" : NUM(p.price)}</b>
                </div>
                <div className="cat-supname">{findSupplier(p.supplierId).name}</div>
                <button className={"btn sm " + (cur ? "ghost" : "primary")} disabled={cur} onClick={() => selectProduct(p)}>
                  {cur ? T(TX.current_tag) : T(TX.use) + " " + client.name.split(" ").slice(-1)}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .cat-suppliers{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
        .cat-sup{text-align:left;font-family:inherit;background:var(--paper);border:1px solid var(--line);border-radius:11px;
          padding:11px 13px;cursor:pointer;display:flex;flex-direction:column;gap:2px;transition:border-color .14s,background .14s}
        .cat-sup:hover{border-color:var(--green)}
        .cat-sup.on{border-color:var(--green);background:var(--green-tint)}
        .cat-sup b{font-size:13px;color:var(--ink)}
        .cat-sup span{font-size:11px;color:var(--green-soft);font-weight:600}
        .cat-sup em{font-style:normal;font-size:11px;color:var(--muted);line-height:1.4;margin-top:2px}
        .cat-supfilter{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted);margin-top:12px}
        .cat-supclear{font-family:inherit;font-size:11px;font-weight:600;color:var(--green-soft);background:none;
          border:none;cursor:pointer;text-decoration:underline}
        .cat-supname{font-size:10.5px;color:var(--muted);margin-top:-4px}
        .cat-current{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:1px;background:var(--line);
          border:1px solid var(--line);border-radius:11px;overflow:hidden}
        .cat-current>div{background:var(--paper-2);padding:12px 14px;display:flex;flex-direction:column;gap:3px}
        .cat-current span{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
        .cat-current b{font-size:13px;color:var(--ink)}
        .cat-current em{font-style:normal;font-size:11.5px;color:var(--muted)}
        .cat-toolbar{display:flex;gap:14px;flex-wrap:wrap;align-items:center;justify-content:space-between}
        .cat-search{max-width:260px}
        .cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
        .cat-card{position:relative;background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:14px;
          display:flex;flex-direction:column;gap:11px}
        .cat-card.cur{border-color:var(--green);background:var(--green-tint)}
        .cat-cur-tag{position:absolute;top:-8px;right:12px;background:var(--green);color:#fff;font-size:9.5px;font-weight:700;
          text-transform:uppercase;letter-spacing:.05em;border-radius:99px;padding:2px 9px}
        .cat-card-h{display:flex;flex-direction:column;gap:1px}
        .cat-kind{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--green-soft)}
        .cat-card-h b{font-size:14.5px;color:var(--ink)}
        .cat-model{font-size:11.5px;color:var(--muted);line-height:1.35}
        .cat-specs{display:grid;grid-template-columns:1fr 1fr;gap:8px 10px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:9px 0}
        .cat-specs>div{display:flex;flex-direction:column;gap:2px}
        .cat-specs span{font-size:9.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.03em}
        .cat-specs b{font-size:12.5px;color:var(--ink)}
        .cat-chem{font-size:9.5px !important;font-weight:700;text-transform:none !important;letter-spacing:0 !important;
          border-radius:6px;padding:1px 5px;display:inline-block;width:fit-content}
        .cat-chem.lfp{background:var(--green-tint);color:var(--green-soft)}
        .cat-chem.nmc{background:var(--amber-tint);color:#B4700F}
        .cat-foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .cat-stock{font-size:11px;font-weight:600;color:var(--green-soft)}
        .cat-stock.bad{color:#B4700F}
        .cat-lead{font-family:var(--font-m,monospace);font-size:10px;color:var(--muted);background:var(--paper-2);
          border:1px solid var(--line);border-radius:99px;padding:1px 7px}
        .cat-price{margin-left:auto;font-family:var(--font-m,monospace);font-size:13px;color:var(--ink)}
      ` }} />
    </>
  );
}

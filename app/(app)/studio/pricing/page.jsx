"use client";
// Preview 3 — Distributor-linked catalog pricing.
// A live-feel price book of real RO/MD panels, inverters and batteries from
// named distributors, with 30-day movement and a delta against the installer's
// own catalog. Turns the catalog from a placeholder into a daily-open habit.
import { useEffect, useMemo, useState } from "react";
import {
  useLang, makeT, tx, PreviewHeader, MockNote, EUR, Spark, walk,
  useStudioClient, ClientBar,
} from "../studio-kit.jsx";

const TX = {
  title: { en: "Distributor pricing", ro: "Prețuri distribuitori", ru: "Цены дистрибьюторов" },
  sub: {
    en: "Current panel, inverter and battery prices from RO/MD distributors — with 30-day movement and a gap against your own catalog.",
    ro: "Prețuri curente la panouri, invertoare și baterii de la distribuitori din RO/MD — cu variația pe 30 de zile și diferența față de catalogul tău.",
    ru: "Актуальные цены на панели, инверторы и батареи от дистрибьюторов RO/MD — с динамикой за 30 дней.",
  },
  note: {
    en: "Panel, inverter and battery prices from RO and MD distributors, with 30-day movement and the gap against your own catalog. “Add to catalog” writes the SKU and price straight onto your catalog.",
    ro: "Prețuri la panouri, invertoare și baterii de la distribuitorii din RO și MD, cu variația pe 30 de zile și diferența față de catalogul tău. „Adaugă în catalog” scrie SKU-ul și prețul direct în catalogul tău.",
    ru: "Цены на панели, инверторы и батареи от дистрибьюторов RO и MD, с динамикой за 30 дней и разницей с вашим каталогом. «Добавить в каталог» запишет SKU и цену прямо в ваш каталог.",
  },
  all: { en: "All", ro: "Toate", ru: "Все" },
  panel: { en: "Panels", ro: "Panouri", ru: "Панели" },
  inverter: { en: "Inverters", ro: "Invertoare", ru: "Инверторы" },
  battery: { en: "Batteries", ro: "Baterii", ru: "Батареи" },
  compare: { en: "Compare to my catalog", ro: "Compară cu catalogul meu", ru: "Сравнить с моим каталогом" },
  c_product: { en: "Product", ro: "Produs", ru: "Продукт" },
  c_dist: { en: "Distributor", ro: "Distribuitor", ru: "Дистрибьютор" },
  c_price: { en: "Price", ro: "Preț", ru: "Цена" },
  c_unit: { en: "Unit", ro: "Unitar", ru: "За ед." },
  c_30d: { en: "30-day", ro: "30 zile", ru: "30 дн." },
  c_trend: { en: "Trend", ro: "Tendință", ru: "Тренд" },
  c_stock: { en: "Stock", ro: "Stoc", ru: "Склад" },
  c_updated: { en: "Updated", ro: "Actualizat", ru: "Обновлено" },
  c_vs: { en: "vs mine", ro: "vs. al meu", ru: "против моей" },
  add: { en: "Add", ro: "Adaugă", ru: "Добавить" },
  sku: { en: "SKUs", ro: "SKU-uri", ru: "SKU" },
  dists: { en: "distributors", ro: "distribuitori", ru: "дистрибьюторов" },
  cheapest: { en: "Cheapest 440 W panel today", ro: "Cel mai ieftin panou 440 W azi", ru: "Самая дешёвая панель 440 Вт сегодня" },
  daily: { en: "refreshed nightly · RO + MD", ro: "reîmprospătat nocturn · RO + MD", ru: "обновляется ночью · RO + MD" },
  sortP: { en: "Price", ro: "Preț", ru: "Цена" },
  sortU: { en: "Unit price", ro: "Preț unitar", ru: "Цена за ед." },
  sortC: { en: "Biggest mover", ro: "Cea mai mare variație", ru: "Макс. движение" },
  stock_in: { en: "In stock", ro: "În stoc", ru: "В наличии" },
  stock_low: { en: "Low", ro: "Redus", ru: "Мало" },
  stock_order: { en: "On order", ro: "La comandă", ru: "Под заказ" },
  rev_t: { en: "Distributor revenue-share", ro: "Revenue-share cu distribuitorii", ru: "Revenue-share с дистрибьюторами" },
  rev_p: {
    en: "A distributor that feeds VoltMira its live price list gets its SKUs in front of every installer building a quote — and a cut of subscriptions that convert through its catalog. It's the wedge that pays for the data.",
    ro: "Un distribuitor care alimentează VoltMira cu lista lui de prețuri live își pune SKU-urile în fața fiecărui instalator care face o ofertă — și primește un procent din abonamentele care convertesc prin catalogul lui.",
    ru: "Дистрибьютор, отдающий VoltMira свой прайс-лист, показывает свои SKU каждому монтажнику — и получает долю с подписок.",
  },
  reqApi: { en: "Request distributor API access", ro: "Solicită acces API distribuitor", ru: "Запросить доступ к API" },
  added: { en: "“{m}” added to your catalog", ro: "„{m}” adăugat în catalogul tău", ru: "«{m}» добавлен в каталог" },
};

// kind: panel | inverter | battery ; size in Wp / kW / kWh ; mkt: RO | MD
const RAW = [
  ["panel", "LONGi", "Hi-MO 6 Explorer LR5-54HTH", 435, "Wp", "RO", 34.3, -2.6, "in", 3, 33.9],
  ["panel", "LONGi", "Hi-MO 7 LR5-54HTB", 440, "Wp", "RO", 35.8, -1.1, "in", 9, null],
  ["panel", "Jinko", "Tiger Neo N-type 54HL4", 440, "Wp", "RO", 33.4, -3.4, "in", 6, 35.0],
  ["panel", "Canadian Solar", "TOPHiKu6 CS6.1-54TD", 450, "Wp", "RO", 39.6, 0.4, "low", 12, null],
  ["panel", "Trina Solar", "Vertex S+ NEG9R.28", 445, "Wp", "RO", 37.1, -1.9, "in", 2, 38.5],
  ["panel", "JA Solar", "DeepBlue 4.0 Pro 72", 580, "Wp", "RO", 44.0, -2.2, "in", 5, null],
  ["panel", "DAH Solar", "DHN-54X16/DG(BW)", 450, "Wp", "MD", 41.8, 1.2, "order", 20, null],
  ["panel", "LONGi", "Hi-MO 6 LR5-54HPH", 435, "Wp", "MD", 38.9, -0.8, "in", 4, 40.2],
  ["panel", "Jinko", "Tiger Neo 60HL4-(V)", 480, "Wp", "MD", 42.5, -1.4, "low", 11, null],
  ["panel", "Risen", "Titan RSM108-10", 415, "Wp", "MD", 33.2, 2.6, "in", 7, null],

  ["inverter", "Deye", "SUN-6K-SG04LP3", 6, "kW", "RO", 962, -1.8, "in", 4, 980],
  ["inverter", "Huawei", "SUN2000-8KTL-M1", 8, "kW", "RO", 1284, 0.9, "in", 6, 1180],
  ["inverter", "Fronius", "Symo GEN24 10.0 Plus", 10, "kW", "RO", 1895, 2.1, "low", 14, null],
  ["inverter", "SMA", "Sunny Tripower 8.0 Smart Energy", 8, "kW", "RO", 2140, 1.4, "order", 25, null],
  ["inverter", "Growatt", "MIN 5000TL-XH", 5, "kW", "RO", 742, -4.1, "in", 2, 810],
  ["inverter", "Solis", "S6-EH3P8K-H", 8, "kW", "RO", 1046, -2.7, "in", 8, null],
  ["inverter", "Sungrow", "SH10RT", 10, "kW", "MD", 1730, -1.2, "in", 5, null],
  ["inverter", "Deye", "SUN-5K-SG04LP1", 5, "kW", "MD", 848, -0.6, "in", 3, 890],
  ["inverter", "Huawei", "SUN2000-5KTL-M1", 5, "kW", "MD", 1120, 1.7, "low", 9, null],
  ["inverter", "Growatt", "SPH 6000TL3 BH-UP", 6, "kW", "MD", 968, 3.2, "order", 22, null],

  ["battery", "Pylontech", "US5000", 4.8, "kWh", "RO", 1372, -3.1, "in", 6, 1480],
  ["battery", "Huawei", "LUNA2000-10-S0", 10, "kWh", "RO", 3180, -1.6, "in", 4, null],
  ["battery", "Dyness", "Tower T10", 9.6, "kWh", "RO", 2540, -2.4, "low", 12, 2760],
  ["battery", "BYD", "Battery-Box Premium HVS 7.7", 7.7, "kWh", "RO", 3690, 0.7, "order", 26, null],
  ["battery", "Deye", "SE-G5.1 Pro", 5.12, "kWh", "MD", 1290, -1.1, "in", 5, null],
  ["battery", "Pylontech", "Force H2 (7.1 kWh)", 7.1, "kWh", "MD", 2410, 2.3, "low", 10, 2590],
  ["battery", "Dyness", "PowerBox F 5.0", 5, "kWh", "MD", 1460, 1.9, "order", 24, null],
];

const DISTS = {
  RO: ["Monsson Trading", "Samus Solar", "SunHelp", "Photomate RO", "Alensys RO"],
  MD: ["Helios Energo", "Moldsolar Grup", "Enterrit MD", "SunPower MD"],
};

function buildCatalog() {
  return RAW.map((r, i) => {
    const [kind, brand, model, size, unit, mkt, eur, chg, stock, updated, yourEur] = r;
    const dist = DISTS[mkt][i % DISTS[mkt].length];
    const perUnit = kind === "panel" ? eur / size : eur / size; // €/Wp or €/kW or €/kWh
    return {
      id: `${kind}-${i}`, kind, brand, model, size, unit, mkt, eur, chg, stock, updated, yourEur,
      dist, perUnit, hist: walk(1000 + i * 7, eur, 12, 0.028),
    };
  });
}

export default function PricingPreview() {
  const lang = useLang();
  const t = makeT(TX, lang);
  const { client } = useStudioClient();
  useEffect(() => { document.title = "Distributor pricing — VoltMira Studio"; }, []);

  const catalog = useMemo(buildCatalog, []);
  const [mkt, setMkt] = useState(client.market);
  const [kind, setKind] = useState("all");
  const [dists, setDists] = useState(new Set());
  const [sort, setSort] = useState("unit");
  const [myPrice, setMyPrice] = useState({});   // per-row "my catalog price" overrides
  const [toast, setToast] = useState("");

  useEffect(() => { setMkt(client.market); }, [client.market]);
  useEffect(() => { setDists(new Set()); }, [mkt]);
  const yp = (x) => (myPrice[x.id] !== undefined ? myPrice[x.id] : x.yourEur);

  const rows = useMemo(() => {
    let r = catalog.filter((x) => x.mkt === mkt);
    if (kind !== "all") r = r.filter((x) => x.kind === kind);
    if (dists.size) r = r.filter((x) => dists.has(x.dist));
    r = [...r].sort((a, b) =>
      sort === "price" ? a.eur - b.eur
      : sort === "change" ? Math.abs(b.chg) - Math.abs(a.chg)
      : a.perUnit - b.perUnit);
    return r;
  }, [catalog, mkt, kind, dists, sort]);

  const activeDists = useMemo(() => {
    const set = new Set(catalog.filter((x) => x.mkt === mkt && (kind === "all" || x.kind === kind)).map((x) => x.dist));
    return [...set];
  }, [catalog, mkt, kind]);

  const totalSkus = 1180 + (mkt === "RO" ? 60 : 0);
  const cheapPanel = catalog
    .filter((x) => x.kind === "panel" && x.mkt === mkt)
    .reduce((m, x) => (x.perUnit < m.perUnit ? x : m));

  const unitLabel = (x) => x.kind === "panel" ? "€/Wp" : x.kind === "inverter" ? "€/kW" : "€/kWh";

  function toggleDist(d) {
    setDists((prev) => { const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n; });
  }
  function add(x) {
    setToast(t("added", { m: `${x.brand} ${x.model}` }));
    setTimeout(() => setToast(""), 2400);
  }

  return (
    <>
      <PreviewHeader slug="pricing" lang={lang} title={t("title")} sub={t("sub")}
        right={<div className="pv-seg">
          <button className={mkt === "RO" ? "on" : ""} onClick={() => setMkt("RO")}>România</button>
          <button className={mkt === "MD" ? "on" : ""} onClick={() => setMkt("MD")}>Moldova</button>
        </div>} />
      <MockNote>{t("note")}</MockNote>

      <ClientBar lang={lang} />

      {/* summary band */}
      <div className="pv-panel" style={{ marginBottom: 16 }}>
        <div className="pr-summary">
          <div><b>{totalSkus.toLocaleString("en-IE")}</b><span>{t("sku")} · {activeDists.length + (mkt === "RO" ? 2 : 1)} {t("dists")}</span></div>
          <div><b>{EUR(cheapPanel.perUnit, 3)}<small>/Wp</small></b><span>{t("cheapest")} — {cheapPanel.brand} · {cheapPanel.dist}</span></div>
          <div><b>{(+client.kw).toFixed(1)} kW{+client.batteryKwh > 0 ? ` · ${client.batteryKwh} kWh` : ""}</b>
            <span>{tx({ en: "target system for", ro: "sistem țintă pentru", ru: "целевая система для" }, lang)} {client.name}</span></div>
        </div>
      </div>

      {/* filters */}
      <div className="pv-panel" style={{ marginBottom: 16 }}>
        <div className="pr-filters">
          <div className="pv-seg">
            {["all", "panel", "inverter", "battery"].map((k) => (
              <button key={k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>{t(k)}</button>
            ))}
          </div>
          <div className="pv-seg">
            <button className={sort === "unit" ? "on" : ""} onClick={() => setSort("unit")}>{t("sortU")}</button>
            <button className={sort === "price" ? "on" : ""} onClick={() => setSort("price")}>{t("sortP")}</button>
            <button className={sort === "change" ? "on" : ""} onClick={() => setSort("change")}>{t("sortC")}</button>
          </div>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {tx({ en: "the “my catalog” column is editable", ro: "coloana „catalogul meu” e editabilă", ru: "столбец «мой каталог» редактируемый" }, lang)}
          </span>
        </div>
        <div className="pv-fchips" style={{ marginTop: 12 }}>
          {activeDists.map((d) => (
            <span key={d} className={"pv-fchip" + (dists.has(d) ? " on" : "")} onClick={() => toggleDist(d)}>{d}</span>
          ))}
        </div>
      </div>

      {/* table */}
      <div className="pv-panel">
        <div className="pv-tbl-wrap">
          <table className="pv-tbl">
            <thead><tr>
              <th>{t("c_product")}</th><th>{t("c_dist")}</th>
              <th className="th-r">{t("c_price")}</th><th className="th-r">{t("c_unit")}</th>
              <th className="th-r">{t("c_30d")}</th><th>{t("c_trend")}</th>
              <th>{t("c_stock")}</th><th className="th-r">{t("c_updated")}</th>
              <th className="th-r">{tx({ en: "My catalog", ro: "Catalogul meu", ru: "Мой каталог" }, lang)}</th>
              <th className="th-r">{t("c_vs")}</th>
              <th />
            </tr></thead>
            <tbody>
              {rows.map((x) => {
                const mine = yp(x);
                const delta = mine != null && +mine > 0 ? ((x.eur - +mine) / +mine) * 100 : null;
                return (
                  <tr key={x.id}>
                    <td><b>{x.brand}</b> {x.model}<div style={{ color: "var(--muted)", fontSize: 11.5 }}>{x.size} {x.unit}</div></td>
                    <td>{x.dist}</td>
                    <td className="num"><b>{EUR(x.eur)}</b></td>
                    <td className="num">{EUR(x.perUnit, x.kind === "panel" ? 3 : x.kind === "inverter" ? 0 : 0)} <span style={{ color: "var(--muted)", fontSize: 10.5 }}>{unitLabel(x)}</span></td>
                    <td className={"num pv-delta " + (x.chg >= 0 ? "up" : "down")}>{x.chg >= 0 ? "▲" : "▼"} {Math.abs(x.chg).toFixed(1)}%</td>
                    <td><Spark data={x.hist} up={x.chg >= 0} /></td>
                    <td><span className={"pv-tag " + x.stock}>{x.stock === "in" ? t("stock_in") : x.stock === "low" ? t("stock_low") : t("stock_order")}</span></td>
                    <td className="num" style={{ color: "var(--muted)", fontSize: 12 }}>{x.updated}h</td>
                    <td className="num">
                      <input className="pr-myprice" type="number" step="1" placeholder="—"
                        value={mine ?? ""} onChange={(e) => setMyPrice((m) => ({ ...m, [x.id]: e.target.value === "" ? null : +e.target.value }))} />
                    </td>
                    <td className="num">
                      {delta == null ? <span style={{ color: "var(--muted)" }}>—</span>
                        : <b style={{ color: delta <= 0 ? "var(--green)" : "var(--red)" }}>{delta > 0 ? "+" : ""}{delta.toFixed(1)}%</b>}
                    </td>
                    <td><button className="btn sm ghost" onClick={() => add(x)}>{t("add")}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pv-callout">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 2v20M2 12h20" /></svg>
        <div>
          <b>{t("rev_t")}</b>
          <p>{t("rev_p")}</p>
          <button className="btn sm primary" style={{ marginTop: 10 }}>{t("reqApi")}</button>
        </div>
      </div>

      {toast && <div className="pv-toast show">{toast}</div>}
      <style dangerouslySetInnerHTML={{ __html: `
        .pr-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}
        .pr-summary b{display:block;font-family:var(--font-d);font-size:22px;font-weight:700;letter-spacing:-.02em;line-height:1.1}
        .pr-summary b small{font-size:13px;font-weight:500;color:var(--muted)}
        .pr-summary span{font-size:11.5px;color:var(--muted);display:block;margin-top:4px;line-height:1.4}
        .pr-filters{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
        .pr-myprice{width:80px;text-align:right;background:var(--paper-2);border:1px solid var(--line);
          border-radius:7px;padding:5px 7px;font-size:12.5px;font-variant-numeric:tabular-nums}
        .pr-myprice:focus{border-color:var(--green);outline:none}
      ` }} />
    </>
  );
}

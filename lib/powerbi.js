// lib/powerbi.js — read a PUBLIC Power BI report ("Publish to web") the way
// its own page does: one grouped semantic query in, rows out. Used only by
// scripts/cned-snapshot.mjs to take CNED's monthly snapshot of installed
// renewable capacity; nothing in the app calls Power BI at run time.
//
// A public report answers the same two calls its viewer makes:
//   GET  {api}/public/reports/{key}/modelsAndExploration   which dataset and report
//   POST {api}/public/reports/querydata?synchronous=true   one query, header X-PowerBI-ResourceKey
// The answer comes in Power BI's compressed row format (DSR), which decode()
// unpacks: C holds a row's new values, R is a bitmask of columns repeated from
// the row before, the "Ø" bitmask marks nulls, and ValueDicts hold strings a
// column references by index.

export const PBI_API = "https://wabi-north-europe-q-primary-api.analysis.windows.net/public/reports";

/** Expression helpers for a query's Select and Where. */
export const col = (src, prop) => ({ Column: { Expression: { SourceRef: { Source: src } }, Property: prop } });
export const measure = (src, prop) => ({ Measure: { Expression: { SourceRef: { Source: src } }, Property: prop } });
export const sum = (src, prop) => ({ Aggregation: { Expression: col(src, prop), Function: 0 } });
export const count = (src, prop) => ({ Aggregation: { Expression: col(src, prop), Function: 5 } });
export const inList = (expr, values) => ({ Condition: { In: { Expressions: [expr], Values: values.map((v) => [{ Literal: { Value: `'${v}'` } }]) } } });

/** The body of one grouped query: every selected column is a grouping, up to 30,000 rows. */
export function queryBody(meta, from, select, where = []) {
  const Select = select.map(([Name, e]) => ({ ...e, Name }));
  const Query = { Version: 2, From: Object.entries(from).map(([Name, Entity]) => ({ Name, Entity, Type: 0 })), Select, Where: where };
  return {
    version: "1.0.0",
    queries: [{
      Query: { Commands: [{ SemanticQueryDataShapeCommand: { Query, Binding: { Primary: { Groupings: [{ Projections: Select.map((_, i) => i) }] }, DataReduction: { DataVolume: 4, Primary: { Window: { Count: 30000 } } }, Version: 1 }, ExecutionMetricsKind: 1 } }] },
      QueryId: "",
      ApplicationContext: { DatasetId: meta.datasetId, Sources: [{ ReportId: meta.reportId }] },
    }],
    cancelQueries: [],
    modelId: meta.modelId,
  };
}

/** Unpack a DSR answer into plain rows keyed by `names` (the Select order). */
export function decode(dsr, names) {
  const ds = dsr?.DS?.[0];
  if (!ds) throw new Error("powerbi: empty answer");
  if (ds.odata?.error) throw new Error("powerbi: " + JSON.stringify(ds.odata.error).slice(0, 300));
  const dicts = ds.ValueDicts || {};
  const shape = ds.PH?.[0]?.DM0 || [];
  const schema = shape[0]?.S || [];
  const rows = [];
  let prev = [];
  for (const row of shape) {
    // a query with no grouping answers one row keyed by name ({ M0: "…" }) instead of C
    if (!row.C && schema.length && schema.every((s) => s.N in row)) {
      rows.push(Object.fromEntries(names.map((n, i) => [n, row[schema[i].N] ?? null])));
      continue;
    }
    const values = [...(row.C || [])];
    const repeat = row.R || 0, nulls = row["Ø"] || 0;
    const out = names.map((_, i) => {
      const bit = 1 << i;
      if (repeat & bit) return prev[i];
      if (nulls & bit) return null;
      const v = values.shift();
      const dict = schema[i]?.DN;
      return dict && typeof v === "number" ? dicts[dict][v] : v;
    });
    prev = out;
    rows.push(Object.fromEntries(names.map((n, i) => [n, out[i]])));
  }
  return rows;
}

/** A client for one public report key. fetchImpl is injectable for tests. */
export function publicReport(key, fetchImpl = globalThis.fetch) {
  const headers = { "X-PowerBI-ResourceKey": key, "Content-Type": "application/json;charset=UTF-8", Accept: "application/json" };
  let meta = null;
  return {
    async meta() {
      if (meta) return meta;
      const r = await fetchImpl(`${PBI_API}/${key}/modelsAndExploration?preferReadOnlySession=true`, { headers });
      if (!r.ok) throw new Error(`powerbi: models ${r.status}`);
      const j = await r.json();
      meta = { modelId: j.models[0].id, datasetId: j.models[0].dbName, reportId: j.exploration.report.objectId, refreshed: j.models[0].LastRefreshTime || null };
      return meta;
    },
    async query(from, select, where = []) {
      const m = await this.meta();
      const r = await fetchImpl(`${PBI_API}/querydata?synchronous=true`, { method: "POST", headers, body: JSON.stringify(queryBody(m, from, select, where)) });
      if (!r.ok) throw new Error(`powerbi: query ${r.status}`);
      const j = await r.json();
      const res = j.results?.[0]?.result;
      if (res?.error) throw new Error("powerbi: " + JSON.stringify(res.error).slice(0, 300));
      return decode(res?.data?.dsr, select.map(([n]) => n));
    },
  };
}

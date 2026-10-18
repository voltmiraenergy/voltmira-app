// lib/fakeDb.testutil.js — a small in-memory stand-in for the Supabase client,
// for tests of flows that write: the query calls they make, unique
// constraints, and the error a missing table gives. Rows come back as copies,
// as the real client returns them. Test-only.
export function fakeDb(tables, unique = {}) {
  const T = structuredClone(tables);
  let n = 0;
  class Q {
    constructor(name) { this.name = name; this.f = []; this.op = "select"; this.ret = false; this.cap = Infinity; }
    select() { if (this.op !== "select") this.ret = true; return this; }
    eq(c, v) { this.f.push((r) => r[c] === v); return this; }
    neq(c, v) { this.f.push((r) => r[c] !== v); return this; }
    is(c, v) { this.f.push((r) => (r[c] ?? null) === v); return this; }
    in(c, vs) { this.f.push((r) => vs.includes(r[c])); return this; }
    gte(c, v) { this.f.push((r) => r[c] >= v); return this; }
    lte(c, v) { this.f.push((r) => r[c] <= v); return this; }
    order() { return this; }
    limit(k) { this.cap = k; return this; }
    insert(p) { this.op = "insert"; this.p = p; return this; }
    update(p) { this.op = "update"; this.p = p; return this; }
    upsert(p) { this.op = "upsert"; this.p = p; return this; }
    delete() { this.op = "delete"; return this; }
    maybeSingle() { this.one = "maybe"; return this.run(); }
    single() { this.one = "one"; return this.run(); }
    then(a, b) { return this.run().then(a, b); }
    async run() {
      if (!(this.name in T)) return { data: null, error: { code: "42P01", message: `relation "${this.name}" does not exist` } };
      const rows = T[this.name];
      const match = (r) => this.f.every((f) => f(r));
      const out = (list) => ({ data: this.ret ? structuredClone(this.one ? list[0] || null : list) : null, error: null });
      if (this.op === "insert") {
        const add = [].concat(this.p).map((r) => ({ id: r.id || `id-${++n}`, created_at: "2026-10-18T09:00:00Z", ...r }));
        for (const r of add) for (const cols of unique[this.name] || []) {
          if ([...rows, ...add.filter((x) => x !== r)].some((x) => cols.every((c) => x[c] === r[c]))) return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
        rows.push(...add);
        return out(add);
      }
      if (this.op === "upsert") {
        const key = (unique[this.name] || [["id"]])[0];
        const hit = rows.find((x) => key.every((c) => x[c] === this.p[c]));
        if (hit) Object.assign(hit, this.p); else rows.push({ ...this.p });
        return out([hit || this.p]);
      }
      if (this.op === "update") {
        const hit = rows.filter(match);
        hit.forEach((r) => Object.assign(r, this.p));
        return out(hit);
      }
      if (this.op === "delete") { T[this.name] = rows.filter((r) => !match(r)); return { data: null, error: null }; }
      const hit = structuredClone(rows.filter(match)).slice(0, this.cap);
      if (this.one) return { data: hit[0] || null, error: this.one === "one" && !hit[0] ? { code: "PGRST116" } : null };
      return { data: hit, error: null };
    }
  }
  return { T, from: (name) => new Q(name) };
}

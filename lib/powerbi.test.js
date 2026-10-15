import { test } from "node:test";
import assert from "node:assert/strict";
import { decode, queryBody, col, measure } from "./powerbi.js";

test("decode unpacks values, repeated columns, nulls and dictionary strings", () => {
  const dsr = { DS: [{
    ValueDicts: { D0: ["Anenii Noi", "Bălți"], D1: ["eoliana", "fotovoltaică"] },
    PH: [{ DM0: [
      { S: [{ N: "G0", DN: "D0" }, { N: "G1", DN: "D1" }, { N: "M0" }], C: [0, 0, 12600] },
      { C: [1, 21499], R: 1 },          // raion repeated from the row before
      { C: [1, 1], "Ø": 4 },            // the measure is null
    ] }],
  }] };
  assert.deepEqual(decode(dsr, ["raion", "tech", "kw"]), [
    { raion: "Anenii Noi", tech: "eoliana", kw: 12600 },
    { raion: "Anenii Noi", tech: "fotovoltaică", kw: 21499 },
    { raion: "Bălți", tech: "fotovoltaică", kw: null },
  ]);
});

test("a single value (no grouping) comes back keyed by name and is read too", () => {
  const dsr = { DS: [{ PH: [{ DM0: [{ S: [{ N: "M0", T: 1 }], M0: "la finele lunii august 2026" }] }] }] };
  assert.deepEqual(decode(dsr, ["t"]), [{ t: "la finele lunii august 2026" }]);
});

test("an error in the answer is raised, not returned as rows", () => {
  assert.throws(() => decode({ DS: [{ odata: { error: { code: "x" } } }] }, ["a"]), /powerbi/);
  assert.throws(() => decode({}, ["a"]), /empty/);
});

test("the query groups on every selected column and names the dataset", () => {
  const b = queryBody({ modelId: 1, datasetId: "ds", reportId: "rp" }, { d: "T" }, [["a", col("d", "A")], ["m", measure("d", "M")]]);
  const cmd = b.queries[0].Query.Commands[0].SemanticQueryDataShapeCommand;
  assert.deepEqual(cmd.Binding.Primary.Groupings[0].Projections, [0, 1]);
  assert.equal(cmd.Query.Select[1].Name, "m");
  assert.equal(b.queries[0].ApplicationContext.DatasetId, "ds");
  assert.equal(b.modelId, 1);
});

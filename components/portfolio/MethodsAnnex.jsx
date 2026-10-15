// components/portfolio/MethodsAnnex.jsx — the methods and the glossary of the
// bank documents (lib/methodsText.js): how each family of figures is built, and
// what each term means. A last page of the credit summary and of the report.
// Plain markup, no state.
import { methodsAppendix } from "../../lib/methodsText.js";

export default function MethodsAnnex({ lang = "en" }) {
  const m = methodsAppendix(lang);
  return (
    <div className="rp-methods">
      <h3>{m.title}</h3>
      <p className="rp-small">{m.note}</p>
      <h4>{m.methodsH}</h4>
      {m.methods.map((x) => <p key={x.h} className="rp-mp"><b>{x.h}.</b> {x.p}</p>)}
      <h4>{m.glossaryH}</h4>
      <dl className="rp-gl">
        {m.glossary.map((g) => <div key={g.t}><dt>{g.t}</dt><dd>{g.d}</dd></div>)}
      </dl>
    </div>
  );
}

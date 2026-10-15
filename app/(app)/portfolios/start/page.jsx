// app/(app)/portfolios/start/page.jsx — the guided start of a developer's own
// plant: the site on the map, what is being built, how it sells and the loan
// sought, in one form (StartPlantForm.jsx). On submit the site's public data
// is looked up (lib/plantActions.js startPlantProject) and the plant opens
// with its credit summary ready to read. Where the "I'm developing a plant"
// sign-up lands (app/login).
import "../../dx.css";
import "../portfolio.css";
import { currentCompany } from "../../../../lib/session.js";
import { normLang } from "../../../../lib/i18n.js";
import { plt } from "../../../../lib/plantText.js";
import { appTitle } from "../../../../lib/pageTitle.js";
import StartPlantForm from "./StartPlantForm.jsx";

export const dynamic = "force-dynamic";
// the public lookups (sun, wind, grid, climate) run inside the form's action
export const maxDuration = 60;
export const generateMetadata = appTitle((lang) => plt("st_title", lang));

export default async function StartPlantPage() {
  const co = await currentCompany();
  const lang = normLang(co?.lang);
  return (
    <div className="dx pf">
      <header className="dx-head">
        <div className="dx-hello">
          <h1>{plt("st_title", lang)}</h1>
          <p className="dx-summary">{plt("st_sub", lang)}</p>
        </div>
      </header>
      <StartPlantForm lang={lang} />
    </div>
  );
}

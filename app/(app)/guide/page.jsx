// app/(app)/guide/page.jsx — the in-app installer guide, so clients can self-serve
// instead of calling. Rendered as static HTML using the app's theme variables so
// it matches light/dark automatically. Fully translated (EN / RO / RU) and picked
// from the company's language, so nothing here is hardcoded English.
//
// The server gives every section an anchor and hands their titles to GuideToc,
// the sticky "On this page" list that follows the reader down the page.
import "../dx.css";
import { currentCompany } from "../../../lib/session.js";
import { normLang, t } from "../../../lib/i18n.js";
import GuideToc from "./GuideToc.jsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Guide | VoltMira" };

const CSS = `
.gx-layout{display:grid;grid-template-columns:230px minmax(0,1fr);gap:40px;align-items:start}
.gx-toc{position:sticky;top:22px}
.gx-toc-h{font-size:11px;font-weight:650;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:6px 0 10px 12px}
.gx-toc ol{list-style:none;display:flex;flex-direction:column;gap:2px;border-left:1px solid var(--line)}
.gx-toc a{display:flex;align-items:baseline;gap:9px;padding:7px 12px;margin-left:-1px;border-left:2px solid transparent;
  font-size:13px;font-weight:500;line-height:1.35;color:var(--muted);text-decoration:none;transition:color .15s,border-color .15s,background .15s}
.gx-toc a:hover{color:var(--ink)}
.gx-toc a.on{color:var(--ink);font-weight:650;border-left-color:var(--green);background:linear-gradient(90deg,var(--green-tint),transparent)}
.gx-toc-n{flex:none;width:16px;font-size:11.5px;font-weight:700;color:var(--green);text-align:center}
.guide{max-width:760px;color:var(--ink)}
.guide h1{font-family:'Inter Tight','Inter',system-ui,sans-serif;font-size:32px;line-height:1.12;font-weight:700;letter-spacing:-.03em;margin:4px 0 8px;text-wrap:balance}
.guide .g-sub{color:var(--muted);font-size:15px;line-height:1.55;max-width:60ch;margin:0 0 30px}
.guide section{margin:0 0 38px;scroll-margin-top:22px}
.guide .g-h{display:flex;align-items:center;gap:12px;margin-bottom:6px}
.guide .g-n{font-size:12.5px;font-weight:700;color:var(--green);background:var(--green-tint);width:28px;height:28px;border-radius:9px;display:grid;place-items:center;flex:none}
.guide h2{font-family:'Inter Tight','Inter',system-ui,sans-serif;font-size:22px;font-weight:700;letter-spacing:-.02em;margin:0;line-height:1.2}
.guide .g-lede{color:var(--muted);font-size:15px;line-height:1.55;margin:0 0 16px 40px;max-width:62ch}
.guide .g-card{background:var(--paper-2);border:1px solid var(--line);border-radius:16px;padding:20px 22px;margin-bottom:12px;box-shadow:var(--shadow)}
.guide .g-card p{margin:0 0 10px;font-size:14.5px;color:var(--ink);opacity:.86;line-height:1.65}
.guide .g-card p:last-child{margin-bottom:0}
.guide .g-card b{color:var(--ink)}
.guide .step{position:relative;display:flex;gap:16px;align-items:flex-start;padding:0 0 18px}
.guide .step:not(:last-child)::before{content:"";position:absolute;left:15px;top:34px;bottom:2px;width:2px;background:var(--line)}
.guide .step .sn{flex:none;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:13.5px;
  color:var(--green);background:var(--paper-2);border:2px solid var(--green);position:relative;z-index:1}
.guide .step > div{background:var(--paper-2);border:1px solid var(--line);border-radius:14px;padding:13px 16px;flex:1;min-width:0;box-shadow:var(--shadow)}
.guide .step h3{font-family:'Inter Tight','Inter',system-ui,sans-serif;margin:0 0 3px;font-size:15.5px;font-weight:700;letter-spacing:-.01em}
.guide .step p{margin:0;font-size:13.5px;color:var(--muted);line-height:1.55}
.guide .row{display:grid;grid-template-columns:170px 1fr;gap:16px;padding:12px 0;border-top:1px solid var(--line)}
.guide .row:first-child{border-top:none;padding-top:2px}
.guide .row .k{font-weight:650;font-size:14px}
.guide .row .k small{display:block;font-size:11.5px;color:var(--muted);font-weight:500;margin-top:2px}
.guide .row .v{font-size:14px;color:var(--ink);opacity:.86;line-height:1.55}
.guide .g-tip{display:flex;gap:11px;background:var(--amber-tint);border-radius:14px;padding:14px 16px;margin-top:12px;border:1px solid color-mix(in srgb,var(--amber) 35%,transparent)}
.guide .g-tip::before{content:"";flex:none;width:4px;border-radius:99px;background:var(--amber)}
.guide .g-tip p{margin:0;font-size:14px;color:var(--ink);line-height:1.55}
.guide .nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:8px 0 4px}
.guide .num-c{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:13px 14px;border-top:3px solid var(--bc)}
.guide .num-c .t{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--bc);font-weight:700}
.guide .num-c p{margin:5px 0 0;font-size:13px;color:var(--ink);opacity:.8;line-height:1.45}
.guide details{background:var(--paper-2);border:1px solid var(--line);border-radius:14px;padding:0 18px;margin-bottom:9px;transition:border-color .15s}
.guide details[open]{border-color:color-mix(in srgb,var(--green) 40%,var(--line))}
.guide summary{cursor:pointer;list-style:none;padding:15px 0;font-weight:650;font-size:15px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.guide summary::-webkit-details-marker{display:none}
.guide summary::after{content:"";flex:none;width:9px;height:9px;border-right:2px solid var(--green);border-bottom:2px solid var(--green);transform:rotate(45deg);margin:-4px 4px 0 0;transition:transform .2s}
.guide details[open] summary::after{transform:rotate(225deg);margin-top:4px}
.guide details p{margin:0 0 16px;font-size:14px;color:var(--ink);opacity:.86;line-height:1.6}
.guide .plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
.guide .plan{background:var(--paper-2);border:1px solid var(--line);border-radius:14px;padding:16px;box-shadow:var(--shadow)}
.guide .plan.hot{border-color:var(--amber);box-shadow:inset 0 0 0 1px var(--amber),var(--shadow)}
.guide .plan .pn{font-family:'Inter Tight','Inter',system-ui,sans-serif;font-weight:700;font-size:15px}
.guide .plan .pd{font-size:12.5px;color:var(--muted);line-height:1.45;margin-top:4px}
@media(max-width:1000px){.gx-layout{grid-template-columns:minmax(0,1fr)}.gx-toc{display:none}}
@media(max-width:560px){.guide .row{grid-template-columns:1fr;gap:3px}.guide h1{font-size:25px}.guide .g-lede{margin-left:0}.guide h2{font-size:19px}}
`;

const HTML = {
  en: `
<div class="g-sun"></div>
<h1>Your VoltMira handbook</h1>
<p class="g-sub">How to capture leads, build an honest quote, and send a proposal your client can trust. Keep it open in a tab.</p>

<section>
  <div class="g-h"><span class="g-n">›</span><h2>The whole flow, in five steps</h2></div>
  <p class="g-lede">Everything else in this guide is just detail on one of these steps.</p>
  <div class="step"><span class="sn">1</span><div><h3>Capture a lead</h3><p>A visitor fills the estimate form on your website, or you add one by hand after a call. It lands in your <b>Leads</b> inbox.</p></div></div>
  <div class="step"><span class="sn">2</span><div><h3>Turn it into a quote</h3><p>Hit <b>Create quote</b> on the lead: a new quote opens, pre-filled with their name. Set the system size and their yearly consumption.</p></div></div>
  <div class="step"><span class="sn">3</span><div><h3>Send a tracked proposal</h3><p>Generate a proposal link with your logo and send it on WhatsApp or email. No attachments to chase.</p></div></div>
  <div class="step"><span class="sn">4</span><div><h3>See when they open it</h3><p>You're notified the moment the client opens it: how many times, how long. Call them while it's on their screen.</p></div></div>
  <div class="step"><span class="sn">5</span><div><h3>Win</h3><p>They accept with one tap, right from the proposal. The quote flips to <b>Won</b> and the lead is marked converted.</p></div></div>
</section>

<section>
  <div class="g-h"><span class="g-n">1</span><h2>The Leads inbox &amp; where leads come from</h2></div>
  <p class="g-lede">Leads are people who might buy. VoltMira keeps them in one place so none slip through.</p>
  <div class="g-card">
    <p><b>Three ways leads arrive:</b></p>
    <p><b>1. Your website widget.</b> In <b>Settings</b> you get a small snippet of code. Paste it onto your site once: every "free estimate" a visitor requests becomes a lead, automatically.</p>
    <p><b>2. By hand.</b> After a call or a fair, add the person yourself so you don't forget to follow up.</p>
    <p><b>3. From a proposal.</b> When someone asks for changes on a proposal you sent, that returns as a lead too.</p>
  </div>
  <div class="g-card">
    <p><b>Working the inbox</b>: move each lead through its status as you work it:</p>
    <div class="row"><div class="k">New</div><div class="v">Just arrived. These are who you call today.</div></div>
    <div class="row"><div class="k">Contacted</div><div class="v">You've reached out; waiting to hear back.</div></div>
    <div class="row"><div class="k">Converted</div><div class="v">You built a quote from it: lead and quote are now linked.</div></div>
    <div class="row"><div class="k">Archived</div><div class="v">Not a fit, or gone cold. Tidied away, not deleted.</div></div>
  </div>
  <div class="g-tip"><p>Click <b>Edit</b> on any lead to fix their name, phone, and email right in the inbox, and tag the <b>channel</b> it came from (website, Facebook, WhatsApp, referral, cold call) so you learn which one actually pays off.</p></div>
</section>

<section>
  <div class="g-h"><span class="g-n">2</span><h2>Building a quote</h2></div>
  <p class="g-lede">A quote is just a handful of honest inputs. Here's what each one means.</p>
  <div class="g-card">
    <div class="row"><div class="k">Market <small>MD / RO</small></div><div class="v">Moldova (net billing) or Romania (net metering). Sets the tariff rules automatically.</div></div>
    <div class="row"><div class="k">System size <small>kW</small></div><div class="v">How big the array is: the biggest driver of both cost and production.</div></div>
    <div class="row"><div class="k">Yearly consumption <small>kWh / year</small></div><div class="v">How much power they use per year: read the annual total off their bill. This decides how much solar they use vs. export.</div></div>
    <div class="row"><div class="k">Electricity price <small>€ / kWh</small></div><div class="v">What they pay per kWh. Pre-filled with the market default (Moldova ≈ €0.18); set their real bill for accuracy.</div></div>
    <div class="row"><div class="k">Battery <small>optional, kWh</small></div><div class="v">Adds storage. Enter usable capacity: cost and benefit both scale with it. Worth it in Moldova (see below).</div></div>
    <div class="row"><div class="k">Bill of materials <small>optional</small></div><div class="v">Pick the real panels, inverter and battery from your catalog or the supplier database, or auto-fill a whole system for the size you've set. Shows the margin between the quote price and what the equipment actually costs.</div></div>
  </div>
  <div class="g-tip"><p>Type the client's <b>address</b> and VoltMira pulls the real sunlight for that exact roof from satellite data: numbers for <i>their</i> house, not a national average.</p></div>
</section>

<section>
  <div class="g-h"><span class="g-n">3</span><h2>The equipment catalog</h2></div>
  <p class="g-lede">Your own library of panels, inverters and batteries, so a quote's cost comes from real gear, not a round guess.</p>
  <div class="g-card">
    <p><b>Build it once.</b> On the <b>Catalog</b> tab, add the products you actually install with their prices. New here? Hit <b>Load starter catalog</b> for a ready set of common panels, inverters and batteries, then edit the prices to match your suppliers.</p>
    <p><b>It drives the real cost.</b> When you add equipment to a quote, the bill of materials replaces the rough €/kW estimate, so the number you show the client is your true cost.</p>
    <p><b>It looks the part.</b> Add a photo URL to any product and it shows as a clean thumbnail: handy when a client wants to see exactly what's going on the roof.</p>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">4</span><h2>Understanding the numbers</h2></div>
  <p class="g-lede">This is what makes VoltMira different, and what you can confidently explain.</p>
  <div class="g-card">
    <p><b>Payback: three honest scenarios.</b> Instead of one flattering number, every quote shows three, so the client trusts you:</p>
    <div class="nums">
      <div class="num-c" style="--bc:#C4543B"><div class="t">Pessimistic</div><p>Bad luck: weaker sun, faster wear, flat prices.</p></div>
      <div class="num-c" style="--bc:var(--amber)"><div class="t">Expected</div><p>The realistic middle: what you'd quote.</p></div>
      <div class="num-c" style="--bc:var(--green)"><div class="t">Optimistic</div><p>Strong sun, rising prices.</p></div>
    </div>
  </div>
  <div class="g-card">
    <p><b>Self-consumed %.</b> The share of solar the household actually <i>uses</i> instead of exporting. Higher is better: self-used power is worth full retail price, exports earn a low feed rate. A very low number (say 8%) means the system is <b>too big</b> for that home; downsize it, or add a battery.</p>
  </div>
  <div class="g-card">
    <p><b>Battery &amp; the Moldova advantage.</b> Since Moldova moved to <b>net billing</b> (2024), exported power is bought back at the operator's published monthly price: around <b>2.5 lei/kWh</b> (≈ €0.13), lowest in spring and summer when a roof exports most, while power you use is worth the retail tariff, ≈ 3.66 lei (€0.18). The gap of roughly <b>1.2 lei/kWh</b> is what a battery earns on every stored kWh: not the whole tariff, as offers often claim, but enough that in Moldova a battery genuinely adds savings.</p>
    <div class="g-tip"><p>Size the battery to cover the <b>evening</b>, not to be as big as possible: an oversized battery just adds cost.</p></div>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">5</span><h2>Tracked proposals</h2></div>
  <p class="g-lede">The part that closes deals: you always know where the client stands.</p>
  <div class="g-card">
    <p><b>Sending.</b> From the editor, hit <b>Generate proposal</b>: you get a link with your logo and name. Share it on WhatsApp or email, nothing to download.</p>
    <p><b>What the client sees.</b> A clean page with the three payback scenarios, monthly savings, your assumptions, and an <b>Accept</b> button.</p>
    <p><b>Tracking.</b> You're notified the moment they open it, and see how often and how long they looked: your cue to call at exactly the right time.</p>
    <p><b>Frozen &amp; honest.</b> Once sent, a proposal locks its numbers. Editing the quote later never changes what the client was shown.</p>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">6</span><h2>Plans</h2></div>
  <p class="g-lede">Free during beta, no card required. Founder pricing is locked for the first 50 installers.</p>
  <div class="plans">
    <div class="plan hot"><div class="pn">Pro: €49/mo</div><div class="pd">Your logo on every proposal &amp; PDF, tracked links + open alerts, website lead widget, full pipeline.</div></div>
    <div class="plan"><div class="pn">Team: €119/mo</div><div class="pd">Everything in Pro, up to 5 people on one pipeline, win-rate analytics, priority support.</div></div>
    <div class="plan"><div class="pn">Enterprise: custom pricing</div><div class="pd">Unlimited seats for multi-branch installers, full audit log, a dedicated manager.</div></div>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">?</span><h2>Common questions</h2></div>
  <details><summary>Why does a battery make payback longer sometimes?</summary><p>A battery adds real cost per kWh of capacity. In Moldova it also adds savings, but if the savings are smaller than the extra cost, payback stretches a little. That's honest: batteries are often about evening backup and independence as much as savings. In Romania's 1:1 net metering a battery adds almost no savings, so it always lengthens payback there.</p></details>
  <details><summary>The address didn't pull sun data: what now?</summary><p>Occasionally a very new or rural address won't resolve. Try a nearby landmark or the town name: the sunlight barely changes over a few kilometres. If it still won't load, the quote uses a sensible regional average.</p></details>
  <details><summary>Can I change my company logo and details?</summary><p>Yes: in <b>Settings</b>. Your logo, name, currency, and language flow onto every proposal and PDF automatically.</p></details>
  <details><summary>A sent proposal shows different numbers than my quote now.</summary><p>That's intentional: a sent proposal is frozen so the client always sees what you promised. If you've edited the quote, generate a fresh proposal to send updated numbers.</p></details>
  <details><summary>What's the difference between a lead and a quote?</summary><p>A <b>lead</b> is a person who might buy. A <b>quote</b> is the actual solar calculation for them. One click turns a lead into a quote, and they stay linked so you can trace where a deal came from.</p></details>
  <details><summary>Is my clients' data safe?</summary><p>Yes. Data is on EU servers, each company only sees its own projects, and you can export everything to CSV anytime, nothing is locked in.</p></details>
</section>
`,

  ro: `
<div class="g-sun"></div>
<h1>Manualul tău VoltMira</h1>
<p class="g-sub">Cum prinzi contacte, faci o ofertă onestă și trimiți o propunere în care clientul are încredere. Ține-l deschis într-un tab.</p>

<section>
  <div class="g-h"><span class="g-n">›</span><h2>Tot fluxul, în cinci pași</h2></div>
  <p class="g-lede">Tot restul din ghid detaliază doar unul dintre acești pași.</p>
  <div class="step"><span class="sn">1</span><div><h3>Prinde un contact</h3><p>Un vizitator completează formularul de estimare de pe site-ul tău, sau îl adaugi tu manual după un apel. Ajunge în inbox-ul <b>Contacte</b>.</p></div></div>
  <div class="step"><span class="sn">2</span><div><h3>Transformă-l în ofertă</h3><p>Apasă <b>Creează ofertă</b> pe contact: se deschide o ofertă nouă, pre-completată cu numele lui. Setează dimensiunea sistemului și consumul anual.</p></div></div>
  <div class="step"><span class="sn">3</span><div><h3>Trimite o propunere urmărită</h3><p>Generează un link de propunere cu logo-ul tău și trimite-l pe WhatsApp sau email. Fără atașamente de urmărit.</p></div></div>
  <div class="step"><span class="sn">4</span><div><h3>Vezi când o deschide</h3><p>Ești notificat în clipa în care clientul o deschide: de câte ori, cât timp. Sună-l cât e pe ecranul lui.</p></div></div>
  <div class="step"><span class="sn">5</span><div><h3>Câștigă</h3><p>Acceptă cu un singur tap, direct din propunere. Oferta trece pe <b>Câștigat</b>, iar contactul e marcat convertit.</p></div></div>
</section>

<section>
  <div class="g-h"><span class="g-n">1</span><h2>Inbox-ul Contacte &amp; de unde vin contactele</h2></div>
  <p class="g-lede">Contactele sunt oameni care ar putea cumpăra. VoltMira îi ține într-un singur loc, ca să nu-ți scape niciunul.</p>
  <div class="g-card">
    <p><b>Trei feluri în care apar contactele:</b></p>
    <p><b>1. Widgetul de pe site.</b> În <b>Setări</b> primești un mic fragment de cod. Lipește-l o dată pe site: fiecare „estimare gratuită" cerută de un vizitator devine automat un contact.</p>
    <p><b>2. Manual.</b> După un apel sau un târg, adaugă tu persoana ca să nu uiți să revii.</p>
    <p><b>3. Dintr-o propunere.</b> Când cineva cere modificări la o propunere trimisă, revine tot ca un contact.</p>
  </div>
  <div class="g-card">
    <p><b>Lucrează inbox-ul</b>: mută fiecare contact prin statusuri pe măsură ce lucrezi:</p>
    <div class="row"><div class="k">Nou</div><div class="v">Tocmai a sosit. Pe aceștia îi suni azi.</div></div>
    <div class="row"><div class="k">Contactat</div><div class="v">Ai luat legătura; aștepți răspuns.</div></div>
    <div class="row"><div class="k">Convertit</div><div class="v">Ai făcut o ofertă din el: contactul și oferta sunt acum legate.</div></div>
    <div class="row"><div class="k">Arhivat</div><div class="v">Nu se potrivește sau s-a răcit. Pus deoparte, nu șters.</div></div>
  </div>
  <div class="g-tip"><p>Apasă <b>Editează</b> pe orice contact ca să corectezi numele, telefonul și emailul direct în inbox, și etichetează <b>canalul</b> din care a venit (site, Facebook, WhatsApp, recomandare, apel la rece), ca să afli care aduce cu adevărat rezultate.</p></div>
</section>

<section>
  <div class="g-h"><span class="g-n">2</span><h2>Construirea unei oferte</h2></div>
  <p class="g-lede">O ofertă e doar câteva date oneste. Iată ce înseamnă fiecare.</p>
  <div class="g-card">
    <div class="row"><div class="k">Piață <small>MD / RO</small></div><div class="v">Moldova (facturare netă) sau România (contorizare netă). Setează automat regulile de tarif.</div></div>
    <div class="row"><div class="k">Dimensiune sistem <small>kW</small></div><div class="v">Cât de mare e sistemul: factorul principal pentru cost și producție.</div></div>
    <div class="row"><div class="k">Consum anual <small>kWh / an</small></div><div class="v">Cât curent folosește pe an: ia totalul anual de pe factură. Decide cât din solar folosește vs. exportă.</div></div>
    <div class="row"><div class="k">Preț energie <small>€ / kWh</small></div><div class="v">Cât plătește pe kWh. Pre-completat cu valoarea implicită a pieței (Moldova ≈ €0,18); pune prețul real pentru acuratețe.</div></div>
    <div class="row"><div class="k">Baterie <small>opțional, kWh</small></div><div class="v">Adaugă stocare. Introdu capacitatea utilă, și costul, și beneficiul cresc cu ea. Merită în Moldova (vezi mai jos).</div></div>
    <div class="row"><div class="k">Deviz de echipamente <small>opțional</small></div><div class="v">Alege panourile, invertorul și bateria reale din catalogul tău sau din baza de date a furnizorilor, sau completează automat un sistem întreg pentru puterea aleasă. Arată marja dintre prețul din ofertă și cât costă efectiv echipamentul.</div></div>
  </div>
  <div class="g-tip"><p>Scrie <b>adresa</b> clientului și VoltMira ia lumina solară reală pentru acel acoperiș din date satelitare: cifre pentru casa <i>lui</i>, nu o medie națională.</p></div>
</section>

<section>
  <div class="g-h"><span class="g-n">3</span><h2>Catalogul de echipamente</h2></div>
  <p class="g-lede">Biblioteca ta de panouri, invertoare și baterii: ca prețul unei oferte să vină din echipamente reale, nu dintr-o estimare rotundă.</p>
  <div class="g-card">
    <p><b>Construiește-l o dată.</b> În tabul <b>Catalog</b>, adaugă produsele pe care chiar le instalezi, cu prețuri. Ești nou? Apasă <b>Încarcă catalog de start</b> pentru un set gata făcut de panouri, invertoare și baterii uzuale, apoi editează prețurile după furnizorii tăi.</p>
    <p><b>Determină costul real.</b> Când adaugi echipamente la o ofertă, lista de materiale înlocuiește estimarea aproximativă în €/kW: așa că numărul arătat clientului e costul tău real.</p>
    <p><b>Arată profesionist.</b> Adaugă un URL de imagine la orice produs și apare ca o miniatură curată: util când clientul vrea să vadă exact ce ajunge pe acoperiș.</p>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">4</span><h2>Înțelegerea cifrelor</h2></div>
  <p class="g-lede">Asta face VoltMira diferit, și asta poți explica cu încredere.</p>
  <div class="g-card">
    <p><b>Amortizare: trei scenarii oneste.</b> În loc de o singură cifră măgulitoare, fiecare ofertă arată trei, ca să aibă clientul încredere:</p>
    <div class="nums">
      <div class="num-c" style="--bc:#C4543B"><div class="t">Pesimist</div><p>Ghinion: soare mai slab, uzură mai rapidă, prețuri constante.</p></div>
      <div class="num-c" style="--bc:var(--amber)"><div class="t">Așteptat</div><p>Mijlocul realist: ce ai oferta.</p></div>
      <div class="num-c" style="--bc:var(--green)"><div class="t">Optimist</div><p>Soare puternic, prețuri în creștere.</p></div>
    </div>
  </div>
  <div class="g-card">
    <p><b>% autoconsum.</b> Cota de solar pe care gospodăria chiar o <i>folosește</i> în loc s-o exporte. Mai mare e mai bine: energia autoconsumată valorează prețul întreg de retail, exporturile aduc un tarif mic. Un număr foarte mic (să zicem 8%) înseamnă că sistemul e <b>prea mare</b> pentru acea casă; micșorează-l sau adaugă o baterie.</p>
  </div>
  <div class="g-card">
    <p><b>Bateria &amp; avantajul Moldovei.</b> De când Moldova a trecut la <b>facturare netă</b> (2024), energia exportată se răscumpără la prețul mediu lunar publicat de operator: în jur de <b>2,5 lei/kWh</b> (≈ €0,13), cel mai mic primăvara și vara, exact când acoperișul exportă cel mai mult, iar energia pe care o folosești valorează tariful din factură, ≈ 3,66 lei (€0,18). Diferența de circa <b>1,2 lei/kWh</b> e tot ce câștigă bateria pe fiecare kWh stocat: nu tariful întreg, cum se scrie des în oferte, dar suficient cât în Moldova bateria chiar să adauge economii.</p>
    <div class="g-tip"><p>Dimensionează bateria ca să acopere <b>seara</b>, nu ca să fie cât mai mare: o baterie supradimensionată doar adaugă cost.</p></div>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">5</span><h2>Propuneri urmărite</h2></div>
  <p class="g-lede">Partea care închide vânzări: știi mereu unde e clientul.</p>
  <div class="g-card">
    <p><b>Trimitere.</b> Din editor, apasă <b>Generează propunere</b>: primești un link cu logo-ul și numele tău. Trimite-l pe WhatsApp sau email, nimic de descărcat.</p>
    <p><b>Ce vede clientul.</b> O pagină curată cu cele trei scenarii de amortizare, economiile lunare, ipotezele tale și un buton <b>Acceptă</b>.</p>
    <p><b>Urmărire.</b> Ești notificat în clipa în care o deschid și vezi de câte ori și cât timp au privit: semnalul să suni exact la momentul potrivit.</p>
    <p><b>Fixă &amp; onestă.</b> Odată trimisă, propunerea își blochează cifrele. Editarea ulterioară a ofertei nu schimbă niciodată ce a văzut clientul.</p>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">6</span><h2>Planuri</h2></div>
  <p class="g-lede">Gratuit în beta: fără card. Prețul de fondator e blocat pentru primii 50 de instalatori.</p>
  <div class="plans">
    <div class="plan hot"><div class="pn">Pro: €49/lună</div><div class="pd">Logo-ul tău pe fiecare propunere și PDF, linkuri urmărite + alerte de deschidere, widget de contacte pe site, pipeline complet.</div></div>
    <div class="plan"><div class="pn">Team: €119/lună</div><div class="pd">Tot ce e în Pro, până la 5 persoane pe un pipeline, analiză a ratei de câștig, suport prioritar.</div></div>
    <div class="plan"><div class="pn">Enterprise: preț personalizat</div><div class="pd">Locuri nelimitate pentru instalatori cu mai multe filiale, jurnal complet de audit, manager dedicat.</div></div>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">?</span><h2>Întrebări frecvente</h2></div>
  <details><summary>De ce uneori bateria mărește amortizarea?</summary><p>O baterie adaugă cost real pe fiecare kWh de capacitate. În Moldova adaugă și economii, dar dacă economiile sunt mai mici decât costul suplimentar, amortizarea se prelungește puțin. E onest: bateriile țin adesea de backup-ul de seară și independență la fel de mult ca de economii. În contorizarea netă 1:1 din România o baterie nu adaugă aproape nicio economie, deci acolo mereu prelungește amortizarea.</p></details>
  <details><summary>Adresa nu a adus date despre soare: ce fac?</summary><p>Ocazional, o adresă foarte nouă sau rurală nu se găsește. Încearcă un reper apropiat sau numele localității: lumina solară abia se schimbă pe câțiva kilometri. Dacă tot nu se încarcă, oferta folosește o medie regională rezonabilă.</p></details>
  <details><summary>Pot schimba logo-ul și datele firmei?</summary><p>Da: în <b>Setări</b>. Logo-ul, numele, moneda și limba ta apar automat pe fiecare propunere și PDF.</p></details>
  <details><summary>O propunere trimisă arată alte cifre decât oferta mea acum.</summary><p>E intenționat: o propunere trimisă e înghețată, ca să vadă clientul mereu ce ai promis. Dacă ai editat oferta, generează o propunere nouă pentru cifre actualizate.</p></details>
  <details><summary>Care e diferența dintre un contact și o ofertă?</summary><p>Un <b>contact</b> e o persoană care ar putea cumpăra. O <b>ofertă</b> e calculul solar propriu-zis pentru ea. Un clic transformă contactul în ofertă, iar cele două rămân legate ca să vezi de unde a venit o vânzare.</p></details>
  <details><summary>Sunt datele clienților mei în siguranță?</summary><p>Da. Datele sunt pe servere din UE, fiecare firmă vede doar proiectele ei, iar tu poți exporta totul în CSV oricând: nimic nu e blocat.</p></details>
</section>
`,

  ru: `
<div class="g-sun"></div>
<h1>Ваш справочник VoltMira</h1>
<p class="g-sub">Как собирать заявки, составлять честный расчёт и отправлять предложение, которому клиент доверяет. Держите вкладку открытой.</p>

<section>
  <div class="g-h"><span class="g-n">›</span><h2>Весь процесс за пять шагов</h2></div>
  <p class="g-lede">Всё остальное в руководстве: лишь детали одного из этих шагов.</p>
  <div class="step"><span class="sn">1</span><div><h3>Поймайте заявку</h3><p>Посетитель заполняет форму расчёта на вашем сайте, или вы добавляете его вручную после звонка. Она попадает во входящие <b>Заявки</b>.</p></div></div>
  <div class="step"><span class="sn">2</span><div><h3>Превратите в расчёт</h3><p>Нажмите <b>Создать оферту</b> на заявке: откроется новый расчёт с уже вписанным именем. Задайте размер системы и годовое потребление.</p></div></div>
  <div class="step"><span class="sn">3</span><div><h3>Отправьте отслеживаемое предложение</h3><p>Создайте ссылку на предложение с вашим логотипом и отправьте в WhatsApp или по почте. Никаких вложений.</p></div></div>
  <div class="step"><span class="sn">4</span><div><h3>Видьте, когда откроют</h3><p>Вы получаете уведомление в момент открытия: сколько раз, как долго. Позвоните, пока оно у него на экране.</p></div></div>
  <div class="step"><span class="sn">5</span><div><h3>Побеждайте</h3><p>Клиент принимает одним касанием прямо в предложении. Расчёт переходит в <b>Выиграно</b>, а заявка: в конвертированные.</p></div></div>
</section>

<section>
  <div class="g-h"><span class="g-n">1</span><h2>Входящие заявки &amp; откуда они приходят</h2></div>
  <p class="g-lede">Заявки: это люди, которые могут купить. VoltMira держит их в одном месте, чтобы никто не потерялся.</p>
  <div class="g-card">
    <p><b>Три способа получения заявок:</b></p>
    <p><b>1. Виджет на сайте.</b> В <b>Настройках</b> вы получаете небольшой фрагмент кода. Вставьте его на сайт один раз: каждый запрос «бесплатного расчёта» автоматически становится заявкой.</p>
    <p><b>2. Вручную.</b> После звонка или выставки добавьте человека сами, чтобы не забыть перезвонить.</p>
    <p><b>3. Из предложения.</b> Когда кто-то просит изменения в отправленном предложении, это тоже возвращается как заявка.</p>
  </div>
  <div class="g-card">
    <p><b>Работа со входящими</b>: переводите заявку по статусам по мере работы:</p>
    <div class="row"><div class="k">Новые</div><div class="v">Только пришли. Им звоните сегодня.</div></div>
    <div class="row"><div class="k">Связались</div><div class="v">Вы написали; ждёте ответа.</div></div>
    <div class="row"><div class="k">Конвертирован</div><div class="v">Вы сделали расчёт: заявка и расчёт связаны.</div></div>
    <div class="row"><div class="k">В архиве</div><div class="v">Не подошёл или остыл. Убран, но не удалён.</div></div>
  </div>
  <div class="g-tip"><p>Нажмите <b>Изменить</b> на любой заявке, чтобы поправить имя, телефон и почту прямо во входящих, и отметьте <b>канал</b>, из которого она пришла (сайт, Facebook, WhatsApp, рекомендация, холодный звонок), чтобы понять, какой из них реально окупается.</p></div>
</section>

<section>
  <div class="g-h"><span class="g-n">2</span><h2>Составление расчёта</h2></div>
  <p class="g-lede">Расчёт: это несколько честных параметров. Вот что означает каждый.</p>
  <div class="g-card">
    <div class="row"><div class="k">Рынок <small>MD / RO</small></div><div class="v">Молдова (нетто-биллинг) или Румыния (нетто-учёт). Автоматически задаёт тарифные правила.</div></div>
    <div class="row"><div class="k">Размер системы <small>кВт</small></div><div class="v">Насколько велика установка: главный фактор и стоимости, и выработки.</div></div>
    <div class="row"><div class="k">Годовое потребление <small>кВт·ч / год</small></div><div class="v">Сколько энергии он тратит в год: возьмите годовой итог из счёта. Определяет, сколько солнечной энергии используется, а сколько экспортируется.</div></div>
    <div class="row"><div class="k">Цена электроэнергии <small>€ / кВт·ч</small></div><div class="v">Сколько он платит за кВт·ч. Заполнено значением по умолчанию (Молдова ≈ €0,18); укажите реальную цену из счёта.</div></div>
    <div class="row"><div class="k">Батарея <small>необязательно, кВт·ч</small></div><div class="v">Добавляет накопитель. Введите полезную ёмкость, и стоимость, и выгода растут вместе с ней. В Молдове окупается (см. ниже).</div></div>
    <div class="row"><div class="k">Смета оборудования <small>необязательно</small></div><div class="v">Выберите реальные панели, инвертор и батарею из своего каталога или из базы поставщиков: либо заполните систему автоматически под выбранную мощность. Показывает разницу между ценой предложения и реальной стоимостью оборудования.</div></div>
  </div>
  <div class="g-tip"><p>Введите <b>адрес</b> клиента, и VoltMira возьмёт реальную инсоляцию именно для этой крыши из спутниковых данных: цифры для <i>его</i> дома, а не средние по стране.</p></div>
</section>

<section>
  <div class="g-h"><span class="g-n">3</span><h2>Каталог оборудования</h2></div>
  <p class="g-lede">Ваша собственная библиотека панелей, инверторов и батарей: чтобы стоимость расчёта бралась из реального оборудования, а не из круглой прикидки.</p>
  <div class="g-card">
    <p><b>Соберите один раз.</b> На вкладке <b>Каталог</b> добавьте товары, которые вы реально устанавливаете, с ценами. Впервые здесь? Нажмите <b>Загрузить стартовый каталог</b>: готовый набор популярных панелей, инверторов и батарей, затем отредактируйте цены под своих поставщиков.</p>
    <p><b>Он задаёт реальную стоимость.</b> Когда вы добавляете оборудование в расчёт, спецификация заменяет приблизительную оценку в €/кВт, так что цифра, которую видит клиент, это ваша настоящая стоимость.</p>
    <p><b>Выглядит солидно.</b> Добавьте URL фото к любому товару, и оно покажется аккуратной миниатюрой: удобно, когда клиент хочет увидеть, что именно ставится на крышу.</p>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">4</span><h2>Понимание цифр</h2></div>
  <p class="g-lede">Именно это отличает VoltMira, и это вы можете уверенно объяснить.</p>
  <div class="g-card">
    <p><b>Окупаемость: три честных сценария.</b> Вместо одной красивой цифры каждый расчёт показывает три, чтобы клиент вам доверял:</p>
    <div class="nums">
      <div class="num-c" style="--bc:#C4543B"><div class="t">Пессимистичный</div><p>Не повезло: слабее солнце, быстрее износ, цены не растут.</p></div>
      <div class="num-c" style="--bc:var(--amber)"><div class="t">Ожидаемый</div><p>Реалистичная середина: то, что вы предложите.</p></div>
      <div class="num-c" style="--bc:var(--green)"><div class="t">Оптимистичный</div><p>Сильное солнце, растущие цены.</p></div>
    </div>
  </div>
  <div class="g-card">
    <p><b>% самопотребления.</b> Доля солнечной энергии, которую дом реально <i>использует</i>, а не экспортирует. Больше: лучше: самопотреблённая энергия стоит полную розничную цену, экспорт оплачивается по низкому тарифу. Очень низкое значение (скажем, 8%) означает, что система <b>слишком большая</b> для этого дома; уменьшите её или добавьте батарею.</p>
  </div>
  <div class="g-card">
    <p><b>Батарея &amp; преимущество Молдовы.</b> С тех пор как Молдова перешла на <b>нетто-биллинг</b> (2024), экспортируемая энергия выкупается по публикуемой оператором среднемесячной цене: около <b>2,5 лей/кВт·ч</b> (≈ €0,13), и ниже всего весной и летом, когда крыша отдаёт больше всего, а используемая вами стоит розничный тариф, ≈ 3,66 лей (€0,18). Разрыв примерно в <b>1,2 лей/кВт·ч</b>: это и есть заработок батареи на каждом запасённом кВт·ч: не весь тариф, как часто пишут в предложениях, но достаточно, чтобы в Молдове батарея действительно добавляла экономию.</p>
    <div class="g-tip"><p>Подбирайте батарею под <b>вечер</b>, а не «как можно больше»: избыточная батарея лишь добавляет затраты.</p></div>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">5</span><h2>Отслеживаемые предложения</h2></div>
  <p class="g-lede">То, что закрывает сделки: вы всегда знаете, на каком этапе клиент.</p>
  <div class="g-card">
    <p><b>Отправка.</b> В редакторе нажмите <b>Создать предложение</b>: получите ссылку с вашим логотипом и именем. Отправьте в WhatsApp или по почте, ничего скачивать не нужно.</p>
    <p><b>Что видит клиент.</b> Чистая страница с тремя сценариями окупаемости, ежемесячной экономией, вашими допущениями и кнопкой <b>Принять</b>.</p>
    <p><b>Отслеживание.</b> Вы получаете уведомление в момент открытия и видите, как часто и как долго смотрели: сигнал позвонить точно вовремя.</p>
    <p><b>Зафиксировано &amp; честно.</b> После отправки предложение фиксирует цифры. Изменение расчёта позже никогда не меняет то, что видел клиент.</p>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">6</span><h2>Тарифы</h2></div>
  <p class="g-lede">Бесплатно на бета-этапе: без карты. Цена основателя зафиксирована для первых 50 монтажников.</p>
  <div class="plans">
    <div class="plan hot"><div class="pn">Pro: €49/мес</div><div class="pd">Ваш логотип на каждом предложении и PDF, отслеживаемые ссылки + уведомления об открытии, виджет заявок на сайте, полный пайплайн.</div></div>
    <div class="plan"><div class="pn">Team: €119/мес</div><div class="pd">Всё из Pro, до 5 человек в одном пайплайне, аналитика конверсии, приоритетная поддержка.</div></div>
    <div class="plan"><div class="pn">Enterprise: индивидуальная цена</div><div class="pd">Неограниченные места для монтажников с филиалами, полный журнал аудита, персональный менеджер.</div></div>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">?</span><h2>Частые вопросы</h2></div>
  <details><summary>Почему батарея иногда удлиняет окупаемость?</summary><p>Батарея добавляет реальную стоимость за каждый кВт·ч ёмкости. В Молдове она добавляет и экономию, но если экономия меньше дополнительной стоимости, окупаемость немного растягивается. Это честно: батареи часто нужны для вечернего резерва и независимости не меньше, чем ради экономии. При румынском нетто-учёте 1:1 батарея почти не добавляет экономии, поэтому там всегда удлиняет окупаемость.</p></details>
  <details><summary>Адрес не подтянул данные о солнце: что делать?</summary><p>Иногда очень новый или сельский адрес не распознаётся. Попробуйте ближайший ориентир или название населённого пункта: инсоляция почти не меняется на нескольких километрах. Если всё равно не загружается, расчёт использует разумное региональное среднее.</p></details>
  <details><summary>Можно ли изменить логотип и данные компании?</summary><p>Да: в <b>Настройках</b>. Ваш логотип, название, валюта и язык автоматически появляются на каждом предложении и PDF.</p></details>
  <details><summary>Отправленное предложение показывает не те цифры, что мой расчёт сейчас.</summary><p>Так задумано: отправленное предложение зафиксировано, чтобы клиент всегда видел обещанное. Если вы изменили расчёт, создайте новое предложение с обновлёнными цифрами.</p></details>
  <details><summary>В чём разница между заявкой и расчётом?</summary><p><b>Заявка</b>: это человек, который может купить. <b>Расчёт</b>: это конкретный солнечный расчёт для него. Один клик превращает заявку в расчёт, и они остаются связанными, чтобы видеть, откуда пришла сделка.</p></details>
  <details><summary>Данные моих клиентов в безопасности?</summary><p>Да. Данные на серверах в ЕС, каждая компания видит только свои проекты, и вы можете в любой момент экспортировать всё в CSV: ничто не заблокировано.</p></details>
</section>
`,
  uk: `
<div class="g-sun"></div>
<h1>Ваш довідник VoltMira</h1>
<p class="g-sub">Як збирати заявки, складати чесний розрахунок і надсилати пропозицію, якій клієнт довіряє. Тримайте вкладку відкритою.</p>

<section>
  <div class="g-h"><span class="g-n">›</span><h2>Увесь процес за п’ять кроків</h2></div>
  <p class="g-lede">Усе інше в посібнику лише деталі одного з цих кроків.</p>
  <div class="step"><span class="sn">1</span><div><h3>Спіймайте заявку</h3><p>Відвідувач заповнює форму розрахунку на вашому сайті, або ви додаєте його вручну після дзвінка. Заявка потрапляє у вхідні <b>Заявки</b>.</p></div></div>
  <div class="step"><span class="sn">2</span><div><h3>Перетворіть на розрахунок</h3><p>Натисніть <b>Створити розрахунок</b> на заявці: відкриється новий розрахунок із уже вписаним ім’ям. Задайте розмір системи й річне споживання.</p></div></div>
  <div class="step"><span class="sn">3</span><div><h3>Надішліть відстежувану пропозицію</h3><p>Створіть посилання на пропозицію з вашим логотипом і надішліть у Viber, WhatsApp або поштою. Жодних вкладень.</p></div></div>
  <div class="step"><span class="sn">4</span><div><h3>Бачте, коли відкриють</h3><p>Ви отримуєте сповіщення в момент відкриття: скільки разів і як довго. Зателефонуйте, поки пропозиція в клієнта на екрані.</p></div></div>
  <div class="step"><span class="sn">5</span><div><h3>Вигравайте</h3><p>Клієнт приймає одним дотиком прямо в пропозиції. Розрахунок переходить у <b>Виграно</b>, а заявка в конвертовані.</p></div></div>
</section>

<section>
  <div class="g-h"><span class="g-n">1</span><h2>Вхідні заявки &amp; звідки вони приходять</h2></div>
  <p class="g-lede">Заявки це люди, які можуть купити. VoltMira тримає їх в одному місці, щоб ніхто не загубився.</p>
  <div class="g-card">
    <p><b>Три способи отримання заявок:</b></p>
    <p><b>1. Віджет на сайті.</b> У <b>Налаштуваннях</b> ви отримуєте невеликий фрагмент коду. Вставте його на сайт один раз: кожен запит «безкоштовного розрахунку» автоматично стає заявкою.</p>
    <p><b>2. Вручну.</b> Після дзвінка чи виставки додайте людину самі, щоб не забути передзвонити.</p>
    <p><b>3. З пропозиції.</b> Коли хтось просить змін у надісланій пропозиції, це теж повертається як заявка.</p>
  </div>
  <div class="g-card">
    <p><b>Робота з вхідними</b>: переводьте заявку між статусами в міру роботи:</p>
    <div class="row"><div class="k">Нові</div><div class="v">Щойно прийшли. Їм телефонуйте сьогодні.</div></div>
    <div class="row"><div class="k">Зв’язалися</div><div class="v">Ви написали; чекаєте на відповідь.</div></div>
    <div class="row"><div class="k">Конвертовано</div><div class="v">Ви зробили розрахунок: заявка й розрахунок пов’язані.</div></div>
    <div class="row"><div class="k">В архіві</div><div class="v">Не підійшов або охолов. Прибрано, але не видалено.</div></div>
  </div>
  <div class="g-tip"><p>Натисніть <b>Змінити</b> на будь-якій заявці, щоб виправити ім’я, телефон і пошту прямо у вхідних, і позначте <b>канал</b>, з якого вона прийшла (сайт, Facebook, Viber, рекомендація, холодний дзвінок), щоб зрозуміти, який із них реально окупається.</p></div>
</section>

<section>
  <div class="g-h"><span class="g-n">2</span><h2>Складання розрахунку</h2></div>
  <p class="g-lede">Розрахунок це кілька чесних параметрів. Ось що означає кожен.</p>
  <div class="g-card">
    <div class="row"><div class="k">Ринок <small>MD / RO</small></div><div class="v">Молдова (нетбілінг) або Румунія (нетметеринг). Автоматично задає тарифні правила.</div></div>
    <div class="row"><div class="k">Розмір системи <small>кВт</small></div><div class="v">Наскільки велика установка: головний чинник і вартості, і генерації.</div></div>
    <div class="row"><div class="k">Річне споживання <small>кВт·год / рік</small></div><div class="v">Скільки енергії клієнт витрачає за рік: візьміть річний підсумок із рахунку. Визначає, скільки сонячної енергії використовується, а скільки експортується.</div></div>
    <div class="row"><div class="k">Ціна електроенергії <small>€ / кВт·год</small></div><div class="v">Скільки клієнт платить за кВт·год. Заповнено значенням за замовчуванням (Молдова ≈ €0,18); вкажіть реальну ціну з рахунку.</div></div>
    <div class="row"><div class="k">Батарея <small>необов’язково, кВт·год</small></div><div class="v">Додає накопичувач. Введіть корисну ємність, і вартість, і вигода зростають разом із нею. У Молдові окупається (див. нижче).</div></div>
    <div class="row"><div class="k">Специфікація обладнання <small>необов’язково</small></div><div class="v">Виберіть реальні панелі, інвертор і батарею зі свого каталогу або з бази постачальників, або заповніть систему автоматично під вибрану потужність. Показує різницю між ціною пропозиції та реальною вартістю обладнання.</div></div>
  </div>
  <div class="g-tip"><p>Введіть <b>адресу</b> клієнта, і VoltMira візьме реальну інсоляцію саме для цього даху із супутникових даних: цифри для <i>його</i> будинку, а не середні по країні.</p></div>
</section>

<section>
  <div class="g-h"><span class="g-n">3</span><h2>Каталог обладнання</h2></div>
  <p class="g-lede">Ваша власна бібліотека панелей, інверторів і батарей, щоб вартість розрахунку бралася з реального обладнання, а не з круглої прикидки.</p>
  <div class="g-card">
    <p><b>Зберіть один раз.</b> На вкладці <b>Каталог</b> додайте товари, які ви реально встановлюєте, із цінами. Уперше тут? Натисніть <b>Завантажити стартовий каталог</b>: готовий набір популярних панелей, інверторів і батарей, потім відредагуйте ціни під своїх постачальників.</p>
    <p><b>Він задає реальну вартість.</b> Коли ви додаєте обладнання в розрахунок, специфікація замінює приблизну оцінку в €/кВт, тож цифра, яку бачить клієнт, це ваша справжня вартість.</p>
    <p><b>Виглядає солідно.</b> Додайте URL фото до будь-якого товару, і воно покажеться акуратною мініатюрою: зручно, коли клієнт хоче побачити, що саме ставиться на дах.</p>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">4</span><h2>Розуміння цифр</h2></div>
  <p class="g-lede">Саме це вирізняє VoltMira, і саме це ви можете впевнено пояснити.</p>
  <div class="g-card">
    <p><b>Окупність: три чесні сценарії.</b> Замість однієї гарної цифри кожен розрахунок показує три, щоб клієнт вам довіряв:</p>
    <div class="nums">
      <div class="num-c" style="--bc:#C4543B"><div class="t">Песимістичний</div><p>Не пощастило: слабше сонце, швидше зношування, ціни не ростуть.</p></div>
      <div class="num-c" style="--bc:var(--amber)"><div class="t">Очікуваний</div><p>Реалістична середина: те, що ви запропонуєте.</p></div>
      <div class="num-c" style="--bc:var(--green)"><div class="t">Оптимістичний</div><p>Сильне сонце, зростаючі ціни.</p></div>
    </div>
  </div>
  <div class="g-card">
    <p><b>% власного споживання.</b> Частка сонячної енергії, яку будинок реально <i>використовує</i>, а не експортує. Більше це краще: власно спожита енергія коштує повну роздрібну ціну, експорт оплачується за низьким тарифом. Дуже низьке значення (скажімо, 8%) означає, що система <b>завелика</b> для цього будинку; зменште її або додайте батарею.</p>
  </div>
  <div class="g-card">
    <p><b>Батарея &amp; перевага Молдови.</b> Відколи Молдова перейшла на <b>нетбілінг</b> (2024), експортована енергія викуповується за опублікованою оператором середньомісячною ціною: близько <b>2,5 лей/кВт·год</b> (≈ €0,13), і найнижче навесні та влітку, коли дах віддає найбільше, а енергія, яку ви використовуєте, коштує за роздрібним тарифом, ≈ 3,66 лей (€0,18). Різниця приблизно <b>1,2 лей/кВт·год</b>: це й є заробіток батареї на кожній збереженій кВт·год. Не весь тариф, як часто пишуть у пропозиціях, але достатньо, щоб у Молдові батарея справді додавала економії.</p>
    <div class="g-tip"><p>Добирайте батарею під <b>вечір</b>, а не «якомога більшу»: надмірна батарея лише додає витрат.</p></div>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">5</span><h2>Відстежувані пропозиції</h2></div>
  <p class="g-lede">Те, що закриває угоди: ви завжди знаєте, на якому етапі клієнт.</p>
  <div class="g-card">
    <p><b>Надсилання.</b> У редакторі натисніть <b>Створити пропозицію</b>: отримаєте посилання з вашим логотипом та ім’ям. Надішліть у Viber, WhatsApp або поштою, нічого завантажувати не потрібно.</p>
    <p><b>Що бачить клієнт.</b> Чиста сторінка з трьома сценаріями окупності, щомісячною економією, вашими припущеннями й кнопкою <b>Прийняти</b>.</p>
    <p><b>Відстеження.</b> Ви отримуєте сповіщення в момент відкриття й бачите, як часто і як довго дивилися: сигнал зателефонувати саме вчасно.</p>
    <p><b>Зафіксовано &amp; чесно.</b> Після надсилання пропозиція фіксує цифри. Зміна розрахунку пізніше ніколи не змінює те, що бачив клієнт.</p>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">6</span><h2>Тарифи</h2></div>
  <p class="g-lede">Безкоштовно на етапі бета, без картки. Ціна засновника зафіксована для перших 50 монтажників.</p>
  <div class="plans">
    <div class="plan hot"><div class="pn">Pro: €49/міс.</div><div class="pd">Ваш логотип на кожній пропозиції та PDF, відстежувані посилання + сповіщення про відкриття, віджет заявок на сайті, повна воронка.</div></div>
    <div class="plan"><div class="pn">Team: €119/міс.</div><div class="pd">Усе з Pro, до 5 людей в одній воронці, аналітика конверсії, пріоритетна підтримка.</div></div>
    <div class="plan"><div class="pn">Enterprise: індивідуальна ціна</div><div class="pd">Необмежені місця для монтажників із філіями, повний журнал аудиту, персональний менеджер.</div></div>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">?</span><h2>Часті запитання</h2></div>
  <details><summary>Чому батарея іноді подовжує окупність?</summary><p>Батарея додає реальну вартість за кожну кВт·год ємності. У Молдові вона додає й економію, але якщо економія менша за додаткову вартість, окупність трохи розтягується. Це чесно: батареї часто потрібні для вечірнього резерву й незалежності не менше, ніж заради економії. За румунського нетметерингу 1:1 батарея майже не додає економії, тому там завжди подовжує окупність.</p></details>
  <details><summary>Адреса не підтягнула дані про сонце: що робити?</summary><p>Іноді дуже нову або сільську адресу не розпізнано. Спробуйте найближчий орієнтир або назву населеного пункту: інсоляція майже не змінюється на кількох кілометрах. Якщо все одно не завантажується, розрахунок використовує розумне регіональне середнє.</p></details>
  <details><summary>Чи можна змінити логотип і дані компанії?</summary><p>Так, у <b>Налаштуваннях</b>. Ваш логотип, назва, валюта й мова автоматично з’являються на кожній пропозиції та PDF.</p></details>
  <details><summary>Надіслана пропозиція показує не ті цифри, що мій розрахунок зараз.</summary><p>Так задумано: надіслана пропозиція зафіксована, щоб клієнт завжди бачив обіцяне. Якщо ви змінили розрахунок, створіть нову пропозицію з оновленими цифрами.</p></details>
  <details><summary>У чому різниця між заявкою та розрахунком?</summary><p><b>Заявка</b> це людина, яка може купити. <b>Розрахунок</b> це конкретний сонячний розрахунок для неї. Один клік перетворює заявку на розрахунок, і вони лишаються пов’язаними, щоб бачити, звідки прийшла угода.</p></details>
  <details><summary>Чи в безпеці дані моїх клієнтів?</summary><p>Так. Дані зберігаються на серверах у ЄС, кожна компанія бачить лише власні проєкти, і ви будь-коли можете експортувати все в CSV: нічого не заблоковано.</p></details>
</section>
`,
};

// Give each section an anchor and collect its heading for the TOC.
const decode = (h) => h.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
function withAnchors(src) {
  const toc = [];
  const html = src
    .replace('<div class="g-sun"></div>', "")
    .replace(/<section>(\s*<div class="g-h"><span class="g-n">([^<]*)<\/span><h2>([\s\S]*?)<\/h2>)/g, (_, head, n, title) => {
      const id = "g-" + (toc.length + 1);
      toc.push({ id, n, title: decode(title) });
      return `<section id="${id}">${head}`;
    });
  return { html, toc };
}

export default async function GuidePage() {
  const co = await currentCompany();
  const lang = normLang(co?.lang);
  const { html, toc } = withAnchors(HTML[lang] || HTML.en);
  return (
    <div className="dx gx">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="gx-layout">
        <aside className="gx-toc"><GuideToc items={toc} label={t("guide_toc", lang)} /></aside>
        <article className="guide" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}

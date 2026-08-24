// app/(app)/guide/page.jsx — the in-app installer guide, so clients can self-serve
// instead of calling. Rendered as static HTML using the app's theme variables so
// it matches light/dark automatically. Fully translated (EN / RO / RU) and picked
// from the company's language, so nothing here is hardcoded English.
import { currentCompany } from "../../../lib/session.js";
import { normLang } from "../../../lib/i18n.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Guide — VoltMira" };

const CSS = `
.guide{max-width:820px;margin:0 auto;color:var(--ink)}
.guide .g-sun{height:4px;border-radius:99px;background:linear-gradient(90deg,var(--amber),var(--green));margin-bottom:26px}
.guide h1{font-size:clamp(26px,5vw,34px);letter-spacing:-.02em;margin:0 0 8px;line-height:1.08}
.guide .g-sub{color:var(--ink-soft);font-size:16px;max-width:60ch;margin:0 0 30px}
.guide .g-kick{font-family:var(--font-m,monospace);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--green);margin-bottom:12px}
.guide section{margin:0 0 34px;scroll-margin-top:20px}
.guide .g-h{display:flex;align-items:center;gap:12px;margin-bottom:6px}
.guide .g-n{font-family:var(--font-m,monospace);font-size:12px;color:var(--paper);background:var(--ink);width:26px;height:26px;border-radius:8px;display:grid;place-items:center;flex:none;font-weight:600}
.guide h2{font-size:21px;letter-spacing:-.01em;margin:0}
.guide .g-lede{color:var(--ink-soft);font-size:15px;margin:0 0 16px;max-width:64ch}
.guide .g-card{background:var(--paper-2);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin-bottom:11px}
.guide .g-card p{margin:0 0 9px;font-size:14.5px;color:var(--ink-soft);line-height:1.6}
.guide .g-card p:last-child{margin-bottom:0}
.guide .g-card b{color:var(--ink)}
.guide .step{display:flex;gap:15px;align-items:flex-start;background:var(--paper-2);border:1px solid var(--line);border-radius:13px;padding:15px 17px;margin-bottom:10px}
.guide .step .sn{flex:none;width:29px;height:29px;border-radius:9px;display:grid;place-items:center;font-family:var(--font-m,monospace);font-weight:600;font-size:14px;color:var(--green);background:var(--green-tint)}
.guide .step h3{margin:0 0 2px;font-size:15.5px}
.guide .step p{margin:0;font-size:13.5px;color:var(--muted);line-height:1.55}
.guide .row{display:grid;grid-template-columns:150px 1fr;gap:16px;padding:12px 0;border-top:1px solid var(--line)}
.guide .row:first-child{border-top:none}
.guide .row .k{font-weight:600;font-size:14px}
.guide .row .k small{display:block;font-family:var(--font-m,monospace);font-size:11px;color:var(--muted);font-weight:400;margin-top:2px}
.guide .row .v{font-size:13.5px;color:var(--ink-soft);line-height:1.55}
.guide .g-tip{display:flex;gap:11px;background:var(--amber-tint,#FBF0DD);border-radius:12px;padding:13px 15px;margin-top:12px;border:1px solid var(--line)}
.guide .g-tip p{margin:0;font-size:13.5px;color:var(--ink)}
.guide .nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:2px 0 4px}
.guide .num-c{background:var(--paper-2);border:1px solid var(--line);border-radius:11px;padding:13px 14px;border-top:3px solid var(--bc)}
.guide .num-c .t{font-family:var(--font-m,monospace);font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--bc);font-weight:600}
.guide .num-c p{margin:5px 0 0;font-size:12.5px;color:var(--ink-soft);line-height:1.45}
.guide details{background:var(--paper-2);border:1px solid var(--line);border-radius:12px;padding:0 17px;margin-bottom:9px}
.guide summary{cursor:pointer;list-style:none;padding:14px 0;font-weight:600;font-size:15px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.guide summary::-webkit-details-marker{display:none}
.guide summary::after{content:"+";font-family:var(--font-m,monospace);color:var(--green);font-size:18px;flex:none}
.guide details[open] summary::after{content:"–"}
.guide details p{margin:0 0 15px;font-size:14px;color:var(--ink-soft);line-height:1.6}
.guide .plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:10px}
.guide .plan{background:var(--paper-2);border:1px solid var(--line);border-radius:12px;padding:15px}
.guide .plan.hot{border-color:var(--amber)}
.guide .plan .pn{font-weight:700;font-size:14.5px}
.guide .plan .pp{font-family:var(--font-m,monospace);font-size:19px;margin:3px 0;color:var(--green)}
.guide .plan .pd{font-size:12px;color:var(--muted);line-height:1.4}
@media(max-width:560px){.guide .row{grid-template-columns:1fr;gap:3px}}
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
  <div class="step"><span class="sn">2</span><div><h3>Turn it into a quote</h3><p>Hit <b>Create quote</b> on the lead — a new quote opens, pre-filled with their name. Set the system size and their yearly consumption.</p></div></div>
  <div class="step"><span class="sn">3</span><div><h3>Send a tracked proposal</h3><p>Generate a proposal link with your logo and send it on WhatsApp or email. No attachments to chase.</p></div></div>
  <div class="step"><span class="sn">4</span><div><h3>See when they open it</h3><p>You're notified the moment the client opens it — how many times, how long. Call them while it's on their screen.</p></div></div>
  <div class="step"><span class="sn">5</span><div><h3>Win</h3><p>They accept with one tap, right from the proposal. The quote flips to <b>Won</b> and the lead is marked converted.</p></div></div>
</section>

<section>
  <div class="g-h"><span class="g-n">1</span><h2>The Leads inbox &amp; where leads come from</h2></div>
  <p class="g-lede">Leads are people who might buy. VoltMira keeps them in one place so none slip through.</p>
  <div class="g-card">
    <p><b>Three ways leads arrive:</b></p>
    <p><b>1. Your website widget.</b> In <b>Settings</b> you get a small snippet of code. Paste it onto your site once — every "free estimate" a visitor requests becomes a lead, automatically.</p>
    <p><b>2. By hand.</b> After a call or a fair, add the person yourself so you don't forget to follow up.</p>
    <p><b>3. From a proposal.</b> When someone asks for changes on a proposal you sent, that returns as a lead too.</p>
  </div>
  <div class="g-card">
    <p><b>Working the inbox</b> — move each lead through its status as you work it:</p>
    <div class="row"><div class="k">New</div><div class="v">Just arrived. These are who you call today.</div></div>
    <div class="row"><div class="k">Contacted</div><div class="v">You've reached out; waiting to hear back.</div></div>
    <div class="row"><div class="k">Converted</div><div class="v">You built a quote from it — lead and quote are now linked.</div></div>
    <div class="row"><div class="k">Archived</div><div class="v">Not a fit, or gone cold. Tidied away, not deleted.</div></div>
  </div>
  <div class="g-tip"><p>Click <b>Edit</b> on any lead to fix their name, phone, and email right in the inbox — and tag the <b>channel</b> it came from (website, Facebook, WhatsApp, referral, cold call) so you learn which one actually pays off.</p></div>
</section>

<section>
  <div class="g-h"><span class="g-n">2</span><h2>Building a quote</h2></div>
  <p class="g-lede">A quote is just a handful of honest inputs. Here's what each one means.</p>
  <div class="g-card">
    <div class="row"><div class="k">Market <small>MD / RO</small></div><div class="v">Moldova (net billing) or Romania (net metering). Sets the tariff rules automatically.</div></div>
    <div class="row"><div class="k">System size <small>kW</small></div><div class="v">How big the array is — the biggest driver of both cost and production.</div></div>
    <div class="row"><div class="k">Yearly consumption <small>kWh / year</small></div><div class="v">How much power they use per year — read the annual total off their bill. This decides how much solar they use vs. export.</div></div>
    <div class="row"><div class="k">Electricity price <small>€ / kWh</small></div><div class="v">What they pay per kWh. Pre-filled with the market default (Moldova ≈ €0.18); set their real bill for accuracy.</div></div>
    <div class="row"><div class="k">Battery <small>optional, kWh</small></div><div class="v">Adds storage. Enter usable capacity — cost and benefit both scale with it. Worth it in Moldova (see below).</div></div>
    <div class="row"><div class="k">Casa Verde grant <small>optional</small></div><div class="v">If the client qualifies for a subsidy, set the amount in Settings and switch it on — it comes off the up-front cost.</div></div>
  </div>
  <div class="g-tip"><p>Type the client's <b>address</b> and VoltMira pulls the real sunlight for that exact roof from satellite data — numbers for <i>their</i> house, not a national average.</p></div>
</section>

<section>
  <div class="g-h"><span class="g-n">3</span><h2>The equipment catalog</h2></div>
  <p class="g-lede">Your own library of panels, inverters and batteries — so a quote's cost comes from real gear, not a round guess.</p>
  <div class="g-card">
    <p><b>Build it once.</b> On the <b>Catalog</b> tab, add the products you actually install with their prices. New here? Hit <b>Load starter catalog</b> for a ready set of common panels, inverters and batteries, then edit the prices to match your suppliers.</p>
    <p><b>It drives the real cost.</b> When you add equipment to a quote, the bill of materials replaces the rough €/kW estimate — so the number you show the client is your true cost.</p>
    <p><b>It looks the part.</b> Add a photo URL to any product and it shows as a clean thumbnail — handy when a client wants to see exactly what's going on the roof.</p>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">4</span><h2>Understanding the numbers</h2></div>
  <p class="g-lede">This is what makes VoltMira different — and what you can confidently explain.</p>
  <div class="g-card">
    <p><b>Payback — three honest scenarios.</b> Instead of one flattering number, every quote shows three, so the client trusts you:</p>
    <div class="nums">
      <div class="num-c" style="--bc:#C4543B"><div class="t">Pessimistic</div><p>Bad luck: weaker sun, faster wear, flat prices.</p></div>
      <div class="num-c" style="--bc:var(--amber)"><div class="t">Expected</div><p>The realistic middle — what you'd quote.</p></div>
      <div class="num-c" style="--bc:var(--green)"><div class="t">Optimistic</div><p>Strong sun, rising prices.</p></div>
    </div>
  </div>
  <div class="g-card">
    <p><b>Self-consumed %.</b> The share of solar the household actually <i>uses</i> instead of exporting. Higher is better — self-used power is worth full retail price, exports earn a low feed rate. A very low number (say 8%) means the system is <b>too big</b> for that home; downsize it, or add a battery.</p>
  </div>
  <div class="g-card">
    <p><b>Battery &amp; the Moldova advantage.</b> Since Moldova moved to <b>net billing</b> (2024), exported power earns ≈ €0.07/kWh while power you use is worth ≈ €0.18. A battery stores daytime surplus for the evening, turning cheap exports into full-price self-use — so in Moldova a battery genuinely adds savings.</p>
    <div class="g-tip"><p>Size the battery to cover the <b>evening</b>, not to be as big as possible — an oversized battery just adds cost.</p></div>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">5</span><h2>Tracked proposals</h2></div>
  <p class="g-lede">The part that closes deals: you always know where the client stands.</p>
  <div class="g-card">
    <p><b>Sending.</b> From the editor, hit <b>Generate proposal</b> — you get a link with your logo and name. Share it on WhatsApp or email, nothing to download.</p>
    <p><b>What the client sees.</b> A clean page with the three payback scenarios, monthly savings, your assumptions, and an <b>Accept</b> button.</p>
    <p><b>Tracking.</b> You're notified the moment they open it, and see how often and how long they looked — your cue to call at exactly the right time.</p>
    <p><b>Frozen &amp; honest.</b> Once sent, a proposal locks its numbers. Editing the quote later never changes what the client was shown.</p>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">6</span><h2>Plans</h2></div>
  <p class="g-lede">Free during beta — no card required. Founder pricing is locked for the first 50 installers.</p>
  <div class="plans">
    <div class="plan hot"><div class="pn">Pro · €49/mo</div><div class="pd">Your logo on every proposal &amp; PDF, tracked links + open alerts, website lead widget, full pipeline.</div></div>
    <div class="plan"><div class="pn">Team · €119/mo</div><div class="pd">Everything in Pro, up to 5 people on one pipeline, win-rate analytics, priority support.</div></div>
    <div class="plan"><div class="pn">Enterprise · custom pricing</div><div class="pd">Unlimited seats for multi-branch installers, full audit log, a dedicated manager.</div></div>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">?</span><h2>Common questions</h2></div>
  <details><summary>Why does a battery make payback longer sometimes?</summary><p>A battery adds real cost per kWh of capacity. In Moldova it also adds savings — but if the savings are smaller than the extra cost, payback stretches a little. That's honest: batteries are often about evening backup and independence as much as savings. In Romania's 1:1 net metering a battery adds almost no savings, so it always lengthens payback there.</p></details>
  <details><summary>The address didn't pull sun data — what now?</summary><p>Occasionally a very new or rural address won't resolve. Try a nearby landmark or the town name — the sunlight barely changes over a few kilometres. If it still won't load, the quote uses a sensible regional average.</p></details>
  <details><summary>Can I change my company logo and details?</summary><p>Yes — in <b>Settings</b>. Your logo, name, currency, and language flow onto every proposal and PDF automatically.</p></details>
  <details><summary>A sent proposal shows different numbers than my quote now.</summary><p>That's intentional — a sent proposal is frozen so the client always sees what you promised. If you've edited the quote, generate a fresh proposal to send updated numbers.</p></details>
  <details><summary>What's the difference between a lead and a quote?</summary><p>A <b>lead</b> is a person who might buy. A <b>quote</b> is the actual solar calculation for them. One click turns a lead into a quote, and they stay linked so you can trace where a deal came from.</p></details>
  <details><summary>Is my clients' data safe?</summary><p>Yes. Data is on EU servers, each company only sees its own projects, and you can export everything to CSV anytime — nothing is locked in.</p></details>
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
  <div class="step"><span class="sn">2</span><div><h3>Transformă-l în ofertă</h3><p>Apasă <b>Creează ofertă</b> pe contact — se deschide o ofertă nouă, pre-completată cu numele lui. Setează dimensiunea sistemului și consumul anual.</p></div></div>
  <div class="step"><span class="sn">3</span><div><h3>Trimite o propunere urmărită</h3><p>Generează un link de propunere cu logo-ul tău și trimite-l pe WhatsApp sau email. Fără atașamente de urmărit.</p></div></div>
  <div class="step"><span class="sn">4</span><div><h3>Vezi când o deschide</h3><p>Ești notificat în clipa în care clientul o deschide — de câte ori, cât timp. Sună-l cât e pe ecranul lui.</p></div></div>
  <div class="step"><span class="sn">5</span><div><h3>Câștigă</h3><p>Acceptă cu un singur tap, direct din propunere. Oferta trece pe <b>Câștigat</b>, iar contactul e marcat convertit.</p></div></div>
</section>

<section>
  <div class="g-h"><span class="g-n">1</span><h2>Inbox-ul Contacte &amp; de unde vin contactele</h2></div>
  <p class="g-lede">Contactele sunt oameni care ar putea cumpăra. VoltMira îi ține într-un singur loc, ca să nu-ți scape niciunul.</p>
  <div class="g-card">
    <p><b>Trei feluri în care apar contactele:</b></p>
    <p><b>1. Widgetul de pe site.</b> În <b>Setări</b> primești un mic fragment de cod. Lipește-l o dată pe site — fiecare „estimare gratuită" cerută de un vizitator devine automat un contact.</p>
    <p><b>2. Manual.</b> După un apel sau un târg, adaugă tu persoana ca să nu uiți să revii.</p>
    <p><b>3. Dintr-o propunere.</b> Când cineva cere modificări la o propunere trimisă, revine tot ca un contact.</p>
  </div>
  <div class="g-card">
    <p><b>Lucrează inbox-ul</b> — mută fiecare contact prin statusuri pe măsură ce lucrezi:</p>
    <div class="row"><div class="k">Nou</div><div class="v">Tocmai a sosit. Pe aceștia îi suni azi.</div></div>
    <div class="row"><div class="k">Contactat</div><div class="v">Ai luat legătura; aștepți răspuns.</div></div>
    <div class="row"><div class="k">Convertit</div><div class="v">Ai făcut o ofertă din el — contactul și oferta sunt acum legate.</div></div>
    <div class="row"><div class="k">Arhivat</div><div class="v">Nu se potrivește sau s-a răcit. Pus deoparte, nu șters.</div></div>
  </div>
  <div class="g-tip"><p>Apasă <b>Editează</b> pe orice contact ca să corectezi numele, telefonul și emailul direct în inbox — și etichetează <b>canalul</b> din care a venit (site, Facebook, WhatsApp, recomandare, apel la rece), ca să afli care aduce cu adevărat rezultate.</p></div>
</section>

<section>
  <div class="g-h"><span class="g-n">2</span><h2>Construirea unei oferte</h2></div>
  <p class="g-lede">O ofertă e doar câteva date oneste. Iată ce înseamnă fiecare.</p>
  <div class="g-card">
    <div class="row"><div class="k">Piață <small>MD / RO</small></div><div class="v">Moldova (facturare netă) sau România (contorizare netă). Setează automat regulile de tarif.</div></div>
    <div class="row"><div class="k">Dimensiune sistem <small>kW</small></div><div class="v">Cât de mare e sistemul — factorul principal pentru cost și producție.</div></div>
    <div class="row"><div class="k">Consum anual <small>kWh / an</small></div><div class="v">Cât curent folosește pe an — ia totalul anual de pe factură. Decide cât din solar folosește vs. exportă.</div></div>
    <div class="row"><div class="k">Preț energie <small>€ / kWh</small></div><div class="v">Cât plătește pe kWh. Pre-completat cu valoarea implicită a pieței (Moldova ≈ €0,18); pune prețul real pentru acuratețe.</div></div>
    <div class="row"><div class="k">Baterie <small>opțional, kWh</small></div><div class="v">Adaugă stocare. Introdu capacitatea utilă — și costul, și beneficiul cresc cu ea. Merită în Moldova (vezi mai jos).</div></div>
    <div class="row"><div class="k">Grant Casa Verde <small>opțional</small></div><div class="v">Dacă clientul se califică pentru subvenție, setează suma în Setări și activeaz-o — se scade din costul inițial.</div></div>
  </div>
  <div class="g-tip"><p>Scrie <b>adresa</b> clientului și VoltMira ia lumina solară reală pentru acel acoperiș din date satelitare — cifre pentru casa <i>lui</i>, nu o medie națională.</p></div>
</section>

<section>
  <div class="g-h"><span class="g-n">3</span><h2>Catalogul de echipamente</h2></div>
  <p class="g-lede">Biblioteca ta de panouri, invertoare și baterii — ca prețul unei oferte să vină din echipamente reale, nu dintr-o estimare rotundă.</p>
  <div class="g-card">
    <p><b>Construiește-l o dată.</b> În tabul <b>Catalog</b>, adaugă produsele pe care chiar le instalezi, cu prețuri. Ești nou? Apasă <b>Încarcă catalog de start</b> pentru un set gata făcut de panouri, invertoare și baterii uzuale, apoi editează prețurile după furnizorii tăi.</p>
    <p><b>Determină costul real.</b> Când adaugi echipamente la o ofertă, lista de materiale înlocuiește estimarea aproximativă în €/kW — așa că numărul arătat clientului e costul tău real.</p>
    <p><b>Arată profesionist.</b> Adaugă un URL de imagine la orice produs și apare ca o miniatură curată — util când clientul vrea să vadă exact ce ajunge pe acoperiș.</p>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">4</span><h2>Înțelegerea cifrelor</h2></div>
  <p class="g-lede">Asta face VoltMira diferit — și asta poți explica cu încredere.</p>
  <div class="g-card">
    <p><b>Amortizare — trei scenarii oneste.</b> În loc de o singură cifră măgulitoare, fiecare ofertă arată trei, ca să aibă clientul încredere:</p>
    <div class="nums">
      <div class="num-c" style="--bc:#C4543B"><div class="t">Pesimist</div><p>Ghinion: soare mai slab, uzură mai rapidă, prețuri constante.</p></div>
      <div class="num-c" style="--bc:var(--amber)"><div class="t">Așteptat</div><p>Mijlocul realist — ce ai oferta.</p></div>
      <div class="num-c" style="--bc:var(--green)"><div class="t">Optimist</div><p>Soare puternic, prețuri în creștere.</p></div>
    </div>
  </div>
  <div class="g-card">
    <p><b>% autoconsum.</b> Cota de solar pe care gospodăria chiar o <i>folosește</i> în loc s-o exporte. Mai mare e mai bine — energia autoconsumată valorează prețul întreg de retail, exporturile aduc un tarif mic. Un număr foarte mic (să zicem 8%) înseamnă că sistemul e <b>prea mare</b> pentru acea casă; micșorează-l sau adaugă o baterie.</p>
  </div>
  <div class="g-card">
    <p><b>Bateria &amp; avantajul Moldovei.</b> De când Moldova a trecut la <b>facturare netă</b> (2024), energia exportată aduce ≈ €0,07/kWh, iar cea pe care o folosești valorează ≈ €0,18. O baterie stochează surplusul de zi pentru seară, transformând exporturile ieftine în autoconsum la preț întreg — așa că în Moldova bateria chiar adaugă economii.</p>
    <div class="g-tip"><p>Dimensionează bateria ca să acopere <b>seara</b>, nu ca să fie cât mai mare — o baterie supradimensionată doar adaugă cost.</p></div>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">5</span><h2>Propuneri urmărite</h2></div>
  <p class="g-lede">Partea care închide vânzări: știi mereu unde e clientul.</p>
  <div class="g-card">
    <p><b>Trimitere.</b> Din editor, apasă <b>Generează propunere</b> — primești un link cu logo-ul și numele tău. Trimite-l pe WhatsApp sau email, nimic de descărcat.</p>
    <p><b>Ce vede clientul.</b> O pagină curată cu cele trei scenarii de amortizare, economiile lunare, ipotezele tale și un buton <b>Acceptă</b>.</p>
    <p><b>Urmărire.</b> Ești notificat în clipa în care o deschid și vezi de câte ori și cât timp au privit — semnalul să suni exact la momentul potrivit.</p>
    <p><b>Fixă &amp; onestă.</b> Odată trimisă, propunerea își blochează cifrele. Editarea ulterioară a ofertei nu schimbă niciodată ce a văzut clientul.</p>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">6</span><h2>Planuri</h2></div>
  <p class="g-lede">Gratuit în beta — fără card. Prețul de fondator e blocat pentru primii 50 de instalatori.</p>
  <div class="plans">
    <div class="plan hot"><div class="pn">Pro · €49/lună</div><div class="pd">Logo-ul tău pe fiecare propunere și PDF, linkuri urmărite + alerte de deschidere, widget de contacte pe site, pipeline complet.</div></div>
    <div class="plan"><div class="pn">Team · €119/lună</div><div class="pd">Tot ce e în Pro, până la 5 persoane pe un pipeline, analiză a ratei de câștig, suport prioritar.</div></div>
    <div class="plan"><div class="pn">Enterprise · preț personalizat</div><div class="pd">Locuri nelimitate pentru instalatori cu mai multe filiale, jurnal complet de audit, manager dedicat.</div></div>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">?</span><h2>Întrebări frecvente</h2></div>
  <details><summary>De ce uneori bateria mărește amortizarea?</summary><p>O baterie adaugă cost real pe fiecare kWh de capacitate. În Moldova adaugă și economii — dar dacă economiile sunt mai mici decât costul suplimentar, amortizarea se prelungește puțin. E onest: bateriile țin adesea de backup-ul de seară și independență la fel de mult ca de economii. În contorizarea netă 1:1 din România o baterie nu adaugă aproape nicio economie, deci acolo mereu prelungește amortizarea.</p></details>
  <details><summary>Adresa nu a adus date despre soare — ce fac?</summary><p>Ocazional, o adresă foarte nouă sau rurală nu se găsește. Încearcă un reper apropiat sau numele localității — lumina solară abia se schimbă pe câțiva kilometri. Dacă tot nu se încarcă, oferta folosește o medie regională rezonabilă.</p></details>
  <details><summary>Pot schimba logo-ul și datele firmei?</summary><p>Da — în <b>Setări</b>. Logo-ul, numele, moneda și limba ta apar automat pe fiecare propunere și PDF.</p></details>
  <details><summary>O propunere trimisă arată alte cifre decât oferta mea acum.</summary><p>E intenționat — o propunere trimisă e înghețată, ca să vadă clientul mereu ce ai promis. Dacă ai editat oferta, generează o propunere nouă pentru cifre actualizate.</p></details>
  <details><summary>Care e diferența dintre un contact și o ofertă?</summary><p>Un <b>contact</b> e o persoană care ar putea cumpăra. O <b>ofertă</b> e calculul solar propriu-zis pentru ea. Un clic transformă contactul în ofertă, iar cele două rămân legate ca să vezi de unde a venit o vânzare.</p></details>
  <details><summary>Sunt datele clienților mei în siguranță?</summary><p>Da. Datele sunt pe servere din UE, fiecare firmă vede doar proiectele ei, iar tu poți exporta totul în CSV oricând — nimic nu e blocat.</p></details>
</section>
`,

  ru: `
<div class="g-sun"></div>
<h1>Ваш справочник VoltMira</h1>
<p class="g-sub">Как собирать заявки, составлять честный расчёт и отправлять предложение, которому клиент доверяет. Держите вкладку открытой.</p>

<section>
  <div class="g-h"><span class="g-n">›</span><h2>Весь процесс за пять шагов</h2></div>
  <p class="g-lede">Всё остальное в руководстве — лишь детали одного из этих шагов.</p>
  <div class="step"><span class="sn">1</span><div><h3>Поймайте заявку</h3><p>Посетитель заполняет форму расчёта на вашем сайте, или вы добавляете его вручную после звонка. Она попадает во входящие <b>Заявки</b>.</p></div></div>
  <div class="step"><span class="sn">2</span><div><h3>Превратите в расчёт</h3><p>Нажмите <b>Создать оферту</b> на заявке — откроется новый расчёт с уже вписанным именем. Задайте размер системы и годовое потребление.</p></div></div>
  <div class="step"><span class="sn">3</span><div><h3>Отправьте отслеживаемое предложение</h3><p>Создайте ссылку на предложение с вашим логотипом и отправьте в WhatsApp или по почте. Никаких вложений.</p></div></div>
  <div class="step"><span class="sn">4</span><div><h3>Видьте, когда откроют</h3><p>Вы получаете уведомление в момент открытия — сколько раз, как долго. Позвоните, пока оно у него на экране.</p></div></div>
  <div class="step"><span class="sn">5</span><div><h3>Побеждайте</h3><p>Клиент принимает одним касанием прямо в предложении. Расчёт переходит в <b>Выиграно</b>, а заявка — в конвертированные.</p></div></div>
</section>

<section>
  <div class="g-h"><span class="g-n">1</span><h2>Входящие заявки &amp; откуда они приходят</h2></div>
  <p class="g-lede">Заявки — это люди, которые могут купить. VoltMira держит их в одном месте, чтобы никто не потерялся.</p>
  <div class="g-card">
    <p><b>Три способа получения заявок:</b></p>
    <p><b>1. Виджет на сайте.</b> В <b>Настройках</b> вы получаете небольшой фрагмент кода. Вставьте его на сайт один раз — каждый запрос «бесплатного расчёта» автоматически становится заявкой.</p>
    <p><b>2. Вручную.</b> После звонка или выставки добавьте человека сами, чтобы не забыть перезвонить.</p>
    <p><b>3. Из предложения.</b> Когда кто-то просит изменения в отправленном предложении, это тоже возвращается как заявка.</p>
  </div>
  <div class="g-card">
    <p><b>Работа со входящими</b> — переводите заявку по статусам по мере работы:</p>
    <div class="row"><div class="k">Новые</div><div class="v">Только пришли. Им звоните сегодня.</div></div>
    <div class="row"><div class="k">Связались</div><div class="v">Вы написали; ждёте ответа.</div></div>
    <div class="row"><div class="k">Конвертирован</div><div class="v">Вы сделали расчёт — заявка и расчёт связаны.</div></div>
    <div class="row"><div class="k">В архиве</div><div class="v">Не подошёл или остыл. Убран, но не удалён.</div></div>
  </div>
  <div class="g-tip"><p>Нажмите <b>Изменить</b> на любой заявке, чтобы поправить имя, телефон и почту прямо во входящих — и отметьте <b>канал</b>, из которого она пришла (сайт, Facebook, WhatsApp, рекомендация, холодный звонок), чтобы понять, какой из них реально окупается.</p></div>
</section>

<section>
  <div class="g-h"><span class="g-n">2</span><h2>Составление расчёта</h2></div>
  <p class="g-lede">Расчёт — это несколько честных параметров. Вот что означает каждый.</p>
  <div class="g-card">
    <div class="row"><div class="k">Рынок <small>MD / RO</small></div><div class="v">Молдова (нетто-биллинг) или Румыния (нетто-учёт). Автоматически задаёт тарифные правила.</div></div>
    <div class="row"><div class="k">Размер системы <small>кВт</small></div><div class="v">Насколько велика установка — главный фактор и стоимости, и выработки.</div></div>
    <div class="row"><div class="k">Годовое потребление <small>кВт·ч / год</small></div><div class="v">Сколько энергии он тратит в год — возьмите годовой итог из счёта. Определяет, сколько солнечной энергии используется, а сколько экспортируется.</div></div>
    <div class="row"><div class="k">Цена электроэнергии <small>€ / кВт·ч</small></div><div class="v">Сколько он платит за кВт·ч. Заполнено значением по умолчанию (Молдова ≈ €0,18); укажите реальную цену из счёта.</div></div>
    <div class="row"><div class="k">Батарея <small>необязательно, кВт·ч</small></div><div class="v">Добавляет накопитель. Введите полезную ёмкость — и стоимость, и выгода растут вместе с ней. В Молдове окупается (см. ниже).</div></div>
    <div class="row"><div class="k">Грант Casa Verde <small>необязательно</small></div><div class="v">Если клиент имеет право на субсидию, задайте сумму в Настройках и включите её — она вычитается из первоначальной стоимости.</div></div>
  </div>
  <div class="g-tip"><p>Введите <b>адрес</b> клиента, и VoltMira возьмёт реальную инсоляцию именно для этой крыши из спутниковых данных — цифры для <i>его</i> дома, а не средние по стране.</p></div>
</section>

<section>
  <div class="g-h"><span class="g-n">3</span><h2>Каталог оборудования</h2></div>
  <p class="g-lede">Ваша собственная библиотека панелей, инверторов и батарей — чтобы стоимость расчёта бралась из реального оборудования, а не из круглой прикидки.</p>
  <div class="g-card">
    <p><b>Соберите один раз.</b> На вкладке <b>Каталог</b> добавьте товары, которые вы реально устанавливаете, с ценами. Впервые здесь? Нажмите <b>Загрузить стартовый каталог</b> — готовый набор популярных панелей, инверторов и батарей, затем отредактируйте цены под своих поставщиков.</p>
    <p><b>Он задаёт реальную стоимость.</b> Когда вы добавляете оборудование в расчёт, спецификация заменяет приблизительную оценку в €/кВт — так что цифра, которую видит клиент, это ваша настоящая стоимость.</p>
    <p><b>Выглядит солидно.</b> Добавьте URL фото к любому товару, и оно покажется аккуратной миниатюрой — удобно, когда клиент хочет увидеть, что именно ставится на крышу.</p>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">4</span><h2>Понимание цифр</h2></div>
  <p class="g-lede">Именно это отличает VoltMira — и это вы можете уверенно объяснить.</p>
  <div class="g-card">
    <p><b>Окупаемость — три честных сценария.</b> Вместо одной красивой цифры каждый расчёт показывает три, чтобы клиент вам доверял:</p>
    <div class="nums">
      <div class="num-c" style="--bc:#C4543B"><div class="t">Пессимистичный</div><p>Не повезло: слабее солнце, быстрее износ, цены не растут.</p></div>
      <div class="num-c" style="--bc:var(--amber)"><div class="t">Ожидаемый</div><p>Реалистичная середина — то, что вы предложите.</p></div>
      <div class="num-c" style="--bc:var(--green)"><div class="t">Оптимистичный</div><p>Сильное солнце, растущие цены.</p></div>
    </div>
  </div>
  <div class="g-card">
    <p><b>% самопотребления.</b> Доля солнечной энергии, которую дом реально <i>использует</i>, а не экспортирует. Больше — лучше: самопотреблённая энергия стоит полную розничную цену, экспорт оплачивается по низкому тарифу. Очень низкое значение (скажем, 8%) означает, что система <b>слишком большая</b> для этого дома; уменьшите её или добавьте батарею.</p>
  </div>
  <div class="g-card">
    <p><b>Батарея &amp; преимущество Молдовы.</b> С тех пор как Молдова перешла на <b>нетто-биллинг</b> (2024), экспортируемая энергия приносит ≈ €0,07/кВт·ч, а используемая вами стоит ≈ €0,18. Батарея запасает дневной избыток на вечер, превращая дешёвый экспорт в самопотребление по полной цене — поэтому в Молдове батарея действительно добавляет экономию.</p>
    <div class="g-tip"><p>Подбирайте батарею под <b>вечер</b>, а не «как можно больше» — избыточная батарея лишь добавляет затраты.</p></div>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">5</span><h2>Отслеживаемые предложения</h2></div>
  <p class="g-lede">То, что закрывает сделки: вы всегда знаете, на каком этапе клиент.</p>
  <div class="g-card">
    <p><b>Отправка.</b> В редакторе нажмите <b>Создать предложение</b> — получите ссылку с вашим логотипом и именем. Отправьте в WhatsApp или по почте, ничего скачивать не нужно.</p>
    <p><b>Что видит клиент.</b> Чистая страница с тремя сценариями окупаемости, ежемесячной экономией, вашими допущениями и кнопкой <b>Принять</b>.</p>
    <p><b>Отслеживание.</b> Вы получаете уведомление в момент открытия и видите, как часто и как долго смотрели — сигнал позвонить точно вовремя.</p>
    <p><b>Зафиксировано &amp; честно.</b> После отправки предложение фиксирует цифры. Изменение расчёта позже никогда не меняет то, что видел клиент.</p>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">6</span><h2>Тарифы</h2></div>
  <p class="g-lede">Бесплатно на бета-этапе — без карты. Цена основателя зафиксирована для первых 50 монтажников.</p>
  <div class="plans">
    <div class="plan hot"><div class="pn">Pro · €49/мес</div><div class="pd">Ваш логотип на каждом предложении и PDF, отслеживаемые ссылки + уведомления об открытии, виджет заявок на сайте, полный пайплайн.</div></div>
    <div class="plan"><div class="pn">Team · €119/мес</div><div class="pd">Всё из Pro, до 5 человек в одном пайплайне, аналитика конверсии, приоритетная поддержка.</div></div>
    <div class="plan"><div class="pn">Enterprise · индивидуальная цена</div><div class="pd">Неограниченные места для монтажников с филиалами, полный журнал аудита, персональный менеджер.</div></div>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">?</span><h2>Частые вопросы</h2></div>
  <details><summary>Почему батарея иногда удлиняет окупаемость?</summary><p>Батарея добавляет реальную стоимость за каждый кВт·ч ёмкости. В Молдове она добавляет и экономию — но если экономия меньше дополнительной стоимости, окупаемость немного растягивается. Это честно: батареи часто нужны для вечернего резерва и независимости не меньше, чем ради экономии. При румынском нетто-учёте 1:1 батарея почти не добавляет экономии, поэтому там всегда удлиняет окупаемость.</p></details>
  <details><summary>Адрес не подтянул данные о солнце — что делать?</summary><p>Иногда очень новый или сельский адрес не распознаётся. Попробуйте ближайший ориентир или название населённого пункта — инсоляция почти не меняется на нескольких километрах. Если всё равно не загружается, расчёт использует разумное региональное среднее.</p></details>
  <details><summary>Можно ли изменить логотип и данные компании?</summary><p>Да — в <b>Настройках</b>. Ваш логотип, название, валюта и язык автоматически появляются на каждом предложении и PDF.</p></details>
  <details><summary>Отправленное предложение показывает не те цифры, что мой расчёт сейчас.</summary><p>Так задумано — отправленное предложение зафиксировано, чтобы клиент всегда видел обещанное. Если вы изменили расчёт, создайте новое предложение с обновлёнными цифрами.</p></details>
  <details><summary>В чём разница между заявкой и расчётом?</summary><p><b>Заявка</b> — это человек, который может купить. <b>Расчёт</b> — это конкретный солнечный расчёт для него. Один клик превращает заявку в расчёт, и они остаются связанными, чтобы видеть, откуда пришла сделка.</p></details>
  <details><summary>Данные моих клиентов в безопасности?</summary><p>Да. Данные на серверах в ЕС, каждая компания видит только свои проекты, и вы можете в любой момент экспортировать всё в CSV — ничто не заблокировано.</p></details>
</section>
`,
};

export default async function GuidePage() {
  const co = await currentCompany();
  const lang = normLang(co?.lang);
  return (
    <div className="guide">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div dangerouslySetInnerHTML={{ __html: HTML[lang] || HTML.en }} />
    </div>
  );
}

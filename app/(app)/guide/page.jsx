// app/(app)/guide/page.jsx — the in-app installer guide, so clients can self-serve
// instead of calling. Rendered as static HTML using the app's theme variables so
// it matches light/dark automatically. Content is intentionally plain-language.
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

const HTML = `
<div class="g-sun"></div>
<h1>Everything you need — no phone call required.</h1>
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
  <div class="g-tip"><p>✏️ &nbsp;Click <b>Edit</b> on any lead to fix their name, phone, and email right in the inbox — so your contacts stay clean as you learn more.</p></div>
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
  <div class="g-tip"><p>📍 &nbsp;Type the client's <b>address</b> and VoltMira pulls the real sunlight for that exact roof from satellite data — numbers for <i>their</i> house, not a national average.</p></div>
</section>

<section>
  <div class="g-h"><span class="g-n">3</span><h2>Understanding the numbers</h2></div>
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
    <div class="g-tip"><p>🔋 &nbsp;Size the battery to cover the <b>evening</b>, not to be as big as possible — an oversized battery just adds cost.</p></div>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">4</span><h2>Tracked proposals</h2></div>
  <p class="g-lede">The part that closes deals: you always know where the client stands.</p>
  <div class="g-card">
    <p><b>Sending.</b> From the editor, hit <b>Generate proposal</b> — you get a link with your logo and name. Share it on WhatsApp or email, nothing to download.</p>
    <p><b>What the client sees.</b> A clean page with the three payback scenarios, monthly savings, your assumptions, and an <b>Accept</b> button.</p>
    <p><b>Tracking.</b> You're notified the moment they open it, and see how often and how long they looked — your cue to call at exactly the right time.</p>
    <p><b>Frozen &amp; honest.</b> Once sent, a proposal locks its numbers. Editing the quote later never changes what the client was shown.</p>
  </div>
</section>

<section>
  <div class="g-h"><span class="g-n">5</span><h2>Plans</h2></div>
  <p class="g-lede">Free during beta — no card required. Founder pricing is locked for the first 50 installers.</p>
  <div class="plans">
    <div class="plan hot"><div class="pn">Pro · €25/mo</div><div class="pd">Your logo on every proposal &amp; PDF, tracked links + open alerts, website lead widget, full pipeline.</div></div>
    <div class="plan"><div class="pn">Team · €99/mo</div><div class="pd">Everything in Pro, up to 5 people on one pipeline, win-rate analytics, priority support.</div></div>
    <div class="plan"><div class="pn">Enterprise · €299/mo</div><div class="pd">Unlimited seats for multi-branch installers, SSO, API access, a dedicated manager.</div></div>
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
`;

export default function GuidePage() {
  return (
    <div className="guide">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div dangerouslySetInnerHTML={{ __html: HTML }} />
    </div>
  );
}

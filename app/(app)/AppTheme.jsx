// app/(app)/AppTheme.jsx — the authenticated app's design system.
//
// This is the SAME visual language as the public live demo
// (app/_landing/demo.html): identical tokens, sidebar, buttons, chips, cards,
// tables, KPI strip, activity feed, and entrance animations. Ported verbatim so
// the signed-in app is a 1-of-1 match to what clients see in the demo.
//
// It is rendered once by app/(app)/layout.jsx, so it only loads on authed
// routes — the generic class names (.card/.btn/.field/.band) can never collide
// with the login page's own scoped <style> (different layout, never co-mounted).
// Fonts (Space Grotesk / Inter) and the no-flash theme script live in the root
// layout and are shared across the whole site.

const CSS = `
  :root{
    --paper:#F6F5F0; --paper-2:#FFFFFF;
    --ink:#142A21; --ink-2:#0D1F18;
    --green:#1E6B4E; --green-soft:#2A8563; --green-tint:#E4EFE9;
    --amber:#E89B2D; --amber-soft:#F4B45C; --amber-tint:#FBF0DD;
    --muted:#66756C; --line:#E3E1D6;
    --red:#C4543B; --red-tint:#F7E6E1;
    --blue:#3D6B8E; --blue-tint:#E4EDF4;
    --white-dim:rgba(255,255,255,.66); --white-faint:rgba(255,255,255,.4); --white-line:rgba(255,255,255,.12);
    --shadow:0 1px 2px rgba(20,42,33,.05),0 4px 16px rgba(20,42,33,.06);
    --shadow-lg:0 8px 34px rgba(20,42,33,.16);
    --radius:14px; --trans:.35s ease;
    --font-d:'Inter',system-ui,sans-serif;
    --font-b:'Inter',system-ui,sans-serif;
    --font-m:'Inter',system-ui,sans-serif;
  }
  html[data-theme="dark"]{
    --paper:#0F1310; --paper-2:#171B16; --ink:#EEF1EA; --ink-2:#F1EFE8;
    --green:#4FB584; --green-soft:#3FAE6A; --green-tint:rgba(79,181,132,.16);
    --amber:#EBA542; --amber-soft:#F2B85F; --amber-tint:rgba(232,155,45,.15);
    --muted:#8E998F; --line:#28302A;
    --red:#E0725A; --red-tint:rgba(196,84,59,.2);
    --blue:#6FA0C4; --blue-tint:rgba(61,107,142,.22);
    --shadow:0 1px 2px rgba(0,0,0,.35),0 4px 16px rgba(0,0,0,.4);
    --shadow-lg:0 10px 36px rgba(0,0,0,.55);
  }
  /* these use var(--ink) as a background — keep them dark when the theme flips */
  html[data-theme="dark"] .sidebar,
  html[data-theme="dark"] .more-sheet,
  html[data-theme="dark"] .toast,
  html[data-theme="dark"] .embed-code{ background:#080B09; }
  html[data-theme="dark"] .fchip.on{ background:#080B09; border-color:#080B09; color:#fff; }

  .app *{margin:0;padding:0;box-sizing:border-box}
  .app{font-family:var(--font-b);font-size:14.5px;color:var(--ink);
    display:grid;grid-template-columns:236px 1fr;min-height:100vh;
    opacity:0;animation:fadeIn .5s ease .03s forwards}
  @keyframes fadeIn{to{opacity:1}}
  .app h1,.app h2,.app h3,.app h4,.app .font-d{font-family:var(--font-d)}
  .app button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}
  .app input,.app select,.app textarea{font-family:inherit;font-size:inherit;color:inherit}
  .app :focus-visible{outline:2px solid var(--amber);outline-offset:2px}
  .app ::selection{background:var(--amber-tint)}
  .app a{color:inherit}
  @media (prefers-reduced-motion:reduce){
    .app,.view{opacity:1!important;animation:none!important}
    .app *,.app *::before,.app *::after{animation-duration:.01ms!important;transition-duration:.01ms!important}
  }

  /* ============ Shell ============ */
  .sidebar{
    background:var(--ink);color:#fff;
    display:flex;flex-direction:column;padding:22px 14px 16px;
    position:sticky;top:0;height:100vh;z-index:40;
  }
  .logo{display:flex;align-items:center;gap:10px;font-family:var(--font-d);font-weight:700;font-size:20px;letter-spacing:-.02em;padding:0 10px 24px;color:#fff}
  .nav{display:flex;flex-direction:column;gap:3px}
  .nav a{
    display:flex;align-items:center;gap:11px;text-decoration:none;
    color:var(--white-dim);padding:10.5px 12px;border-radius:10px;
    font-size:14px;font-weight:500;transition:background .18s,color .18s;
  }
  .nav a svg{flex:none;opacity:.85}
  .nav a:hover{background:var(--white-line);color:#fff}
  .nav a.active{background:var(--amber);color:var(--ink);font-weight:600}
  .nav a.active svg{opacity:1}
  /* the mobile "More" bottom sheet + its trigger are hidden on desktop, where
     the full vertical nav already shows every tab */
  .nav-more{display:none}
  .more-sheet,.more-backdrop{display:none}
  .side-foot{margin-top:auto}
  .profile{display:flex;align-items:center;gap:11px;padding:12px;border-radius:12px;background:var(--white-line)}
  .avatar{
    width:36px;height:36px;border-radius:50%;flex:none;
    background:var(--amber);color:var(--ink);
    display:grid;place-items:center;font-family:var(--font-d);font-weight:700;font-size:13.5px;
  }
  .avatar.sm{width:30px;height:30px;font-size:12px}
  .avatar.green{background:var(--green-tint);color:var(--green)}

  /* Initials tile for projects and clients (lib/Avatar.jsx). Square-ish, to
     stay visually distinct from the round .avatar that means "a person".
     Eight tones, picked from the name so a list reads as distinct rows. */
  .av-sq{
    flex:none;display:grid;place-items:center;
    font-family:var(--font-d);font-weight:700;letter-spacing:.01em;
    color:#fff;line-height:1;user-select:none;
  }
  .av-c0{background:#2F6FB3}
  .av-c1{background:#C9781E}
  .av-c2{background:#6B54C6}
  .av-c3{background:#C4543B}
  .av-c4{background:#2E8C6A}
  .av-c5{background:#B0417E}
  .av-c6{background:#3E7D8C}
  .av-c7{background:#8A6D2F}
  .av-c8{background:#4E6BA8}
  .av-c9{background:#A0552B}
  html[data-theme="dark"] .av-sq{color:#F2F5F0}

  /* project/client row: tile + the existing title/sub stack */
  .row-id{display:flex;align-items:center;gap:11px;min-width:0}
  .row-id .row-id-tx{min-width:0}
  .profile .who{line-height:1.3;min-width:0}
  .profile .who b{display:block;font-size:13.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .profile .who span{font-size:11.5px;color:var(--white-faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
  .side-theme{
    display:flex;align-items:center;gap:10px;width:100%;text-align:left;margin-top:10px;
    padding:10px 12px;border-radius:10px;cursor:pointer;font-size:14px;font-weight:500;
    color:var(--white-dim);background:var(--white-line);transition:color .15s,background .15s;
  }
  .side-theme:hover{color:#fff;background:rgba(255,255,255,.18)}
  .reset-link{
    display:block;width:100%;text-align:center;margin-top:10px;
    background:transparent;color:var(--white-faint);font-size:12px;font-weight:500;
    padding:6px;border-radius:8px;transition:color .15s,background .15s;
  }
  .reset-link:hover{color:#fff;background:var(--white-line)}
  .side-plan{text-transform:uppercase;letter-spacing:.06em;font-size:11px;color:var(--white-faint);margin:12px 4px 0}

  .main{min-width:0;display:flex;flex-direction:column;background:var(--paper)}
  .view{padding:26px 30px 48px;max-width:1180px;width:100%;margin:0 auto;animation:viewIn .3s ease}
  @keyframes viewIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

  /* ============ Shared components ============ */
  .page-head{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:22px}
  .page-head h1{font-size:24px;font-weight:700;letter-spacing:-.02em}
  .page-head .sub{font-size:13.5px;color:var(--muted);width:100%;margin-top:-6px}
  .spacer{flex:1}

  .btn{
    display:inline-flex;align-items:center;justify-content:center;gap:8px;
    font-size:14px;font-weight:600;font-family:var(--font-b);
    padding:10.5px 17px;border-radius:11px;border:1px solid transparent;text-decoration:none;
    transition:transform .14s,box-shadow .18s,background .18s,border-color .18s,color .18s;
    white-space:nowrap;user-select:none;
  }
  .btn:active{transform:scale(.97)}
  .btn.primary{background:var(--green);color:#fff;box-shadow:0 3px 12px rgba(30,107,78,.25)}
  .btn.primary:hover{background:var(--green-soft);transform:translateY(-1px);box-shadow:0 6px 18px rgba(30,107,78,.3)}
  .btn.amber{background:var(--amber);color:var(--ink);box-shadow:0 3px 12px rgba(232,155,45,.3)}
  .btn.amber:hover{background:var(--amber-soft);transform:translateY(-1px);box-shadow:0 6px 18px rgba(232,155,45,.4)}
  .btn.ghost{background:var(--paper-2);border-color:var(--line);color:var(--ink)}
  .btn.ghost:hover{border-color:var(--green);color:var(--green)}
  .btn.danger{background:var(--paper-2);border-color:var(--line);color:var(--red)}
  .btn.danger:hover{border-color:var(--red);background:var(--red-tint)}
  .btn.sm{padding:7px 12px;font-size:13px;border-radius:9px}
  .btn.icon{padding:8px;border-radius:9px}
  .btn:disabled{opacity:.5;cursor:not-allowed;transform:none!important;box-shadow:none!important}
  .btn.wapp{background:#25D366;color:#fff;box-shadow:0 3px 12px rgba(37,211,102,.3)}
  .btn.wapp:hover{background:#1FBE5A;transform:translateY(-1px);box-shadow:0 6px 18px rgba(37,211,102,.4)}

  /* First-run screen (empty workspace). Two choices, generous space, nothing
     to scroll past — the opposite of the all-zeros dashboard it replaces. */
  .firstrun{background:var(--paper-2);border:1px solid var(--line);border-radius:var(--radius);
    box-shadow:var(--shadow);padding:34px 30px;margin-bottom:18px;text-align:center}
  .firstrun h2{font-size:22px;font-weight:700;letter-spacing:-.02em;margin:0 0 6px}
  .firstrun .fr-sub{font-size:14px;color:var(--muted);margin:0 auto 26px;max-width:46ch;line-height:1.55}
  .fr-paths{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;
    max-width:660px;margin:0 auto;text-align:left}
  @media(max-width:640px){.fr-paths{grid-template-columns:minmax(0,1fr)}}
  .fr-card{display:flex;flex-direction:column;align-items:flex-start;gap:7px;
    border:1px solid var(--line);border-radius:13px;padding:20px 18px;background:var(--paper)}
  .fr-card.fr-primary{border-color:color-mix(in srgb,var(--green) 45%,transparent);
    background:var(--green-tint)}
  .fr-ic{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;
    background:var(--paper-2);border:1px solid var(--line);color:var(--green);margin-bottom:3px}
  .fr-card b{font-size:15px;font-weight:650;color:var(--ink)}
  .fr-card > span{font-size:12.5px;color:var(--muted);line-height:1.5}
  .fr-card .btn{margin-top:9px;align-self:stretch}
  .fr-err{font-size:12px;color:var(--red);margin-top:4px}
  .fr-foot{font-size:12.5px;color:var(--muted);margin:24px 0 0;line-height:1.5}
  @media (pointer:coarse){ .app .fr-card .btn{min-height:44px} }

  /* "You're looking at sample data" — amber, same family as the demo strip.
     Filtering sample rows out of the KPIs would break the demo button; naming
     them is what actually prevents the embarrassing version of this. */
  .sample-bar{display:flex;align-items:center;gap:11px;flex-wrap:wrap;margin-bottom:16px;
    padding:9px 13px;border-radius:12px;background:var(--amber-tint);
    border:1px solid color-mix(in srgb,var(--amber) 40%,transparent)}
  .sample-badge{font-family:var(--font-d);font-size:10.5px;font-weight:700;letter-spacing:.09em;
    text-transform:uppercase;color:var(--ink);background:var(--amber);border-radius:99px;padding:3px 9px;flex:none}
  .sample-note{font-size:13px;color:var(--ink);opacity:.85;flex:1;min-width:0;line-height:1.45}
  .sample-cta{flex:none;font-size:12.5px;font-weight:600;color:var(--ink);text-decoration:none;
    border-bottom:1.5px solid color-mix(in srgb,var(--ink) 40%,transparent);padding-bottom:1px}
  .sample-cta:hover{border-bottom-color:var(--ink)}
  /* Funnel € column */
  .pf-eur{flex:none;min-width:74px;text-align:right;font-size:12px;color:var(--muted);
    font-variant-numeric:tabular-nums}
  @media(max-width:560px){.pf-eur{display:none}}

  /* Demo workspace strip. Amber (the attention token) rather than a loud red:
     it should read as context, not as an error, while presenting to a client. */
  /* Deposit chooser in the proforma modal */
  .dep-seg{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}
  .dep-opt{display:flex;align-items:center;justify-content:center;padding:11px 8px;border-radius:10px;
    border:1.5px solid var(--line);background:var(--paper-2);color:var(--muted);
    font-size:13.5px;font-weight:600;cursor:pointer;transition:border-color .15s,color .15s,background .15s}
  .dep-opt:hover{border-color:var(--green);color:var(--ink)}
  .dep-opt.on{border-color:var(--green);color:var(--green);background:var(--green-tint)}
  .dep-amount{font-family:var(--font-d);font-size:24px;font-weight:700;letter-spacing:-.02em;
    color:var(--ink);margin-bottom:16px}
  .dep-amount span{font-size:14px;font-weight:500;color:var(--muted)}
  @media (pointer:coarse){ .app .dep-opt{min-height:44px} }

  /* Email-the-PDF row in the share modal */
  .email-row{display:flex;gap:8px;margin-bottom:10px}
  .email-row input{flex:1;min-width:0;border:1px solid var(--line);background:var(--paper-2);
    border-radius:10px;padding:10px 12px;font-size:14px}
  .email-row input:focus{outline:2px solid var(--amber);outline-offset:1px}
  .email-row .btn{flex:none}
  .email-row .btn:disabled{opacity:.5;cursor:not-allowed}
  .email-msg{font-size:12.5px;line-height:1.45;margin:-4px 0 10px}
  .email-msg.ok{color:var(--green)}
  .email-msg.bad{color:var(--red)}

  .demo-bar{display:flex;align-items:center;gap:11px;flex-wrap:wrap;margin-bottom:18px;
    padding:10px 14px;border-radius:12px;background:var(--amber-tint);
    border:1px solid color-mix(in srgb,var(--amber) 38%,transparent)}
  .demo-badge{font-family:var(--font-d);font-size:10.5px;font-weight:700;letter-spacing:.09em;
    text-transform:uppercase;color:var(--ink);background:var(--amber);border-radius:99px;padding:3px 9px;flex:none}
  .demo-note{font-size:13px;color:var(--ink);opacity:.85;flex:1;min-width:0;line-height:1.45}
  .demo-cta{flex:none;font-size:12.5px;font-weight:600;color:var(--ink);text-decoration:none;
    border-bottom:1.5px solid color-mix(in srgb,var(--ink) 40%,transparent);padding-bottom:1px}
  .demo-cta:hover{border-bottom-color:var(--ink)}
  @media (max-width:560px){.demo-note{flex-basis:100%;order:3}}

  .card{background:var(--paper-2);border:1px solid var(--line);border-radius:var(--radius);padding:20px;box-shadow:var(--shadow)}
  .card h3{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.09em;color:var(--muted);margin-bottom:15px}

  .chip{
    display:inline-flex;align-items:center;gap:6px;
    font-size:12px;font-weight:600;padding:5px 11px;border-radius:99px;
    border:1px solid transparent;cursor:pointer;transition:filter .15s;user-select:none;
  }
  .chip::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
  .chip:hover{filter:brightness(.94)}
  .chip.draft{background:var(--paper);border-color:var(--line);color:var(--muted)}
  .chip.sent{background:var(--blue-tint);color:var(--blue)}
  .chip.won{background:var(--green-tint);color:var(--green)}
  .chip.lost{background:var(--red-tint);color:var(--red)}
  .chip.static{cursor:default}
  .chip.hot{background:var(--amber-tint);color:#B4700F}

  .field{margin-bottom:15px}
  .field:last-child{margin-bottom:0}
  .field label{display:flex;justify-content:space-between;align-items:baseline;font-size:13px;font-weight:500;color:var(--muted);margin-bottom:7px}
  .field label output{color:var(--green);font-family:var(--font-d);font-weight:700;font-size:15px}
  .input{
    width:100%;background:var(--paper-2);border:1px solid var(--line);
    font-size:14.5px;padding:10px 12px;border-radius:10px;transition:border-color .18s,box-shadow .18s;
  }
  .input:hover{border-color:#CFCCBD}
  .input:focus{border-color:var(--green);outline:none;box-shadow:0 0 0 3px rgba(30,107,78,.12)}
  select.input{cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2366756C' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:34px}
  textarea.input{resize:vertical;min-height:52px}

  .app input[type=range]{
    -webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:99px;
    background:linear-gradient(90deg,var(--amber) var(--fill,30%),var(--line) var(--fill,30%));
  }
  .app input[type=range]::-webkit-slider-thumb{
    -webkit-appearance:none;appearance:none;width:22px;height:22px;border-radius:50%;
    background:var(--amber);border:3px solid var(--paper-2);
    box-shadow:0 0 0 1px var(--amber),0 2px 8px rgba(20,42,33,.25);cursor:grab;transition:transform .14s;
  }
  .app input[type=range]::-webkit-slider-thumb:hover{transform:scale(1.12)}
  .app input[type=range]:active::-webkit-slider-thumb{cursor:grabbing;transform:scale(1.16)}
  .app input[type=range]::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:var(--amber);border:3px solid var(--paper-2);box-shadow:0 0 0 1px var(--amber),0 2px 8px rgba(20,42,33,.25);cursor:grab}
  .app input[type=range]::-moz-range-progress{height:6px;border-radius:99px;background:var(--amber)}

  .check{
    display:flex;align-items:center;gap:12px;cursor:pointer;
    background:var(--paper-2);border:1px solid var(--line);
    padding:12px;border-radius:10px;transition:border-color .18s;user-select:none;
  }
  .check:hover{border-color:var(--amber)}
  .check input{position:absolute;opacity:0;pointer-events:none}
  .toggle-pill{width:42px;height:24px;border-radius:99px;background:var(--line);position:relative;flex:none;transition:background var(--trans)}
  .toggle-pill::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:var(--paper-2);box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform var(--trans)}
  .check input:checked + .toggle-pill{background:var(--green)}
  .check input:checked + .toggle-pill::after{transform:translateX(18px)}
  .check input:focus-visible + .toggle-pill{outline:2px solid var(--amber);outline-offset:2px}
  .check .txt{font-size:13.5px;font-weight:500;line-height:1.35}
  .check .txt small{display:block;color:var(--muted);font-size:12px;font-weight:400}

  /* Tables */
  .tbl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
  .tbl{width:100%;border-collapse:collapse}
  .tbl th{font-size:11.5px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);text-align:left;padding:9px 12px;border-bottom:1px solid var(--line)}
  .tbl td{padding:12px;border-bottom:1px solid var(--line);font-size:13.5px;vertical-align:middle}
  .tbl tr:last-child td{border-bottom:none}
  .tbl tbody tr{transition:background .15s}
  .tbl tbody tr:hover{background:var(--paper)}
  .tbl .t-title{font-weight:600;font-family:var(--font-d);font-size:14px;cursor:pointer;color:var(--ink);text-decoration:none}
  .tbl .t-title:hover{color:var(--green);text-decoration:underline;text-underline-offset:3px}
  .tbl .t-sub{color:var(--muted);font-size:12px;margin-top:2px}
  .tbl th.th-sort a{cursor:pointer;user-select:none;white-space:nowrap}
  .tbl th.th-sort:hover{color:var(--ink)}
  .tbl .sort-arr{font-size:9px;opacity:.8}
  .avatar.sm.green{font-size:12px}
  .row-acts{display:flex;gap:5px;justify-content:flex-end}
  .row-acts .btn.icon{color:var(--muted);border-color:transparent}
  .row-acts .btn.icon:hover{color:var(--green);background:var(--green-tint)}
  .row-acts .btn.icon.del:hover{color:var(--red);background:var(--red-tint)}
  .row-acts .btn.icon.win:hover{color:var(--green);background:var(--green-tint)}
  .row-acts .btn.icon.ok{color:var(--green)}

  /* Quote aging + engagement (pipeline intelligence) */
  .age{display:inline-block;margin-top:5px;font-size:11px;font-weight:600;color:var(--muted);white-space:nowrap}
  .age.warn{color:#B4700F}
  .age.bad{color:var(--red)}
  .opens{font-family:var(--font-d);font-weight:700;font-size:14px}
  .opens.hot{color:#B4700F}
  .note-dot{margin-left:6px;font-size:12px;cursor:help;vertical-align:middle}
  .tpl-item:hover{background:var(--paper)}

  /* Bulk action bar (projects) */
  .bulkbar{display:none;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;padding:10px 14px;background:var(--paper-2);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow)}
  /* The bulk editor only appears once at least one quote is ticked, so it reads as
     "act on selected", never as a filter that does nothing. */
  .bulk-form:has(input.bulk-id:checked) .bulkbar{display:flex;animation:viewIn .2s ease}
  .bulkbar .bb-lbl{font-size:12.5px;color:var(--ink);font-weight:600}
  .bulkbar .bb-clear{font-size:12.5px;color:var(--muted);background:none;border:none;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
  .bulkbar .bb-clear:hover{color:var(--ink)}
  .bulkbar .chip{cursor:pointer}
  .tbl .col-sel{width:34px;padding-right:2px}
  .tbl .col-sel input{width:15px;height:15px;accent-color:var(--green);cursor:pointer;vertical-align:middle}

  /* Dashboard "Needs follow-up" strip */

  /* KPI strip */
  .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:22px}
  .kpi{background:var(--paper-2);border:1px solid var(--line);border-radius:var(--radius);padding:16px 18px;box-shadow:var(--shadow)}
  .kpi b{display:block;font-family:var(--font-d);font-size:25px;font-weight:700;letter-spacing:-.02em;line-height:1.1}
  .kpi span{font-size:12px;color:var(--muted)}
  .kpi .up{color:var(--green)}

  /* Sales pipeline funnel (dashboard) */
  .pipe-funnel{display:flex;flex-direction:column;gap:12px}
  .pf-row{display:flex;align-items:center;gap:12px}
  .pf-lbl{width:74px;flex:none;font-size:12.5px;color:var(--muted)}
  .pf-track{flex:1;height:30px;background:var(--paper);border-radius:8px;overflow:hidden;min-width:40px}
  .pf-track i{display:block;height:100%;border-radius:8px;min-width:3px;transform-origin:left;animation:pf-grow .6s cubic-bezier(.22,.9,.28,1) both}
  @keyframes pf-grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
  .pf-val{flex:none;min-width:30px;text-align:right;font-family:var(--font-d);font-weight:700;font-size:16px;line-height:1}

  /* Bands (editor scenarios) */
  .bands{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
  .band{border-radius:12px;padding:15px 15px 14px;border:1px solid var(--line);background:var(--paper-2);position:relative;overflow:hidden}
  .band::before{content:"";position:absolute;inset:0 auto 0 0;width:4px;background:var(--band-c)}
  .band.pess{--band-c:var(--red)} .band.expc{--band-c:var(--amber)} .band.opti{--band-c:var(--green)}
  .band .tag{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--band-c);margin-bottom:8px}
  .band .yrs{font-family:var(--font-d);font-size:26px;font-weight:700;letter-spacing:-.02em;line-height:1}
  .band .yrs small{font-size:12.5px;font-weight:500;color:var(--muted)}
  .band .roi{font-size:12px;color:var(--muted);margin-top:6px}
  .band .roi b{color:var(--ink)}

  /* Chart legend + trend legend */
  .legend{display:flex;flex-wrap:wrap;gap:14px;font-size:11.5px;color:var(--muted);margin-top:8px}
  .tr-leg{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)}
  .tr-leg i{width:10px;height:10px;border-radius:3px;display:inline-block}

  /* Activity feed */
  .feed{list-style:none;display:flex;flex-direction:column}
  .feed li{display:flex;gap:12px;padding:11px 0;border-bottom:1px solid var(--line);font-size:13px;align-items:flex-start}
  .feed li:last-child{border-bottom:none}
  .feed .f-ic{width:30px;height:30px;border-radius:9px;flex:none;display:grid;place-items:center;background:var(--green-tint);color:var(--green)}
  .feed .f-ic.amber{background:var(--amber-tint);color:#B4700F}
  .feed .f-ic.blue{background:var(--blue-tint);color:var(--blue)}
  .feed .f-tx{flex:1;line-height:1.45;color:var(--ink)}
  .feed .f-tx b{font-weight:600}
  .feed time{color:var(--muted);font-size:11.5px;white-space:nowrap;padding-top:2px}
  .feed-scroll{max-height:348px;overflow-y:auto;margin:0 -6px;padding:0 6px;scrollbar-width:thin;scrollbar-color:var(--line) transparent}
  .feed .f-day{position:sticky;top:0;z-index:2;list-style:none;display:block;background:var(--paper-2);padding:5px 2px;margin:2px 0;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--line)}
  /* a feed row that points at a quote/settings becomes a clickable link */
  .feed a.f-link{display:flex;gap:12px;align-items:flex-start;width:100%;text-decoration:none;color:inherit;margin:-11px 0;padding:11px 6px;border-radius:9px;transition:background .15s}
  .feed a.f-link:hover{background:rgba(20,42,33,.05)}
  html[data-theme="dark"] .feed a.f-link:hover{background:rgba(255,255,255,.05)}
  .empty{text-align:center;color:var(--muted);font-size:13.5px;padding:34px 16px;border:1.5px dashed var(--line);border-radius:12px;line-height:1.6}
  .empty b{display:block;font-family:var(--font-d);font-size:15px;color:var(--ink);margin-bottom:3px}

  /* Project editor layout */
  .editor{display:grid;grid-template-columns:minmax(280px,370px) 1fr;gap:20px;align-items:start}
  .stack{display:flex;flex-direction:column;gap:18px;min-width:0}
  .ed-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:20px}
  .back-link{display:inline-flex;align-items:center;gap:7px;color:var(--muted);font-size:13.5px;font-weight:500;text-decoration:none;padding:7px 12px 7px 8px;border-radius:9px;transition:background .15s,color .15s}
  .back-link:hover{background:var(--paper-2);color:var(--ink)}
  .proj-title{background:transparent;border:1px solid transparent;color:var(--ink);font-family:var(--font-d);font-size:21px;font-weight:700;letter-spacing:-.01em;padding:6px 10px;border-radius:9px;min-width:0;width:250px;transition:border-color .18s,background .18s}
  .proj-title:hover{border-color:var(--line)}
  .proj-title:focus{border-color:var(--green);background:var(--paper-2);outline:none}
  .pvgis-data{margin-top:9px;padding:9px 12px;border:1px solid var(--green);background:var(--green-tint);border-radius:10px;font-size:12.5px;color:var(--muted);text-align:center}
  .pvgis-data .pvg-k{font-family:var(--font-d);font-weight:700;color:var(--green);font-size:15px}
  /* Headline figures sit in one tight row. They used to be gap:24px with a
     flex spacer pushing the donut to the far edge, which opened a dead band
     across the middle of the card at every width above ~700px. */
  .cost-line{display:flex;flex-wrap:wrap;gap:14px 28px;align-items:flex-start}
  .cost-line .k b{display:block;font-family:var(--font-d);font-size:24px;font-weight:700;letter-spacing:-.02em;line-height:1.15}
  .cost-line .k span{font-size:12px;color:var(--muted)}
  .cost-spec{margin-top:10px;font-size:12.5px;color:var(--muted)}
  .cost-spec b{font-family:var(--font-d);font-weight:700;color:var(--ink)}

  /* Self-consumption ring + legend */
  .self-split{display:flex;align-items:center;gap:18px;margin-top:16px;flex-wrap:wrap}
  .self-split .ss-ring{flex:none}
  .ss-legend{display:flex;flex-direction:column;gap:7px;min-width:0;flex:1}
  .ss-item{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--ink)}
  .ss-item i{width:9px;height:9px;border-radius:3px;flex:none}
  .ss-item b{font-family:var(--font-d);font-weight:700;margin-left:2px}
  .ss-cov{font-size:11.5px;line-height:1.45;color:var(--muted);margin-top:2px;max-width:34ch}

  /* Investment vs lifetime-return breakdown */
  .cost-break{margin-top:18px;padding-top:16px;border-top:1px solid var(--line)}
  .cost-break .cb-t{font-size:11.5px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:11px}
  .cb-row{display:flex;align-items:center;gap:10px;margin-bottom:9px}
  .cb-row .cb-lbl{flex:0 0 92px;font-size:12.5px;color:var(--ink)}
  /* --line, not --paper: in dark, --paper (#0F1310) sits 1.07 contrast against
     the card (--paper-2 #171B16), so the unfilled part of the bar vanished.
     --line is the divider token and reads in both themes. */
  .cb-row .cb-track{flex:1;height:14px;background:var(--line);border-radius:99px;overflow:hidden;min-width:40px}
  .cb-row .cb-track i{display:block;height:100%;border-radius:99px;transition:width .4s var(--ease,ease)}
  .cb-row .cb-track .cb-cost{background:var(--amber)}
  .cb-row .cb-track .cb-life{background:var(--green)}
  .cb-row .cb-val{flex:0 0 auto;font-family:var(--font-d);font-size:13.5px;font-weight:700;min-width:64px;text-align:right}
  .cb-grant{font-size:11.5px;color:var(--muted);margin:2px 0 8px 102px}
  .cb-net{display:flex;justify-content:space-between;align-items:baseline;margin-top:11px;padding-top:11px;border-top:1px dashed var(--line)}
  .cb-net span{font-size:12.5px;color:var(--muted)}
  .cb-net b{font-family:var(--font-d);font-size:18px;font-weight:700;color:var(--green)}
  .cb-net b.neg{color:var(--red)}
  @media(max-width:560px){
    .cb-row .cb-lbl{flex-basis:78px;font-size:12px}
    .cb-row .cb-val{min-width:56px}
    .cb-grant{margin-left:88px}
  }

  /* Financing */
  .fin-split{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
  .fin-box{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:18px;text-align:center}
  .fin-box .lbl{font-size:12.5px;color:var(--muted);margin-bottom:8px}
  .fin-box .big{font-family:var(--font-d);font-size:30px;font-weight:700;letter-spacing:-.02em;line-height:1.05}
  .fin-box .big small{font-size:14px;font-weight:500;color:var(--muted)}
  .fin-box input{width:120px;background:transparent;border:none;border-bottom:2px solid var(--amber);font-family:var(--font-d);font-size:30px;font-weight:700;text-align:center;padding:0 0 2px}
  .fin-box input:focus{outline:none;border-bottom-color:var(--green)}
  .verdict{text-align:center;font-family:var(--font-d);font-size:15px;font-weight:600;padding:12px 16px;border-radius:11px;transition:background .3s,color .3s}
  .verdict.good{background:var(--green-tint);color:var(--green)}
  .verdict.bad{background:var(--red-tint);color:var(--red)}

  /* Modal */
  .overlay{position:fixed;inset:0;background:rgba(13,31,24,.5);backdrop-filter:blur(3px);display:grid;place-items:center;padding:20px;z-index:100}
  .modal{background:var(--paper-2);border-radius:16px;box-shadow:var(--shadow-lg);width:min(500px,100%);padding:26px;max-height:88vh;overflow:auto}
  .modal h4{font-size:18px;font-weight:700;margin-bottom:5px}
  .modal p.sub{font-size:13px;color:var(--muted);margin-bottom:18px;line-height:1.5}
  .link-row{display:flex;gap:8px;background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:5px 5px 5px 13px;align-items:center;margin-bottom:16px}
  .link-row code{font-family:var(--font-d);font-size:13px;color:var(--green);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .modal-acts{display:flex;gap:9px;flex-wrap:wrap}
  .modal-acts .btn{flex:1}

  /* Tabs */
  .tabbar{display:flex;gap:6px;margin-bottom:20px;border-bottom:1px solid var(--line)}
  .tab{font-size:14px;font-weight:600;font-family:var(--font-d);color:var(--muted);padding:11px 16px;border-bottom:2px solid transparent;margin-bottom:-1px;transition:color .15s,border-color .15s;display:inline-flex;align-items:center;gap:8px}
  .tab:hover{color:var(--ink)}
  .tab.on{color:var(--green);border-bottom-color:var(--green)}

  /* Monthly grid */
  .mo-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
  .mo-cell label{display:block;font-size:11px;color:var(--muted);margin-bottom:3px;font-weight:500}
  .mo-cell .mo-in{padding:7px 8px;font-size:13px;text-align:center}
  @media (max-width:520px){.mo-grid{grid-template-columns:repeat(3,1fr)}}

  /* Grids */
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start}
  .dash-grid{display:grid;grid-template-columns:1.55fr 1fr;gap:18px;align-items:start}
  .filters{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:16px}
  .filters .input{width:220px}

  /* ---------------- Leads tab ---------------- */
  .lead-card{position:relative;background:var(--paper-2);border:1px solid var(--line);border-radius:16px;
    padding:15px 17px;transition:border-color .2s,box-shadow .2s}
  .lead-card:hover{border-color:#CBC7B6}
  .lead-card.editing{border-color:var(--green);box-shadow:0 0 0 3px var(--green-tint)}
  html[data-theme="dark"] .lead-card:hover{border-color:#39443B}

  .lead-top{display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap}
  .lead-main{flex:1 1 260px;min-width:0}
  .lead-name-row{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
  .lead-name{font-family:var(--font-d);font-weight:700;font-size:16px;color:var(--ink);letter-spacing:-.01em}
  .lead-hot{width:7px;height:7px;border-radius:50%;background:var(--red);flex:none;box-shadow:0 0 0 3px rgba(196,84,59,.18)}
  .lead-status{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;border-radius:99px;padding:3px 9px;white-space:nowrap}

  /* origin (read-only, the app knows it) + marketing channel (installer sets it) */
  .lead-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:9px}
  .lead-src{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:var(--ink-soft);
    background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:4px 9px 4px 8px;white-space:nowrap}
  .lead-src svg{width:13px;height:13px;flex:none;opacity:.72}
  .lead-chan{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);border-radius:8px;
    padding:3px 8px 3px 9px;background:var(--paper);position:relative}
  .lead-chan-dot{width:8px;height:8px;border-radius:50%;flex:none}
  .lead-chan select{appearance:none;-webkit-appearance:none;-moz-appearance:none;border:none;background:transparent;
    color:var(--ink);font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit;padding-right:14px;outline:none}
  .lead-chan .caret{position:absolute;right:8px;font-size:9px;color:var(--muted);pointer-events:none}

  .lead-contact{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;font-size:13.5px}
  .lead-contact a{color:var(--green);text-decoration:none;font-weight:500}
  .lead-contact a:hover{text-decoration:underline;text-underline-offset:2px}
  .lead-contact .none{color:var(--muted)}
  .lead-note{margin-top:10px;font-size:13px;color:var(--ink-soft);line-height:1.55;
    padding:8px 12px;background:var(--paper);border-radius:9px;border-left:2px solid var(--amber)}

  .lead-side{display:flex;flex-direction:column;align-items:flex-end;gap:10px;flex:none}
  .lead-time{font-size:11.5px;color:var(--muted);font-family:var(--font-m,monospace);white-space:nowrap}

  /* Smooth expanding editor: grid-template-rows 0fr->1fr animates height without
     a fixed pixel value, so the drawer opens cleanly whatever it contains. */
  .lead-editor{display:grid;grid-template-rows:0fr;opacity:0;margin-top:0;
    transition:grid-template-rows .34s cubic-bezier(.22,.9,.28,1),opacity .24s ease,margin-top .34s cubic-bezier(.22,.9,.28,1)}
  .lead-editor-inner{overflow:hidden;min-height:0}
  .lead-card.editing .lead-editor{grid-template-rows:1fr;opacity:1;margin-top:14px}
  .lead-ed-fields{display:flex;flex-wrap:wrap;gap:8px;padding-top:14px;border-top:1px dashed var(--line)}
  .lead-ed-input{padding:9px 11px;border:1.5px solid var(--line);border-radius:10px;font-size:13.5px;
    font-family:inherit;color:var(--ink);background:var(--paper);min-width:0;
    transition:border-color .2s,box-shadow .2s}
  .lead-ed-input::placeholder{color:#A9B1AA}
  .lead-ed-input:focus{border-color:var(--green);box-shadow:0 0 0 3px var(--green-tint);outline:none}
  .lead-ed-actions{display:flex;gap:8px;align-items:center;margin-left:auto}
  @media (prefers-reduced-motion:reduce){ .lead-editor{transition:opacity .12s} }
  @media (max-width:640px){
    .lead-side{flex-direction:row;align-items:center;width:100%;justify-content:space-between}
    .lead-ed-actions{margin-left:0;width:100%;justify-content:flex-end}
  }
  .fchip{font-size:12.5px;font-weight:600;padding:7px 13px;border-radius:99px;background:var(--paper-2);border:1px solid var(--line);color:var(--muted);text-decoration:none;transition:all .15s}
  .fchip:hover{border-color:var(--green);color:var(--green)}
  .fchip.on{background:var(--ink);border-color:var(--ink);color:#fff}

  /* ============ Team ============ */
  /* Header strip: one measured band of stats, divided rather than boxed, so the
     page opens with a scoreboard instead of three floating tiles. */
  .team-hero{display:grid;grid-template-columns:repeat(4,1fr);background:var(--paper-2);
    border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);
    padding:18px 4px;margin-bottom:18px}
  .th-item{padding:0 20px;border-left:1px solid var(--line)}
  .th-item:first-child{border-left:none}
  .th-lbl{font-size:11px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)}
  .th-val{font-family:var(--font-d);font-size:26px;font-weight:700;letter-spacing:-.025em;line-height:1.1;margin-top:7px;color:var(--ink)}
  .th-val .th-of{font-size:14px;font-weight:500;color:var(--muted);margin-left:5px}
  .th-money{color:var(--green)}
  .th-sub{font-size:11.5px;color:var(--muted);margin-top:8px}
  /* Discrete pips beat a continuous bar here — you can count the seats left. */
  .seat-pips{display:flex;gap:5px;margin-top:11px}
  .seat-pips .pip{width:100%;max-width:26px;height:6px;border-radius:99px;background:var(--line)}
  .seat-pips .pip.on{background:var(--green)}
  @media(max-width:860px){
    .team-hero{grid-template-columns:repeat(2,1fr);gap:18px 0;padding:18px 4px}
    .th-item:nth-child(3){border-left:none}
  }
  @media(max-width:520px){.team-hero{grid-template-columns:minmax(0,1fr)}.th-item{border-left:none}}

  .team-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:18px;align-items:start}
  /* minmax(0,1fr), not 1fr: a bare 1fr is minmax(auto,1fr), so one long
     unbreakable string (a member email) sets the track min-content and pushes
     every card past the viewport. At 375px this blew the cards out to 469px. */
  @media(max-width:900px){.team-grid{grid-template-columns:minmax(0,1fr)}}
  .ch-row{display:flex;align-items:center;gap:9px;margin-bottom:14px}
  .ch-row h3{margin:0}
  .ch-count{font-family:var(--font-d);font-size:11.5px;font-weight:700;color:var(--muted);
    background:var(--paper);border:1px solid var(--line);border-radius:99px;padding:1px 8px}

  /* Member rows read as a leaderboard: role-tinted avatar ring, headline metrics
     visible without expanding, and a share-of-team bar for relative standing. */
  .member-wrap{border-bottom:1px solid var(--line)}
  .member-wrap:last-child{border-bottom:none}
  .member-wrap.open{background:var(--paper);border-radius:12px;border-bottom-color:transparent}
  .member{display:flex;align-items:center;gap:14px;padding:14px 10px;margin:0 -10px;
    border-radius:12px;cursor:pointer;transition:background .15s;user-select:none}
  .member:hover{background:var(--paper)}
  .member-wrap.open .member{background:transparent}

  .m-av{position:relative;flex:none;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;
    background:color-mix(in srgb,var(--rc) 16%,transparent);box-shadow:0 0 0 1.5px color-mix(in srgb,var(--rc) 45%,transparent) inset}
  .m-av-in{font-family:var(--font-d);font-weight:700;font-size:15px;color:var(--rc)}
  .m-crown{position:absolute;right:-3px;bottom:-3px;width:17px;height:17px;border-radius:50%;
    background:var(--amber);color:var(--ink);display:grid;place-items:center;
    box-shadow:0 0 0 2px var(--paper-2)}

  .m-who{flex:1;min-width:0}
  .m-name{display:flex;align-items:center;gap:7px;flex-wrap:wrap;line-height:1.25}
  .m-name b{font-size:14.5px;font-weight:600;color:var(--ink)}
  .m-you{font-size:11px;color:var(--muted);background:var(--paper);border:1px solid var(--line);
    border-radius:99px;padding:1px 7px}
  .m-pending{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
    border-radius:99px;padding:2px 8px;background:var(--amber-tint);color:#B4700F;white-space:nowrap}
  .m-mail{font-size:12px;color:var(--muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .m-meta{display:flex;align-items:center;gap:8px;margin-top:7px;font-size:11.5px;color:var(--muted);flex-wrap:wrap}
  .m-meta i{width:3px;height:3px;border-radius:50%;background:var(--line);flex:none}
  /* --ink-soft is not part of the dark token set, so a fallback literal here
     rendered dark-on-dark. Use --ink, which is defined in both themes. */
  .m-meta .m-share{font-weight:700;color:var(--ink)}
  .m-bar{height:4px;border-radius:99px;background:var(--line);overflow:hidden;margin-top:6px;max-width:320px}
  .m-bar span{display:block;height:100%;border-radius:99px;transition:width .35s var(--ease,ease)}

  .m-role{flex:none;font-size:11px;font-weight:600;white-space:nowrap;color:var(--rc);
    background:color-mix(in srgb,var(--rc) 12%,transparent);border-radius:99px;padding:2px 9px}
  .m-acts{flex:none;display:flex;align-items:center;gap:6px;color:var(--muted)}
  /* Keep the name from wrapping the row into two lines on a narrow card. */
  .m-name b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
  .th-item{min-width:0}

  .member-detail{padding:0 10px 16px}
  .md-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
  .md-stat{background:var(--paper-2);border:1px solid var(--line);border-radius:11px;padding:12px 8px;text-align:center}
  .md-stat b{display:block;font-family:var(--font-d);font-size:17px;font-weight:700;letter-spacing:-.02em;color:var(--ink);line-height:1.15}
  .md-stat b.good{color:var(--green)}
  .md-stat span{font-size:10.5px;color:var(--muted);display:block;margin-top:3px}
  @media(max-width:720px){.md-stats{grid-template-columns:repeat(2,1fr)}}

  .seat-note{font-size:12.5px;color:var(--muted);margin-top:16px;padding-top:14px;border-top:1px dashed var(--line)}
  .seat-note b{color:var(--green)}

  /* Invite card */
  .invite-card{position:sticky;top:18px}
  .invite-sub{color:var(--muted);font-size:13px;margin:0 0 16px;line-height:1.55}
  .role-seg{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
  .role-opt{display:flex;align-items:center;justify-content:center;gap:6px;padding:9px 6px;border-radius:10px;
    border:1.5px solid var(--line);background:var(--paper-2);color:var(--muted);
    font-size:12.5px;font-weight:600;cursor:pointer;transition:border-color .15s,color .15s,background .15s}
  .role-opt .ro-dot{width:7px;height:7px;border-radius:50%;background:var(--rc);flex:none;opacity:.55}
  .role-opt:hover{border-color:color-mix(in srgb,var(--rc) 55%,transparent);color:var(--ink)}
  .role-opt.on{border-color:var(--rc);color:var(--ink);background:color-mix(in srgb,var(--rc) 9%,transparent)}
  .role-opt.on .ro-dot{opacity:1}
  .owner-only{display:flex;gap:12px;align-items:flex-start}
  .owner-only .oo-ic{flex:none;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;
    background:var(--paper);border:1px solid var(--line);color:var(--muted)}
  .owner-only p{margin:7px 0 0;color:var(--muted);font-size:13.5px;line-height:1.55}

  /* Settings */
  .set-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:13px}
  .set-note{font-size:12px;color:var(--muted);line-height:1.55;margin-top:12px}
  .embed-code{background:var(--ink);color:#D6E5DE;font-family:var(--font-d);font-size:12px;padding:14px;border-radius:10px;overflow-x:auto;white-space:pre-wrap;word-break:break-all;line-height:1.6}

  .warn-card{margin-top:12px;padding:11px 13px;border-radius:10px;font-size:12.5px;line-height:1.5;background:var(--amber-tint);color:#8A5A0F;border:1px solid rgba(232,155,45,.4)}

  /* Pager */
  .pager{display:flex;align-items:center;justify-content:center;gap:14px;padding:11px 0 9px;font-size:12.5px;color:var(--muted);border-top:1px solid var(--line)}
  .pager .btn.disabled{opacity:.4;pointer-events:none}

  /* Toast */
  .toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,90px);background:var(--ink);color:#fff;font-size:13.5px;font-weight:500;padding:13px 18px;border-radius:12px;box-shadow:var(--shadow-lg);z-index:200;transition:transform .32s cubic-bezier(.2,.9,.3,1.2);display:flex;align-items:center;gap:14px;max-width:calc(100vw - 36px)}
  .toast.show{transform:translate(-50%,0)}
  .toast button{color:var(--amber);font-weight:700;font-size:13.5px;white-space:nowrap}

  /* Skip link */
  .skip-link{position:fixed;top:-60px;left:12px;z-index:300;background:var(--ink);color:#fff;padding:10px 16px;border-radius:0 0 10px 10px;font-size:13.5px;font-weight:600;text-decoration:none;transition:top .2s}
  .skip-link:focus{top:0}
  .mini-badge{display:inline-block;font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:99px;background:var(--green-tint);color:var(--green);margin-left:4px;vertical-align:middle;letter-spacing:.02em}

  /* ============ Mobile ============ */
  @media (max-width:980px){
    .editor,.dash-grid,.grid-2{grid-template-columns:minmax(0,1fr)}
  }
  @media (pointer:coarse){
    .app input[type=range]{height:10px}
    .app input[type=range]::-webkit-slider-thumb{width:28px;height:28px}
    .app input[type=range]::-moz-range-thumb{width:28px;height:28px}
    /* Thumb-sized hit areas. This app gets used one-handed on a roof, and an
       audit at 375px found 15 controls under 40px tall (some at 22px). Scoped to
       coarse pointers so the desktop density is untouched. 44px is the
       accessible minimum; .sm keeps a slightly tighter 40px. */
    .app .btn{min-height:44px}
    .app .btn.sm{min-height:40px}
    .app .btn.icon{min-width:44px;min-height:44px}
    .app .chip{min-height:36px}
    .app .fchip{min-height:38px}
    .app .member{padding-top:16px;padding-bottom:16px}
    /* Onboarding + follow-up rows are links, not buttons — give them real height */
    .app .ob-step{min-height:44px}
    .app .tr-tab{min-height:40px;min-width:44px}
    .app .role-opt{min-height:42px}
    .app .tbl .t-title{display:inline-flex;align-items:center;min-height:40px}
  }
  @media (max-width:768px){
    .app{grid-template-columns:1fr}
    .input,.proj-title{font-size:16px}
    /* Bottom nav (option A): a tidy single row of the 4 primary tabs + a "More"
       button that opens a bottom sheet with the rest. No cramming 9 tabs. */
    .sidebar{
      position:fixed;inset:auto 0 0 0;height:auto;z-index:60;
      flex-direction:row;align-items:stretch;
      padding:6px 6px env(safe-area-inset-bottom);
      border-top:1px solid rgba(255,255,255,.14);
    }
    .logo,.side-foot{display:none}
    .nav{display:grid;grid-template-columns:repeat(5,1fr);gap:3px;flex:1}
    .nav .nav-secondary{display:none}         /* secondary tabs live in the sheet */
    .nav a,.nav-more{
      display:flex;flex-direction:column;gap:4px;line-height:1;min-width:0;
      font-size:10.5px;font-weight:600;padding:8px 2px;border-radius:12px;
      align-items:center;justify-content:center;white-space:nowrap;
    }
    .nav a svg,.nav-more svg{width:21px;height:21px}
    .nav-more{background:none;border:none;color:var(--white-dim);cursor:pointer;font-family:inherit}
    .nav-more.active{background:var(--white-line);color:#fff}
    /* backdrop + sheet */
    .more-backdrop{display:block;position:fixed;inset:0;z-index:65;background:rgba(10,20,15,.5);
      opacity:0;pointer-events:none;transition:opacity .25s}
    .more-backdrop.open{opacity:1;pointer-events:auto}
    .more-sheet{display:flex;flex-direction:column;gap:2px;position:fixed;left:0;right:0;bottom:0;z-index:70;
      background:var(--ink);border-top:1px solid rgba(255,255,255,.14);border-radius:18px 18px 0 0;
      padding:8px 10px calc(12px + env(safe-area-inset-bottom));
      transform:translateY(110%);transition:transform .34s cubic-bezier(.22,.9,.28,1);
      box-shadow:0 -14px 40px -12px rgba(0,0,0,.5)}
    .more-sheet.open{transform:translateY(0)}
    .more-grip{width:40px;height:4px;border-radius:99px;background:rgba(255,255,255,.28);margin:4px auto 8px}
    .more-sheet a{display:flex;align-items:center;gap:14px;padding:14px 14px;border-radius:11px;
      color:var(--white-dim);font-size:15px;font-weight:500;text-decoration:none}
    .more-sheet a svg{width:20px;height:20px;flex:none;opacity:.9}
    .more-sheet a.active{background:var(--amber);color:var(--ink)}
    .more-sheet a.active svg{opacity:1}
    /* account footer inside the sheet: profile, theme toggle, sign out */
    .more-foot{display:flex;flex-direction:column;gap:2px;margin-top:6px;padding-top:8px;border-top:1px solid rgba(255,255,255,.12)}
    .more-foot-profile{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:11px;text-decoration:none;color:#fff}
    .more-foot-profile .avatar{width:34px;height:34px;border-radius:50%;background:var(--white-line);display:grid;place-items:center;font-size:12.5px;font-weight:600;color:#fff;object-fit:cover;flex:none}
    .more-foot-profile .who b{display:block;font-size:14px;font-weight:600;color:#fff;line-height:1.2}
    .more-foot-profile .who span{font-size:12px;color:var(--white-dim)}
    .more-sheet .side-theme,.more-sheet .reset-link{display:flex;align-items:center;gap:14px;width:100%;justify-content:flex-start;text-align:left;padding:14px;border-radius:11px;background:none;border:none;font-size:15px;font-weight:500;cursor:pointer;font-family:inherit;color:var(--white-dim)}
    .more-sheet .side-theme svg{width:20px;height:20px;flex:none;opacity:.9}
    .more-sheet .reset-link{color:#E88E7A}
    .view{padding:18px 16px 92px}
    .filters .input{width:100%}
    .proj-title{width:170px;font-size:18px}
  }
`;

export default function AppTheme() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}

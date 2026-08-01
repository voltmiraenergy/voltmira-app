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
  .side-foot{margin-top:auto}
  .profile{display:flex;align-items:center;gap:11px;padding:12px;border-radius:12px;background:var(--white-line)}
  .avatar{
    width:36px;height:36px;border-radius:50%;flex:none;
    background:var(--amber);color:var(--ink);
    display:grid;place-items:center;font-family:var(--font-d);font-weight:700;font-size:13.5px;
  }
  .avatar.sm{width:30px;height:30px;font-size:12px}
  .avatar.green{background:var(--green-tint);color:var(--green)}
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
  .bulkbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;padding:10px 14px;background:var(--paper-2);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow)}
  .bulkbar .bb-lbl{font-size:12.5px;color:var(--muted);font-weight:600}
  .bulkbar .chip{cursor:pointer}
  .tbl .col-sel{width:34px;padding-right:2px}
  .tbl .col-sel input{width:15px;height:15px;accent-color:var(--green);cursor:pointer;vertical-align:middle}

  /* Dashboard "Needs follow-up" strip */
  .followup-strip{background:var(--amber-tint);border:1px solid rgba(232,155,45,.4);border-radius:var(--radius);padding:16px 18px;margin-bottom:18px}
  .followup-strip h3{color:#8A5A0F;margin:0 0 3px;font-size:13px;text-transform:uppercase;letter-spacing:.07em}
  .fu-sub{font-size:13px;color:#8A5A0F;opacity:.92;margin-bottom:10px}
  .fu-row{display:flex;align-items:center;gap:12px;padding:9px 0;border-top:1px solid rgba(232,155,45,.28)}
  .fu-row .fu-who{flex:1;min-width:0}
  .fu-row .fu-who b{display:block;font-size:13.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .fu-row .fu-who span{font-size:12px;color:#8A5A0F}
  .fu-row .fu-age{font-size:12px;font-weight:700;color:var(--red);white-space:nowrap}

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
  .cost-line{display:flex;flex-wrap:wrap;gap:24px;align-items:center}
  .cost-line .k b{display:block;font-family:var(--font-d);font-size:24px;font-weight:700;letter-spacing:-.02em}
  .cost-line .k span{font-size:12px;color:var(--muted)}

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
  .fchip{font-size:12.5px;font-weight:600;padding:7px 13px;border-radius:99px;background:var(--paper-2);border:1px solid var(--line);color:var(--muted);text-decoration:none;transition:all .15s}
  .fchip:hover{border-color:var(--green);color:var(--green)}
  .fchip.on{background:var(--ink);border-color:var(--ink);color:#fff}

  /* Team */
  .member{display:flex;align-items:center;gap:13px;padding:13px 0;border-bottom:1px solid var(--line)}
  .member:last-child{border-bottom:none}
  .member .m-who{flex:1;min-width:0}
  .member .m-who b{display:block;font-size:14px;font-weight:600}
  .member .m-who span{font-size:12px;color:var(--muted)}
  .member .m-count{font-size:12px;color:var(--muted);white-space:nowrap}
  .seat-note{font-size:12.5px;color:var(--muted);margin-top:14px;padding-top:13px;border-top:1px dashed var(--line)}
  .seat-note b{color:var(--green)}

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
    .editor,.dash-grid,.grid-2{grid-template-columns:1fr}
  }
  @media (pointer:coarse){
    .app input[type=range]{height:10px}
    .app input[type=range]::-webkit-slider-thumb{width:28px;height:28px}
    .app input[type=range]::-moz-range-thumb{width:28px;height:28px}
  }
  @media (max-width:768px){
    .app{grid-template-columns:1fr}
    .input,.proj-title{font-size:16px}
    .sidebar{
      position:fixed;inset:auto 0 0 0;height:auto;z-index:60;
      flex-direction:row;align-items:center;gap:6px;
      padding:6px 8px calc(6px + env(safe-area-inset-bottom));
      border-top:1px solid rgba(255,255,255,.16);
    }
    .logo,.side-foot{display:none}
    .nav{flex-direction:row;flex:1;gap:3px}
    .nav a{flex-direction:column;gap:4px;font-size:10px;padding:7px 4px;flex:1;align-items:center;justify-content:center;border-radius:9px}
    .view{padding:18px 16px 96px}
    .filters .input{width:100%}
    .proj-title{width:170px;font-size:18px}
  }
`;

export default function AppTheme() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}

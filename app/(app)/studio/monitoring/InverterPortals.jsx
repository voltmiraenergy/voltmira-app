"use client";
// app/(app)/studio/monitoring/InverterPortals.jsx — connect the inverter
// portals the installer already uses (Huawei FusionSolar, Deye/Solarman,
// Growatt) and link each station to the job it powers. From then on the
// nightly sync (app/api/cron/inverter-sync) fills that job's monitoring months,
// so the fleet below is assessed on real figures instead of typed-in ones.
//
// Logins are checked against the portal before they're stored, stored
// encrypted, and never sent back to the browser (app/api/inverters).
import { useEffect, useMemo, useState } from "react";
import { tx } from "../studio-kit.jsx";

const PROVIDER_INFO = {
  fusionsolar: {
    name: "Huawei FusionSolar",
    sub: { en: "SUN2000 inverters", ro: "Invertoare SUN2000", ru: "Инверторы SUN2000" },
    help: {
      en: "Use a Northbound API account, not your everyday login. The company admin creates one in FusionSolar under Northbound management. The domain is the one in your FusionSolar address bar.",
      ro: "Folosește un cont Northbound API, nu contul obișnuit. Administratorul companiei îl creează în FusionSolar, la Northbound management. Domeniul este cel din bara de adrese FusionSolar.",
      ru: "Нужна учётная запись Northbound API, а не обычный вход. Администратор компании создаёт её в FusionSolar в разделе Northbound management. Домен тот, что в адресной строке FusionSolar.",
    },
  },
  solarman: {
    name: "Deye / Solarman",
    sub: { en: "Deye and other Solarman loggers", ro: "Deye și alte loggere Solarman", ru: "Deye и другие логгеры Solarman" },
    help: {
      en: "App ID and App Secret come with Solarman's OpenAPI access, which Solarman grants on request. Login and password are those of your Solarman Business account.",
      ro: "App ID și App Secret vin odată cu accesul Solarman OpenAPI, acordat de Solarman la cerere. Login-ul și parola sunt cele ale contului Solarman Business.",
      ru: "App ID и App Secret выдаются вместе с доступом к Solarman OpenAPI, который Solarman предоставляет по запросу. Логин и пароль от вашего аккаунта Solarman Business.",
    },
  },
  growatt: {
    name: "Growatt",
    sub: { en: "Growatt OpenAPI", ro: "Growatt OpenAPI", ru: "Growatt OpenAPI" },
    help: {
      en: "The OpenAPI token Growatt issues for your installer account.",
      ro: "Token-ul OpenAPI emis de Growatt pentru contul tău de instalator.",
      ru: "Токен OpenAPI, который Growatt выдаёт для вашего аккаунта установщика.",
    },
  },
};

const FIELD_LABEL = {
  inv_f_domain: { en: "Portal domain", ro: "Domeniul portalului", ru: "Домен портала" },
  inv_f_api_user: { en: "API user", ro: "Utilizator API", ru: "Пользователь API" },
  inv_f_api_password: { en: "API password", ro: "Parolă API", ru: "Пароль API" },
  inv_f_app_id: { en: "App ID", ro: "App ID", ru: "App ID" },
  inv_f_app_secret: { en: "App Secret", ro: "App Secret", ru: "App Secret" },
  inv_f_login: { en: "Email or username", ro: "E-mail sau utilizator", ru: "Email или имя пользователя" },
  inv_f_password: { en: "Password", ro: "Parolă", ru: "Пароль" },
  inv_f_token: { en: "API token", ro: "Token API", ru: "API-токен" },
};

const T = {
  title: { en: "Inverter portals", ro: "Portaluri invertoare", ru: "Порталы инверторов" },
  sub: {
    en: "Link a station to the job it powers and its finished months fill in every night, with nothing to type.",
    ro: "Leagă o stație de lucrarea pe care o alimentează și lunile încheiate se completează în fiecare noapte, fără nimic de tastat.",
    ru: "Привяжите станцию к объекту, и завершённые месяцы будут заполняться каждую ночь, без ручного ввода.",
  },
  connect: { en: "Connect a portal", ro: "Conectează un portal", ru: "Подключить портал" },
  manage: { en: "Manage", ro: "Gestionează", ru: "Управление" },
  hide: { en: "Hide", ro: "Ascunde", ru: "Скрыть" },
  summary: {
    en: "{a} accounts · {s} stations · {l} linked",
    ro: "{a} conturi · {s} stații · {l} legate",
    ru: "аккаунтов: {a} · станций: {s} · привязано: {l}",
  },
  synced: { en: "synced {t}", ro: "sincronizat {t}", ru: "синхронизировано {t}" },
  none: {
    en: "No portal connected yet. Connect the account your inverters report to, then link each station to its job.",
    ro: "Niciun portal conectat încă. Conectează contul în care raportează invertoarele, apoi leagă fiecare stație de lucrarea ei.",
    ru: "Порталы пока не подключены. Подключите аккаунт, куда отчитываются ваши инверторы, и привяжите каждую станцию к её объекту.",
  },
  notMigrated: {
    en: "Portal sync isn't switched on for this workspace yet.",
    ro: "Sincronizarea cu portalurile nu este încă activată pentru acest spațiu de lucru.",
    ru: "Синхронизация с порталами ещё не включена для этого рабочего пространства.",
  },
  noKey: {
    en: "Connecting portals is off until the server has an encryption key for stored logins.",
    ro: "Conectarea portalurilor este oprită până când serverul are o cheie de criptare pentru datele de autentificare.",
    ru: "Подключение порталов выключено, пока на сервере нет ключа шифрования для сохранённых логинов.",
  },
  noManage: {
    en: "Only the workspace owner or a manager can connect portals and link stations.",
    ro: "Doar proprietarul spațiului de lucru sau un manager poate conecta portaluri și lega stații.",
    ru: "Подключать порталы и привязывать станции может только владелец или менеджер.",
  },
  loadErr: { en: "Couldn't load your portal accounts.", ro: "Nu am putut încărca conturile de portal.", ru: "Не удалось загрузить аккаунты порталов." },
  retry: { en: "Try again", ro: "Încearcă din nou", ru: "Повторить" },
  pickProvider: { en: "Portal", ro: "Portal", ru: "Портал" },
  label: { en: "Name for this account (optional)", ro: "Nume pentru acest cont (opțional)", ru: "Название аккаунта (необязательно)" },
  labelPh: { en: "e.g. Main installer account", ro: "ex. Contul principal", ru: "напр. Основной аккаунт" },
  check: { en: "Check and connect", ro: "Verifică și conectează", ru: "Проверить и подключить" },
  checking: { en: "Checking with {p}…", ro: "Verific la {p}…", ru: "Проверяем в {p}…" },
  cancel: { en: "Cancel", ro: "Anulează", ru: "Отмена" },
  stored: {
    en: "The login is checked with the portal first, then stored encrypted. It's never shown again.",
    ro: "Datele sunt verificate mai întâi la portal, apoi stocate criptat. Nu mai sunt afișate niciodată.",
    ru: "Логин сначала проверяется на портале, затем хранится в зашифрованном виде и больше не показывается.",
  },
  connected: { en: "Connected. {n} stations found.", ro: "Conectat. {n} stații găsite.", ru: "Подключено. Найдено станций: {n}." },
  st_ok: { en: "Syncing", ro: "Sincronizat", ru: "Синхронизируется" },
  st_new: { en: "Not synced yet", ro: "Nesincronizat încă", ru: "Ещё не синхронизирован" },
  st_error: { en: "Sync failed", ro: "Eroare la sincronizare", ru: "Ошибка синхронизации" },
  never: { en: "never synced", ro: "nesincronizat", ru: "не синхронизирован" },
  syncNow: { en: "Sync now", ro: "Sincronizează acum", ru: "Синхронизировать" },
  syncing: { en: "Syncing…", ro: "Sincronizez…", ru: "Синхронизация…" },
  remove: { en: "Remove", ro: "Elimină", ru: "Удалить" },
  removeQ: { en: "Remove this account?", ro: "Elimini acest cont?", ru: "Удалить аккаунт?" },
  removeYes: { en: "Yes, remove", ro: "Da, elimină", ru: "Да, удалить" },
  removed: { en: "Account removed", ro: "Cont eliminat", ru: "Аккаунт удалён" },
  syncOk: { en: "Synced. {n} monthly readings updated.", ro: "Sincronizat. {n} citiri lunare actualizate.", ru: "Готово. Обновлено месячных показаний: {n}." },
  syncNoLink: {
    en: "Synced. Link a station to a job to start filling its months.",
    ro: "Sincronizat. Leagă o stație de o lucrare ca să înceapă completarea lunilor.",
    ru: "Готово. Привяжите станцию к объекту, чтобы месяцы начали заполняться.",
  },
  syncFail: { en: "Sync failed", ro: "Sincronizarea a eșuat", ru: "Синхронизация не удалась" },
  stations: { en: "Stations", ro: "Stații", ru: "Станции" },
  showSt: { en: "Show {n} stations", ro: "Arată {n} stații", ru: "Показать станции ({n})" },
  hideSt: { en: "Hide stations", ro: "Ascunde stațiile", ru: "Скрыть станции" },
  find: { en: "Find a station", ro: "Caută o stație", ru: "Найти станцию" },
  noStations: {
    en: "The portal lists no stations for this account yet.",
    ro: "Portalul nu listează încă nicio stație pentru acest cont.",
    ru: "Портал пока не показывает станций для этого аккаунта.",
  },
  c_station: { en: "Station", ro: "Stație", ru: "Станция" },
  c_last: { en: "Last month", ro: "Ultima lună", ru: "Посл. месяц" },
  c_job: { en: "Studio job", ro: "Lucrare Studio", ru: "Объект Studio" },
  c_quote: { en: "Quote", ro: "Ofertă", ru: "Предложение" },
  notLinked: { en: "Not linked", ro: "Nelegată", ru: "Не привязана" },
  linked: { en: "Link saved", ro: "Legătură salvată", ru: "Привязка сохранена" },
  linkHelp: {
    en: "Link a station to its Studio job to fill that job's Monitoring months. Link it to a quote too and its readings also feed the dashboard's system health and the yield calibration of your next quotes.",
    ro: "Leagă stația de lucrarea ei din Studio ca să se completeze lunile din Monitorizare. Leag-o și de o ofertă, iar citirile vor alimenta și starea sistemelor din panou și calibrarea producției în ofertele următoare.",
    ru: "Привяжите станцию к объекту Studio, чтобы заполнять месяцы «Мониторинга». Привяжите и к предложению, тогда показания также пойдут в здоровье систем на панели и в калибровку выработки для следующих расчётов.",
  },
  won: { en: "won", ro: "câștigată", ru: "выиграно" },
  sent: { en: "sent", ro: "trimisă", ru: "отправлено" },
  e_generic: { en: "Something went wrong. Try again.", ro: "Ceva n-a mers. Încearcă din nou.", ru: "Что-то пошло не так. Попробуйте ещё раз." },
  e_missing: { en: "Fill in every field.", ro: "Completează toate câmpurile.", ru: "Заполните все поля." },
  e_auth: {
    en: "The portal didn't accept this login. Check each field and try again.",
    ro: "Portalul nu a acceptat aceste date. Verifică fiecare câmp și încearcă din nou.",
    ru: "Портал не принял эти данные. Проверьте каждое поле и попробуйте снова.",
  },
  e_rate: {
    en: "Too many attempts for now. Try again in an hour.",
    ro: "Prea multe încercări deocamdată. Încearcă din nou peste o oră.",
    ru: "Слишком много попыток. Попробуйте через час.",
  },
  e_network: {
    en: "Couldn't reach the portal. Check the domain, or try again in a few minutes.",
    ro: "Portalul nu a putut fi contactat. Verifică domeniul sau încearcă din nou în câteva minute.",
    ru: "Не удалось связаться с порталом. Проверьте домен или повторите через несколько минут.",
  },
  e_domain: {
    en: "The domain should look like eu5.fusionsolar.huawei.com.",
    ro: "Domeniul trebuie să arate ca eu5.fusionsolar.huawei.com.",
    ru: "Домен должен выглядеть как eu5.fusionsolar.huawei.com.",
  },
  e_bad: {
    en: "The portal answered in a way VoltMira doesn't recognise.",
    ro: "Portalul a răspuns într-un format pe care VoltMira nu îl recunoaște.",
    ru: "Портал ответил в формате, который VoltMira не распознаёт.",
  },
};

// Why the last sync failed, keyed by the code lib/inverterSync.js stores.
const STORED = {
  auth: {
    en: "The portal no longer accepts this login. Remove the account and connect it again with current details.",
    ro: "Portalul nu mai acceptă aceste date. Elimină contul și conectează-l din nou cu datele actuale.",
    ru: "Портал больше не принимает этот логин. Удалите аккаунт и подключите его снова с актуальными данными.",
  },
  rate_limited: {
    en: "The portal is limiting requests. The next nightly sync will try again.",
    ro: "Portalul limitează cererile. Următoarea sincronizare de noapte va încerca din nou.",
    ru: "Портал ограничивает запросы. Следующая ночная синхронизация попробует снова.",
  },
  network: {
    en: "Couldn't reach the portal. The next nightly sync will try again.",
    ro: "Portalul nu a putut fi contactat. Următoarea sincronizare de noapte va încerca din nou.",
    ru: "Не удалось связаться с порталом. Следующая ночная синхронизация попробует снова.",
  },
  bad_response: T.e_bad,
  key_changed: {
    en: "The saved login can't be read any more. Remove the account and connect it again.",
    ro: "Datele salvate nu mai pot fi citite. Elimină contul și conectează-l din nou.",
    ru: "Сохранённый логин больше не читается. Удалите аккаунт и подключите его снова.",
  },
  studio_not_ready: {
    en: "This job's months couldn't be filled: Studio isn't saving to the workspace yet.",
    ro: "Lunile acestei lucrări nu au putut fi completate: Studio nu salvează încă în spațiul de lucru.",
    ru: "Месяцы этого объекта не заполнены: Studio ещё не сохраняет данные в рабочем пространстве.",
  },
  store_failed: {
    en: "Couldn't store this station's readings. The next sync will try again.",
    ro: "Citirile acestei stații nu au putut fi salvate. Următoarea sincronizare va încerca din nou.",
    ru: "Не удалось сохранить показания станции. Следующая синхронизация попробует снова.",
  },
};
STORED.secret_missing = STORED.key_changed;
const storedError = (code, message, lang) => (STORED[code] ? tx(STORED[code], lang) : message);

const fill = (s, vars) => Object.keys(vars).reduce((a, k) => a.split("{" + k + "}").join(vars[k]), s);
const locale = (lang) => (lang === "ru" ? "ru-RU" : lang === "ro" ? "ro-RO" : "en-IE");

function ago(iso, lang) {
  if (!iso) return null;
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  if (s < 90) return rtf.format(0, "minute");
  if (s < 3600) return rtf.format(-Math.round(s / 60), "minute");
  if (s < 86400) return rtf.format(-Math.round(s / 3600), "hour");
  return rtf.format(-Math.round(s / 86400), "day");
}

function lastReading(st, lang) {
  if (!st.last_month || st.last_kwh == null) return null;
  const d = new Date(st.last_month + "T12:00:00Z");
  const m = d.toLocaleDateString(locale(lang), { month: "short", year: "numeric", timeZone: "UTC" });
  return `${m}: ${Math.round(st.last_kwh).toLocaleString(locale(lang))} kWh`;
}

// What went wrong, in the installer's language. `portal` errors carry the
// connector's code (lib/inverters/common.js).
function errorText(res, provider, lang) {
  const t = (o) => tx(o, lang);
  switch (res?.error) {
    case "missing_fields": return t(T.e_missing);
    case "rate_limited": return t(T.e_rate);
    case "not_migrated": return t(T.notMigrated);
    case "no_secret_key": return t(T.noKey);
    case "forbidden": return t(T.noManage);
    case "portal":
      if (res.code === "auth") return t(T.e_auth);
      if (res.code === "rate_limited") return t(T.e_rate);
      if (res.code === "network") return t(T.e_network);
      if (res.code === "config" && provider === "fusionsolar") return t(T.e_domain);
      if (res.code === "bad_response") return t(T.e_bad);
      return res.message || t(T.e_generic);
    default: return t(T.e_generic);
  }
}

async function call(url, init) {
  try {
    const r = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers || {}) } });
    const body = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, body };
  } catch {
    return { ok: false, status: 0, body: { error: "network" } };
  }
}

/* ------------------------------------------------------------- connect ---- */
function ConnectForm({ lang, providers, onDone, onCancel }) {
  const t = (o) => tx(o, lang);
  const ids = Object.keys(providers);
  const [provider, setProvider] = useState(ids[0]);
  const [values, setValues] = useState({});
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const fields = providers[provider]?.fields || [];

  function pick(p) { setProvider(p); setValues({}); setErr(null); }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (fields.some((f) => !String(values[f.key] || "").trim())) { setErr(t(T.e_missing)); return; }
    setBusy(true); setErr(null);
    const res = await call("/api/inverters", {
      method: "POST",
      body: JSON.stringify({ provider, label, credentials: values }),
    });
    setBusy(false);
    if (!res.ok) { setErr(errorText(res.body, provider, lang)); return; }
    setValues({});
    onDone(res.body);
  }

  return (
    <form className="ip-form" onSubmit={submit} autoComplete="off">
      <div className="ip-prov" role="radiogroup" aria-label={t(T.pickProvider)}>
        {ids.map((p) => (
          <button type="button" key={p} role="radio" aria-checked={provider === p}
            className={"ip-prov-opt" + (provider === p ? " on" : "")} onClick={() => pick(p)}>
            <b>{PROVIDER_INFO[p]?.name || p}</b>
            <span>{tx(PROVIDER_INFO[p]?.sub || {}, lang)}</span>
          </button>
        ))}
      </div>
      <p className="ip-help">{tx(PROVIDER_INFO[provider]?.help || {}, lang)}</p>
      <div className="ip-fields">
        {fields.map((f) => {
          const id = `ip-f-${provider}-${f.key}`;
          return (
            <div className="pv-field" key={id}>
              <label htmlFor={id}>{tx(FIELD_LABEL[f.label] || { en: f.key }, lang)}</label>
              <input id={id} className="pv-input" type={f.secret ? "password" : "text"}
                autoComplete={f.secret ? "new-password" : "off"} spellCheck={false} autoCapitalize="off"
                placeholder={f.placeholder || ""} value={values[f.key] || ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
            </div>
          );
        })}
        <div className="pv-field">
          <label htmlFor="ip-f-label">{t(T.label)}</label>
          <input id="ip-f-label" className="pv-input" maxLength={80} placeholder={t(T.labelPh)}
            value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
      </div>
      {err && <p className="ip-err" role="alert">{err}</p>}
      <div className="ip-form-foot">
        <p className="ip-note">{t(T.stored)}</p>
        <div className="ip-btns">
          <button type="button" className="btn ghost sm" onClick={onCancel} disabled={busy}>{t(T.cancel)}</button>
          <button type="submit" className="btn primary sm" disabled={busy}>
            {busy ? fill(t(T.checking), { p: PROVIDER_INFO[provider]?.name || provider }) : t(T.check)}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------- station ---- */
function StationRow({ st, lang, jobs, projects, canManage, onLink }) {
  const t = (o) => tx(o, lang);
  const [busy, setBusy] = useState(false);
  async function change(field, value) {
    setBusy(true);
    await onLink(st, { [field]: value || null });
    setBusy(false);
  }
  const jobKnown = !st.studio_job_id || jobs.some((j) => j.id === st.studio_job_id);
  const projKnown = !st.project_id || projects.some((p) => p.id === st.project_id);
  const last = lastReading(st, lang);
  return (
    <tr>
      <td>
        <div className="ip-st">
          <b>{st.name || st.external_id}</b>
          <span>{st.capacity_kw ? `${Number(st.capacity_kw).toLocaleString(locale(lang), { maximumFractionDigits: 1 })} kWp` : st.external_id}</span>
          {st.last_error && <span className="ip-st-err">{storedError(st.last_error_code, st.last_error, lang)}</span>}
        </div>
      </td>
      <td className="ip-last">{last || "—"}</td>
      <td>
        <select className="pv-input ip-sel" aria-label={t(T.c_job)} disabled={!canManage || busy}
          value={st.studio_job_id || ""} onChange={(e) => change("studioJobId", e.target.value)}>
          <option value="">{t(T.notLinked)}</option>
          {!jobKnown && <option value={st.studio_job_id}>{st.studio_job_id}</option>}
          {jobs.map((j) => <option key={j.id} value={j.id}>{j.name || j.id}</option>)}
        </select>
      </td>
      <td>
        <select className="pv-input ip-sel" aria-label={t(T.c_quote)} disabled={!canManage || busy}
          value={st.project_id || ""} onChange={(e) => change("projectId", e.target.value)}>
          <option value="">{t(T.notLinked)}</option>
          {!projKnown && <option value={st.project_id}>{st.project_id.slice(0, 8)}</option>}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {(p.client_name || p.title || "—") + (p.status === "won" ? ` (${t(T.won)})` : ` (${t(T.sent)})`)}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}

/* ---------------------------------------------------------- connection ---- */
function Connection({ c, stations, lang, jobs, projects, canManage, onSync, onRemove, onLink }) {
  const t = (o) => tx(o, lang);
  const [open, setOpen] = useState(stations.length > 0 && stations.length <= 6);
  const [q, setQ] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const linked = stations.filter((s) => s.studio_job_id || s.project_id).length;
  const status = c.status === "ok" ? ["green", T.st_ok] : c.status === "error" ? ["red", T.st_error] : ["grey", T.st_new];
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return stations
      .filter((s) => !needle || `${s.name} ${s.external_id}`.toLowerCase().includes(needle))
      .sort((a, b) => Number(!!(b.studio_job_id || b.project_id)) - Number(!!(a.studio_job_id || a.project_id)));
  }, [stations, q]);

  async function sync() {
    setSyncing(true);
    await onSync(c);
    setSyncing(false);
  }

  return (
    <article className="ip-conn">
      <header className="ip-conn-top">
        <div className="ip-conn-who">
          <b>{c.label || PROVIDER_INFO[c.provider]?.name || c.provider}</b>
          <span>
            {[c.label ? PROVIDER_INFO[c.provider]?.name : null, c.account_hint || null,
              c.last_sync_at ? fill(t(T.synced), { t: ago(c.last_sync_at, lang) }) : t(T.never)].filter(Boolean).join(" · ")}
          </span>
        </div>
        <span className={"pv-stage " + status[0]}>{t(status[1])}</span>
      </header>
      {c.status === "error" && c.last_error && <p className="ip-err">{storedError(c.last_error_code, c.last_error, lang)}</p>}
      <div className="ip-conn-bar">
        <button type="button" className="ip-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)} disabled={!stations.length}>
          {stations.length ? (open ? t(T.hideSt) : fill(t(T.showSt), { n: stations.length })) : t(T.noStations)}
          {stations.length > 0 && <em>{linked}/{stations.length}</em>}
        </button>
        <div className="ip-btns">
          <button type="button" className="btn ghost sm" onClick={sync} disabled={syncing}>{syncing ? t(T.syncing) : t(T.syncNow)}</button>
          {canManage && (confirm ? (
            <>
              <span className="ip-q">{t(T.removeQ)}</span>
              <button type="button" className="btn ghost sm ip-danger" onClick={() => onRemove(c)}>{t(T.removeYes)}</button>
              <button type="button" className="btn ghost sm" onClick={() => setConfirm(false)}>{t(T.cancel)}</button>
            </>
          ) : (
            <button type="button" className="btn ghost sm" onClick={() => setConfirm(true)}>{t(T.remove)}</button>
          ))}
        </div>
      </div>
      {open && stations.length > 0 && (
        <div className="ip-stations">
          {stations.length > 8 && (
            <input className="pv-input ip-find" type="search" id={`ip-find-${c.id}`} aria-label={t(T.find)}
              placeholder={t(T.find)} value={q} onChange={(e) => setQ(e.target.value)} />
          )}
          <div className="pv-tbl-wrap">
            <table className="pv-tbl ip-tbl">
              <colgroup><col className="ip-c-st" /><col className="ip-c-last" /><col /><col /></colgroup>
              <thead>
                <tr>
                  <th>{t(T.c_station)}</th>
                  <th>{t(T.c_last)}</th>
                  <th>{t(T.c_job)}</th>
                  <th>{t(T.c_quote)}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((st) => (
                  <StationRow key={st.id} st={st} lang={lang} jobs={jobs} projects={projects} canManage={canManage} onLink={onLink} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </article>
  );
}

/* ---------------------------------------------------------------- main ---- */
/**
 * @param {{ lang: string, jobs: object[], fire: (msg: string) => void,
 *           onReadings: () => Promise<void> }} props
 * `jobs` are the Studio jobs a station can be linked to; `onReadings` pulls
 * the workspace copy back into this browser after a sync wrote new months.
 */
export default function InverterPortals({ lang, jobs, fire, onReadings }) {
  const t = (o) => tx(o, lang);
  const [data, setData] = useState(null);     // GET /api/inverters
  const [state, setState] = useState("loading");
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState(null);

  async function load() {
    const res = await call("/api/inverters");
    if (res.status === 401) { setState("hidden"); return; }
    if (!res.ok) { setState("error"); return; }
    setData(res.body);
    setState("ready");
  }
  useEffect(() => { load(); }, []);

  const conns = data?.connections || [];
  const stations = data?.stations || [];
  const byConn = useMemo(() => {
    const m = new Map();
    for (const s of stations) m.set(s.connection_id, [...(m.get(s.connection_id) || []), s]);
    return m;
  }, [stations]);

  if (state === "hidden") return null;

  const linkedCount = stations.filter((s) => s.studio_job_id || s.project_id).length;
  const lastSync = conns.map((c) => c.last_sync_at).filter(Boolean).sort().pop();
  const anyError = conns.some((c) => c.status === "error");
  // Open by default while there's something to do: nothing connected yet, or a failing account.
  const isOpen = expanded ?? (conns.length === 0 || anyError);
  const canConnect = data?.migrated && data?.keyConfigured && data?.canManage;

  async function onConnected(body) {
    setAdding(false);
    fire(fill(t(T.connected), { n: body.stations?.length || 0 }));
    setExpanded(true);
    await load();
  }
  async function onSync(c) {
    const res = await call(`/api/inverters/${c.id}`, { method: "POST", body: JSON.stringify({ action: "sync" }) });
    if (!res.ok) fire(errorText(res.body, c.provider, lang));
    else if (res.body.status === "error") fire(t(T.syncFail));
    else fire(res.body.linked ? fill(t(T.syncOk), { n: res.body.readings || 0 }) : t(T.syncNoLink));
    await load();
    if (res.ok && res.body.readings) await onReadings();
  }
  async function onRemove(c) {
    const res = await call(`/api/inverters/${c.id}`, { method: "DELETE" });
    if (!res.ok) { fire(errorText(res.body, c.provider, lang)); return; }
    fire(t(T.removed));
    await load();
  }
  async function onLink(st, patch) {
    const res = await call(`/api/inverters/stations/${st.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    if (!res.ok) { fire(errorText(res.body, null, lang)); return; }
    setData((d) => ({ ...d, stations: d.stations.map((s) => (s.id === st.id ? { ...s, ...res.body.station } : s)) }));
    fire(t(T.linked));
  }

  return (
    <section className="mn-section ip" aria-labelledby="ip-title">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="pv-panel ip-panel">
        <div className="ip-head">
          <div className="ip-head-tx">
            <h2 className="mn-h2" id="ip-title">{t(T.title)} {state === "ready" && conns.length > 0 && <span>{conns.length}</span>}</h2>
            {state === "loading" ? <div className="ip-skel" aria-hidden="true" />
              : state === "error" ? <p className="ip-sub">{t(T.loadErr)}</p>
              : conns.length ? (
                <p className="ip-sub">
                  {fill(t(T.summary), { a: conns.length, s: stations.length, l: linkedCount })}
                  {lastSync && <> · {fill(t(T.synced), { t: ago(lastSync, lang) })}</>}
                </p>
              ) : <p className="ip-sub">{t(T.sub)}</p>}
          </div>
          <div className="ip-btns">
            {state === "error" && <button type="button" className="btn ghost sm" onClick={() => { setState("loading"); load(); }}>{t(T.retry)}</button>}
            {state === "ready" && conns.length > 0 && (
              <button type="button" className="btn ghost sm" aria-expanded={isOpen} onClick={() => setExpanded(!isOpen)}>
                {isOpen ? t(T.hide) : t(T.manage)}
              </button>
            )}
            {state === "ready" && canConnect && !adding && (
              <button type="button" className="btn primary sm" onClick={() => { setAdding(true); setExpanded(true); }}>{t(T.connect)}</button>
            )}
          </div>
        </div>

        {state === "ready" && (
          <>
            {!data.migrated ? <p className="ip-notice">{t(T.notMigrated)}</p>
              : !data.keyConfigured ? <p className="ip-notice">{t(T.noKey)}</p>
              : !data.canManage && isOpen ? <p className="ip-notice">{t(T.noManage)}</p> : null}

            {adding && (
              <ConnectForm lang={lang} providers={data.providers || {}} onDone={onConnected} onCancel={() => setAdding(false)} />
            )}

            {isOpen && data.migrated && (
              conns.length === 0 ? (!adding && <p className="ip-empty">{t(T.none)}</p>) : (
                <>
                  <p className="ip-linkhelp">{t(T.linkHelp)}</p>
                  <div className="ip-conns">
                    {conns.map((c) => (
                      <Connection key={c.id} c={c} stations={byConn.get(c.id) || []} lang={lang}
                        jobs={jobs} projects={data.projects || []} canManage={data.canManage}
                        onSync={onSync} onRemove={onRemove} onLink={onLink} />
                    ))}
                  </div>
                </>
              )
            )}
          </>
        )}
      </div>
    </section>
  );
}

const CSS = `
.app .ip-panel{padding:18px 20px}
.app .ip-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap}
.app .ip-head-tx{flex:1 1 320px;min-width:0}
.app .ip-head .mn-h2{margin:0 0 4px}
.app .ip-sub{margin:0;font-size:13px;color:var(--muted);line-height:1.5;max-width:70ch}
.app .ip-skel{height:12px;width:min(340px,70%);border-radius:6px;background:var(--line);margin-top:6px;animation:ip-pulse 1.2s ease-in-out infinite}
@keyframes ip-pulse{50%{opacity:.5}}
.app .ip-btns{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.app .ip-notice{margin:14px 0 0;font-size:13px;color:var(--ink-soft);background:var(--amber-tint);border-radius:10px;padding:10px 12px;line-height:1.5}
.app .ip-empty{margin:14px 0 0;font-size:13px;color:var(--muted);line-height:1.55}
.app .ip-linkhelp{margin:14px 0 12px;font-size:12.5px;color:var(--muted);line-height:1.55;max-width:80ch}
.app .ip-err{margin:10px 0 0;font-size:12.5px;color:var(--red);line-height:1.5}

.app .ip-form{margin-top:16px;border-top:1px solid var(--line);padding-top:16px}
.app .ip-prov{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-bottom:12px}
.app .ip-prov-opt{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;padding:11px 13px;border-radius:11px;
  border:1px solid var(--line);background:var(--paper);cursor:pointer;transition:border-color .14s,box-shadow .14s}
.app .ip-prov-opt b{font-size:13.5px;color:var(--ink)}
.app .ip-prov-opt span{font-size:11.5px;color:var(--muted)}
.app .ip-prov-opt:hover{border-color:var(--hair)}
.app .ip-prov-opt.on{border-color:var(--green);box-shadow:0 0 0 3px rgba(30,107,78,.12);background:var(--paper-2)}
.app .ip-prov-opt:focus-visible{outline:2px solid var(--green);outline-offset:2px}
.app .ip-help{margin:0 0 14px;font-size:12.5px;color:var(--ink-soft);line-height:1.55;max-width:80ch}
.app .ip-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0 14px}
.app .ip-form-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:4px}
.app .ip-note{margin:0;font-size:11.5px;color:var(--muted);line-height:1.5;flex:1 1 260px}

.app .ip-conns{display:flex;flex-direction:column;gap:10px}
.app .ip-conn{border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:var(--paper)}
.app .ip-conn-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.app .ip-conn-who{display:flex;flex-direction:column;gap:2px;min-width:0}
.app .ip-conn-who b{font-size:14px;color:var(--ink)}
.app .ip-conn-who span{font-size:12px;color:var(--muted);overflow-wrap:anywhere}
.app .ip-conn-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:10px}
.app .ip-toggle{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;color:var(--green);background:none;border:0;cursor:pointer;padding:4px 0}
.app .ip-toggle:disabled{color:var(--muted);cursor:default}
.app .ip-toggle em{font-style:normal;font-family:var(--font-m,monospace);font-size:11px;color:var(--muted);border:1px solid var(--line);border-radius:6px;padding:1px 6px}
.app .ip-q{font-size:12.5px;color:var(--ink-soft)}
.app .ip-danger{color:var(--red)}
.app .ip-stations{margin-top:10px}
.app .ip-find{max-width:280px;margin-bottom:8px;padding:7px 10px;font-size:13px}
.app .ip-tbl{table-layout:fixed;min-width:640px}
.app .ip-c-st{width:32%}
.app .ip-c-last{width:18%}
.app .ip-tbl td{padding:9px 8px}
.app .ip-st{display:flex;flex-direction:column;gap:2px;min-width:0;overflow-wrap:anywhere}
.app .ip-st b{font-size:13px;color:var(--ink)}
.app .ip-st span{font-size:11.5px;color:var(--muted)}
.app .ip-st .ip-st-err{color:var(--red)}
.app .ip-last{font-size:12.5px;color:var(--ink-soft);font-variant-numeric:tabular-nums}
.app .ip-sel{width:100%;padding:6px 8px;font-size:12.5px;text-overflow:ellipsis}
@media (max-width:520px){
  .app .ip-panel{padding:14px}
  .app .ip-btns .btn{flex:1 1 auto}
}
@media (prefers-reduced-motion:reduce){.app .ip-skel{animation:none}}
`;

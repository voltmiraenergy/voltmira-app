"use client";
// components/portfolio/PlantDesigner.jsx — the site planner of a utility solar
// plant, built like the roof designer (components/SiteDesigner.jsx) and
// sharing its look: full screen, the satellite map on the left with the
// drawing tools floating over it, and three tabs on the right. 1, the plots
// the plant stands on (one or more); 2, the zones no table may stand on (a
// building, water, a road, a power line corridor, trees); 3, the panels: tilt,
// facing, table format and setback. The tables are laid out in rows as the
// shapes change (lib/siteLayout.js through lib/plantLayout.js), with the
// inverter stations, the cable and the grid connection point, and the result
// stays in view below the tabs. Everything is saved on the plant as it
// changes (plant.layout, and the tilt and facing on the equipment list).
// Leaflet and leaflet-geoman load inside an effect, as in SiteDesigner.
import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import "../SiteDesigner.css";
import { X, Undo2, Redo2, Pentagon, Ban, Ruler, Move, LocateFixed, Trash2, Check, Eye, ChevronRight, Sun, Info } from "lucide-react";
import { layoutInputs, layoutPlots } from "../../lib/plantLayout.js";
import { plotHectares, EXCLUSION_KINDS, TABLE_FORMATS, TRACKER_GCR_DEFAULT, TRACKER_GCR_RANGE, tableGeometry } from "../../lib/siteLayout.js";

/* --------------------------------------------------------------- words --- */
const TX = {
  title: { en: "Site plan", ro: "Plan de amplasare", ru: "План размещения", uk: "План розміщення" },
  undo: { en: "Undo", ro: "Anulează", ru: "Отменить", uk: "Скасувати" },
  redo: { en: "Redo", ro: "Refă", ru: "Повторить", uk: "Повторити" },
  close: { en: "Close", ro: "Închide", ru: "Закрыть", uk: "Закрити" },
  tools: { en: "Drawing tools", ro: "Unelte de desen", ru: "Инструменты", uk: "Інструменти" },
  t_plot: { en: "Plot", ro: "Teren", ru: "Участок", uk: "Ділянка" },
  t_excl: { en: "Keep-out zone", ro: "Zonă exclusă", ru: "Запретная зона", uk: "Заборонена зона" },
  t_measure: { en: "Measure", ro: "Măsoară", ru: "Измерить", uk: "Виміряти" },
  t_edit: { en: "Adjust shapes", ro: "Ajustează forme", ru: "Изменить формы", uk: "Змінити форми" },
  h_plot: { en: "Click each corner of the plot. Click the first corner again to close it.", ro: "Apasă pe fiecare colț al terenului. Apasă din nou pe primul colț ca să închizi forma.", ru: "Нажмите на каждый угол участка. Нажмите на первый угол ещё раз, чтобы замкнуть форму.", uk: "Натисніть на кожен кут ділянки. Натисніть на перший кут ще раз, щоб замкнути форму." },
  h_excl: { en: "Click around the area no table may stand on. Click the first point again to close it.", ro: "Apasă în jurul zonei pe care nu pot sta mese. Apasă din nou pe primul punct ca să închizi forma.", ru: "Обведите область, где не может стоять ни один стол. Нажмите на первую точку ещё раз, чтобы замкнуть.", uk: "Обведіть область, де не може стояти жоден стіл. Натисніть на першу точку ще раз, щоб замкнути." },
  h_measure: { en: "Click two points to measure the distance between them.", ro: "Apasă pe două puncte ca să măsori distanța dintre ele.", ru: "Щёлкните по двум точкам, чтобы измерить расстояние.", uk: "Клацніть по двох точках, щоб виміряти відстань." },
  h_measured: { en: "{d} m between the two points. Click two more to measure again.", ro: "{d} m între cele două puncte. Apasă pe alte două ca să măsori din nou.", ru: "{d} м между точками. Щёлкните ещё две, чтобы измерить снова.", uk: "{d} м між точками. Клацніть ще дві, щоб виміряти знову." },
  h_edit: { en: "Drag a corner to move it, or the dot between two corners to add one. Right-click a corner to remove it.", ro: "Trage un colț ca să-l muți sau punctul dintre două colțuri ca să adaugi unul. Click dreapta pe un colț ca să-l ștergi.", ru: "Перетащите угол, чтобы сдвинуть, или точку между углами, чтобы добавить. Правый клик по углу удаляет его.", uk: "Перетягніть кут, щоб зсунути, або точку між кутами, щоб додати. Правий клік по куту видаляє його." },
  cancel: { en: "Cancel", ro: "Anulează", ru: "Отмена", uk: "Скасувати" },
  done: { en: "Done", ro: "Gata", ru: "Готово", uk: "Готово" },
  lengths: { en: "Edge lengths", ro: "Lungimi laturi", ru: "Длины сторон", uk: "Довжини сторін" },
  recenter: { en: "Back to the site", ro: "Înapoi la amplasament", ru: "К площадке", uk: "До майданчика" },
  loading: { en: "Loading satellite imagery", ro: "Se încarcă imaginea din satelit", ru: "Загружаем спутниковый снимок", uk: "Завантажуємо супутниковий знімок" },
  loadError: { en: "The map did not load. Check the connection and open the planner again.", ro: "Harta nu s-a încărcat. Verifică conexiunea și deschide din nou planificatorul.", ru: "Карта не загрузилась. Проверьте связь и откройте планировщик снова.", uk: "Мапа не завантажилася. Перевірте зв'язок і відкрийте планувальник знову." },
  tab1: { en: "Plot", ro: "Teren", ru: "Участок", uk: "Ділянка" },
  tab2: { en: "Keep-out", ro: "Zone excluse", ru: "Запреты", uk: "Заборони" },
  tab3: { en: "Panels", ro: "Panouri", ru: "Панели", uk: "Панелі" },
  st1h: { en: "Outline the plot", ro: "Conturează terenul", ru: "Обведите участок", uk: "Обведіть ділянку" },
  st1p: { en: "Draw each plot the tables will stand on. A plant can have several; the one nearest the grid fills first.", ro: "Desenează fiecare parcelă pe care vor sta mesele. O centrală poate avea mai multe; cea mai apropiată de rețea se umple prima.", ru: "Нарисуйте каждый участок, где будут стоять столы. Их может быть несколько; ближайший к сети заполняется первым.", uk: "Намалюйте кожну ділянку, де стоятимуть столи. Їх може бути кілька; найближча до мережі заповнюється першою." },
  drawFirst: { en: "Draw the first plot", ro: "Desenează prima parcelă", ru: "Нарисовать первый участок", uk: "Намалювати першу ділянку" },
  drawMore: { en: "Add another plot", ro: "Adaugă încă o parcelă", ru: "Добавить участок", uk: "Додати ділянку" },
  drawCancel: { en: "Stop drawing", ro: "Oprește desenarea", ru: "Остановить рисование", uk: "Зупинити малювання" },
  how1: { en: "Click a corner of the plot on the map.", ro: "Apasă pe un colț al terenului, pe hartă.", ru: "Нажмите на угол участка на карте.", uk: "Натисніть на кут ділянки на мапі." },
  how2: { en: "Click the other corners, in order round it.", ro: "Apasă pe celelalte colțuri, pe rând.", ru: "Нажмите на остальные углы по порядку.", uk: "Натисніть на інші кути по черзі." },
  how3: { en: "Click the first corner again to close the shape.", ro: "Apasă din nou pe primul colț ca să închizi forma.", ru: "Нажмите на первый угол ещё раз, чтобы замкнуть форму.", uk: "Натисніть на перший кут ще раз, щоб замкнути форму." },
  plot: { en: "Plot {n}", ro: "Parcela {n}", ru: "Участок {n}", uk: "Ділянка {n}" },
  plotSum: { en: "{ha} ha, {t} tables", ro: "{ha} ha, {t} mese", ru: "{ha} га, {t} столов", uk: "{ha} га, {t} столів" },
  del: { en: "Delete {name}", ro: "Șterge {name}", ru: "Удалить: {name}", uk: "Видалити: {name}" },
  next2: { en: "Next: keep-out zones", ro: "Mai departe: zone excluse", ru: "Далее: запретные зоны", uk: "Далі: заборонені зони" },
  st2h: { en: "Mark what cannot be covered", ro: "Marchează ce nu poate fi acoperit", ru: "Отметьте, что нельзя занимать", uk: "Позначте, що не можна займати" },
  st2p: { en: "Buildings, water, roads, power line corridors, trees: no table stands on them, and the setback holds around them.", ro: "Clădiri, apă, drumuri, culoare de linii electrice, copaci: nicio masă nu stă pe ele, iar distanța de siguranță se păstrează în jurul lor.", ru: "Здания, вода, дороги, коридоры ЛЭП, деревья: столы на них не ставятся, и отступ сохраняется вокруг них.", uk: "Будівлі, вода, дороги, коридори ЛЕП, дерева: столи на них не ставлять, і відступ зберігається довкола них." },
  addExcl: { en: "Add a keep-out zone", ro: "Adaugă o zonă exclusă", ru: "Добавить запретную зону", uk: "Додати заборонену зону" },
  noneExcl: { en: "None yet. Skip this if the plot is clear.", ro: "Niciuna încă. Sari peste dacă terenul este liber.", ru: "Пока нет. Пропустите, если участок свободен.", uk: "Поки немає. Пропустіть, якщо ділянка вільна." },
  next3: { en: "Next: panels", ro: "Mai departe: panouri", ru: "Далее: панели", uk: "Далі: панелі" },
  st3h: { en: "Lay out the panels", ro: "Așază panourile", ru: "Расставьте панели", uk: "Розставте панелі" },
  st3p: { en: "Rows are spaced so none shades the next at noon on 21 December. The tilt and facing are saved on the equipment list too.", ro: "Rândurile sunt distanțate astfel încât niciunul să nu umbrească următorul la amiază pe 21 decembrie. Înclinarea și orientarea se salvează și în lista de echipamente.", ru: "Ряды разнесены так, чтобы ни один не затенял следующий в полдень 21 декабря. Наклон и ориентация сохраняются и в списке оборудования.", uk: "Ряди рознесено так, щоб жоден не затінював наступний опівдні 21 грудня. Нахил і орієнтація зберігаються і в списку обладнання." },
  mount: { en: "Mounting", ro: "Montaj", ru: "Монтаж", uk: "Монтаж" },
  mountFixed: { en: "Fixed tilt", ro: "Înclinare fixă", ru: "Фиксированный наклон", uk: "Фіксований нахил" },
  mountTracker: { en: "Tracker", ro: "Tracker", ru: "Трекер", uk: "Трекер" },
  gcr: { en: "Ground-cover target", ro: "Ținta de acoperire a solului", ru: "Целевой коэффициент покрытия", uk: "Цільовий коефіцієнт покриття" },
  gcrHelp: { en: "A single-axis tracker's rows run north-south and tilt with the sun; this sets how close together they stand.", ro: "Rândurile unui tracker pe o axă merg nord-sud și se înclină după soare; aceasta stabilește cât de aproape stau unele de altele.", ru: "Ряды однокоординатного трекера идут с севера на юг и наклоняются вслед за солнцем; это задаёт, насколько близко они стоят друг к другу.", uk: "Ряди однокоординатного трекера йдуть з півночі на південь і нахиляються за сонцем; це задає, наскільки близько вони стоять одне до одного." },
  tilt: { en: "Tilt", ro: "Înclinare", ru: "Наклон", uk: "Нахил" },
  facing: { en: "Facing", ro: "Orientare", ru: "Ориентация", uk: "Орієнтація" },
  facesDir: { en: "Faces {dir}", ro: "Orientat spre {dir}", ru: "Смотрит на {dir}", uk: "Дивиться на {dir}" },
  exact: { en: "Exact azimuth", ro: "Azimut exact", ru: "Точный азимут", uk: "Точний азимут" },
  exactHelp: { en: "0 is south, -90 east, 90 west.", ro: "0 este sud, -90 est, 90 vest.", ru: "0 юг, -90 восток, 90 запад.", uk: "0 південь, -90 схід, 90 захід." },
  format: { en: "Table", ro: "Masă", ru: "Стол", uk: "Стіл" },
  formatV: { en: "{h} up x {w} along", ro: "{h} pe înălțime x {w} pe lungime", ru: "{h} в высоту x {w} в длину", uk: "{h} у висоту x {w} у довжину" },
  setback: { en: "Distance from the boundary", ro: "Distanța față de limită", ru: "Отступ от границы", uk: "Відступ від межі" },
  rowInfo: { en: "Rows {p} m apart, ground cover {g}; a table is {w} x {d} m on the ground, {m} modules.", ro: "Rânduri la {p} m, grad de acoperire {g}; o masă ocupă {w} x {d} m pe sol, {m} module.", ru: "Ряды через {p} м, коэффициент покрытия {g}; стол занимает {w} x {d} м, {m} модулей.", uk: "Ряди через {p} м, коефіцієнт покриття {g}; стіл займає {w} x {d} м, {m} модулів." },
  assumed: { en: "Modules of {wp} Wp are assumed: enter them in the equipment list to use your own.", ro: "Sunt presupuse module de {wp} Wp: introdu-le în lista de echipamente ca să folosești cifrele tale.", ru: "Приняты модули по {wp} Вт пик: введите свои в списке оборудования.", uk: "Прийнято модулі по {wp} Вт пік: введіть свої у списку обладнання." },
  resultEmpty: { en: "Draw a plot and the tables that fit on it appear here.", ro: "Desenează o parcelă și aici apar mesele care încap pe ea.", ru: "Нарисуйте участок, и здесь появятся столы, которые на нём помещаются.", uk: "Намалюйте ділянку, і тут з'являться столи, що на ній вміщуються." },
  tables: { en: "tables", ro: "mese", ru: "столов", uk: "столів" },
  need: { en: "The plant needs {need} MWp; the plots hold {fit} MWp on {ha} ha.", ro: "Centrala are nevoie de {need} MWp; parcelele cuprind {fit} MWp pe {ha} ha.", ru: "Станции нужно {need} МВтп; участки вмещают {fit} МВтп на {ha} га.", uk: "Станції потрібно {need} МВтп; ділянки вміщують {fit} МВтп на {ha} га." },
  short: { en: "The plots are too small: {miss} MWp does not fit. Add a plot, lower the tilt or the distance from the boundary.", ro: "Parcelele sunt prea mici: {miss} MWp nu încap. Adaugă o parcelă, micșorează înclinarea sau distanța față de limită.", ru: "Участки малы: {miss} МВтп не помещается. Добавьте участок, уменьшите наклон или отступ.", uk: "Ділянки замалі: {miss} МВтп не вміщується. Додайте ділянку, зменште нахил або відступ." },
  grid: { en: "{n} inverter stations, about {m} m of medium-voltage cable to the connection point.", ro: "{n} stații de invertoare, circa {m} m de cablu de medie tensiune până la punctul de racordare.", ru: "{n} инверторных станций, около {m} м кабеля среднего напряжения до точки присоединения.", uk: "{n} інверторних станцій, близько {m} м кабелю середньої напруги до точки приєднання." },
  turbinesFit: { en: "Wind: {n} of {need} turbines fit, rotor about {d} m, each with a {r} m keep-out circle.", ro: "Vânt: încap {n} din {need} turbine, rotor de circa {d} m, fiecare cu un cerc de siguranță de {r} m.", ru: "Ветер: помещается {n} из {need} турбин, ротор около {d} м, у каждой защитный круг {r} м.", uk: "Вітер: вміщується {n} з {need} турбін, ротор близько {d} м, у кожної захисне коло {r} м." },
  turbinesShort: { en: "Not every turbine fits: {n} of {need}. Add a plot or move the keep-out zones.", ro: "Nu încap toate turbinele: {n} din {need}. Adaugă o parcelă sau mută zonele excluse.", ru: "Не все турбины помещаются: {n} из {need}. Добавьте участок или передвиньте запретные зоны.", uk: "Не всі турбіни вміщуються: {n} з {need}. Додайте ділянку або пересуньте заборонені зони." },
  apply: { en: "Save the plan", ro: "Salvează planul", ru: "Сохранить план", uk: "Зберегти план" },
  saved: { en: "Saved with the plant. It goes into the credit summary and the report.", ro: "Salvat cu centrala. Intră în fișa de credit și în raport.", ru: "Сохранено со станцией. Попадёт в кредитную справку и отчёт.", uk: "Збережено зі станцією. Потрапить у кредитну довідку та звіт." },
};
const KIND = {
  building: { en: "Building", ro: "Clădire", ru: "Здание", uk: "Будівля" },
  water: { en: "Water", ro: "Apă", ru: "Вода", uk: "Вода" },
  road: { en: "Road", ro: "Drum", ru: "Дорога", uk: "Дорога" },
  line: { en: "Power line corridor", ro: "Culoar de linie electrică", ru: "Коридор ЛЭП", uk: "Коридор ЛЕП" },
  trees: { en: "Trees", ro: "Copaci", ru: "Деревья", uk: "Дерева" },
  other: { en: "Something else", ro: "Altceva", ru: "Другое", uk: "Інше" },
};
// The eight directions, as PVGIS azimuths (0 = south, -90 = east), north at the top.
const DIRS = [
  { az: 135, en: "NW", ro: "NV", ru: "СЗ", uk: "ПнЗх" }, { az: 180, en: "N", ro: "N", ru: "С", uk: "Пн" }, { az: -135, en: "NE", ro: "NE", ru: "СВ", uk: "ПнСх" },
  { az: 90, en: "W", ro: "V", ru: "З", uk: "Зх" }, null, { az: -90, en: "E", ro: "E", ru: "В", uk: "Сх" },
  { az: 45, en: "SW", ro: "SV", ru: "ЮЗ", uk: "ПдЗх" }, { az: 0, en: "S", ro: "S", ru: "Ю", uk: "Пд" }, { az: -45, en: "SE", ro: "SE", ru: "ЮВ", uk: "ПдСх" },
];
const DIR_NAME = {
  0: { en: "south", ro: "sud", ru: "юг", uk: "південь" }, 45: { en: "south-west", ro: "sud-vest", ru: "юго-запад", uk: "південний захід" },
  90: { en: "west", ro: "vest", ru: "запад", uk: "захід" }, 135: { en: "north-west", ro: "nord-vest", ru: "северо-запад", uk: "північний захід" },
  180: { en: "north", ro: "nord", ru: "север", uk: "північ" }, "-45": { en: "south-east", ro: "sud-est", ru: "юго-восток", uk: "південний схід" },
  "-90": { en: "east", ro: "est", ru: "восток", uk: "схід" }, "-135": { en: "north-east", ro: "nord-est", ru: "северо-восток", uk: "північний схід" },
};
const angleGap = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
const nearestDir = (az) => DIRS.filter(Boolean).reduce((best, d) => (angleGap(d.az, az) < angleGap(best.az, az) ? d : best));

const PLOT_STYLE = { color: "#2E9A5E", weight: 2, fillColor: "#2E9A5E", fillOpacity: 0.1 };
const PLOT_ON = { color: "#E89B2D", weight: 3, fillColor: "#E89B2D", fillOpacity: 0.08 };
const EXCL_STYLE = { color: "#C4543B", weight: 2, fillColor: "#C4543B", fillOpacity: 0.35, dashArray: "6 4" };
const PIN_SVG = `<svg class="sd-pin" viewBox="0 0 32 40" aria-hidden="true"><path d="M16 39s13-12.4 13-23A13 13 0 0 0 3 16c0 10.6 13 23 13 23z" fill="#E89B2D" stroke="#fff" stroke-width="2"/><circle cx="16" cy="16" r="5" fill="#142A21"/></svg>`;
const SAT = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

function uid() { return Math.random().toString(36).slice(2, 10); }
function ringOf(layer) { return (layer.getLatLngs()[0] || []).map((ll) => [Math.round(ll.lat * 1e6) / 1e6, Math.round(ll.lng * 1e6) / 1e6]); }
// Screen-upright bearing from a to b, so an edge's length label runs along the edge.
function edgeAngle(map, a, b) {
  const p = map.latLngToContainerPoint(a), q = map.latLngToContainerPoint(b);
  let d = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
  if (d > 90) d -= 180; if (d < -90) d += 180;
  return d;
}
// One SVG pattern of module cells as the fill of every table, so a thousand tables cost what plain shapes do.
function ensureTablePattern(map, high, wide) {
  const svg = map.getPanes().overlayPane.querySelector("svg");
  if (!svg) return;
  const NS = "http://www.w3.org/2000/svg";
  let defs = svg.querySelector("defs");
  if (!defs) { defs = document.createElementNS(NS, "defs"); svg.insertBefore(defs, svg.firstChild); }
  let pattern = svg.querySelector("#pdTableCells");
  if (!pattern) {
    pattern = document.createElementNS(NS, "pattern");
    pattern.setAttribute("id", "pdTableCells");
    pattern.setAttribute("patternUnits", "objectBoundingBox");
    pattern.setAttribute("patternContentUnits", "objectBoundingBox");
    const bg = document.createElementNS(NS, "rect");
    bg.setAttribute("width", "1"); bg.setAttribute("height", "1"); bg.setAttribute("fill", "#0F2A4A");
    const shine = document.createElementNS(NS, "rect");
    shine.setAttribute("x", "0.1"); shine.setAttribute("y", "0.1"); shine.setAttribute("width", "0.5"); shine.setAttribute("height", "0.3");
    shine.setAttribute("fill", "#3D6FA8"); shine.setAttribute("opacity", "0.4");
    const grid = document.createElementNS(NS, "rect");
    grid.setAttribute("width", "1"); grid.setAttribute("height", "1"); grid.setAttribute("fill", "none");
    grid.setAttribute("stroke", "#4A7FB5"); grid.setAttribute("stroke-width", "0.08");
    pattern.append(bg, shine, grid);
    defs.appendChild(pattern);
  }
  pattern.setAttribute("width", String(1 / wide));
  pattern.setAttribute("height", String(1 / high));
}

/**
 * @param {object} p
 * @param {string} p.lang
 * @param {object} p.pl       the plant, normalised (lib/plantFinance.js)
 * @param {string} p.subtitle the plant's name and locality
 * @param {(patch:{layout:object|null, angles?:{tilt:number, azimuth:number}}) => void} p.onSave
 * @param {() => void} p.onClose
 */
export default function PlantDesigner({ lang = "en", pl, subtitle = "", onSave, onClose }) {
  const tr = (k, vars) => { let s = (TX[k] && (TX[k][lang] || TX[k].en)) || k; if (vars) for (const [a, b] of Object.entries(vars)) s = s.split(`{${a}}`).join(String(b)); return s; };
  const L3 = (o) => o[lang] || o.en;
  const loc = { en: "en-GB", ru: "ru-RU", uk: "uk-UA" }[lang] || "ro-RO";
  const nf = (n, d = 0) => Number(n).toLocaleString(loc, { maximumFractionDigits: d, minimumFractionDigits: d });

  const base = useMemo(() => layoutInputs(pl), [pl]);
  const site = base.site;
  const saved = pl.layout || {};
  const [tilt, setTilt] = useState(Math.round(base.inputs.tiltDeg));
  const [az, setAz] = useState(Math.round(base.inputs.azimuthDeg));
  const [mountKind, setMountKind] = useState(base.inputs.tracker ? "tracker" : "fixed");
  const [gcr, setGcr] = useState(saved.trackerGcr ?? TRACKER_GCR_DEFAULT);
  const [fmt, setFmt] = useState(Math.max(0, TABLE_FORMATS.findIndex((t) => t.high === (saved.high || 2) && t.wide === (saved.wide || 26))));
  const [setback, setSetback] = useState(saved.setbackM ?? 5);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [tool, setTool] = useState(null);
  const [measure, setMeasure] = useState(null);
  const [showDims, setShowDims] = useState(true);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [shapes, setShapes] = useState({ plots: [], exclusions: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [step, setStep] = useState(saved.plots?.length ? 3 : 1);
  const [result, setResult] = useState(null);

  const shellRef = useRef(null);
  const stageRef = useRef(null);
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const Lref = useRef(null);
  const plotLayers = useRef(new Map());
  const exclLayers = useRef(new Map());
  const panelGroup = useRef(null);
  const dimGroup = useRef(null);
  const measureLayer = useRef(null);
  const measurePts = useRef([]);
  const pendingKind = useRef(null);
  const toolRef = useRef(null);
  const selectedRef = useRef(null);
  const showDimsRef = useRef(true);
  const timer = useRef(null);
  const api = useRef({});
  // the mounting (tilt, facing, or tracker and its ground-cover target) goes on the equipment list only once the user has set it here
  const mountTouched = useRef(false);
  const settingsTouched = useRef(false);
  const settingsRef = useRef({ tilt, az, mountKind, gcr, fmt, setback });
  const onSaveRef = useRef(onSave);
  const onCloseRef = useRef(onClose);
  const baseRef = useRef(base);
  useEffect(() => {
    settingsRef.current = { tilt, az, mountKind, gcr, fmt, setback };
    onSaveRef.current = onSave; onCloseRef.current = onClose; baseRef.current = base;
  });

  // Escape ends a tool or closes; Ctrl+Z / Ctrl+Shift+Z undo and redo; Delete removes the selected shape.
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); if (toolRef.current) api.current.endTool?.(); else onCloseRef.current?.(); return; }
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName || "")) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); if (e.shiftKey) api.current.redo?.(); else api.current.undo?.(); }
      else if ((e.ctrlKey || e.metaKey) && k === "y") { e.preventDefault(); api.current.redo?.(); }
      else if ((e.key === "Delete" || e.key === "Backspace") && selectedRef.current && !toolRef.current) { e.preventDefault(); api.current.removeShape?.(selectedRef.current); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The page behind stays put while the planner is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    shellRef.current?.focus();
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const history = { list: [], index: -1, restoring: false };

    function styleOf(layer) {
      if (layer._pdKind === "plot") return layer._pdId === selectedRef.current ? PLOT_ON : PLOT_STYLE;
      return layer._pdId === selectedRef.current ? { ...EXCL_STYLE, weight: 4 } : EXCL_STYLE;
    }
    function restyle() {
      for (const l of plotLayers.current.values()) l.setStyle(styleOf(l));
      for (const l of exclLayers.current.values()) l.setStyle(styleOf(l));
    }
    function selectFromMap(ev, id) {
      if (toolRef.current && toolRef.current !== "edit") return;
      Lref.current.DomEvent.stop(ev);
      setSelectedId(id);
      setStep(plotLayers.current.has(id) ? 1 : 2);
    }
    function attach(layer, id, kind, exclKind = "other") {
      layer._pdKind = kind; layer._pdId = id;
      if (kind === "excl") layer._pdExcl = EXCLUSION_KINDS.includes(exclKind) ? exclKind : "other";
      layer.setStyle(styleOf(layer));
      layer.on("pm:edit", () => commit());
      layer.on("click", (ev) => selectFromMap(ev, id));
      (kind === "plot" ? plotLayers : exclLayers).current.set(id, layer);
    }
    function renderDims() {
      const map = mapRef.current, L = Lref.current;
      if (!map || !L) return;
      if (!dimGroup.current) dimGroup.current = L.layerGroup().addTo(map);
      dimGroup.current.clearLayers();
      if (!showDimsRef.current || map.getZoom() < 15) return;
      for (const layer of [...plotLayers.current.values(), ...exclLayers.current.values()]) {
        const ring = ringOf(layer);
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i], b = ring[(i + 1) % ring.length];
          if (map.latLngToContainerPoint(a).distanceTo(map.latLngToContainerPoint(b)) < 60) continue;
          const icon = L.divIcon({ className: "sd-dim-icon", html: `<div class="sd-dim-label" style="transform:rotate(${edgeAngle(map, a, b).toFixed(1)}deg)">${nf(map.distance(L.latLng(a), L.latLng(b)), 0)} m</div>`, iconSize: [64, 18], iconAnchor: [32, 9] });
          L.marker([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], { icon, interactive: false, pmIgnore: true, keyboard: false }).addTo(dimGroup.current);
        }
      }
    }
    function snapshot() {
      return {
        plots: [...plotLayers.current.entries()].map(([id, l]) => ({ id, ring: ringOf(l) })),
        exclusions: [...exclLayers.current.entries()].map(([id, l]) => ({ id, ring: ringOf(l), kind: l._pdExcl })),
      };
    }
    function mirror() {
      const s = snapshot();
      setShapes({ plots: s.plots.map((p) => ({ id: p.id, ha: plotHectares(p.ring) })), exclusions: s.exclusions.map((e) => ({ id: e.id, kind: e.kind })) });
    }
    function clearAll() {
      const map = mapRef.current;
      for (const l of [...plotLayers.current.values(), ...exclLayers.current.values()]) map.removeLayer(l);
      plotLayers.current.clear(); exclLayers.current.clear();
    }
    function load(snap) {
      const L = Lref.current, map = mapRef.current;
      clearAll();
      (snap?.plots || []).forEach((p) => { if (p.ring?.length >= 3) attach(L.polygon(p.ring).addTo(map), p.id || uid(), "plot"); });
      (snap?.exclusions || []).forEach((e) => { if (e.ring?.length >= 3) attach(L.polygon(e.ring).addTo(map), e.id || uid(), "excl", e.kind); });
      if (selectedRef.current && !plotLayers.current.has(selectedRef.current) && !exclLayers.current.has(selectedRef.current)) setSelectedId(null);
      mirror();
      renderDims();
    }
    // What is saved on the plant: the plots, the zones, the table format, the setback, the ground-cover target; the mounting goes on the equipment list.
    function save(snap) {
      const s = settingsRef.current, f = TABLE_FORMATS[s.fmt] || TABLE_FORMATS[0];
      const layout = snap.plots.length ? { plots: snap.plots.map((p) => p.ring), exclusions: snap.exclusions.map((e) => ({ ring: e.ring, kind: e.kind })), high: f.high, wide: f.wide, setbackM: s.setback, trackerGcr: s.gcr } : null;
      const mounting = mountTouched.current ? (s.mountKind === "tracker" ? { kind: "tracker" } : { kind: "fixed", tiltDeg: s.tilt, azimuthDeg: s.az }) : null;
      onSaveRef.current?.({ layout, mounting });
    }
    function pushHistory(snap) {
      if (history.restoring) return;
      history.list = history.list.slice(0, history.index + 1);
      history.list.push(snap);
      while (history.list.length > 60) history.list.shift();
      history.index = history.list.length - 1;
      setCanUndo(history.index > 0); setCanRedo(false);
    }
    function restore(i) {
      history.restoring = true;
      history.index = i;
      load(history.list[i]);
      save(history.list[i]);
      history.restoring = false;
      setCanUndo(history.index > 0); setCanRedo(history.index < history.list.length - 1);
      schedule(0);
    }
    const undo = () => { if (history.index > 0) restore(history.index - 1); };
    const redo = () => { if (history.index < history.list.length - 1) restore(history.index + 1); };
    // A shape changed: save it, remember it for undo, and lay the tables out again after a short pause.
    function commit() {
      const snap = snapshot();
      mirror();
      save(snap);
      renderDims();
      pushHistory(snap);
      panelGroup.current?.clearLayers();
      schedule(300);
    }
    function schedule(ms) { clearTimeout(timer.current); timer.current = setTimeout(() => api.current.run?.(), ms); }

    function endTool() {
      const map = mapRef.current;
      if (map) {
        map.pm.disableDraw();
        if (map.pm.globalEditModeEnabled()) map.pm.disableGlobalEditMode();
        map.getContainer().style.cursor = "";
      }
      pendingKind.current = null;
      measurePts.current = [];
      if (measureLayer.current && map) { map.removeLayer(measureLayer.current); measureLayer.current = null; }
      toolRef.current = null;
      setTool(null); setMeasure(null);
    }
    function startTool(next) {
      endTool();
      const map = mapRef.current;
      if (!next || !map) return;
      if (next === "plot" || next === "excl") {
        pendingKind.current = next;
        map.pm.enableDraw("Polygon", { pathOptions: next === "plot" ? PLOT_ON : EXCL_STYLE, snappable: true, snapDistance: 14, templineStyle: { color: "#E89B2D" }, hintlineStyle: { color: "#E89B2D", dashArray: [5, 5] } });
      } else if (next === "measure") {
        map.getContainer().style.cursor = "crosshair";
      } else if (next === "edit") {
        map.pm.enableGlobalEditMode({ allowSelfIntersection: false, snappable: true });
      }
      toolRef.current = next;
      setTool(next);
    }
    function removeShape(id) {
      const map = mapRef.current;
      const l = plotLayers.current.get(id) || exclLayers.current.get(id);
      if (!l || !map) return;
      map.removeLayer(l);
      plotLayers.current.delete(id); exclLayers.current.delete(id);
      if (selectedRef.current === id) setSelectedId(null);
      commit();
    }
    function focusShape(id) {
      const l = plotLayers.current.get(id) || exclLayers.current.get(id);
      if (l && mapRef.current) mapRef.current.fitBounds(l.getBounds(), { padding: [60, 60], maxZoom: 19 });
    }
    function recenter() {
      const map = mapRef.current, L = Lref.current;
      if (!map || !L) return;
      if (plotLayers.current.size) map.fitBounds(L.featureGroup([...plotLayers.current.values()]).getBounds(), { padding: [60, 60], maxZoom: 18 });
      else if (site) map.setView([site.lat, site.lon], 16);
    }
    function setExclKind(id, kind) {
      const l = exclLayers.current.get(id);
      if (!l) return;
      l._pdExcl = kind;
      commit();
    }
    function setDims(on) { showDimsRef.current = on; renderDims(); }

    // The tables, the stations, the cable and the connection point for what is drawn now.
    function run() {
      const map = mapRef.current, L = Lref.current;
      if (!map || !L) return;
      const snap = snapshot();
      const s = settingsRef.current, f = TABLE_FORMATS[s.fmt] || TABLE_FORMATS[0];
      if (!panelGroup.current) panelGroup.current = L.layerGroup().addTo(map);
      panelGroup.current.clearLayers();
      if (!snap.plots.length) { setResult(null); return; }
      const inputs = { ...baseRef.current.inputs, tiltDeg: s.tilt, azimuthDeg: s.az, tracker: s.mountKind === "tracker", trackerGcr: s.gcr, high: f.high, wide: f.wide, setbackM: s.setback };
      const r = layoutPlots(snap.plots.map((p) => p.ring), snap.exclusions, inputs);
      setResult(r ? { ...r, inputs } : null);
      if (!r) return;
      ensureTablePattern(map, f.high, f.wide);
      // the wind turbines this plant also stands on, with their keep-out circle, drawn first so the tables sit visibly around them
      for (const t of r.turbines) {
        L.polygon(t.exclusion, { color: "#0EA5E9", weight: 1.5, dashArray: "4 4", fillColor: "#0EA5E9", fillOpacity: 0.08, interactive: false, pmIgnore: true }).addTo(panelGroup.current);
        L.marker([t.lat, t.lon], { icon: L.divIcon({ className: "pd-tb-wrap", html: `<span class="pd-tb">T${t.n}</span>`, iconSize: [26, 22], iconAnchor: [13, 11] }), interactive: false, keyboard: false, pmIgnore: true }).addTo(panelGroup.current);
      }
      for (const t of r.tables) L.polygon(t.corners, { color: "#B9C4CE", weight: 0.6, fillColor: "url(#pdTableCells)", fillOpacity: 1, interactive: false, pmIgnore: true }).addTo(panelGroup.current);
      for (const c of r.cables) L.polyline(c, { color: "#FF9F1C", weight: 2.5, dashArray: "6 4", interactive: false, pmIgnore: true }).addTo(panelGroup.current);
      for (const st of r.stations) {
        L.polygon(st.corners, { color: "#ffffff", weight: 1.5, fillColor: "#D946EF", fillOpacity: 1, interactive: false, pmIgnore: true }).addTo(panelGroup.current);
        L.marker(st.center, { icon: L.divIcon({ className: "pd-st-wrap", html: `<span class="pd-st">${st.n}</span>`, iconSize: [22, 22], iconAnchor: [-4, 24] }), interactive: false, keyboard: false, pmIgnore: true }).addTo(panelGroup.current);
      }
      L.circleMarker([r.connection.lat, r.connection.lon], { radius: 7, color: "#ffffff", weight: 2.5, fillColor: "#E11D48", fillOpacity: 1, interactive: false, pmIgnore: true }).addTo(panelGroup.current);
    }
    api.current = { ...api.current, undo, redo, startTool, endTool, removeShape, focusShape, recenter, setExclKind, setDims, restyle, schedule, run, save: () => save(snapshot()) };

    async function init() {
      // leaflet-geoman expects a global L, as in SiteDesigner
      const { default: L } = await import("leaflet");
      if (cancelled || !mapEl.current) return;
      window.L = L;
      await import("@geoman-io/leaflet-geoman-free");
      await import("@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css");
      if (cancelled || !mapEl.current) return;
      Lref.current = L;
      const map = L.map(mapEl.current, { zoomControl: false, maxZoom: 20 });
      mapRef.current = map;
      L.control.zoom({ position: "bottomright" }).addTo(map);
      map.pm.setLang(lang === "ru" ? "ru" : lang === "uk" ? "ua" : lang === "ro" ? "ro" : "en");
      // Esri has nothing past about z18 over most of Moldova: it upscales the last real tile instead
      L.tileLayer(SAT, { maxZoom: 20, maxNativeZoom: 18, attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics" }).addTo(map);
      if (site) {
        map.setView([site.lat, site.lon], 16);
        L.marker([site.lat, site.lon], { icon: L.divIcon({ className: "sd-pin-wrap", html: PIN_SVG, iconSize: [32, 40], iconAnchor: [16, 39] }), interactive: false, keyboard: false, pmIgnore: true, zIndexOffset: -100 }).addTo(map);
      }
      load({ plots: (saved.plots || []).map((ring) => ({ id: uid(), ring })), exclusions: (saved.exclusions || []).map((e) => ({ id: uid(), ring: e.ring, kind: e.kind })) });
      history.list = [snapshot()]; history.index = 0;
      if (plotLayers.current.size) map.fitBounds(L.featureGroup([...plotLayers.current.values()]).getBounds(), { padding: [60, 60], maxZoom: 18 });

      map.on("pm:create", (e) => {
        if (e.shape !== "Polygon") return;
        const id = uid();
        const kind = pendingKind.current || "plot";
        attach(e.layer, id, kind, "other");
        endTool();
        selectedRef.current = id;
        setSelectedId(id);
        setStep(kind === "plot" ? 1 : 2);
        restyle();
        commit();
      });
      map.on("click", (e) => {
        if (toolRef.current === "measure") {
          measurePts.current.push(e.latlng);
          if (measureLayer.current) { map.removeLayer(measureLayer.current); measureLayer.current = null; }
          if (measurePts.current.length === 1) {
            setMeasure(null);
            measureLayer.current = L.circleMarker(e.latlng, { radius: 5, color: "#fff", weight: 2, fillColor: "#E89B2D", fillOpacity: 1, pmIgnore: true, interactive: false }).addTo(map);
          } else {
            const [p1, p2] = measurePts.current;
            measureLayer.current = L.polyline([p1, p2], { color: "#E89B2D", weight: 3, dashArray: "6 6", pmIgnore: true, interactive: false }).addTo(map);
            setMeasure(map.distance(p1, p2));
            measurePts.current = [];
          }
          return;
        }
        if (!toolRef.current) setSelectedId(null);
      });
      map.on("zoomend", renderDims);
      setReady(true);
      schedule(50);
    }
    init().catch((e) => {
      if (cancelled) return;
      console.error("PlantDesigner failed to load:", e?.message || e);
      setLoadError(true);
    });
    const plots = plotLayers.current, excl = exclLayers.current;
    return () => {
      cancelled = true;
      clearTimeout(timer.current);
      mapRef.current?.remove();
      mapRef.current = null;
      plots.clear(); excl.clear();
      panelGroup.current = null; dimGroup.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapEl.current || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => mapRef.current?.invalidateSize());
    ro.observe(mapEl.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    selectedRef.current = selectedId;
    api.current.restyle?.();
    if (selectedId) document.getElementById("pd-item-" + selectedId)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  // a setting moved: save it and lay the tables out again (a slider sends many small moves)
  useEffect(() => {
    if (!ready || !settingsTouched.current) return;
    const id = setTimeout(() => { api.current.save?.(); api.current.run?.(); }, 220);
    return () => clearTimeout(id);
  }, [tilt, az, mountKind, gcr, fmt, setback, ready]);

  const touch = (mounting) => { settingsTouched.current = true; if (mounting) mountTouched.current = true; };
  const putTilt = (v) => { touch(true); setTilt(v); };
  const putAz = (v) => { touch(true); setAz(v); };
  const putMountKind = (v) => { touch(true); setMountKind(v); };
  const putGcr = (v) => { touch(true); setGcr(v); };
  const putFmt = (v) => { touch(false); setFmt(v); };
  const putSetback = (v) => { touch(false); setSetback(v); };

  /* ------------------------------------------------------------- render --- */
  const TOOLS = [
    { id: "plot", Icon: Pentagon, label: tr("t_plot") },
    { id: "excl", Icon: Ban, label: tr("t_excl") },
    "sep",
    { id: "measure", Icon: Ruler, label: tr("t_measure") },
    { id: "edit", Icon: Move, label: tr("t_edit") },
  ];
  const TOOL_TAB = { plot: 1, excl: 2 };
  const pick = (id) => {
    const next = tool === id ? null : id;
    if (next && TOOL_TAB[next]) setStep(TOOL_TAB[next]);
    api.current.startTool?.(next);
    const r = stageRef.current?.getBoundingClientRect();
    if (next && r && (r.top < 0 || r.bottom > window.innerHeight + 1)) stageRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const hasPlots = shapes.plots.length > 0;
  const hasExcl = shapes.exclusions.length > 0;
  const fits = !!result && result.tables.length > 0;
  const tabDone = { 1: hasPlots, 2: hasExcl, 3: fits };
  let hint = null;
  if (tool === "plot") hint = tr("h_plot");
  else if (tool === "excl") hint = tr("h_excl");
  else if (tool === "measure") hint = tr("h_measure");
  else if (tool === "edit") hint = tr("h_edit");
  const dir = nearestDir(az);
  const f = TABLE_FORMATS[fmt] || TABLE_FORMATS[0];
  const tracker = mountKind === "tracker";
  const geo = site ? tableGeometry(base.inputs.wp, tilt, site.lat, { wide: f.wide, high: f.high, tracker, trackerGcr: gcr }) : null;
  const perPlot = (i) => result?.plots?.find((p) => p.k === i)?.stats.placedTables ?? 0;
  const s = result?.stats;
  const hasWind = !!base.inputs.wind;

  return (
    <div className="sd-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <section className="sd-shell" role="dialog" aria-modal="true" aria-labelledby="pd-title" ref={shellRef} tabIndex={-1}>
        <header className="sd-head">
          <span className="sd-head-ic" aria-hidden="true"><Sun size={20} /></span>
          <div className="sd-head-tx">
            <h2 id="pd-title">{tr("title")}</h2>
            <p>{subtitle}</p>
          </div>
          <div className="sd-head-acts">
            <button type="button" className="sd-ibtn" disabled={!ready || !canUndo} onClick={() => api.current.undo?.()} aria-label={tr("undo")} title={tr("undo") + " (Ctrl+Z)"}><Undo2 size={19} /></button>
            <button type="button" className="sd-ibtn" disabled={!ready || !canRedo} onClick={() => api.current.redo?.()} aria-label={tr("redo")} title={tr("redo") + " (Ctrl+Shift+Z)"}><Redo2 size={19} /></button>
            <span className="sd-head-sep" aria-hidden="true" />
            <button type="button" className="sd-ibtn" onClick={() => onClose?.()} aria-label={tr("close")} title={tr("close") + " (Esc)"}><X size={20} /></button>
          </div>
        </header>

        <div className="sd-body">
          {/* ------------------------------------------------------ map */}
          <div className="sd-stage" ref={stageRef}>
            <div ref={mapEl} className="sd-map" />
            {ready && (
              <div className="sd-tools" role="toolbar" aria-label={tr("tools")}>
                {TOOLS.map((tl, i) => tl === "sep"
                  ? <span key={"sep" + i} className="sd-tool-sep" aria-hidden="true" />
                  : (
                    <button key={tl.id} type="button" className={"sd-tool" + (tool === tl.id ? " on" : "")} aria-pressed={tool === tl.id} onClick={() => pick(tl.id)} title={tl.label}>
                      <tl.Icon size={18} aria-hidden="true" /><span>{tl.label}</span>
                    </button>
                  ))}
              </div>
            )}
            {hint && (
              <div className="sd-hint" role="status">
                <div className="sd-hint-tx">{tool === "measure" && measure != null ? tr("h_measured", { d: nf(measure, 1) }) : hint}</div>
                <button type="button" className="sd-hint-end" onClick={() => api.current.endTool?.()}>{tool === "edit" || tool === "measure" ? tr("done") : tr("cancel")}</button>
              </div>
            )}
            {ready && (
              <div className="sd-mapctl">
                <button type="button" className={"sd-chip" + (showDims ? " on" : "")} aria-pressed={showDims}
                  onClick={() => { const on = !showDims; setShowDims(on); api.current.setDims?.(on); }}>
                  <Eye size={16} aria-hidden="true" />{tr("lengths")}
                </button>
                <button type="button" className="sd-chip" onClick={() => api.current.recenter?.()}><LocateFixed size={16} aria-hidden="true" />{tr("recenter")}</button>
              </div>
            )}
            {!ready && <div className="sd-loading" role="status">{loadError ? tr("loadError") : tr("loading")}</div>}
          </div>

          {/* --------------------------------------------- the three tabs */}
          <aside className="sd-side">
            <nav className="sd-tabs" role="tablist" aria-label={tr("title")}>
              {[1, 2, 3].map((n) => (
                <button key={n} type="button" role="tab" id={"pd-tab-" + n} aria-selected={step === n} aria-controls="pd-tabpanel"
                  className={"sd-tab" + (step === n ? " on" : "") + (tabDone[n] ? " done" : "")} onClick={() => setStep(n)}>
                  <span className="sd-tab-n" aria-hidden="true">{tabDone[n] ? <Check size={14} strokeWidth={3} /> : n}</span>
                  <span className="sd-tab-tx">{tr("tab" + n)}</span>
                </button>
              ))}
            </nav>

            <div className="sd-scroll" id="pd-tabpanel" role="tabpanel" aria-labelledby={"pd-tab-" + step}>
              {step === 1 && (
                <>
                  <header className="sd-step-h"><h3>{tr("st1h")}</h3><p>{tr("st1p")}</p></header>
                  <button type="button" className={"sd-btn big" + (tool === "plot" ? " on" : " primary")} onClick={() => pick("plot")} disabled={!ready}>
                    {tool === "plot" ? <><X size={19} aria-hidden="true" />{tr("drawCancel")}</> : <><Pentagon size={19} aria-hidden="true" />{hasPlots ? tr("drawMore") : tr("drawFirst")}</>}
                  </button>
                  {(tool === "plot" || !hasPlots) && (
                    <ol className="sd-how">
                      <li><span aria-hidden="true">1</span>{tr("how1")}</li>
                      <li><span aria-hidden="true">2</span>{tr("how2")}</li>
                      <li><span aria-hidden="true">3</span>{tr("how3")}</li>
                    </ol>
                  )}
                  {hasPlots && (
                    <ul className="sd-list">
                      {shapes.plots.map((p, i) => {
                        const name = tr("plot", { n: i + 1 });
                        return (
                          <li key={p.id} id={"pd-item-" + p.id} className={"sd-row" + (selectedId === p.id ? " on" : "")}>
                            <span className="sd-row-ic pd-plot" aria-hidden="true"><Pentagon size={17} /></span>
                            <button type="button" className="sd-row-name" onClick={() => { setSelectedId(p.id); api.current.focusShape?.(p.id); }}>
                              <b>{name}</b> <small>{tr("plotSum", { ha: nf(p.ha, 1), t: nf(perPlot(i), 0) })}</small>
                            </button>
                            <button type="button" className="sd-ibtn del" onClick={() => api.current.removeShape?.(p.id)} aria-label={tr("del", { name })} title={tr("del", { name })}><Trash2 size={17} /></button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {hasPlots && <button type="button" className="sd-btn big" onClick={() => setStep(2)}>{tr("next2")}<ChevronRight size={19} aria-hidden="true" /></button>}
                </>
              )}

              {step === 2 && (
                <>
                  <header className="sd-step-h"><h3>{tr("st2h")}</h3><p>{tr("st2p")}</p></header>
                  <button type="button" className={"sd-btn big" + (tool === "excl" ? " on" : "")} onClick={() => pick("excl")} disabled={!ready}>
                    {tool === "excl" ? <><X size={19} aria-hidden="true" />{tr("drawCancel")}</> : <><Ban size={19} aria-hidden="true" />{tr("addExcl")}</>}
                  </button>
                  {hasExcl ? (
                    <ul className="sd-list">
                      {shapes.exclusions.map((e) => (
                        <li key={e.id} id={"pd-item-" + e.id} className={"sd-row" + (selectedId === e.id ? " on" : "")}>
                          <button type="button" className="sd-row-ic ob" onClick={() => { setSelectedId(e.id); api.current.focusShape?.(e.id); }} aria-label={L3(KIND[e.kind] || KIND.other)}><Ban size={17} aria-hidden="true" /></button>
                          <select className="sd-select" value={e.kind} onChange={(ev) => api.current.setExclKind?.(e.id, ev.target.value)} aria-label={tr("t_excl")}>
                            {EXCLUSION_KINDS.map((k) => <option key={k} value={k}>{L3(KIND[k])}</option>)}
                          </select>
                          <button type="button" className="sd-ibtn del" onClick={() => api.current.removeShape?.(e.id)} aria-label={tr("del", { name: L3(KIND[e.kind] || KIND.other) })}><Trash2 size={17} /></button>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="sd-help">{tr("noneExcl")}</p>}
                  <button type="button" className="sd-btn big" onClick={() => setStep(3)}>{tr("next3")}<ChevronRight size={19} aria-hidden="true" /></button>
                </>
              )}

              {step === 3 && (
                <>
                  <header className="sd-step-h"><h3>{tr("st3h")}</h3><p>{tr("st3p")}</p></header>
                  <div className="sd-field">
                    <span className="sd-lbl" id="pd-mount">{tr("mount")}</span>
                    <div className="sd-seg" role="radiogroup" aria-labelledby="pd-mount">
                      <button type="button" role="radio" aria-checked={!tracker} className={!tracker ? "on" : ""} onClick={() => putMountKind("fixed")}>{tr("mountFixed")}</button>
                      <button type="button" role="radio" aria-checked={tracker} className={tracker ? "on" : ""} onClick={() => putMountKind("tracker")}>{tr("mountTracker")}</button>
                    </div>
                  </div>
                  {!tracker && (
                    <>
                      <div className="sd-field">
                        <span className="sd-lbl-row">
                          <span className="sd-lbl" id="pd-tilt">{tr("tilt")}</span>
                          <span className="sd-numwrap">
                            <input type="number" className="sd-num" min="5" max="45" step="1" value={tilt} aria-labelledby="pd-tilt" onChange={(e) => e.target.value !== "" && putTilt(Math.min(45, Math.max(5, +e.target.value)))} />
                            <span className="sd-unit">°</span>
                          </span>
                        </span>
                        <input type="range" className="sd-slider" min="5" max="45" step="1" value={tilt} aria-labelledby="pd-tilt" style={{ "--fill": ((tilt - 5) / 40) * 100 + "%" }} onChange={(e) => putTilt(+e.target.value)} />
                        <span className="sd-scale" aria-hidden="true"><span>5°</span><span>25°</span><span>45°</span></span>
                      </div>
                      <div className="sd-field">
                        <span className="sd-lbl">{tr("facing")}</span>
                        <div className="sd-compass-row">
                          <div className="sd-compass" role="radiogroup" aria-label={tr("facing")}>
                            {DIRS.map((d, k) => d ? (
                              <button key={k} type="button" role="radio" aria-checked={dir.az === d.az} className={"sd-dir" + (dir.az === d.az ? " on" : "")} onClick={() => putAz(d.az)}>{d[lang] || d.en}</button>
                            ) : (
                              <span key={k} className="sd-compass-mid" aria-hidden="true">
                                <svg width="24" height="24" viewBox="0 0 24 24" style={{ transform: `rotate(${az + 180}deg)` }}><path d="M12 3 L18 15 H13.5 V21 H10.5 V15 H6 Z" fill="currentColor" /></svg>
                              </span>
                            ))}
                          </div>
                          <div className="sd-compass-side">
                            <b>{tr("facesDir", { dir: L3(DIR_NAME[String(dir.az)] || DIR_NAME[0]) })}</b>
                            <label className="sd-field">
                              <span className="sd-lbl">{tr("exact")}</span>
                              <span className="sd-numwrap">
                                <input type="number" className="sd-num" min="-180" max="180" step="5" value={az} onChange={(e) => e.target.value !== "" && e.target.value !== "-" && putAz(Math.min(180, Math.max(-180, +e.target.value)))} />
                                <span className="sd-unit">°</span>
                              </span>
                            </label>
                            <span className="sd-note">{tr("exactHelp")}</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  {tracker && (
                    <div className="sd-field">
                      <span className="sd-lbl-row">
                        <span className="sd-lbl" id="pd-gcr">{tr("gcr")}</span>
                        <span className="sd-numwrap">
                          <input type="number" className="sd-num" min={TRACKER_GCR_RANGE[0]} max={TRACKER_GCR_RANGE[1]} step="0.01" value={gcr} aria-labelledby="pd-gcr" onChange={(e) => e.target.value !== "" && putGcr(Math.min(TRACKER_GCR_RANGE[1], Math.max(TRACKER_GCR_RANGE[0], +e.target.value)))} />
                        </span>
                      </span>
                      <input type="range" className="sd-slider" min={TRACKER_GCR_RANGE[0]} max={TRACKER_GCR_RANGE[1]} step="0.01" value={gcr} aria-labelledby="pd-gcr" style={{ "--fill": ((gcr - TRACKER_GCR_RANGE[0]) / (TRACKER_GCR_RANGE[1] - TRACKER_GCR_RANGE[0])) * 100 + "%" }} onChange={(e) => putGcr(+e.target.value)} />
                      <span className="sd-note">{tr("gcrHelp")}</span>
                    </div>
                  )}
                  <div className="sd-field">
                    <span className="sd-lbl" id="pd-fmt">{tr("format")}</span>
                    <div className="sd-seg" role="radiogroup" aria-labelledby="pd-fmt">
                      {TABLE_FORMATS.map((t, i) => (
                        <button key={i} type="button" role="radio" aria-checked={fmt === i} className={fmt === i ? "on" : ""} onClick={() => putFmt(i)} title={tr("formatV", { h: t.high, w: t.wide })}>{t.high} x {t.wide}</button>
                      ))}
                    </div>
                  </div>
                  <div className="sd-field">
                    <span className="sd-lbl-row">
                      <span className="sd-lbl" id="pd-sb">{tr("setback")}</span>
                      <span className="sd-numwrap">
                        <input type="number" className="sd-num" min="0" max="30" value={setback} aria-labelledby="pd-sb" onChange={(e) => e.target.value !== "" && putSetback(Math.min(30, Math.max(0, +e.target.value)))} />
                        <span className="sd-unit">m</span>
                      </span>
                    </span>
                    <input type="range" className="sd-slider" min="0" max="30" step="1" value={setback} aria-labelledby="pd-sb" style={{ "--fill": (setback / 30) * 100 + "%" }} onChange={(e) => putSetback(+e.target.value)} />
                  </div>
                  {geo && <p className="sd-help">{tr("rowInfo", { p: nf(geo.pitchM, 1), g: nf(geo.gcr, 2), w: nf(geo.widthM, 1), d: nf(geo.depthM, 1), m: geo.modules })}</p>}
                  {base.assumed.wp && <p className="sd-guess"><Info size={15} aria-hidden="true" />{tr("assumed", { wp: base.inputs.wp })}</p>}
                </>
              )}
            </div>

            {/* the result, always in view */}
            <div className="sd-result" aria-live="polite">
              {!result ? (
                <p className="sd-result-empty">{tr("resultEmpty")}</p>
              ) : (
                <>
                  <div className="sd-result-top">
                    <div className="sd-big"><b>{nf(s.placedTables, 0)}</b><span>{tr("tables")}</span></div>
                    <div className="sd-big"><b>{nf(s.mwpPlaced, 2)}</b><span>MWp</span></div>
                    <span className="sd-use">{tr("need", { need: nf(s.mwpNeed, 2), fit: nf(s.mwpFit, 2), ha: nf(s.plotHa, 1) })}</span>
                  </div>
                  {s.short
                    ? <p className="sd-warn" role="alert">{tr("short", { miss: nf(Math.max(0, s.mwpNeed - s.mwpFit), 2) })}</p>
                    : result.stations.length > 0 && <p className="sd-help">{tr("grid", { n: result.stations.length, m: nf(s.cableM, 0) })}</p>}
                  {hasWind && (s.turbinesShort
                    ? <p className="sd-warn" role="alert">{tr("turbinesShort", { n: s.turbineCount, need: s.needTurbines })}</p>
                    : <p className="sd-help">{tr("turbinesFit", { n: s.turbineCount, need: s.needTurbines, d: nf(s.rotorM, 0), r: nf(s.rotorM ? (s.rotorM / 2 + base.inputs.wind.hubM) * 1.15 : 0, 0) })}</p>)}
                  <button type="button" className="sd-btn primary big sd-apply" disabled={!fits} onClick={() => { api.current.save?.(); onClose?.(); }}>
                    <Check size={19} aria-hidden="true" />{tr("apply")}
                  </button>
                  <p className="sd-help">{tr("saved")}</p>
                </>
              )}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

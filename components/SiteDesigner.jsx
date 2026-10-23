"use client";
// components/SiteDesigner.jsx — the roof survey workspace. The installer draws
// each side of the roof (its own pitch, facing and material) and whatever is
// in the way on real satellite imagery; the chosen module is fitted into every
// side, skipping obstacles, and the real price, payback and CO2 for that many
// panels show beside the map before anything touches the quote.
//
// Full screen: the map on the left with the drawing tools floating over it,
// and on the right the roof sides, obstacles, electrical points, panel choice
// and the result with "Use in the quote". Stacked on a phone.
//
// What it saves (onChange → projects.site_design): the drawn planes, obstacles
// and markers, plus `layout` — the module, orientation and spacing chosen
// here — so the quote's rail estimate and the proposal's roof drawing fit
// panels exactly as this screen did (lib/roofLayout.js fitOptions).
//
// Esri World Imagery is the default base layer: free, no API key. When a real
// NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set (installer's own Google Cloud
// project, billing enabled — see .env.example), Google's satellite tiles are
// used instead, via the official Maps JavaScript API loaded under
// leaflet.gridlayer.googlemutant (never raw tile-server URLs, which aren't
// licensed for direct use). Leaflet + leaflet-geoman are loaded inside an
// effect because they touch `window` at load time.
import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import "./SiteDesigner.css";
import {
  X, Undo2, Redo2, Pentagon, Box, TreeDeciduous, Ruler, Plug, Move, LocateFixed, Trash2, Check,
  House, ChevronDown, ChevronRight, Info, Eye, Signpost, ImagePlus,
} from "lucide-react";
import { labelLayer, LABEL_TILES, namesPref, setNamesPref } from "../lib/mapLabels.js";
import { loadGoogleSatelliteLayer } from "../lib/googleSatellite.js";
import { tilesAround, postTiles } from "../lib/tileWarm.js";

const SAT_ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
import { compassLabel, project, polygonAreaM2, slopeAreaM2, facingFromShape, limitPanels, fitSidesFor, presetRing, OBSTACLE_PRESETS, OBSTACLE_HEIGHT_DEFAULT, shadeElevationDeg, RACK_ROOFS } from "../lib/roofLayout.js";
import { measurePhoneTilt } from "../lib/phoneTilt.js";
import { blendYields, sideSummaries, sideKey, fetchSideYield } from "../lib/sideYield.js";
import { uploadRoofPhoto } from "../lib/photoShrink.js";
import { cleanPlace, startPlace, metersPerPixel, handleLatLon, placeFromHandle, placeAt, photoCorners } from "../lib/photoPlace.js";
import { makePhotoLayer } from "./photoLayer.js";
import { drawReadout, drawLang } from "./drawReadout.js";
import NumInput from "./NumInput.jsx";
import { PANELS, findPanel, recommendPanel } from "../lib/supplierCatalog.js";
import { designCheck } from "../lib/designCheck.js";
import { SOLAR_SEASON, effectiveConsumption } from "@voltmira/engine";
import { CashflowSVG, MonthlySVG } from "../app/p/[code]/charts.jsx";

/* --------------------------------------------------------------- words --- */
const TX = {
  title: { en: "Roof design", ro: "Proiectare amplasament", ru: "Проект крыши", uk: "Проєкт даху" },
  noAddress: { en: "Pinned on the map", ro: "Fixat pe hartă", ru: "Отмечено на карте", uk: "Позначено на мапі" },
  undo: { en: "Undo", ro: "Anulează", ru: "Отменить", uk: "Скасувати" },
  redo: { en: "Redo", ro: "Refă", ru: "Повторить", uk: "Повторити" },
  close: { en: "Close", ro: "Închide", ru: "Закрыть", uk: "Закрити" },
  tools: { en: "Drawing tools", ro: "Unelte de desen", ru: "Инструменты", uk: "Інструменти" },
  t_plane: { en: "Roof side", ro: "Parte de acoperiș", ru: "Скат", uk: "Схил" },
  t_obstacle: { en: "Obstacle", ro: "Obstacol", ru: "Препятствие", uk: "Перешкода" },
  t_tree: { en: "Tree", ro: "Copac", ru: "Дерево", uk: "Дерево" },
  t_measure: { en: "Measure", ro: "Măsoară", ru: "Измерить", uk: "Виміряти" },
  t_marker: { en: "Electrical point", ro: "Punct electric", ru: "Электроточка", uk: "Електроточка" },
  t_edit: { en: "Adjust shapes", ro: "Ajustează forme", ru: "Изменить формы", uk: "Змінити форми" },
  h_plane: { en: "Click each corner of this side of the roof. Click the first corner again to close it.", ro: "Apasă pe fiecare colț al acestei părți de acoperiș. Apasă din nou pe primul colț ca să închizi forma.", ru: "Щёлкните по каждому углу ската. Щёлкните по первому углу ещё раз, чтобы замкнуть контур.", uk: "Клацніть по кожному куту схилу. Клацніть по першому куту ще раз, щоб замкнути контур." },
  h_obstacle: { en: "Click around the chimney, roof window or dormer. Click the first point again to close it.", ro: "Apasă în jurul coșului, ferestrei de mansardă sau lucarnei. Apasă din nou pe primul punct ca să închizi forma.", ru: "Обведите дымоход, мансардное или слуховое окно. Щёлкните по первой точке, чтобы замкнуть контур.", uk: "Обведіть димар, мансардне чи слухове вікно. Клацніть по першій точці, щоб замкнути контур." },
  h_tree: { en: "Click the trunk, then click the edge of the crown.", ro: "Apasă pe trunchi, apoi pe marginea coroanei.", ru: "Нажмите на ствол, затем на край кроны.", uk: "Натисніть на стовбур, потім на край крони." },
  h_measure: { en: "Click two points to measure the distance between them.", ro: "Apasă pe două puncte ca să măsori distanța dintre ele.", ru: "Щёлкните по двум точкам, чтобы измерить расстояние.", uk: "Клацніть по двох точках, щоб виміряти відстань." },
  h_measured: { en: "{d} m between the two points. Click two more to measure again.", ro: "{d} m între cele două puncte. Apasă pe alte două ca să măsori din nou.", ru: "{d} м между точками. Щёлкните ещё две, чтобы измерить снова.", uk: "{d} м між точками. Клацніть ще дві, щоб виміряти знову." },
  h_marker: { en: "Pick what it is, then click where it sits.", ro: "Alege ce este, apoi apasă unde se află.", ru: "Выберите, что это, и щёлкните, где оно находится.", uk: "Виберіть, що це, і клацніть, де воно розташоване." },
  h_edit: { en: "Drag a corner to move it, or the dot between two corners to add one. Right-click a corner to remove it.", ro: "Trage un colț ca să-l muți sau punctul dintre două colțuri ca să adaugi unul. Click dreapta pe un colț îl șterge.", ru: "Перетащите угол, чтобы сдвинуть его, или точку между углами, чтобы добавить новый. Правый щелчок по углу удаляет его.", uk: "Перетягніть кут, щоб зсунути його, або точку між кутами, щоб додати новий. Правий клік по куту видаляє його." },
  cancel: { en: "Cancel", ro: "Anulează", ru: "Отмена", uk: "Скасувати" },
  done: { en: "Done", ro: "Gata", ru: "Готово", uk: "Готово" },
  lengths: { en: "Edge lengths", ro: "Lungimi laturi", ru: "Длины сторон", uk: "Довжини сторін" },
  names: { en: "Street names", ro: "Nume de străzi", ru: "Названия улиц", uk: "Назви вулиць" },
  recenter: { en: "Back to the house", ro: "Înapoi la casă", ru: "К дому", uk: "До будинку" },
  loading: { en: "Loading satellite imagery", ro: "Se încarcă imaginea din satelit", ru: "Загружаем спутниковый снимок", uk: "Завантажуємо супутниковий знімок" },
  loadError: { en: "The map could not load. Check the connection, then close and open the roof design again.", ro: "Harta nu s-a putut încărca. Verifică conexiunea, apoi închide și redeschide proiectarea.", ru: "Карта не загрузилась. Проверьте соединение, затем закройте и снова откройте проект крыши.", uk: "Мапа не завантажилася. Перевірте з’єднання, потім закрийте й знову відкрийте проєкт даху." },


  plane: { en: "Side {n}", ro: "Partea {n}", ru: "Скат {n}", uk: "Схил {n}" },
  planeSum: { en: "{a} m², {tilt}° pitch, faces {dir}", ro: "{a} m², înclinare {tilt}°, spre {dir}", ru: "{a} м², наклон {tilt}°, на {dir}", uk: "{a} м², нахил {tilt}°, на {dir}" },
  del: { en: "Delete {name}", ro: "Șterge {name}", ru: "Удалить: {name}", uk: "Видалити: {name}" },
  photoH: { en: "Photo over the map", ro: "Fotografie peste hartă", ru: "Фото поверх карты", uk: "Фото поверх мапи" },
  photoP: { en: "Lay a drone or phone photo over the satellite picture (one taken straight down fits best). Vents, pipes and chimneys the satellite cannot show become visible, and you can draw on top of it.", ro: "Așază o fotografie de dronă sau de telefon peste imaginea din satelit (cea făcută drept de sus se potrivește cel mai bine). Ventilațiile, țevile și coșurile pe care satelitul nu le arată devin vizibile, iar tu poți desena peste ea.", ru: "Наложите фото с дрона или телефона на спутниковый снимок (лучше всего подходит снятое строго сверху). Вентиляция, трубы и дымоходы, которых не видно со спутника, станут видны, и вы сможете рисовать поверх.", uk: "Накладіть фото з дрона чи телефона на супутниковий знімок (найкраще підходить знімок строго зверху). Вентиляція, труби й димарі, яких не видно з супутника, стануть видимими, і ви зможете малювати поверху." },
  photoOnly: { en: "This photo is shown on the offer only. Lay it over the map to draw on it.", ro: "Fotografia apare doar în ofertă. Așaz-o peste hartă ca să desenezi pe ea.", ru: "Это фото показывается только в предложении. Наложите его на карту, чтобы рисовать по нему.", uk: "Це фото показується лише в пропозиції. Накладіть його на мапу, щоб малювати по ньому." },
  photoAlign: { en: "Drag the middle dot to move the photo. Drag the square on its right edge to size and turn it. Line up a roof edge or a corner of the yard with the satellite picture below.", ro: "Trage punctul din mijloc ca să muți fotografia. Trage pătratul de pe marginea dreaptă ca s-o mărești și s-o rotești. Aliniază o margine de acoperiș sau un colț de curte cu imaginea din satelit de dedesubt.", ru: "Перетащите среднюю точку, чтобы сдвинуть фото. Перетащите квадрат на правом краю, чтобы изменить размер и повернуть. Совместите край крыши или угол двора со спутниковым снимком под фото.", uk: "Перетягніть середню точку, щоб зсунути фото. Перетягніть квадрат на правому краї, щоб змінити розмір і повернути. Сумістіть край даху чи кут двору із супутниковим знімком під фото." },
  photoAdd: { en: "Add a photo", ro: "Adaugă o fotografie", ru: "Добавить фото", uk: "Додати фото" },
  photoChange: { en: "Change photo", ro: "Schimbă fotografia", ru: "Заменить фото", uk: "Замінити фото" },
  photoBusy: { en: "Sending the photo...", ro: "Se trimite fotografia...", ru: "Отправляем фото...", uk: "Надсилаємо фото..." },
  photoFail: { en: "The photo could not be sent. Try a smaller one, or check the connection.", ro: "Fotografia nu s-a putut trimite. Încearcă una mai mică sau verifică conexiunea.", ru: "Не удалось отправить фото. Попробуйте меньшее или проверьте соединение.", uk: "Не вдалося надіслати фото. Спробуйте менше або перевірте з’єднання." },
  photoLay: { en: "Lay it over the map", ro: "Așaz-o peste hartă", ru: "Наложить на карту", uk: "Накласти на мапу" },
  photoAdjust: { en: "Move and size it on the map", ro: "Mut-o și măr-o pe hartă", ru: "Двигать и менять размер на карте", uk: "Рухати й змінювати розмір на мапі" },
  photoAdjustDone: { en: "Done placing", ro: "Gata poziționarea", ru: "Положение готово", uk: "Позицію задано" },
  photoRemove: { en: "Remove photo", ro: "Șterge fotografia", ru: "Убрать фото", uk: "Прибрати фото" },
  photoOpacity: { en: "See-through", ro: "Transparență", ru: "Прозрачность", uk: "Прозорість" },
  photoTurn: { en: "Turn", ro: "Rotire", ru: "Поворот", uk: "Поворот" },
  photoWidth: { en: "Width on the ground", ro: "Lățime pe teren", ru: "Ширина на земле", uk: "Ширина на землі" },
  photoMove: { en: "Move the photo", ro: "Mută fotografia", ru: "Сдвинуть фото", uk: "Зсунути фото" },
  photoSize: { en: "Size and turn the photo", ro: "Mărește și rotește fotografia", ru: "Размер и поворот фото", uk: "Розмір і поворот фото" },
  presetsH: { en: "One click for the small things", ro: "Un clic pentru lucrurile mici", ru: "Один щелчок для мелочей", uk: "Один клік для дрібниць" },
  presetsP: { en: "Pick one, then click the roof where it stands. It is set down at its real size; drag its corners if it is not exact.", ro: "Alege unul, apoi apasă pe acoperiș unde se află. Se așază la mărimea reală; trage de colțuri dacă nu e exact.", ru: "Выберите и щёлкните по крыше там, где он стоит. Он ставится в реальный размер; потяните за углы, если не точно.", uk: "Виберіть і клацніть по даху там, де він стоїть. Він ставиться в реальний розмір; потягніть за кути, якщо не точно." },
  h_place: { en: "Click the roof where it stands.", ro: "Apasă pe acoperiș unde se află.", ru: "Щёлкните по крыше там, где он стоит.", uk: "Клацніть по даху там, де він стоїть." },
  obHeight: { en: "Height above the roof, m", ro: "Înălțime deasupra acoperișului, m", ru: "Высота над крышей, м", uk: "Висота над дахом, м" },
  clearance: { en: "Distance kept round vents, chimneys and skylights", ro: "Distanța păstrată în jurul ventilațiilor, coșurilor și ferestrelor", ru: "Отступ вокруг вентиляции, дымоходов и окон", uk: "Відступ навколо вентиляції, димарів і вікон" },
  clearanceHelp: { en: "A thing taller than 30 cm also shades the panels north of it; the shade is worked out for the equinox at noon (sun {deg}° high). Winter, mornings and evenings are worse.", ro: "Un lucru mai înalt de 30 cm umbrește și panourile din nordul lui; umbra e calculată la echinocțiu, la amiază (soarele la {deg}°). Iarna, dimineața și seara e mai rău.", ru: "Всё выше 30 см также затеняет панели севернее; тень считается на равноденствие в полдень (солнце {deg}°). Зимой, утром и вечером хуже.", uk: "Усе вище 30 см також затінює панелі на північ; тінь розраховано на рівнодення опівдні (сонце {deg}°). Взимку, зранку й ввечері гірше." },
  planeHeight: { en: "Height above the lowest roof, m", ro: "Înălțime peste cel mai jos acoperiș, m", ru: "Высота над самой низкой крышей, м", uk: "Висота над найнижчим дахом, м" },
  planeHeightHelp: { en: "Only for a roof with steps. A side 30 cm or more higher shades the lower one beside it.", ro: "Doar pentru un acoperiș în trepte. O parte cu 30 cm sau mai sus umbrește partea mai joasă de lângă ea.", ru: "Только для крыши со ступенями. Скат на 30 см и выше затеняет соседний, более низкий.", uk: "Лише для даху зі сходинками. Схил на 30 см і вище затінює сусідній нижчий." },
  pitchEst: { en: "This pitch is an estimate: measure it, or type the real one.", ro: "Înclinarea aceasta este o estimare: măsoar-o sau scrie-o pe cea reală.", ru: "Этот наклон приблизительный: измерьте его или введите настоящий.", uk: "Цей нахил приблизний: виміряйте його або введіть справжній." },
  pitchMeasured: { en: "Measured with the phone.", ro: "Măsurată cu telefonul.", ru: "Измерено телефоном.", uk: "Виміряно телефоном." },
  pitchTyped: { en: "Entered by you.", ro: "Introdusă de tine.", ru: "Введено вами.", uk: "Введено вами." },
  pitchMeasure: { en: "Measure with the phone", ro: "Măsoară cu telefonul", ru: "Измерить телефоном", uk: "Виміряти телефоном" },
  pitchHow: { en: "Lay the phone flat on the roof slope, or along a rafter, top edge up the slope. Hold it still.", ro: "Așază telefonul pe panta acoperișului, sau de-a lungul unei căpriori, cu marginea de sus spre coamă. Ține-l nemișcat.", ru: "Положите телефон на скат или вдоль стропила, верхним краем вверх по скату. Держите неподвижно.", uk: "Покладіть телефон на схил або вздовж крокви, верхнім краєм угору по схилу. Тримайте нерухомо." },
  pitchReading: { en: "Reading...", ro: "Se citește...", ru: "Считывание...", uk: "Зчитування..." },
  pitchNoSensor: { en: "This phone or browser gives no tilt sensor. Type the pitch instead.", ro: "Telefonul sau browserul acesta nu are senzor de înclinare. Scrie înclinarea.", ru: "У этого телефона или браузера нет датчика наклона. Введите наклон.", uk: "У цього телефона чи браузера немає датчика нахилу. Введіть нахил." },
  pitchDenied: { en: "The tilt sensor was not allowed. Type the pitch instead.", ro: "Senzorul de înclinare nu a fost permis. Scrie înclinarea.", ru: "Доступ к датчику наклона не разрешён. Введите наклон.", uk: "Доступ до датчика нахилу не дозволено. Введіть нахил." },
  statusH: { en: "How this roof was designed", ro: "Cum a fost proiectat acoperișul", ru: "Как спроектирована крыша", uk: "Як спроєктовано дах" },
  status_sat: { en: "From satellite imagery", ro: "Din imagini din satelit", ru: "По спутниковым снимкам", uk: "За супутниковими знімками" },
  status_ver: { en: "Verified on site", ro: "Verificat la fața locului", ru: "Проверено на объекте", uk: "Перевірено на об’єкті" },
  statusHelp: { en: "The offer states which. Mark it verified once you have measured the roof on site.", ro: "Oferta spune care este. Marchează-l verificat după ce ai măsurat acoperișul la fața locului.", ru: "В предложении это указано. Отметьте «проверено» после замера крыши на объекте.", uk: "У пропозиції це зазначено. Позначте «перевірено» після замірів даху на об’єкті." },
  yieldSide: { en: "Sun on this side: {y} kWh per kWp, about {kwh} kWh a year.", ro: "Soarele pe această parte: {y} kWh pe kWp, circa {kwh} kWh pe an.", ru: "Солнце на этом скате: {y} кВт·ч на кВт, около {kwh} кВт·ч в год.", uk: "Сонце на цьому схилі: {y} кВт·год на кВт, близько {kwh} кВт·год на рік." },
  yieldLoading: { en: "Looking up the sun for this side...", ro: "Se caută soarele pentru această parte...", ru: "Ищем данные о солнце для этого ската...", uk: "Шукаємо дані про сонце для цього схилу..." },
  yieldNone: { en: "No solar data for this side yet.", ro: "Încă nu sunt date solare pentru această parte.", ru: "Пока нет данных о солнце для этого ската.", uk: "Поки немає даних про сонце для цього схилу." },
  yieldFailed: { en: "No solar data for {n} side(s): the roof's yield counts the others.", ro: "Nu sunt date solare pentru {n} parte/părți: randamentul acoperișului le numără pe celelalte.", ru: "Нет данных о солнце для скатов: {n}. В выработке крыши учтены остальные.", uk: "Немає даних про сонце для схилів: {n}. У виробітку даху враховано решту." },
  material: { en: "Roof material", ro: "Tip acoperiș", ru: "Тип кровли", uk: "Тип покрівлі" },
  rackAngle: { en: "Angle of the racks", ro: "Unghiul suporturilor", ru: "Угол стоек", uk: "Кут стійок" },
  rackHelp: { en: "On a flat roof or the ground the panels stand on racks at this angle, with space between the rows so none shades the next (no shade from 10:00 to 14:00 on 21 December).", ro: "Pe un acoperiș plat sau pe sol, panourile stau pe suporturi la acest unghi, cu spațiu între rânduri ca niciunul să nu umbrească pe următorul (fără umbră între 10 și 14 pe 21 decembrie).", ru: "На плоской крыше или на земле панели стоят на стойках под этим углом, между рядами оставлен зазор, чтобы ни один не затенял следующий (без тени с 10 до 14 21 декабря).", uk: "На пласкому даху чи на землі панелі стоять на стійках під цим кутом, між рядами залишено проміжок, щоб жоден не затінював наступний (без тіні з 10 до 14 21 грудня)." },
  pitch: { en: "Pitch", ro: "Înclinare", ru: "Наклон", uk: "Нахил" },
  facing: { en: "Faces", ro: "Orientare", ru: "Направление", uk: "Напрямок" },
  facesDir: { en: "Faces {dir}", ro: "Spre {dir}", ru: "На {dir}", uk: "На {dir}" },
  exact: { en: "Exact angle", ro: "Unghi exact", ru: "Точный угол", uk: "Точний кут" },
  exactHelp: { en: "0 is south, −90 east, 90 west", ro: "0 e sud, −90 est, 90 vest", ru: "0 юг, −90 восток, 90 запад", uk: "0 південь, −90 схід, 90 захід" },
  guessed: { en: "Guessed from the longest edge. Pick the opposite side if the roof slopes the other way.", ro: "Dedusă din latura cea mai lungă. Alege partea opusă dacă acoperișul coboară invers.", ru: "Определено по самой длинной стороне. Выберите противоположную, если скат идёт в другую сторону.", uk: "Визначено за найдовшою стороною. Виберіть протилежну, якщо схил іде в інший бік." },

  obstacles: { en: "Obstacles", ro: "Obstacole", ru: "Препятствия", uk: "Перешкоди" },
  points: { en: "Electrical points", ro: "Puncte electrice", ru: "Электроточки", uk: "Електроточки" },

  module: { en: "Module", ro: "Modul", ru: "Модуль", uk: "Модуль" },
  fromQuote: { en: "The panel in this quote's equipment list", ro: "Panoul din lista de echipamente a ofertei", ru: "Панель из списка оборудования предложения", uk: "Панель зі списку обладнання розрахунку" },
  laid: { en: "Laid", ro: "Așezare", ru: "Раскладка", uk: "Розкладка" },
  portrait: { en: "Portrait", ro: "Portret", ru: "Вертикально", uk: "Вертикально" },
  landscape: { en: "Landscape", ro: "Peisaj", ru: "Горизонтально", uk: "Горизонтально" },
  auto: { en: "Most fit", ro: "Maxim", ru: "Максимум", uk: "Максимум" },
  setback: { en: "Distance from the roof edge", ro: "Distanța față de marginea acoperișului", ru: "Отступ от края крыши", uk: "Відступ від краю даху" },
  more: { en: "More spacing options", ro: "Mai multe opțiuni de distanțare", ru: "Другие настройки отступов", uk: "Інші налаштування відступів" },
  rowGap: { en: "Gap between rows", ro: "Spațiu între rânduri", ru: "Зазор между рядами", uk: "Зазор між рядами" },
  colGap: { en: "Gap between panels", ro: "Spațiu între panouri", ru: "Зазор между панелями", uk: "Зазор між панелями" },
  blockW: { en: "Longest block along the ridge", ro: "Bloc maxim de-a lungul coamei", ru: "Макс. блок вдоль конька", uk: "Макс. блок уздовж гребеня" },
  blockH: { en: "Tallest block up the slope", ro: "Bloc maxim pe pantă", ru: "Макс. блок по скату", uk: "Макс. блок по схилу" },
  blockGap: { en: "Gap between blocks", ro: "Spațiu între blocuri", ru: "Зазор между блоками", uk: "Зазор між блоками" },
  blockHelp: { en: "Leave the block sizes at 0 for one continuous field of panels.", ro: "Lasă dimensiunile blocurilor pe 0 pentru un singur câmp continuu de panouri.", ru: "Оставьте размеры блоков 0, чтобы панели шли сплошным полем.", uk: "Залиште розміри блоків 0, щоб панелі йшли суцільним полем." },

  tab1: { en: "Roof", ro: "Acoperiș", ru: "Крыша", uk: "Дах" },
  tab2: { en: "Obstacles", ro: "Obstacole", ru: "Препятствия", uk: "Перешкоди" },
  tab3: { en: "Panels", ro: "Panouri", ru: "Панели", uk: "Панелі" },
  st1h: { en: "Outline the roof", ro: "Conturează acoperișul", ru: "Обведите крышу", uk: "Обведіть дах" },
  st1p: { en: "Draw each side of the roof that will carry panels. Each side keeps its own pitch and direction.", ro: "Desenează fiecare parte a acoperișului pe care vor sta panouri. Fiecare parte își păstrează înclinarea și orientarea ei.", ru: "Обведите каждый скат, на котором будут панели. У каждого ската свой наклон и направление.", uk: "Обведіть кожен схил, на якому будуть панелі. Кожен схил має власний нахил і напрямок." },
  drawFirst: { en: "Draw the first side", ro: "Desenează prima parte", ru: "Нарисовать первый скат", uk: "Намалювати перший схил" },
  drawMore: { en: "Add another side", ro: "Adaugă încă o parte", ru: "Добавить ещё скат", uk: "Додати ще схил" },
  drawCancel: { en: "Stop drawing", ro: "Oprește desenarea", ru: "Остановить рисование", uk: "Зупинити малювання" },
  how1: { en: "Click one corner of the roof on the map.", ro: "Apasă pe un colț al acoperișului, pe hartă.", ru: "Щёлкните по углу крыши на карте.", uk: "Клацніть по куту даху на мапі." },
  how2: { en: "Click the other corners, one after another.", ro: "Apasă pe celelalte colțuri, pe rând.", ru: "Щёлкайте по остальным углам по очереди.", uk: "Клацайте по інших кутах по черзі." },
  how3: { en: "Click the first corner again to close the shape.", ro: "Apasă din nou pe primul colț ca să închizi forma.", ru: "Щёлкните по первому углу ещё раз, чтобы замкнуть контур.", uk: "Клацніть по першому куту ще раз, щоб замкнути контур." },
  next2: { en: "Next: obstacles", ro: "Mai departe: obstacole", ru: "Далее: препятствия", uk: "Далі: перешкоди" },
  next3: { en: "Next: panels", ro: "Mai departe: panouri", ru: "Далее: панели", uk: "Далі: панелі" },
  st2h: { en: "What's on the roof", ro: "Ce e pe acoperiș", ru: "Что есть на крыше", uk: "Що є на даху" },
  st2p: { en: "Mark what keeps panels away: chimneys, roof windows, trees that cast shade. Skip this step if the roof is clear.", ro: "Marchează ce ține panourile departe: coșuri, ferestre de mansardă, copaci care umbresc. Sari peste pas dacă acoperișul e liber.", ru: "Отметьте, что мешает панелям: дымоходы, мансардные окна, деревья с тенью. Пропустите шаг, если крыша свободна.", uk: "Позначте, що заважає панелям: димарі, мансардні вікна, дерева, що дають тінь. Пропустіть крок, якщо дах вільний." },
  addOb: { en: "Chimney or window", ro: "Coș sau fereastră", ru: "Дымоход или окно", uk: "Димар або вікно" },
  addTree: { en: "Tree", ro: "Copac", ru: "Дерево", uk: "Дерево" },
  optional: { en: "optional", ro: "opțional", ru: "необязательно", uk: "необов’язково" },
  pointsP: { en: "Mark the main panel, the meter and the inverter spot, so the crew knows where the cables run.", ro: "Marchează tabloul principal, contorul și locul invertorului, ca echipa să știe pe unde trec cablurile.", ru: "Отметьте главный щит, счётчик и место инвертора, чтобы бригада знала, где пойдут кабели.", uk: "Позначте головний щит, лічильник і місце інвертора, щоб бригада знала, де підуть кабелі." },
  addPoint: { en: "Add an electrical point", ro: "Adaugă un punct electric", ru: "Добавить электроточку", uk: "Додати електроточку" },
  st3h: { en: "Choose the panels", ro: "Alege panourile", ru: "Выберите панели", uk: "Виберіть панелі" },
  st3p: { en: "Panels place themselves on every side, around the obstacles. Change the model or the spacing and they rearrange.", ro: "Panourile se așază singure pe fiecare parte, ocolind obstacolele. Schimbă modelul sau distanțele și se rearanjează.", ru: "Панели сами раскладываются на каждом скате, обходя препятствия. Измените модель или отступы, и раскладка обновится.", uk: "Панелі самі розкладаються на кожному схилі, оминаючи перешкоди. Змініть модель або відступи, і розкладка оновиться." },
  flat: { en: "flat", ro: "plat", ru: "плоско", uk: "пласко" },
  charts: { en: "Production and payback", ro: "Producție și recuperare", ru: "Выработка и окупаемость", uk: "Генерація та окупність" },
  monthly: { en: "Month by month", ro: "Lună de lună", ru: "По месяцам", uk: "По місяцях" },
  cash: { en: "Money over the years", ro: "Banii de-a lungul anilor", ru: "Деньги по годам", uk: "Гроші по роках" },

  goalH: { en: "What you are aiming for", ro: "Ce urmărești", ru: "К чему стремимся", uk: "До чого прагнемо" },
  goal: { en: "The quote is for {kw} kW: about {n} panels of {w} W, so about {m2} m² of clear roof.", ro: "Oferta e de {kw} kW: circa {n} panouri de {w} W, deci circa {m2} m² de acoperiș liber.", ru: "В расчёте {kw} кВт: около {n} панелей по {w} Вт, то есть около {m2} м² свободной крыши.", uk: "У розрахунку {kw} кВт: близько {n} панелей по {w} Вт, тобто близько {m2} м² вільного даху." },
  goalNone: { en: "Set the system size in the quote and the designer shows how much roof it needs.", ro: "Pune puterea sistemului în ofertă și aici vezi cât acoperiș îi trebuie.", ru: "Укажите мощность в расчёте, и здесь будет видно, сколько крыши нужно.", uk: "Вкажіть потужність у розрахунку, і тут буде видно, скільки даху потрібно." },
  howH: { en: "How to draw a side", ro: "Cum desenezi o parte", ru: "Как нарисовать скат", uk: "Як намалювати схил" },
  keys: { en: "Keys 1 to 5 pick a tool, Esc stops drawing, Ctrl+Z takes back the last corner. Zoom in until the roof's edges are sharp.", ro: "Tastele 1 până la 5 aleg unealta, Esc oprește desenul, Ctrl+Z anulează ultimul colț. Mărește harta până vezi clar marginile acoperișului.", ru: "Клавиши от 1 до 5 выбирают инструмент, Esc останавливает рисование, Ctrl+Z отменяет последний угол. Приблизьте карту, пока края крыши не станут чёткими.", uk: "Клавіші від 1 до 5 вибирають інструмент, Esc зупиняє малювання, Ctrl+Z скасовує останній кут. Наблизьте карту, доки краї даху не стануть чіткими." },
  sub1_none: { en: "Nothing yet", ro: "Nimic încă", ru: "Пока пусто", uk: "Поки порожньо" },
  sub1_one: { en: "1 side", ro: "1 parte", ru: "1 скат", uk: "1 схил" },
  sub1: { en: "{n} sides", ro: "{n} părți", ru: "Скатов: {n}", uk: "Схилів: {n}" },
  sub2_none: { en: "Optional", ro: "Opțional", ru: "Необязательно", uk: "Необов’язково" },
  sub2: { en: "{n} marked", ro: "{n} marcate", ru: "Отмечено: {n}", uk: "Позначено: {n}" },
  sub3_none: { en: "After the roof", ro: "După acoperiș", ru: "После крыши", uk: "Після даху" },
  meterEmpty: { en: "0 of about {t} panels for {kw} kW", ro: "0 din circa {t} panouri pentru {kw} kW", ru: "0 из примерно {t} панелей для {kw} кВт", uk: "0 з приблизно {t} панелей для {kw} кВт" },
  meter: { en: "{n} of about {t} panels for {kw} kW", ro: "{n} din circa {t} panouri pentru {kw} kW", ru: "{n} из примерно {t} панелей для {kw} кВт", uk: "{n} з приблизно {t} панелей для {kw} кВт" },
  meterOver: { en: "{n} fit, more than the {kw} kW the quote asks for", ro: "Încap {n}, mai multe decât cei {kw} kW din ofertă", ru: "Помещается {n}, больше, чем {kw} кВт в расчёте", uk: "Вміщується {n}, більше, ніж {kw} кВт у розрахунку" },
  resultEmpty: { en: "Draw a side of the roof and the panels that fit on it appear here.", ro: "Desenează o parte a acoperișului și aici apar panourile care încap pe ea.", ru: "Обведите скат, и здесь появятся панели, которые на нём помещаются.", uk: "Обведіть схил, і тут з’являться панелі, які на ньому вміщаються." },
  howMany: { en: "How many panels", ro: "Câte panouri", ru: "Сколько панелей", uk: "Скільки панелей" },
  fillTarget: { en: "As the quote needs ({n})", ro: "Cât cere oferta ({n})", ru: "Сколько нужно в расчёте ({n})", uk: "Скільки потрібно в розрахунку ({n})" },
  fillRoof: { en: "Whole roof ({n})", ro: "Tot acoperișul ({n})", ru: "Вся крыша ({n})", uk: "Увесь дах ({n})" },
  fillOwn: { en: "My number", ro: "Alt număr", ru: "Своё число", uk: "Своє число" },
  fillOwnLbl: { en: "Panels to place", ro: "Panouri de pus", ru: "Сколько поставить", uk: "Скільки поставити" },
  fillHelp: { en: "Panels go on the sides facing nearest south first. Places left free show as grey outlines on the map.", ro: "Panourile se pun întâi pe părțile orientate cel mai aproape de sud. Locurile rămase libere apar pe hartă ca un contur gri.", ru: "Панели ставятся сначала на стороны, ближе всего к югу. Свободные места видны на карте серым контуром.", uk: "Панелі ставляться спершу на сторони, найближчі до півдня. Вільні місця видно на мапі сірим контуром." },
  spareLine: { en: "{fit} fit on the roof; {free} places left free.", ro: "Pe acoperiș încap {fit}; {free} locuri rămân libere.", ru: "На крыше помещается {fit}; {free} мест остаются свободными.", uk: "На даху вміщується {fit}; {free} місць лишаються вільними." },
  roofUse: { en: "{used} m² of panels on {roof} m² of roof", ro: "{used} m² de panouri pe {roof} m² de acoperiș", ru: "{used} м² панелей на {roof} м² крыши", uk: "{used} м² панелей на {roof} м² даху" },
  price: { en: "System price", ro: "Preț sistem", ru: "Цена системы", uk: "Ціна системи" },
  payback: { en: "Pays back in", ro: "Se recuperează în", ru: "Окупается за", uk: "Окуповується за" },
  co2: { en: "CO₂ avoided", ro: "CO₂ evitat", ru: "Меньше CO₂", uk: "Менше CO₂" },
  perYear: { en: "{t} t a year", ro: "{t} t pe an", ru: "{t} т в год", uk: "{t} т на рік" },
  noFit: { en: "No panel fits. Draw the outline larger, or lower the distance from the roof edge.", ro: "Niciun panou nu încape. Desenează conturul mai mare sau micșorează distanța față de margine.", ru: "Ни одна панель не помещается. Увеличьте контур или уменьшите отступ от края.", uk: "Жодна панель не вміщається. Збільште контур або зменште відступ від краю." },
  apply: { en: "Use {n} in the quote", ro: "Folosește {n} în ofertă", ru: "Перенести в предложение: {n}", uk: "Перенести в розрахунок: {n}" },
  applying: { en: "Updating the quote", ro: "Se actualizează oferta", ru: "Обновляем предложение", uk: "Оновлюємо розрахунок" },
};

function makeT(lang) {
  return (k, vars) => {
    const e = TX[k];
    let s = e ? (e[lang] || e.en) : k;
    if (vars) for (const [a, b] of Object.entries(vars)) s = s.split("{" + a + "}").join(String(b));
    return s;
  };
}

// "18 panels" / "18 panouri" / "20 de panouri" / "18 панелей" / "3 панелі"
function panelsNoun(n, lang) {
  if (lang === "ru" || lang === "uk") {
    const m10 = n % 10, m100 = n % 100;
    return m10 === 1 && m100 !== 11 ? "панель" : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? (lang === "uk" ? "панелі" : "панели") : "панелей";
  }
  if (lang === "ro") return n === 1 ? "panou" : n >= 20 && (n % 100 === 0 || n % 100 >= 20) ? "de panouri" : "panouri";
  return n === 1 ? "panel" : "panels";
}
function yearsLabel(y, lang) {
  if (y == null) return lang === "ro" ? "25+ ani" : lang === "ru" ? "25+ лет" : lang === "uk" ? "25+ років" : "25+ years";
  const v = y.toLocaleString({ ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "en-GB", { maximumFractionDigits: 1 });
  if (lang === "uk") {
    // 7,4 року; 5 років; 2 роки; 1 рік
    const r = Math.round(y * 10) / 10;
    if (!Number.isInteger(r)) return `${v} року`;
    const f = new Intl.PluralRules("uk").select(r);
    return `${v} ${f === "one" ? "рік" : f === "few" ? "роки" : "років"}`;
  }
  return lang === "ro" ? `${v} ani` : lang === "ru" ? `${v} года` : `${v} years`;
}

/* ------------------------------------------------------------ constants --- */
const PLANE_STYLE = { color: "#2E9A5E", weight: 2, fillColor: "#2E9A5E", fillOpacity: 0.16 };
const PLANE_ON = { color: "#E89B2D", weight: 3, fillColor: "#E89B2D", fillOpacity: 0.14 };
const OBSTACLE_STYLE = { color: "#C4543B", weight: 2, fillColor: "#C4543B", fillOpacity: 0.35 };
const TREE_STYLE = { color: "#6E8F3E", weight: 2, fillColor: "#6E8F3E", fillOpacity: 0.35 };

// Matches lib/supplierCatalog.js's ROOF_TYPE_MOUNT_TEST keys exactly, so a
// plane's chosen roof type maps straight to a real, verified mount SKU.
const ROOF_TYPES = ["tile", "metalTile", "fibreCement", "trapezoidal", "standingSeam", "flat", "ground"];
const ROOF_TYPE_LABEL = {
  tile: { ro: "Țiglă", en: "Tile", ru: "Черепица", uk: "Черепиця" },
  metalTile: { ro: "Țiglă metalică", en: "Metal tile", ru: "Металлочерепица", uk: "Металочерепиця" },
  fibreCement: { ro: "Ardezie (fibrociment)", en: "Fibre-cement sheet", ru: "Шифер", uk: "Шифер" },
  trapezoidal: { ro: "Tablă cutată", en: "Trapezoidal sheet", ru: "Профлист", uk: "Профнастил" },
  standingSeam: { ro: "Tablă fălțuită", en: "Standing-seam metal", ru: "Фальцевая кровля", uk: "Фальцева покрівля" },
  flat: { ro: "Terasă (acoperiș plat)", en: "Flat roof or terrace", ru: "Плоская крыша", uk: "Плаский дах або тераса" },
  ground: { ro: "Sol sau carport", en: "Ground or carport", ru: "Грунт или навес", uk: "Ґрунт або навіс" },
};

const OBSTACLE_KINDS = ["chimney", "vent", "pipe", "skylight", "dormer", "tree", "other"];
const KIND_LABEL = {
  chimney: { ro: "Coș", en: "Chimney", ru: "Дымоход", uk: "Димар" },
  vent: { ro: "Ventilație", en: "Vent", ru: "Вентиляция", uk: "Вентиляція" },
  pipe: { ro: "Țeavă", en: "Pipe", ru: "Труба", uk: "Труба" },
  skylight: { ro: "Fereastră de acoperiș", en: "Skylight", ru: "Мансардное окно", uk: "Мансардне вікно" },
  dormer: { ro: "Lucarnă", en: "Dormer", ru: "Слуховое окно", uk: "Слухове вікно" },
  tree: { ro: "Copac", en: "Tree", ru: "Дерево", uk: "Дерево" },
  other: { ro: "Altceva", en: "Something else", ru: "Другое", uk: "Інше" },
};

// Draggable points for a lightweight single-line layout; real electrical
// validation lives in the separate String Designer.
const MARKER_TYPES = ["mainPanel", "meter", "inverter", "secondaryPanel"];
const MARKER_LABEL = {
  mainPanel: { ro: "Tablou principal", en: "Main panel", ru: "Главный щит", uk: "Головний щит" },
  meter: { ro: "Contor", en: "Meter", ru: "Счётчик", uk: "Лічильник" },
  inverter: { ro: "Invertor", en: "Inverter", ru: "Инвертор", uk: "Інвертор" },
  secondaryPanel: { ro: "Tablou secundar", en: "Secondary panel", ru: "Доп. щит", uk: "Дод. щит" },
};
const MARKER_ABBR = { mainPanel: "TP", meter: "C", inverter: "INV", secondaryPanel: "TS" };

// The eight ways a roof can face, as PVGIS azimuths (0 = south, -90 = east),
// laid out as a compass: north at the top.
const DIRS = [
  { az: 135, en: "NW", ro: "NV", ru: "СЗ", uk: "ПнЗх" }, { az: 180, en: "N", ro: "N", ru: "С", uk: "Пн" }, { az: -135, en: "NE", ro: "NE", ru: "СВ", uk: "ПнСх" },
  { az: 90, en: "W", ro: "V", ru: "З", uk: "Зх" }, null, { az: -90, en: "E", ro: "E", ru: "В", uk: "Сх" },
  { az: 45, en: "SW", ro: "SV", ru: "ЮЗ", uk: "ПдЗх" }, { az: 0, en: "S", ro: "S", ru: "Ю", uk: "Пд" }, { az: -45, en: "SE", ro: "SE", ru: "ЮВ", uk: "ПдСх" },
];
const angleGap = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
const nearestDir = (az) => DIRS.filter(Boolean).reduce((best, d) => (angleGap(d.az, az) < angleGap(best.az, az) ? d : best));

// Same per-market kg CO2/kWh factors as PrintSheet.jsx's MKT table.
const CO2_FACTOR = { RO: 0.30, MD: 0.40, DE: 0.35 };

const PIN_SVG = `<svg class="sd-pin" viewBox="0 0 32 40" aria-hidden="true"><path d="M16 39s13-12.4 13-23A13 13 0 0 0 3 16c0 10.6 13 23 13 23z" fill="#E89B2D" stroke="#fff" stroke-width="2"/><path d="M10.5 17.5 16 13l5.5 4.5V23h-3.6v-3.4h-3.8V23h-3.6z" fill="#142A21"/></svg>`;

function uid() { return Math.random().toString(36).slice(2, 10); }
function ringToLatLon(layer) { return (layer.getLatLngs()[0] || []).map((ll) => [ll.lat, ll.lng]); }
function centroidOf(ring) {
  let sx = 0, sy = 0;
  for (const [a, b] of ring) { sx += a; sy += b; }
  return [sx / ring.length, sy / ring.length];
}
// A circle drawn by geoman becomes a plain polygon ring at once, so a tree
// flows through the same obstacle pipeline as any other shape.
function circleToRing(center, radiusM, n) {
  const R = 6371000;
  const latRad = (center.lat * Math.PI) / 180;
  const dLat = (radiusM / R) * (180 / Math.PI);
  const dLon = (radiusM / (R * Math.cos(latRad))) * (180 / Math.PI);
  const ring = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    ring.push([center.lat + dLat * Math.sin(a), center.lng + dLon * Math.cos(a)]);
  }
  return ring;
}
// One shared SVG pattern (a small cell grid with a soft highlight) as the fill
// for every placed panel, so hundreds of panels cost the same as plain shapes.
function ensurePanelPattern(map) {
  const svg = map.getPanes().overlayPane.querySelector("svg");
  if (!svg || svg.querySelector("#sdPanelCells")) return;
  const NS = "http://www.w3.org/2000/svg";
  let defs = svg.querySelector("defs");
  if (!defs) { defs = document.createElementNS(NS, "defs"); svg.insertBefore(defs, svg.firstChild); }
  const pattern = document.createElementNS(NS, "pattern");
  pattern.setAttribute("id", "sdPanelCells");
  pattern.setAttribute("patternUnits", "objectBoundingBox");
  pattern.setAttribute("patternContentUnits", "objectBoundingBox");
  pattern.setAttribute("width", "0.2");
  pattern.setAttribute("height", "0.1");
  const bg = document.createElementNS(NS, "rect");
  bg.setAttribute("width", "1"); bg.setAttribute("height", "1"); bg.setAttribute("fill", "#0F2A4A");
  const shine = document.createElementNS(NS, "rect");
  shine.setAttribute("x", "0.08"); shine.setAttribute("y", "0.08");
  shine.setAttribute("width", "0.5"); shine.setAttribute("height", "0.3");
  shine.setAttribute("fill", "#3D6FA8"); shine.setAttribute("opacity", "0.4");
  const grid = document.createElementNS(NS, "rect");
  grid.setAttribute("width", "1"); grid.setAttribute("height", "1"); grid.setAttribute("fill", "none");
  grid.setAttribute("stroke", "#4A7FB5"); grid.setAttribute("stroke-width", "0.06");
  pattern.appendChild(bg); pattern.appendChild(shine); pattern.appendChild(grid);
  defs.appendChild(pattern);
}
// Screen-upright bearing (degrees) from a to b, so an edge's length label
// runs along the edge and is never upside-down.
function edgeAngleDeg(a, b) {
  const [p0, p1] = project([a, b], a[0], a[1]);
  let deg = (Math.atan2(-(p1[1] - p0[1]), p1[0] - p0[0]) * 180) / Math.PI;
  if (deg > 90 || deg < -90) deg += 180;
  return deg;
}


const clampNum = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo; };
const savedNum = (v, d) => (v === "" || v == null || !Number.isFinite(Number(v)) ? d : Number(v));

// the photo and where it lies, as they are kept with the roof (null when there is none)
const photoFields = (ph) => ({ photoUrl: ph?.url || null, photoPlace: ph?.place || null });

/* ============================================================ component === */
export default function SiteDesigner({
  lang, lat, lon, address = "", siteDesign, onChange, onApply, applying = false, projectId = null,
  projectInputs = {}, onComputeQuote, onClose, money,
}) {
  const tr = useMemo(() => makeT(lang), [lang]);
  const L3 = (o) => o[lang] || o.en;
  const fmtMoney = money || ((n) => "€" + Math.round(n).toLocaleString("en-IE"));
  const loc = { en: "en-GB", ru: "ru-RU", uk: "uk-UA" }[lang] || "ro-RO";
  const nf = (n, d = 0) => Number(n).toLocaleString(loc, { maximumFractionDigits: d, minimumFractionDigits: d });
  // what the label at the cursor says while an outline is drawn (components/drawReadout.js)
  const readoutText = useRef(null);
  useEffect(() => { readoutText.current = (m, a) => `${nf(m, 1)} m` + (a ? `, ${nf(a, 1)} m²` : ""); });

  const shellRef = useRef(null);
  const stageRef = useRef(null);
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const Lref = useRef(null);
  const planeLayers = useRef(new Map());
  const obstacleLayers = useRef(new Map());
  const markerLayers = useRef(new Map());
  const panelGroupRef = useRef(null);
  const dimensionGroupRef = useRef(null);
  const measureLayerRef = useRef(null);
  const measurePtsRef = useRef([]);
  const pendingKind = useRef(null);
  const toolRef = useRef(null);
  const markerTypeRef = useRef("mainPanel");
  const placeKindRef = useRef("vent");
  const selectedRef = useRef(null);
  const showDimensionsRef = useRef(true);
  const layoutTimer = useRef(null);
  const commitTimer = useRef(null);
  const api = useRef({});
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [tool, setTool] = useState(null);
  const [markerType, setMarkerType] = useState("mainPanel");
  const [measureResult, setMeasureResult] = useState(null);
  const [showDimensions, setShowDimensions] = useState(true);
  // roads, towns and villages over the imagery (lib/mapLabels.js)
  const [showNames, setShowNames] = useState(true);
  const namesLayer = useRef(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [shapes, setShapes] = useState({ planes: [], obstacles: [], markers: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [layout, setLayout] = useState(null);
  // how the roof was designed: from the satellite until the installer has measured it on site; the offer says which
  const [designStatus, setDesignStatus] = useState(() => (siteDesign?.status === "verified" ? "verified" : "satellite"));
  const [verifiedAt, setVerifiedAt] = useState(() => (/^\d{4}-\d{2}-\d{2}$/.test(String(siteDesign?.verifiedAt || "")) ? siteDesign.verifiedAt : ""));
  const statusRef = useRef({ status: designStatus, verifiedAt: designStatus === "verified" ? verifiedAt : "" });
  // what the sun gives each side, worked out per side (lib/sideYield.js), and kept for the quote and the offer
  const [yields, setYields] = useState({});
  const yieldCache = useRef(new Map());
  const sidesRef = useRef(Array.isArray(siteDesign?.sides) ? siteDesign.sides : []);
  const aliveRef = useRef(true);
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);
  // a photo (drone or phone) laid over the map: its address, and where it lies on the ground (null: the offer's picture only)
  const [photo, setPhoto] = useState(() => {
    const url = /^https:\/\/[^\s"']+$/.test(String(siteDesign?.photoUrl || "")) ? siteDesign.photoUrl : "";
    return url ? { url, place: cleanPlace(siteDesign?.photoPlace) } : null;
  });
  const photoRef = useRef(photo);
  useEffect(() => { photoRef.current = photo; });
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoFail, setPhotoFail] = useState(false);
  // the handles show while it is being placed; a photo already placed on an earlier visit starts settled
  const [photoAdjust, setPhotoAdjust] = useState(() => !cleanPlace(siteDesign?.photoPlace));
  const photoFile = useRef(null);
  const photoLayerRef = useRef(null);
  const photoClassRef = useRef(null);
  const photoHandlesRef = useRef(null);
  const [step, setStep] = useState(1);
  markerTypeRef.current = markerType;

  // The panel and spacing: what was saved with this roof, else the panel in
  // the quote's equipment list, else the best one in stock.
  const saved = siteDesign?.layout && typeof siteDesign.layout === "object" ? siteDesign.layout : {};
  const bomPanelId = useMemo(() => {
    try {
      const d = designCheck({ bom: Array.isArray(projectInputs?.bom) ? projectInputs.bom : [], kw: Number(projectInputs?.kw) || 0 });
      return d.fromBom.panel ? d.panel.id : null;
    } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [panelId, setPanelId] = useState(() => (PANELS.some((x) => x.id === saved.panelId) ? saved.panelId : bomPanelId || recommendPanel().id));
  const [orientation, setOrientation] = useState(() => (["portrait", "landscape", "auto"].includes(saved.orientation) ? saved.orientation : "portrait"));
  const [rowSpacingCm, setRowSpacingCm] = useState(() => savedNum(saved.rowSpacingCm, 2));
  const [colSpacingCm, setColSpacingCm] = useState(() => savedNum(saved.colSpacingCm, 2));
  const [setbackCm, setSetbackCm] = useState(() => savedNum(saved.setbackCm, 30));
  const [clusterMaxW, setClusterMaxW] = useState(() => savedNum(saved.clusterMaxW, 0));
  const [clusterMaxH, setClusterMaxH] = useState(() => savedNum(saved.clusterMaxH, 0));
  const [clusterGap, setClusterGap] = useState(() => savedNum(saved.clusterGap, 0));
  // how many of the panels that fit go on the roof: what the quote needs, the whole roof, or the installer's own number.
  // A roof drawn before this choice existed was filled whole, and stays so until changed.
  const [fill, setFill] = useState(() => (["target", "roof", "own"].includes(saved.fill) ? saved.fill
    : Array.isArray(siteDesign?.planes) && siteDesign.planes.length ? "roof" : "target"));
  const [fillOwn, setFillOwn] = useState(() => savedNum(saved.fillOwn, 0));
  // what the quote asks for, in panels of the chosen model; its kW is kept to 0.1, so a
  // quarter panel of slack keeps a roof applied from here at the same count when reopened
  const targetKw = Number(projectInputs?.kw) || 0;
  const panelW = Number(findPanel(panelId)?.watt) || 0;
  const targetPanels = targetKw > 0 && panelW > 0 ? Math.max(1, Math.ceil((targetKw * 1000) / panelW - 0.25)) : 0;
  const fillCount = fill === "own" ? fillOwn : fill === "target" ? targetPanels : 0;
  // the distance kept round vents and chimneys: none on a roof drawn before the setting existed (its panels do not
  // move), 15 cm on a new one
  const [clearanceCm, setClearanceCm] = useState(() => savedNum(saved.obstacleClearanceCm, Array.isArray(siteDesign?.planes) && siteDesign.planes.length ? 0 : 15));
  const settings = { panelId, orientation, rowSpacingCm, colSpacingCm, setbackCm, clusterMaxW, clusterMaxH, clusterGap, fill, fillOwn, fillCount, obstacleClearanceCm: clearanceCm };
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  /* ------------------------------------------------------------ the map --- */
  useEffect(() => {
    let cancelled = false;
    const history = { list: [], index: -1, restoring: false };

    function styleOf(layer) {
      const on = layer._sdId === selectedRef.current;
      if (layer._sdKind === "plane") return on ? PLANE_ON : PLANE_STYLE;
      const base = layer._sdObstacleKind === "tree" ? TREE_STYLE : OBSTACLE_STYLE;
      return on ? { ...base, weight: 4 } : base;
    }
    function restyle() {
      for (const l of planeLayers.current.values()) l.setStyle(styleOf(l));
      for (const l of obstacleLayers.current.values()) l.setStyle(styleOf(l));
      for (const [id, m] of markerLayers.current) m.getElement()?.querySelector(".sd-mk")?.classList.toggle("on", id === selectedRef.current);
    }

    function selectFromMap(ev, id) {
      // While drawing or measuring, a click on a shape belongs to that tool.
      if (toolRef.current && toolRef.current !== "edit") return;
      Lref.current.DomEvent.stop(ev);
      setSelectedId(id);
      setStep(planeLayers.current.has(id) ? 1 : 2);
    }
    function placeMarker(latlng, type, id) {
      const L = Lref.current;
      const icon = L.divIcon({
        className: "sd-mk-wrap",
        html: `<span class="sd-mk">${MARKER_ABBR[type] || "?"}</span>`,
        iconSize: [30, 30], iconAnchor: [15, 15],
      });
      const mid = id || uid();
      const m = L.marker(latlng, { icon, draggable: true, pmIgnore: true, title: L3(MARKER_LABEL[type] || MARKER_LABEL.mainPanel) }).addTo(mapRef.current);
      m._sdMarkerType = type; m._sdId = mid;
      m.on("dragend", () => commit({ geometry: false }));
      m.on("click", (ev) => selectFromMap(ev, mid));
      markerLayers.current.set(mid, m);
      return m;
    }
    function attachPlane(layer, id, { tilt = 35, az = 0, roofType = "tile", guessed = false, heightM = 0, tiltSource = "estimated" } = {}) {
      layer._sdKind = "plane"; layer._sdId = id;
      layer._sdHeight = clampNum(heightM, 0, 30);
      layer._sdTiltSrc = ["estimated", "measured", "typed"].includes(tiltSource) ? tiltSource : "estimated";
      layer._sdTilt = clampNum(tilt, 0, 60); layer._sdAzimuth = clampNum(az, -180, 180);
      layer._sdRoofType = ROOF_TYPES.includes(roofType) ? roofType : "tile";
      layer._sdAzGuess = guessed;
      layer.setStyle(styleOf(layer));
      // geoman fires its edit events on the shape itself, never on the map
      layer.on("pm:edit", () => commit({ geometry: true }));
      layer.on("click", (ev) => selectFromMap(ev, id));
      planeLayers.current.set(id, layer);
    }
    function attachObstacle(layer, id, kind, heightM) {
      layer._sdKind = "obstacle"; layer._sdId = id;
      layer._sdObstacleKind = OBSTACLE_KINDS.includes(kind) ? kind : "chimney";
      layer._sdHeight = Number.isFinite(Number(heightM)) && heightM !== null && heightM !== "" ? clampNum(heightM, 0, 30) : (OBSTACLE_HEIGHT_DEFAULT[layer._sdObstacleKind] ?? 0);
      layer.setStyle(styleOf(layer));
      layer.on("pm:edit", () => commit({ geometry: true }));
      layer.on("click", (ev) => selectFromMap(ev, id));
      obstacleLayers.current.set(id, layer);
    }

    // Every edge of every drawn shape, labelled with its real length:
    // recomputed from the live geometry, never stored.
    function renderDimensionLabels() {
      const map = mapRef.current, L = Lref.current;
      if (!map || !L) return;
      if (!dimensionGroupRef.current) dimensionGroupRef.current = L.layerGroup().addTo(map);
      dimensionGroupRef.current.clearLayers();
      if (!showDimensionsRef.current || map.getZoom() < 18) return;
      for (const layer of [...planeLayers.current.values(), ...obstacleLayers.current.values()]) {
        const ring = ringToLatLon(layer);
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i], b = ring[(i + 1) % ring.length];
          const lengthM = map.distance(L.latLng(a), L.latLng(b));
          // an edge too short on screen for its label would only bury the shape
          if (map.latLngToContainerPoint(a).distanceTo(map.latLngToContainerPoint(b)) < 48) continue;
          const icon = L.divIcon({
            className: "sd-dim-icon",
            html: `<div class="sd-dim-label" style="transform:rotate(${edgeAngleDeg(a, b).toFixed(1)}deg)">${nf(lengthM, 1)} m</div>`,
            iconSize: [56, 18], iconAnchor: [28, 9],
          });
          L.marker([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], { icon, interactive: false, pmIgnore: true, keyboard: false }).addTo(dimensionGroupRef.current);
        }
      }
    }

    function snapshotShapes() {
      return {
        planes: [...planeLayers.current.entries()].map(([id, l]) => ({
          id, polygon: ringToLatLon(l), tiltDeg: l._sdTilt, azimuthDeg: l._sdAzimuth, roofType: l._sdRoofType,
          heightM: l._sdHeight || 0, tiltSource: l._sdTiltSrc || "estimated",
        })),
        obstacles: [...obstacleLayers.current.entries()].map(([id, l]) => ({ id, polygon: ringToLatLon(l), kind: l._sdObstacleKind, heightM: l._sdHeight ?? 0 })),
        markers: [...markerLayers.current.entries()].map(([id, m]) => { const ll = m.getLatLng(); return { id, type: m._sdMarkerType, lat: ll.lat, lon: ll.lng }; }),
      };
    }
    // React's copy of what is on the map, for the side panel.
    function mirror() {
      setShapes({
        planes: [...planeLayers.current.entries()].map(([id, l]) => ({
          id, tilt: l._sdTilt, az: l._sdAzimuth, roofType: l._sdRoofType, guessed: !!l._sdAzGuess, heightM: l._sdHeight || 0, tiltSource: l._sdTiltSrc || "estimated", area: slopeAreaM2(ringToLatLon(l), RACK_ROOFS.includes(l._sdRoofType) ? 0 : l._sdTilt ?? 35),
        })),
        obstacles: [...obstacleLayers.current.entries()].map(([id, l]) => ({ id, kind: l._sdObstacleKind, heightM: l._sdHeight ?? 0 })),
        markers: [...markerLayers.current.entries()].map(([id, m]) => ({ id, type: m._sdMarkerType })),
      });
    }
    function clearAllLayers() {
      const map = mapRef.current;
      for (const l of planeLayers.current.values()) map.removeLayer(l);
      for (const l of obstacleLayers.current.values()) map.removeLayer(l);
      for (const l of markerLayers.current.values()) map.removeLayer(l);
      planeLayers.current.clear(); obstacleLayers.current.clear(); markerLayers.current.clear();
    }
    // Shared by the first draw and by undo/redo: a stored snapshot becomes map layers.
    function loadSnapshot(snap) {
      const L = Lref.current, map = mapRef.current;
      clearAllLayers();
      (snap?.planes || []).forEach((pl) => {
        if (!Array.isArray(pl.polygon) || pl.polygon.length < 3) return;
        // a roof drawn before the pitch was marked as an estimate or measured counts as one the installer entered
        attachPlane(L.polygon(pl.polygon).addTo(map), pl.id || uid(), { tilt: pl.tiltDeg ?? 35, az: pl.azimuthDeg ?? 0, roofType: pl.roofType, heightM: pl.heightM ?? 0, tiltSource: pl.tiltSource || "typed" });
      });
      (snap?.obstacles || []).forEach((ob) => {
        if (!Array.isArray(ob.polygon) || ob.polygon.length < 3) return;
        // no height recorded (drawn before heights existed): none, so its roof keeps the panels it had
        attachObstacle(L.polygon(ob.polygon).addTo(map), ob.id || uid(), ob.kind, ob.heightM ?? 0);
      });
      (snap?.markers || []).forEach((mk) => {
        if (mk.lat == null || mk.lon == null || !MARKER_ABBR[mk.type]) return;
        placeMarker([mk.lat, mk.lon], mk.type, mk.id);
      });
      if (selectedRef.current && !planeLayers.current.has(selectedRef.current) && !obstacleLayers.current.has(selectedRef.current) && !markerLayers.current.has(selectedRef.current)) setSelectedId(null);
      mirror();
      renderDimensionLabels();
    }

    function pushHistory(snap) {
      if (history.restoring) return;
      history.list = history.list.slice(0, history.index + 1);
      history.list.push(snap);
      while (history.list.length > 60) history.list.shift();
      history.index = history.list.length - 1;
      setCanUndo(history.index > 0);
      setCanRedo(false);
    }
    function restoreHistoryStep(i) {
      history.restoring = true;
      history.index = i;
      loadSnapshot(history.list[i]);
      onChangeRef.current?.({ ...history.list[i], layout: settingsRef.current, sides: sidesRef.current, ...statusRef.current, ...photoFields(photoRef.current) });
      history.restoring = false;
      setCanUndo(history.index > 0);
      setCanRedo(history.index < history.list.length - 1);
      scheduleLayout(0);
    }
    const undo = () => { if (history.index > 0) restoreHistoryStep(history.index - 1); };
    const redo = () => { if (history.index < history.list.length - 1) restoreHistoryStep(history.index + 1); };

    // Something changed on the roof: save it, remember it for undo, and
    // refit the panels. A moved outline drops the old panels at once (so a
    // stale layout never looks current) and refits after a short pause.
    function commit({ geometry }) {
      const snap = snapshotShapes();
      mirror();
      onChangeRef.current?.({ ...snap, layout: settingsRef.current, sides: sidesRef.current, ...statusRef.current, ...photoFields(photoRef.current) });
      renderDimensionLabels();
      pushHistory(snap);
      if (geometry) panelGroupRef.current?.clearLayers();
      scheduleLayout(geometry ? 350 : 0);
    }
    function scheduleLayout(ms) {
      clearTimeout(layoutTimer.current);
      layoutTimer.current = setTimeout(() => api.current.runLayout?.(), ms);
    }

    let stopReadout = () => {};
    function endTool() {
      stopReadout();
      const map = mapRef.current;
      if (map) {
        // the drawing layer can be gone while the planner closes: ending a tool then is a no-op
        if (map.pm) {
          map.pm.disableDraw();
          if (map.pm.globalEditModeEnabled()) map.pm.disableGlobalEditMode();
        }
        map.getContainer().style.cursor = "";
      }
      pendingKind.current = null;
      measurePtsRef.current = [];
      if (measureLayerRef.current && map) { map.removeLayer(measureLayerRef.current); measureLayerRef.current = null; }
      toolRef.current = null;
      setTool(null);
      setMeasureResult(null);
    }
    function startTool(next) {
      endTool();
      const map = mapRef.current;
      if (!next || !map || !map.pm) return;
      if (next === "plane" || next === "obstacle") {
        pendingKind.current = next;
        stopReadout = drawReadout(map, (m, a) => readoutText.current?.(m, a) || "");
        map.pm.enableDraw("Polygon", { pathOptions: next === "plane" ? PLANE_ON : OBSTACLE_STYLE, snappable: true, snapDistance: 8, allowSelfIntersection: false, templineStyle: { color: "#E89B2D" }, hintlineStyle: { color: "#E89B2D", dashArray: [5, 5] } });
      } else if (next === "tree") {
        map.pm.enableDraw("Circle", { pathOptions: TREE_STYLE, snappable: true });
      } else if (next === "measure" || next === "marker" || next === "place") {
        map.getContainer().style.cursor = next === "measure" ? "crosshair" : "copy";
      } else if (next === "edit") {
        map.pm.enableGlobalEditMode({ allowSelfIntersection: false, snappable: true });
      }
      toolRef.current = next;
      setTool(next);
    }

    function removeShape(id) {
      const map = mapRef.current;
      const l = planeLayers.current.get(id) || obstacleLayers.current.get(id) || markerLayers.current.get(id);
      if (!l || !map) return;
      map.removeLayer(l);
      planeLayers.current.delete(id); obstacleLayers.current.delete(id); markerLayers.current.delete(id);
      if (selectedRef.current === id) setSelectedId(null);
      commit({ geometry: true });
    }
    function focusShape(id) {
      const map = mapRef.current;
      const l = planeLayers.current.get(id) || obstacleLayers.current.get(id);
      if (l && map) map.fitBounds(l.getBounds(), { padding: [70, 70], maxZoom: 20 });
      const m = markerLayers.current.get(id);
      if (m && map) map.panTo(m.getLatLng());
    }
    function recenter() {
      const map = mapRef.current, L = Lref.current;
      if (!map || !L) return;
      if (planeLayers.current.size) map.fitBounds(L.featureGroup([...planeLayers.current.values()]).getBounds(), { padding: [70, 70], maxZoom: 20 });
      else map.setView([lat, lon], 19);
    }
    function updatePlane(id, patch) {
      const l = planeLayers.current.get(id);
      if (!l) return;
      if (patch.tilt != null && Number.isFinite(patch.tilt)) { l._sdTilt = Math.round(clampNum(patch.tilt, 0, 60)); l._sdTiltSrc = patch.tiltSource === "measured" ? "measured" : "typed"; }
      if (patch.heightM != null && Number.isFinite(patch.heightM)) l._sdHeight = Math.round(clampNum(patch.heightM, 0, 30) * 10) / 10;
      if (patch.az != null && Number.isFinite(patch.az)) { l._sdAzimuth = Math.round(clampNum(patch.az, -180, 180)); l._sdAzGuess = false; }
      if (patch.roofType) {
        l._sdRoofType = patch.roofType;
        // on a flat roof or the ground the pitch is the racks' angle: an estimated pitch follows to a usual one
        if (l._sdTiltSrc === "estimated" && RACK_ROOFS.includes(patch.roofType)) l._sdTilt = patch.roofType === "ground" ? 25 : 15;
      }
      mirror();
      // a slider sends many small moves: save and remember the last one
      clearTimeout(commitTimer.current);
      commitTimer.current = setTimeout(() => { commitTimer.current = null; commit({ geometry: false }); }, 280);
    }
    function updateObstacle(id, patch) {
      const l = obstacleLayers.current.get(id);
      if (!l) return;
      const p = typeof patch === "string" ? { kind: patch } : patch || {};
      if (p.kind && OBSTACLE_KINDS.includes(p.kind)) {
        l._sdObstacleKind = p.kind;
        // a new kind brings that kind's usual height, unless the height was set in the same breath
        if (p.heightM == null) l._sdHeight = OBSTACLE_HEIGHT_DEFAULT[p.kind] ?? 0;
      }
      if (p.heightM != null && Number.isFinite(Number(p.heightM))) l._sdHeight = Math.round(clampNum(p.heightM, 0, 30) * 10) / 10;
      l.setStyle(styleOf(l));
      mirror();
      commit({ geometry: true });
    }
    // One click sets a vent, a pipe, a chimney or a skylight down at its real size.
    function placePreset(latlng, kind) {
      const L = Lref.current, map = mapRef.current;
      const ring = presetRing(kind, [latlng.lat, latlng.lng]);
      if (!ring) return null;
      const id = uid();
      attachObstacle(L.polygon(ring).addTo(map), id, kind, OBSTACLE_HEIGHT_DEFAULT[kind]);
      return id;
    }
    function setDimensions(on) {
      showDimensionsRef.current = on;
      renderDimensionLabels();
    }
    api.current = { ...api.current, commitNow: () => commit({ geometry: false }), undo, redo, startTool, endTool, removeShape, focusShape, recenter, updatePlane, updateObstacle, restyle, setDimensions, snapshotShapes, scheduleLayout };

    async function init() {
      // leaflet-geoman's bundle expects a global `L` (it was built to run after
      // Leaflet's own <script> tag), so Leaflet is imported and published to
      // window.L first, then geoman.
      const { default: L } = await import("leaflet");
      if (cancelled || !mapEl.current) return;
      window.L = L;
      await import("@geoman-io/leaflet-geoman-free");
      await import("@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css");
      if (cancelled || !mapEl.current) return;
      Lref.current = L;

      const map = L.map(mapEl.current, { zoomControl: false, maxZoom: 21 }).setView([lat, lon], 19);
      mapRef.current = map;
      L.control.zoom({ position: "bottomright" }).addTo(map);
      // leaflet-geoman attaches map.pm when the map is made; if it missed this map, attach it now
      if (!map.pm && L.PM?.Map) map.pm = new L.PM.Map(map);
      drawLang(map, lang);

      const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      const googleLayer = googleKey ? await loadGoogleSatelliteLayer(L, googleKey) : null;
      if (googleLayer) googleLayer.addTo(map);
      else {
        // Esri has nothing past ~z18 over most of Moldova and Romania, so it
        // stops fetching there and upscales the last real tile instead of
        // showing its "no data" filler.
        L.tileLayer(SAT_ESRI, { maxZoom: 21, maxNativeZoom: 18, attribution: "Tiles &copy; Esri" }).addTo(map);
      }
      if (cancelled || !mapEl.current) return;
      namesLayer.current = labelLayer(L);
      { const on = namesPref(); setShowNames(on); if (on) namesLayer.current.addTo(map); }
      // the imagery and names around the house, kept for a roof with no signal
      postTiles(tilesAround({ lat, lon }, 250, [17, 18, 19], [SAT_ESRI, ...LABEL_TILES], 400));
      L.marker([lat, lon], {
        icon: L.divIcon({ className: "sd-pin-wrap", html: PIN_SVG, iconSize: [32, 40], iconAnchor: [16, 39] }),
        interactive: false, keyboard: false, pmIgnore: true, zIndexOffset: -100,
      }).addTo(map);

      loadSnapshot(siteDesign);
      history.list = [snapshotShapes()];
      history.index = 0;
      setCanUndo(false); setCanRedo(false);
      if (planeLayers.current.size) map.fitBounds(L.featureGroup([...planeLayers.current.values()]).getBounds(), { padding: [70, 70], maxZoom: 20 });

      map.on("pm:create", (e) => {
        const id = uid();
        if (e.shape === "Polygon") {
          const kind = pendingKind.current || "plane";
          if (kind === "plane") {
            const ring = ringToLatLon(e.layer);
            const prev = [...planeLayers.current.values()].pop();
            const az = facingFromShape(ring);
            attachPlane(e.layer, id, { tilt: prev?._sdTilt ?? 35, az: az ?? 0, roofType: prev?._sdRoofType || "tile", guessed: az != null });
          } else {
            attachObstacle(e.layer, id, "chimney");
          }
        } else if (e.shape === "Circle") {
          const ring = circleToRing(e.layer.getLatLng(), e.layer.getRadius(), 24);
          map.removeLayer(e.layer);
          attachObstacle(L.polygon(ring).addTo(map), id, "tree");
        } else {
          return;
        }
        endTool();
        selectedRef.current = id;
        setSelectedId(id);
        setStep(planeLayers.current.has(id) ? 1 : 2);
        restyle();
        commit({ geometry: true });
      });
      map.on("click", (e) => {
        const t = toolRef.current;
        if (t === "place") {
          const id = placePreset(e.latlng, placeKindRef.current);
          if (!id) return;
          // stay in the tool: a roof usually has several vents; Esc or Done ends it
          selectedRef.current = id;
          setSelectedId(id);
          restyle();
          commit({ geometry: true });
          return;
        }
        if (t === "marker") {
          const id = uid();
          placeMarker(e.latlng, markerTypeRef.current, id);
          endTool();
          selectedRef.current = id;
          setSelectedId(id);
          setStep(2);
          restyle();
          commit({ geometry: false });
          return;
        }
        if (t === "measure") {
          measurePtsRef.current.push(e.latlng);
          if (measureLayerRef.current) { map.removeLayer(measureLayerRef.current); measureLayerRef.current = null; }
          if (measurePtsRef.current.length === 1) {
            setMeasureResult(null);
            measureLayerRef.current = L.circleMarker(e.latlng, { radius: 5, color: "#fff", weight: 2, fillColor: "#E89B2D", fillOpacity: 1, pmIgnore: true, interactive: false }).addTo(map);
          } else {
            const [p1, p2] = measurePtsRef.current;
            measureLayerRef.current = L.polyline([p1, p2], { color: "#E89B2D", weight: 3, dashArray: "6 6", pmIgnore: true, interactive: false }).addTo(map);
            setMeasureResult(map.distance(p1, p2));
            measurePtsRef.current = [];
          }
          return;
        }
        if (!t) setSelectedId(null);
      });
      map.on("zoomend", renderDimensionLabels);

      setReady(true);
      if (planeLayers.current.size) scheduleLayout(50);
    }

    init().catch((e) => {
      if (cancelled) return;
      console.error("SiteDesigner failed to load:", e?.message || e);
      setLoadError(true);
    });

    return () => {
      cancelled = true;
      clearTimeout(layoutTimer.current);
      // closed within a moment of a change: save it now rather than drop it
      if (commitTimer.current) { clearTimeout(commitTimer.current); commitTimer.current = null; try { api.current.commitNow?.(); } catch { /* the map is already gone */ } }
      mapRef.current?.remove();
      mapRef.current = null;
      planeLayers.current.clear();
      obstacleLayers.current.clear();
      markerLayers.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // a fresh map each time the designer opens, at the address the quote has now

  // The map fills whatever space it is given: keep Leaflet's size in step
  // (a phone turning, the side panel wrapping under the map).
  useEffect(() => {
    if (!mapEl.current || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => mapRef.current?.invalidateSize());
    ro.observe(mapEl.current);
    return () => ro.disconnect();
  }, []);

  // Selection: highlight on the map, bring the card into view.
  useEffect(() => {
    selectedRef.current = selectedId;
    api.current.restyle?.();
    // on a phone the cards sit under the map: scrolling to one would push the map off screen
    if (selectedId && !window.matchMedia("(max-width: 860px)").matches) document.getElementById("sd-item-" + selectedId)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  // Fits the chosen module into every drawn side, skipping every obstacle,
  // and draws rails and panels on the map.
  function runLayout() {
    const L = Lref.current, map = mapRef.current;
    if (!L || !map) return;
    if (!panelGroupRef.current) panelGroupRef.current = L.layerGroup().addTo(map);
    panelGroupRef.current.clearLayers();
    if (planeLayers.current.size === 0) { setLayout(null); return; }
    const s = settingsRef.current;
    const panel = findPanel(s.panelId) || recommendPanel();
    const { w, h } = panel.dimensionsMm || { w: 1909, h: 1134 };
    ensurePanelPattern(map);

    let totalCount = 0, roofAreaM2 = 0, fitCount = 0;
    const perPlane = [];
    // the one fit the quote and the offer use too (lib/roofLayout.js fitSidesFor): on the real slope, obstacles kept
    // clear with their shadows, a higher roof level shading the lower one
    const fits = fitSidesFor({ ...api.current.snapshotShapes(), layout: s }, { w, h });
    // only as many as chosen, the sides facing nearest south first; the rest stay as faint outlines
    for (const { id, polygon, panels, count, rows, spare } of limitPanels(fits, s.fillCount)) {
      const layer = planeLayers.current.get(id);
      totalCount += count;
      fitCount += count + spare.length;
      const areaM2 = slopeAreaM2(polygon, RACK_ROOFS.includes(layer._sdRoofType) ? 0 : layer._sdTilt ?? 35);
      roofAreaM2 += areaM2;
      const [clat, clon] = centroidOf(polygon);
      perPlane.push({ id, tiltDeg: layer._sdTilt ?? 35, azimuthDeg: layer._sdAzimuth ?? 0, roofType: layer._sdRoofType || "tile", tiltSource: layer._sdTiltSrc || "estimated", lat: clat, lon: clon, count, areaM2 });
      // rails first, panels on top: the same rows lib/mountingEstimate.js counts
      rows.forEach((r) => {
        L.polyline(r.rail1, { color: "#5B6B7A", weight: 3, opacity: 0.85, interactive: false, pmIgnore: true }).addTo(panelGroupRef.current);
        L.polyline(r.rail2, { color: "#5B6B7A", weight: 3, opacity: 0.85, interactive: false, pmIgnore: true }).addTo(panelGroupRef.current);
      });
      // the panels of a side as one shape each way (placed, and the places left free): one map element, not hundreds
      if (panels.length) L.polygon(panels.map((c) => [c]), { color: "#B9C4CE", weight: 1, fillColor: "url(#sdPanelCells)", fillOpacity: 1, interactive: false, pmIgnore: true }).addTo(panelGroupRef.current);
      if (spare.length) L.polygon(spare.map((c) => [c]), { color: "#DDE3E8", weight: 1, opacity: 0.6, dashArray: "3 3", fill: false, interactive: false, pmIgnore: true }).addTo(panelGroupRef.current);
    }
    const kw = Math.round(((totalCount * panel.watt) / 1000) * 10) / 10;
    setLayout({
      totalCount, kw, perPlane, panelId: panel.id, panelBrand: panel.brand, panelModel: panel.model, panelWatt: panel.watt,
      panelAreaM2: (totalCount * w * h) / 1e6, roofAreaM2, fitCount,
    });
  }
  api.current.runLayout = runLayout;

  // A changed panel or spacing refits at once and is saved with the roof,
  // so the quote and the proposal fit panels the same way.
  const settingsJson = JSON.stringify(settings);
  const lastSettings = useRef(settingsJson);
  useEffect(() => {
    if (!ready || settingsJson === lastSettings.current) return;
    lastSettings.current = settingsJson;
    onChangeRef.current?.({ ...api.current.snapshotShapes(), layout: settingsRef.current, sides: sidesRef.current, ...statusRef.current, ...photoFields(photoRef.current) });
    api.current.scheduleLayout?.(200);
  }, [ready, settingsJson]);

  // Keyboard: Esc ends the tool (or closes), Ctrl+Z / Ctrl+Shift+Z undo and
  // redo, Delete removes what is selected. Never while typing in a field.
  useEffect(() => {
    function onKey(e) {
      const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName || "");
      if (e.key === "Escape") {
        e.preventDefault();
        // in a field, Esc leaves the field; it never throws the whole designer away
        if (typing) e.target.blur();
        else if (toolRef.current) api.current.endTool?.();
        else onCloseRef.current?.();
        return;
      }
      if (typing) return;
      const k = e.key.toLowerCase();
      // while an outline is being drawn, Ctrl+Z takes back its last corner, not the shape before it
      const draw = mapRef.current?.pm?.Draw?.Polygon;
      if ((e.ctrlKey || e.metaKey) && k === "z" && !e.shiftKey && toolRef.current && draw?._enabled && draw._layer?.getLatLngs?.().length) {
        e.preventDefault(); draw._removeLastVertex?.(); return;
      }
      // 1, 2, 3... pick the tools in the toolbar's order, the same in every language
      if (!e.ctrlKey && !e.metaKey && !e.altKey && /^[1-9]$/.test(e.key)) {
        const b = document.querySelectorAll(".sd-tools .sd-tool")[Number(e.key) - 1];
        if (b) { e.preventDefault(); b.click(); return; }
      }
      if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); if (e.shiftKey) api.current.redo?.(); else api.current.undo?.(); }
      else if ((e.ctrlKey || e.metaKey) && k === "y") { e.preventDefault(); api.current.redo?.(); }
      else if ((e.key === "Delete" || e.key === "Backspace") && selectedRef.current && !toolRef.current) { e.preventDefault(); api.current.removeShape?.(selectedRef.current); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The page behind stays put while the designer is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    shellRef.current?.focus();
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* ------------------------------------------------------------ numbers --- */
  // Real payback/CO2 for the layout's own kWp: the same engine call the
  // quote uses, with only kw swapped, so the two can never disagree.
  const perYield = useMemo(() => (layout?.perPlane || []).map((pl) => ({ ...pl, ...(yields[sideKey(pl)] || {}) })), [layout, yields]);
  // a side still being looked up is neither used nor counted as failed
  const liveBlend = useMemo(() => blendYields(perYield.filter((x) => !x.pending)), [perYield]);
  const sidesNow = useMemo(() => sideSummaries(perYield, layout?.panelWatt), [perYield, layout]);
  useEffect(() => {
    const per = layout?.perPlane || [];
    const todo = per.filter((pl) => pl.count > 0 && !yieldCache.current.has(sideKey(pl)));
    if (!todo.length) return;
    const t = setTimeout(async () => {
      todo.forEach((pl) => yieldCache.current.set(sideKey(pl), { pending: true }));
      if (aliveRef.current) setYields(Object.fromEntries(yieldCache.current));
      for (const pl of todo) {
        const r = await fetchSideYield(pl);
        // a failed lookup is not remembered: the next refit tries again
        if (r.yieldPerKwp) yieldCache.current.set(sideKey(pl), r); else yieldCache.current.set(sideKey(pl), { failed: true });
      }
      if (aliveRef.current) setYields(Object.fromEntries(yieldCache.current));
    }, 700);
    return () => clearTimeout(t);
  }, [layout]);
  // the sides' own figures go to the quote with the roof (and to the offer from there)
  const sidesJson = JSON.stringify(sidesNow);
  const lastSides = useRef(JSON.stringify(Array.isArray(siteDesign?.sides) ? siteDesign.sides : []));
  useEffect(() => {
    if (!ready || !layout || sidesJson === lastSides.current) return;
    lastSides.current = sidesJson;
    sidesRef.current = sidesNow;
    onChangeRef.current?.({ ...api.current.snapshotShapes(), layout: settingsRef.current, sides: sidesNow, ...statusRef.current, ...photoFields(photoRef.current) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, sidesJson]);
  // the design status is saved with the roof as soon as it changes
  useEffect(() => {
    const next = { status: designStatus, verifiedAt: designStatus === "verified" ? verifiedAt : "" };
    if (JSON.stringify(next) === JSON.stringify(statusRef.current)) return;
    statusRef.current = next;
    if (ready) onChangeRef.current?.({ ...api.current.snapshotShapes(), layout: settingsRef.current, sides: sidesRef.current, ...next, ...photoFields(photoRef.current) });
  }, [ready, designStatus, verifiedAt]);

  /* ------------------------------------------------ the photo over the map --- */
  // The photo laid over the imagery and, while it is being placed, its handles: the middle one moves it, the
  // square on its right edge sizes and turns it. The map is updated at once while a handle is dragged; the
  // state (and the save) only when it is let go.
  const setPhotoPlace = (patch) => setPhoto((p) => (p?.place ? { ...p, place: cleanPlace({ ...p.place, ...patch }) } : p));
  useEffect(() => {
    const map = mapRef.current, L = Lref.current;
    if (!ready || !map || !L) return;
    const url = photo?.url, place = photo?.place;
    let layer = photoLayerRef.current;
    if (layer && (!place || layer._url !== url)) { map.removeLayer(layer); layer = photoLayerRef.current = null; }
    if (place && url) {
      if (!layer) {
        if (!photoClassRef.current) photoClassRef.current = makePhotoLayer(L);
        // the picture's own shape, once it has loaded, so the map and the offer draw it undistorted
        layer = new photoClassRef.current(url, place, (aspect) => setPhoto((p) => (p?.place && Math.abs(p.place.aspect - aspect) > 0.001 ? { ...p, place: cleanPlace({ ...p.place, aspect }) } : p)));
        layer.addTo(map);
        photoLayerRef.current = layer;
      } else layer.setPlace(place);
    }
    let h = photoHandlesRef.current;
    const showHandles = !!place && photoAdjust && !tool;
    if (h && !showHandles) { h.group.remove(); photoHandlesRef.current = h = null; }
    if (!showHandles) return;
    if (h) {
      h.frame.setLatLngs(photoCorners(place));
      h.link.setLatLngs([[place.lat, place.lon], handleLatLon(place)]);
      h.move.setLatLng([place.lat, place.lon]);
      h.size.setLatLng(handleLatLon(place));
      return;
    }
    const icon = (cls) => L.divIcon({ className: "sd-photo-h " + cls, iconSize: [28, 28], iconAnchor: [14, 14] });
    const mk = (ll, cls, title) => L.marker(ll, { draggable: true, pmIgnore: true, keyboard: false, title, icon: icon(cls), zIndexOffset: 800 });
    const frame = L.polygon(photoCorners(place), { color: "#fff", weight: 2, dashArray: "7 5", fill: false, interactive: false, pmIgnore: true });
    const link = L.polyline([[place.lat, place.lon], handleLatLon(place)], { color: "#E89B2D", weight: 2, dashArray: "3 5", interactive: false, pmIgnore: true });
    const move = mk([place.lat, place.lon], "move", tr("photoMove"));
    const size = mk(handleLatLon(place), "size", tr("photoSize"));
    const group = L.layerGroup([frame, link, move, size]).addTo(map);
    const live = { place, moved: false };
    const sync = (pl) => { live.place = pl; live.moved = true; photoLayerRef.current?.setPlace(pl); frame.setLatLngs(photoCorners(pl)); link.setLatLngs([[pl.lat, pl.lon], handleLatLon(pl)]); };
    move.on("drag", (e) => { const base = photoRef.current?.place; if (!base) return; const pl = placeAt(base, e.latlng.lat, e.latlng.lng); sync(pl); size.setLatLng(handleLatLon(pl)); });
    size.on("drag", (e) => { const base = photoRef.current?.place; if (!base) return; sync(placeFromHandle(base, e.latlng.lat, e.latlng.lng)); });
    const end = () => { if (!live.moved) return; live.moved = false; setPhoto((p) => (p?.place ? { ...p, place: live.place } : p)); };
    move.on("dragend", end);
    size.on("dragend", end);
    photoHandlesRef.current = { group, frame, link, move, size };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, photo, photoAdjust, tool]);
  // the photo and where it lies are saved with the roof as soon as they change
  const photoJson = JSON.stringify(photoFields(photo));
  const lastPhoto = useRef(photoJson);
  useEffect(() => {
    if (!ready || photoJson === lastPhoto.current) return;
    lastPhoto.current = photoJson;
    onChangeRef.current?.({ ...api.current.snapshotShapes(), layout: settingsRef.current, sides: sidesRef.current, ...statusRef.current, ...photoFields(photoRef.current) });
  }, [ready, photoJson]);
  // a first place for a photo: the middle of what the map shows now
  function viewPlace() {
    const map = mapRef.current;
    if (!map) return null;
    const c = map.getCenter();
    return startPlace({ lat: c.lat, lon: c.lng }, map.getSize().x * metersPerPixel(c.lat, map.getZoom()));
  }
  async function addPhoto(file) {
    if (!file || !projectId) return;
    setPhotoBusy(true); setPhotoFail(false);
    try {
      const url = await uploadRoofPhoto(projectId, file);
      setPhoto({ url, place: viewPlace() });
      setPhotoAdjust(true);
    } catch {
      setPhotoFail(true);
    } finally {
      setPhotoBusy(false);
    }
  }
  const layPhoto = () => {
    const place = viewPlace();
    if (place) { setPhoto((p) => (p ? { ...p, place } : p)); setPhotoAdjust(true); }
  };
  const quoteResult = useMemo(
    () => (layout && layout.totalCount > 0 && typeof onComputeQuote === "function"
      // the sun each side really gets, so a changed pitch or facing moves the payback too
      ? onComputeQuote(layout.kw, liveBlend.yieldOverride ? { yieldOverride: liveBlend.yieldOverride, ...(liveBlend.monthlyYieldShape ? { monthlyYieldShape: liveBlend.monthlyYieldShape } : {}) } : undefined)
      : null),
    [layout, onComputeQuote, liveBlend]);
  let bands = null, prodMonthly = null, consMonthly = null, co2Year = 0;
  if (quoteResult) {
    bands = { pess: quoteResult.p, expc: quoteResult.e, opti: quoteResult.o };
    const shape = liveBlend.monthlyYieldShape || (Array.isArray(projectInputs?.monthlyYieldShape) && projectInputs.monthlyYieldShape.length === 12
      ? projectInputs.monthlyYieldShape : SOLAR_SEASON);
    const shapeSum = shape.reduce((a, b) => a + (Number(b) || 0), 0) || 1;
    prodMonthly = shape.map((f) => (quoteResult.e.prod0 * (Number(f) || 0)) / shapeSum);
    const consEff = Math.max(0, Number(effectiveConsumption(projectInputs || {})) || 0);
    consMonthly = (projectInputs?.useMonthly && Array.isArray(projectInputs.consMonthly) && projectInputs.consMonthly.length === 12)
      ? projectInputs.consMonthly.map((v) => Number(v) || 0)
      : new Array(12).fill(consEff / 12);
    co2Year = quoteResult.e.prod0 * (CO2_FACTOR[projectInputs?.market] ?? CO2_FACTOR.MD);
  }
  const countFor = (id) => layout?.perPlane.find((p) => p.id === id)?.count ?? null;

  /* ------------------------------------------------------------- render --- */
  // The map's own toolbar: the drawing tools, then the two that work on
  // anything already drawn. Electrical points live in the Obstacles tab.
  const TOOLS = [
    { id: "plane", Icon: Pentagon, label: tr("t_plane") },
    { id: "obstacle", Icon: Box, label: tr("t_obstacle") },
    { id: "tree", Icon: TreeDeciduous, label: tr("t_tree") },
    "sep",
    { id: "measure", Icon: Ruler, label: tr("t_measure") },
    { id: "edit", Icon: Move, label: tr("t_edit") },
  ];
  const TOOL_TAB = { plane: 1, obstacle: 2, tree: 2, marker: 2 };
  const pick = (id) => {
    const next = tool === id ? null : id;
    if (next && TOOL_TAB[next]) setStep(TOOL_TAB[next]);
    api.current.startTool?.(next);
    // On a phone the tabs sit under the map: bring the map back into view to draw on.
    const r = stageRef.current?.getBoundingClientRect();
    if (next && r && (r.top < 0 || r.bottom > window.innerHeight + 1)) stageRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // the pitch from the phone's tilt sensor
  const [measuring, setMeasuring] = useState(null);
  const [pitchMsg, setPitchMsg] = useState("");
  const [placeKind, setPlaceKind] = useState("vent");
  async function measurePitch(id) {
    setPitchMsg(""); setMeasuring(id);
    const r = await measurePhoneTilt();
    setMeasuring(null);
    if (r.ok) api.current.updatePlane?.(id, { tilt: r.tiltDeg, tiltSource: "measured" });
    else setPitchMsg(tr(r.error === "denied" ? "pitchDenied" : "pitchNoSensor"));
  }
  const pickPlace = (kind) => {
    const same = tool === "place" && placeKind === kind;
    placeKindRef.current = kind; setPlaceKind(kind);
    api.current.startTool?.(same ? null : "place");
    const r = stageRef.current?.getBoundingClientRect();
    if (!same && r && (r.top < 0 || r.bottom > window.innerHeight + 1)) stageRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // what the sun gives this side, once looked up
  const sideYieldLine = (pl) => {
    const lp = layout?.perPlane.find((x) => x.id === pl.id);
    if (!lp || !(lp.count > 0)) return null;
    const y = yields[sideKey(lp)];
    const row = sidesNow.find((s) => s.id === pl.id);
    if (!y || y.pending) return <p className="sd-note">{tr("yieldLoading")}</p>;
    if (y.failed || !row?.yieldPerKwp) return <p className="sd-note">{tr("yieldNone")}</p>;
    return <p className="sd-note">{tr("yieldSide", { y: nf(row.yieldPerKwp, 0), kwh: nf(row.kwh, 0) })}</p>;
  };
  const hasPlanes = shapes.planes.length > 0;
  const hasObstacles = shapes.obstacles.length > 0;
  const hasPoints = shapes.markers.length > 0;
  const fitsAny = !!layout && layout.totalCount > 0;
  const tabDone = { 1: hasPlanes, 2: hasObstacles || hasPoints, 3: fitsAny };
  const panel = findPanel(panelId);
  // what the quote asks for: its kW in panels of the chosen model, and the clear roof they need
  // (the panels' own area plus about a quarter for the gaps, the edges and the walkways)
  const panelM2 = panel?.dimensionsMm ? (panel.dimensionsMm.w / 1000) * (panel.dimensionsMm.h / 1000) : 2;
  const targetM2 = Math.round(targetPanels * panelM2 * 1.25);
  const placed = layout?.totalCount || 0;
  const meterPct = targetPanels ? Math.min(100, Math.round((placed / targetPanels) * 100)) : 0;
  const tabSub = {
    1: hasPlanes ? (shapes.planes.length === 1 ? tr("sub1_one") : tr("sub1", { n: shapes.planes.length })) : tr("sub1_none"),
    2: hasObstacles || hasPoints ? tr("sub2", { n: shapes.obstacles.length + shapes.markers.length }) : tr("sub2_none"),
    3: fitsAny ? `${placed} ${panelsNoun(placed, lang)}` : tr("sub3_none"),
  };

  let hint = null;
  if (tool === "plane") hint = tr("h_plane");
  else if (tool === "obstacle") hint = tr("h_obstacle");
  else if (tool === "tree") hint = tr("h_tree");
  else if (tool === "measure") hint = tr("h_measure");
  else if (tool === "marker") hint = tr("h_marker");
  else if (tool === "place") hint = tr("h_place");
  else if (tool === "edit") hint = tr("h_edit");

  // One roof side: a summary row, and when it is the one being worked on,
  // its material, pitch and facing.
  const planeCard = (pl, i) => {
    const name = tr("plane", { n: i + 1 });
    const open = selectedId === pl.id || shapes.planes.length === 1;
    const dir = nearestDir(pl.az);
    const count = countFor(pl.id);
    return (
      <article key={pl.id} id={"sd-item-" + pl.id} className={"sd-plane" + (selectedId === pl.id ? " on" : "")}>
        <div className="sd-plane-top">
          <button type="button" className="sd-plane-name" onClick={() => { setSelectedId(pl.id); api.current.focusShape?.(pl.id); }} aria-expanded={open}>
            <i className="sd-swatch" aria-hidden="true" />
            <span>
              <b>{name}</b>
              <small>{tr("planeSum", { a: nf(pl.area, 0), tilt: pl.tilt, dir: compassLabel(pl.az, lang).toLowerCase() })}</small>
            </span>
          </button>
          {count != null && <span className="sd-plane-fit">{count} {panelsNoun(count, lang)}</span>}
          <button type="button" className="sd-ibtn del" onClick={() => api.current.removeShape?.(pl.id)} aria-label={tr("del", { name })} title={tr("del", { name })}>
            <Trash2 size={17} />
          </button>
        </div>
        {open && (
          <div className="sd-plane-body">
            <label className="sd-field">
              <span className="sd-lbl">{tr("material")}</span>
              <select className="sd-select" value={pl.roofType} onChange={(e) => api.current.updatePlane?.(pl.id, { roofType: e.target.value })}>
                {ROOF_TYPES.map((k) => <option key={k} value={k}>{L3(ROOF_TYPE_LABEL[k])}</option>)}
              </select>
            </label>
            <div className="sd-field">
              <span className="sd-lbl-row">
                <span className="sd-lbl" id={"sd-pitch-" + pl.id}>{tr(RACK_ROOFS.includes(pl.roofType) ? "rackAngle" : "pitch")}</span>
                <span className="sd-numwrap">
                  <NumInput className="sd-num" min="0" max="60" step="1" value={pl.tilt} aria-labelledby={"sd-pitch-" + pl.id}
                    onValue={(v) => api.current.updatePlane?.(pl.id, { tilt: v })} />
                  <span className="sd-unit">°</span>
                </span>
              </span>
              <input type="range" className="sd-slider" min="0" max="60" step="1" value={pl.tilt} aria-labelledby={"sd-pitch-" + pl.id}
                style={{ "--fill": (pl.tilt / 60) * 100 + "%" }} onChange={(e) => api.current.updatePlane?.(pl.id, { tilt: +e.target.value })} />
              {RACK_ROOFS.includes(pl.roofType) && <span className="sd-note">{tr("rackHelp")}</span>}
              {/* a pitch nobody measured or entered is an estimate, and said to be: the yield rests on it */}
              {pl.tiltSource === "estimated" && <p className="sd-guess"><Info size={15} aria-hidden="true" />{tr("pitchEst")}</p>}
              {pl.tiltSource === "measured" && <p className="sd-note">{tr("pitchMeasured")}</p>}
              <button type="button" className="sd-btn" disabled={measuring === pl.id} onClick={() => measurePitch(pl.id)}>
                {measuring === pl.id ? tr("pitchReading") : tr("pitchMeasure")}
              </button>
              <span className="sd-note">{tr("pitchHow")}</span>
              {pitchMsg && measuring === null && selectedId === pl.id && <p className="sd-warn" role="alert">{pitchMsg}</p>}
              {sideYieldLine(pl)}
              <span className="sd-scale" aria-hidden="true"><span>0° {tr("flat")}</span><span>30°</span><span>60°</span></span>
            </div>
            {shapes.planes.length > 1 && (
              <div className="sd-field">
                <span className="sd-lbl-row">
                  <span className="sd-lbl" id={"sd-h-" + pl.id}>{tr("planeHeight")}</span>
                  <span className="sd-numwrap">
                    <NumInput className="sd-num" min="0" max="30" step="0.5" value={pl.heightM || 0} aria-labelledby={"sd-h-" + pl.id}
                      onValue={(v) => api.current.updatePlane?.(pl.id, { heightM: v })} />
                    <span className="sd-unit">m</span>
                  </span>
                </span>
                <span className="sd-note">{tr("planeHeightHelp")}</span>
              </div>
            )}
            <div className="sd-field">
              <span className="sd-lbl">{tr("facing")}</span>
              <div className="sd-compass-row">
                <div className="sd-compass" role="radiogroup" aria-label={tr("facing")}>
                  {DIRS.map((d, k) => d ? (
                    <button key={k} type="button" role="radio" aria-checked={dir.az === d.az} className={"sd-dir" + (dir.az === d.az ? " on" : "")}
                      onClick={() => api.current.updatePlane?.(pl.id, { az: d.az })} title={compassLabel(d.az, lang)}>{d[lang] || d.en}</button>
                  ) : (
                    <span key={k} className="sd-compass-mid" aria-hidden="true">
                      {/* points down the slope: facing south points down the compass */}
                      <svg width="24" height="24" viewBox="0 0 24 24" style={{ transform: `rotate(${pl.az + 180}deg)` }}>
                        <path d="M12 3 L18 15 H13.5 V21 H10.5 V15 H6 Z" fill="currentColor" />
                      </svg>
                    </span>
                  ))}
                </div>
                <div className="sd-compass-side">
                  <b>{tr("facesDir", { dir: compassLabel(pl.az, lang) })}</b>
                  <label className="sd-field">
                    <span className="sd-lbl">{tr("exact")}</span>
                    <span className="sd-numwrap">
                      <input type="number" className="sd-num" min="-180" max="180" step="5" value={pl.az}
                        onChange={(e) => e.target.value !== "" && e.target.value !== "-" && api.current.updatePlane?.(pl.id, { az: +e.target.value })} />
                      <span className="sd-unit">°</span>
                    </span>
                  </label>
                  <span className="sd-note">{tr("exactHelp")}</span>
                </div>
              </div>
              {pl.guessed && <p className="sd-guess"><Info size={15} aria-hidden="true" />{tr("guessed")}</p>}
            </div>
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="sd-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <section className="sd-shell" role="dialog" aria-modal="true" aria-labelledby="sd-title" ref={shellRef} tabIndex={-1}>
        <header className="sd-head">
          <span className="sd-head-ic" aria-hidden="true"><House size={20} /></span>
          <div className="sd-head-tx">
            <h2 id="sd-title">{tr("title")}</h2>
            <p>{address || tr("noAddress")}</p>
          </div>
          <div className="sd-head-acts">
            <button type="button" className="sd-ibtn" disabled={!ready || !canUndo} onClick={() => api.current.undo?.()}
              aria-label={tr("undo")} title={tr("undo") + " (Ctrl+Z)"}><Undo2 size={19} /></button>
            <button type="button" className="sd-ibtn" disabled={!ready || !canRedo} onClick={() => api.current.redo?.()}
              aria-label={tr("redo")} title={tr("redo") + " (Ctrl+Shift+Z)"}><Redo2 size={19} /></button>
            <span className="sd-head-sep" aria-hidden="true" />
            <button type="button" className="sd-ibtn" onClick={() => onClose?.()} aria-label={tr("close")} title={tr("close") + " (Esc)"}><X size={20} /></button>
          </div>
        </header>

        <div className="sd-body">
          {/* ------------------------------------------------------ map */}
          <div className={"sd-stage" + (tool ? " tooling" : "")} ref={stageRef}>
            <div ref={mapEl} className="sd-map" />
            {ready && (
              <div className="sd-tools" role="toolbar" aria-label={tr("tools")}>
                {TOOLS.map((tl, i) => tl === "sep"
                  ? <span key={"sep" + i} className="sd-tool-sep" aria-hidden="true" />
                  : (
                    <button key={tl.id} type="button" className={"sd-tool" + (tool === tl.id ? " on" : "")} aria-pressed={tool === tl.id}
                      onClick={() => pick(tl.id)} title={`${tl.label} (${TOOLS.filter((x) => x !== "sep").indexOf(tl) + 1})`} aria-keyshortcuts={String(TOOLS.filter((x) => x !== "sep").indexOf(tl) + 1)}>
                      <tl.Icon size={18} aria-hidden="true" /><span>{tl.label}</span>
                    </button>
                  ))}
              </div>
            )}
            {hint && (
              <div className="sd-hint" role="status">
                <div className="sd-hint-tx">
                  {tool === "measure" && measureResult != null ? tr("h_measured", { d: nf(measureResult, 2) }) : hint}
                  {tool === "marker" && (
                    <div className="sd-hint-types" role="radiogroup" aria-label={tr("t_marker")}>
                      {MARKER_TYPES.map((mt) => (
                        <button key={mt} type="button" role="radio" aria-checked={markerType === mt} className={markerType === mt ? "on" : ""}
                          onClick={() => setMarkerType(mt)}>{L3(MARKER_LABEL[mt])}</button>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" className="sd-hint-end" onClick={() => api.current.endTool?.()}>
                  {tool === "edit" || tool === "measure" || tool === "place" ? tr("done") : tr("cancel")}
                </button>
              </div>
            )}
            {ready && (
              <div className="sd-mapctl">
                <button type="button" className={"sd-chip" + (showDimensions ? " on" : "")} aria-pressed={showDimensions}
                  onClick={() => { const on = !showDimensions; setShowDimensions(on); api.current.setDimensions?.(on); }}>
                  <Eye size={16} aria-hidden="true" />{tr("lengths")}
                </button>
                <button type="button" className={"sd-chip" + (showNames ? " on" : "")} aria-pressed={showNames}
                  onClick={() => {
                    const on = !showNames, m = mapRef.current, l = namesLayer.current;
                    setShowNames(on); setNamesPref(on);
                    if (m && l) { if (on) l.addTo(m); else m.removeLayer(l); }
                  }}>
                  <Signpost size={16} aria-hidden="true" />{tr("names")}
                </button>
                <button type="button" className="sd-chip" onClick={() => api.current.recenter?.()}>
                  <LocateFixed size={16} aria-hidden="true" />{tr("recenter")}
                </button>
              </div>
            )}
            {!ready && <div className="sd-loading" role="status">{loadError ? tr("loadError") : tr("loading")}</div>}
          </div>

          {/* --------------------------------------------- the three tabs */}
          <aside className="sd-side">
            <nav className="sd-tabs" role="tablist" aria-label={tr("title")}>
              {[1, 2, 3].map((n) => (
                <button key={n} type="button" role="tab" id={"sd-tab-" + n} aria-selected={step === n} aria-controls="sd-tabpanel"
                  className={"sd-tab" + (step === n ? " on" : "") + (tabDone[n] ? " done" : "")} onClick={() => setStep(n)}>
                  <span className="sd-tab-n" aria-hidden="true">{tabDone[n] ? <Check size={14} strokeWidth={3} /> : n}</span>
                  <span className="sd-tab-tx">{tr("tab" + n)}<small>{tabSub[n]}</small></span>
                </button>
              ))}
            </nav>

            <div className="sd-scroll" id="sd-tabpanel" role="tabpanel" aria-labelledby={"sd-tab-" + step}>
              {step === 1 && (
                <>
                  <header className="sd-step-h">
                    <h3>{tr("st1h")}</h3>
                    <p>{tr("st1p")}</p>
                  </header>
                  <button type="button" className={"sd-btn big" + (tool === "plane" ? " on" : " key")} onClick={() => pick("plane")} disabled={!ready}>
                    {tool === "plane"
                      ? <><X size={19} aria-hidden="true" />{tr("drawCancel")}</>
                      : <><Pentagon size={19} aria-hidden="true" />{hasPlanes ? tr("drawMore") : tr("drawFirst")}</>}
                  </button>
                  {!hasPlanes && (
                    <div className="sd-goal">
                      <h4>{tr("goalH")}</h4>
                      <p>{targetPanels ? tr("goal", { kw: nf(targetKw, 1), n: targetPanels, w: panelW, m2: nf(targetM2) }) : tr("goalNone")}</p>
                    </div>
                  )}
                  {(tool === "plane" || !hasPlanes) && (
                    <div className="sd-howcard">
                      <h4>{tr("howH")}</h4>
                      <div className="sd-howbody">
                        {/* a roof side drawn the way the map wants it: corner by corner, back to the first */}
                        <svg className="sd-howfig" viewBox="0 0 120 92" aria-hidden="true">
                          <path d="M14 70 L34 18 L98 18 L108 70 Z" className="sd-howfig-shape" />
                          <path d="M14 70 L34 18 L98 18 L108 70" className="sd-howfig-line" />
                          {/* the last click closes the shape on the first corner */}
                          <path d="M108 70 L22 70" className="sd-howfig-close" />
                          <circle cx="34" cy="18" r="5" className="sd-howfig-dot" />
                          <circle cx="98" cy="18" r="5" className="sd-howfig-dot" />
                          <circle cx="108" cy="70" r="5" className="sd-howfig-dot" />
                          <circle cx="14" cy="70" r="9" className="sd-howfig-dot one" /><text x="14" y="73.5">1</text>
                        </svg>
                        <ol className="sd-how">
                          <li><span aria-hidden="true">1</span>{tr("how1")}</li>
                          <li><span aria-hidden="true">2</span>{tr("how2")}</li>
                          <li><span aria-hidden="true">3</span>{tr("how3")}</li>
                        </ol>
                      </div>
                      <p className="sd-keys">{tr("keys")}</p>
                    </div>
                  )}
                  {projectId && (
                    <div className="sd-sub sd-photo">
                      <div className="sd-sub-h"><h4>{tr("photoH")}</h4></div>
                      <input ref={photoFile} type="file" accept="image/*" hidden
                        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; addPhoto(f); }} />
                      <p className="sd-help">{!photo ? tr("photoP") : photo.place ? tr("photoAlign") : tr("photoOnly")}</p>
                      {photoFail && <p className="sd-warn" role="alert">{tr("photoFail")}</p>}
                      {photo?.place && (
                        <>
                          <div className="sd-field">
                            <span className="sd-lbl-row">
                              <span className="sd-lbl" id="sd-ph-op">{tr("photoOpacity")}</span>
                              <span className="sd-numwrap">
                                <NumInput className="sd-num" min="20" max="100" step="5" value={Math.round(photo.place.opacity * 100)} aria-labelledby="sd-ph-op"
                                  onValue={(v) => setPhotoPlace({ opacity: v / 100 })} />
                                <span className="sd-unit">%</span>
                              </span>
                            </span>
                            <input type="range" className="sd-slider" min="20" max="100" step="5" value={Math.round(photo.place.opacity * 100)} aria-labelledby="sd-ph-op"
                              style={{ "--fill": ((Math.round(photo.place.opacity * 100) - 20) / 80) * 100 + "%" }} onChange={(e) => setPhotoPlace({ opacity: +e.target.value / 100 })} />
                          </div>
                          <div className="sd-grid2">
                            <div className="sd-field">
                              <span className="sd-lbl-row">
                                <span className="sd-lbl" id="sd-ph-turn">{tr("photoTurn")}</span>
                                <span className="sd-numwrap">
                                  <NumInput className="sd-num" min="-180" max="180" step="1" value={Math.round(photo.place.rotDeg)} aria-labelledby="sd-ph-turn"
                                    onValue={(v) => setPhotoPlace({ rotDeg: v })} />
                                  <span className="sd-unit">°</span>
                                </span>
                              </span>
                            </div>
                            <div className="sd-field">
                              <span className="sd-lbl-row">
                                <span className="sd-lbl" id="sd-ph-w">{tr("photoWidth")}</span>
                                <span className="sd-numwrap">
                                  <NumInput className="sd-num" min="5" max="600" step="1" value={Math.round(photo.place.widthM)} aria-labelledby="sd-ph-w"
                                    onValue={(v) => setPhotoPlace({ widthM: v })} />
                                  <span className="sd-unit">m</span>
                                </span>
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                      {photo && !photo.place && (
                        <button type="button" className="sd-btn big key" disabled={!ready} onClick={layPhoto}>
                          <ImagePlus size={19} aria-hidden="true" />{tr("photoLay")}
                        </button>
                      )}
                      {photo?.place && (
                        <button type="button" className={"sd-btn big" + (photoAdjust ? " on" : "")} aria-pressed={photoAdjust} onClick={() => setPhotoAdjust((v) => !v)}>
                          <Move size={19} aria-hidden="true" />{photoAdjust ? tr("photoAdjustDone") : tr("photoAdjust")}
                        </button>
                      )}
                      <div className={photo ? "sd-pair" : undefined}>
                        <button type="button" className={"sd-btn big" + (!photo ? " key" : "")} disabled={!ready || photoBusy} aria-busy={photoBusy} onClick={() => photoFile.current?.click()}>
                          <ImagePlus size={19} aria-hidden="true" />{photoBusy ? tr("photoBusy") : photo ? tr("photoChange") : tr("photoAdd")}
                        </button>
                        {photo && (
                          <button type="button" className="sd-btn big" disabled={photoBusy} onClick={() => setPhoto(null)}>
                            <Trash2 size={19} aria-hidden="true" />{tr("photoRemove")}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {hasPlanes && <div className="sd-cards">{shapes.planes.map(planeCard)}</div>}
                  {hasPlanes && (
                    <button type="button" className="sd-btn big" onClick={() => setStep(2)}>{tr("next2")}<ChevronRight size={19} aria-hidden="true" /></button>
                  )}
                </>
              )}

              {step === 2 && (
                <>
                  <header className="sd-step-h">
                    <h3>{tr("st2h")}</h3>
                    <p>{tr("st2p")}</p>
                  </header>
                  <div className="sd-sub sd-presets">
                    <div className="sd-sub-h"><h4>{tr("presetsH")}</h4></div>
                    <p className="sd-help">{tr("presetsP")}</p>
                    <div className="sd-seg" role="group" aria-label={tr("presetsH")}>
                      {Object.keys(OBSTACLE_PRESETS).map((k) => (
                        <button key={k} type="button" aria-pressed={tool === "place" && placeKind === k} className={tool === "place" && placeKind === k ? "on" : ""}
                          disabled={!ready} onClick={() => pickPlace(k)}>{L3(KIND_LABEL[k])}</button>
                      ))}
                    </div>
                  </div>
                  <div className="sd-pair">
                    <button type="button" className={"sd-btn big" + (tool === "obstacle" ? " on" : "")} onClick={() => pick("obstacle")} disabled={!ready}>
                      <Box size={19} aria-hidden="true" />{tr("addOb")}
                    </button>
                    <button type="button" className={"sd-btn big" + (tool === "tree" ? " on" : "")} onClick={() => pick("tree")} disabled={!ready}>
                      <TreeDeciduous size={19} aria-hidden="true" />{tr("addTree")}
                    </button>
                  </div>
                  {hasObstacles && (
                    <ul className="sd-list">
                      {shapes.obstacles.map((ob) => (
                        <li key={ob.id} id={"sd-item-" + ob.id} className={"sd-row" + (selectedId === ob.id ? " on" : "")}>
                          <button type="button" className={"sd-row-ic " + (ob.kind === "tree" ? "tree" : "ob")} onClick={() => { setSelectedId(ob.id); api.current.focusShape?.(ob.id); }}
                            aria-label={L3(KIND_LABEL[ob.kind] || KIND_LABEL.other)}>
                            {ob.kind === "tree" ? <TreeDeciduous size={17} aria-hidden="true" /> : <Box size={17} aria-hidden="true" />}
                          </button>
                          <select className="sd-select" value={ob.kind} onChange={(e) => api.current.updateObstacle?.(ob.id, { kind: e.target.value })} aria-label={tr("obstacles")}>
                            {OBSTACLE_KINDS.map((k) => <option key={k} value={k}>{L3(KIND_LABEL[k])}</option>)}
                          </select>
                          <span className="sd-numwrap" title={tr("obHeight")}>
                            <NumInput className="sd-num" min="0" max="30" step="0.1" value={ob.heightM ?? 0} aria-label={tr("obHeight")}
                              onValue={(v) => api.current.updateObstacle?.(ob.id, { heightM: v })} />
                            <span className="sd-unit">m</span>
                          </span>
                          <button type="button" className="sd-ibtn del" onClick={() => api.current.removeShape?.(ob.id)}
                            aria-label={tr("del", { name: L3(KIND_LABEL[ob.kind] || KIND_LABEL.other) })}><Trash2 size={17} /></button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="sd-sub">
                    <div className="sd-sub-h">
                      <h4>{tr("points")}</h4>
                      <span className="sd-tag">{tr("optional")}</span>
                    </div>
                    <p className="sd-help">{tr("pointsP")}</p>
                    <button type="button" className={"sd-btn big" + (tool === "marker" ? " on" : "")} onClick={() => pick("marker")} disabled={!ready}>
                      <Plug size={19} aria-hidden="true" />{tr("addPoint")}
                    </button>
                    {hasPoints && (
                      <ul className="sd-list">
                        {shapes.markers.map((mk) => (
                          <li key={mk.id} id={"sd-item-" + mk.id} className={"sd-row" + (selectedId === mk.id ? " on" : "")}>
                            <span className="sd-row-ic mk" aria-hidden="true">{MARKER_ABBR[mk.type]}</span>
                            <button type="button" className="sd-row-name" onClick={() => { setSelectedId(mk.id); api.current.focusShape?.(mk.id); }}>
                              {L3(MARKER_LABEL[mk.type] || MARKER_LABEL.mainPanel)}
                            </button>
                            <button type="button" className="sd-ibtn del" onClick={() => api.current.removeShape?.(mk.id)}
                              aria-label={tr("del", { name: L3(MARKER_LABEL[mk.type] || MARKER_LABEL.mainPanel) })}><Trash2 size={17} /></button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button type="button" className="sd-btn big" onClick={() => setStep(3)}>{tr("next3")}<ChevronRight size={19} aria-hidden="true" /></button>
                </>
              )}

              {step === 3 && (
                <>
                  <header className="sd-step-h">
                    <h3>{tr("st3h")}</h3>
                    <p>{tr("st3p")}</p>
                  </header>
                  <div className="sd-field">
                    <span className="sd-lbl" id="sd-fill">{tr("howMany")}</span>
                    <div className="sd-seg" role="radiogroup" aria-labelledby="sd-fill">
                      {targetPanels > 0 && <button type="button" role="radio" aria-checked={fill === "target"} className={fill === "target" ? "on" : ""} onClick={() => setFill("target")}>{tr("fillTarget", { n: targetPanels })}</button>}
                      <button type="button" role="radio" aria-checked={fill === "roof" || (fill === "target" && !targetPanels)} className={fill === "roof" || (fill === "target" && !targetPanels) ? "on" : ""} onClick={() => setFill("roof")}>{tr("fillRoof", { n: layout?.fitCount ?? 0 })}</button>
                      <button type="button" role="radio" aria-checked={fill === "own"} className={fill === "own" ? "on" : ""}
                        onClick={() => { if (!fillOwn) setFillOwn(layout?.totalCount || targetPanels || 1); setFill("own"); }}>{tr("fillOwn")}</button>
                    </div>
                    {fill === "own" && (
                      <span className="sd-lbl-row">
                        <span className="sd-lbl" id="sd-fill-own">{tr("fillOwnLbl")}</span>
                        <span className="sd-numwrap">
                          <NumInput className="sd-num" min="1" max="2000" step="1" value={fillOwn || ""} aria-labelledby="sd-fill-own" onValue={(v) => setFillOwn(Math.round(v))} />
                        </span>
                      </span>
                    )}
                    <span className="sd-note">{tr("fillHelp")}</span>
                  </div>
                  <label className="sd-field">
                    <span className="sd-lbl">{tr("module")}</span>
                    <select className="sd-select" value={panelId} onChange={(e) => setPanelId(e.target.value)}>
                      {PANELS.map((pnl) => <option key={pnl.id} value={pnl.id}>{pnl.brand} {pnl.model}, {pnl.watt} W</option>)}
                    </select>
                    <span className="sd-note">
                      {panel?.dimensionsMm ? `${nf(panel.dimensionsMm.w / 1000, 2)} × ${nf(panel.dimensionsMm.h / 1000, 2)} m` : ""}
                      {bomPanelId && bomPanelId === panelId ? (panel?.dimensionsMm ? ". " : "") + tr("fromQuote") : ""}
                    </span>
                  </label>
                  <div className="sd-field">
                    <span className="sd-lbl" id="sd-laid">{tr("laid")}</span>
                    <div className="sd-seg" role="radiogroup" aria-labelledby="sd-laid">
                      {["portrait", "landscape", "auto"].map((o) => (
                        <button key={o} type="button" role="radio" aria-checked={orientation === o} className={orientation === o ? "on" : ""} onClick={() => setOrientation(o)}>{tr(o)}</button>
                      ))}
                    </div>
                  </div>
                  <div className="sd-field">
                    <span className="sd-lbl-row">
                      <span className="sd-lbl" id="sd-setback">{tr("setback")}</span>
                      <span className="sd-numwrap">
                        <NumInput className="sd-num" min="0" max="100" value={setbackCm} onValue={setSetbackCm} aria-labelledby="sd-setback" />
                        <span className="sd-unit">cm</span>
                      </span>
                    </span>
                    <input type="range" className="sd-slider" min="0" max="100" step="5" value={setbackCm} style={{ "--fill": setbackCm + "%" }} onChange={(e) => setSetbackCm(+e.target.value)} aria-labelledby="sd-setback" />
                  </div>
                  <div className="sd-field">
                    <span className="sd-lbl-row">
                      <span className="sd-lbl" id="sd-clear">{tr("clearance")}</span>
                      <span className="sd-numwrap">
                        <NumInput className="sd-num" min="0" max="50" value={clearanceCm} onValue={setClearanceCm} aria-labelledby="sd-clear" />
                        <span className="sd-unit">cm</span>
                      </span>
                    </span>
                    <span className="sd-note">{tr("clearanceHelp", { deg: Math.round(shadeElevationDeg(lat)) })}</span>
                  </div>
                  <div className="sd-field">
                    <span className="sd-lbl" id="sd-status">{tr("statusH")}</span>
                    <div className="sd-seg" role="radiogroup" aria-labelledby="sd-status">
                      {["satellite", "verified"].map((k) => (
                        <button key={k} type="button" role="radio" aria-checked={designStatus === k} className={designStatus === k ? "on" : ""}
                          onClick={() => { setDesignStatus(k); if (k === "verified" && !verifiedAt) setVerifiedAt(new Date().toISOString().slice(0, 10)); }}>{tr("status_" + (k === "verified" ? "ver" : "sat"))}</button>
                      ))}
                    </div>
                    <span className="sd-note">{tr("statusHelp")}</span>
                  </div>
                  <details className="sd-more">
                    <summary><ChevronDown size={17} aria-hidden="true" />{tr("more")}</summary>
                    <div className="sd-grid2">
                      <label className="sd-field"><span className="sd-lbl">{tr("rowGap")} (cm)</span>
                        <NumInput className="sd-num wide" min="0" max="20" value={rowSpacingCm} onValue={setRowSpacingCm} /></label>
                      <label className="sd-field"><span className="sd-lbl">{tr("colGap")} (cm)</span>
                        <NumInput className="sd-num wide" min="0" max="20" value={colSpacingCm} onValue={setColSpacingCm} /></label>
                      <label className="sd-field"><span className="sd-lbl">{tr("blockW")} (m)</span>
                        <NumInput className="sd-num wide" min="0" max="30" step="0.5" value={clusterMaxW} onValue={setClusterMaxW} /></label>
                      <label className="sd-field"><span className="sd-lbl">{tr("blockH")} (m)</span>
                        <NumInput className="sd-num wide" min="0" max="30" step="0.5" value={clusterMaxH} onValue={setClusterMaxH} /></label>
                      <label className="sd-field"><span className="sd-lbl">{tr("blockGap")} (m)</span>
                        <NumInput className="sd-num wide" min="0" max="10" step="0.1" value={clusterGap} onValue={setClusterGap} /></label>
                      <p className="sd-help">{tr("blockHelp")}</p>
                    </div>
                  </details>
                  {quoteResult && (
                    <details className="sd-more">
                      <summary><ChevronDown size={17} aria-hidden="true" />{tr("charts")}</summary>
                      <div className="sd-chart">
                        <h4>{tr("monthly")}</h4>
                        <MonthlySVG prod={prodMonthly} cons={consMonthly} lang={lang} loc={loc} narrow />
                      </div>
                      <div className="sd-chart">
                        <h4>{tr("cash")}</h4>
                        <CashflowSVG bands={bands} cost={quoteResult.e.cost} horizon={quoteResult.e.horizon} lang={lang} money={fmtMoney} narrow />
                      </div>
                    </details>
                  )}
                </>
              )}
            </div>

            {/* the result, always in view */}
            <div className="sd-result" aria-live="polite">
              {targetPanels > 0 && (
                <div className="sd-meter" role="img" aria-label={placed > targetPanels ? tr("meterOver", { n: placed, kw: nf(targetKw, 1) }) : placed ? tr("meter", { n: placed, t: targetPanels, kw: nf(targetKw, 1) }) : tr("meterEmpty", { t: targetPanels, kw: nf(targetKw, 1) })}>
                  <div className="sd-meter-bar"><span className={placed >= targetPanels ? "full" : ""} style={{ width: meterPct + "%" }} /></div>
                  <p>{placed > targetPanels ? tr("meterOver", { n: placed, kw: nf(targetKw, 1) }) : placed ? tr("meter", { n: placed, t: targetPanels, kw: nf(targetKw, 1) }) : tr("meterEmpty", { t: targetPanels, kw: nf(targetKw, 1) })}</p>
                </div>
              )}
              {!layout ? (
                <p className="sd-result-empty">{tr("resultEmpty")}</p>
              ) : (
                <>
                  <div className="sd-result-top">
                    <div className="sd-big"><b>{layout.totalCount}</b><span>{panelsNoun(layout.totalCount, lang)}</span></div>
                    <div className="sd-big"><b>{nf(layout.kw, 1)}</b><span>kWp</span></div>
                    {layout.totalCount > 0 && (
                      <span className="sd-use">{tr("roofUse", { used: nf(layout.panelAreaM2, 0), roof: nf(layout.roofAreaM2, 0) })}</span>
                    )}
                  </div>
                  {layout.totalCount === 0 && <p className="sd-warn" role="alert">{tr("noFit")}</p>}
                  {liveBlend.failed > 0 && <p className="sd-warn" role="status">{tr("yieldFailed", { n: liveBlend.failed })}</p>}
                  {layout.fitCount > layout.totalCount && layout.totalCount > 0 && <p className="sd-help">{tr("spareLine", { fit: layout.fitCount, free: layout.fitCount - layout.totalCount })}</p>}
                  {quoteResult && (
                    <dl className="sd-metrics">
                      <div><dt>{tr("price")}</dt><dd>{fmtMoney(quoteResult.e.cost)}</dd></div>
                      <div><dt>{tr("payback")}</dt><dd>{yearsLabel(quoteResult.e.payback, lang)}</dd></div>
                      <div><dt>{tr("co2")}</dt><dd>{tr("perYear", { t: nf(co2Year / 1000, 1) })}</dd></div>
                    </dl>
                  )}
                  <button type="button" className="sd-btn primary big sd-apply" disabled={!fitsAny || applying} aria-busy={applying}
                    onClick={() => onApply?.({ ...layout, perPlane: perYield, sides: sidesNow, blend: liveBlend })}>
                    {applying ? tr("applying") : <><Check size={19} aria-hidden="true" />{tr("apply", { n: `${layout.totalCount} ${panelsNoun(layout.totalCount, lang)}` })}</>}
                  </button>
                </>
              )}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

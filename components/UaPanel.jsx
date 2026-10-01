"use client";
// components/UaPanel.jsx — what a Ukrainian household quote turns on besides
// the payback: whether the lights stay on in an outage, how the green tariff
// pays, and what the state Energy Credit costs a month. The figures come from
// lib/uaMarket.js and the engine settings; the installer's choices (outage
// length, what stays on, generator, loan term) are stored on the quote as
// ua_plan so the proposal shows the same plan.
import "./uapanel.css";
import { blackoutPlan, energyCredit, uaPlanDefaults, ENERGY_CREDIT, CREDIT_TERMS as TERMS, BANK_RATE_PCT as BANK_RATE } from "../lib/uaMarket.js";

const t3 = (lang, ro, en, ru, uk) => (lang === "en" ? en : lang === "ru" ? ru : lang === "uk" ? (uk ?? en) : ro);
const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };
const KWH = { ru: "кВт·ч", uk: "кВт·год" };
const BANKS_UK = ["Укргазбанк", "Ощадбанк", "ПриватБанк", "Sense Bank", "Глобус", "Полтава-банк"];

export default function UaPanel({ lang, kw, battKwh, plan, onPlan, onApplyBattery, costEur, fxUah, fitUah, afterUah, money }) {
  const loc = LOC[lang] || LOC.en;
  const kwhU = KWH[lang] || "kWh";
  const kwU = lang === "ru" || lang === "uk" ? "кВт" : "kW";
  const n = (v, dec = 1) => Number(v).toLocaleString(loc, { maximumFractionDigits: dec });
  const unit = (u) => (v) => new Intl.NumberFormat(loc, { style: "unit", unit: u, unitDisplay: "long", maximumFractionDigits: 1 }).format(v);
  const hoursL = unit("hour"), yearsL = unit("year");
  const uah = (v) => `${Number(v).toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${lang === "ru" || lang === "uk" ? "грн" : "UAH"}`;

  const s = uaPlanDefaults(plan);
  // Inputs keep what is being typed ("" while a field is cleared); the plan
  // itself always runs on the defaults above.
  const raw = plan && typeof plan === "object" ? plan : {};
  const field = (k) => (raw[k] === "" ? "" : raw[k] ?? s[k]);
  const setField = (k) => (e) => onPlan({ ...raw, [k]: e.target.value === "" ? "" : +e.target.value });

  const bo = blackoutPlan({ battKwh, essentialKw: s.essentialKw, outageHours: s.outageHours });
  const credit = energyCredit({ costEur, fxUah, years: s.creditYears, bankRatePct: BANK_RATE });
  const gen = s.generatorKw;
  const banks = (lang === "ru" || lang === "uk" ? BANKS_UK : ENERGY_CREDIT.banks).join(", ");

  return (
    <section className="card uap">
      <h3>{t3(lang, "Ucraina: pene de curent și tariful verde", "Ukraine: outages and the green tariff", "Украина: отключения и зелёный тариф", "Україна: відключення і зелений тариф")}</h3>

      <div className="uap-block">
        <h4>{t3(lang, "Curent în timpul penelor", "Power during outages", "Свет во время отключений", "Світло під час відключень")}</h4>
        <div className="uap-fields">
          <div className="field">
            <label htmlFor="uapHours">{t3(lang, "Pană obișnuită, ore", "Typical outage, hours", "Обычное отключение, часов", "Звичайне відключення, годин")}</label>
            <input id="uapHours" className="input" type="number" min="0.5" max="72" step="0.5" inputMode="decimal" value={field("outageHours")} onChange={setField("outageHours")} />
          </div>
          <div className="field">
            <label htmlFor="uapLoad">{t3(lang, "Ce rămâne pornit, kW", "What stays on, kW", "Что остаётся включённым, кВт", "Що лишається ввімкненим, кВт")}</label>
            <input id="uapLoad" className="input" type="number" min="0.1" max="30" step="0.1" inputMode="decimal" value={field("essentialKw")} onChange={setField("essentialKw")} />
          </div>
          <div className="field">
            <label htmlFor="uapGen">{t3(lang, "Generator, kW (0 dacă nu e)", "Generator, kW (0 if none)", "Генератор, кВт (0, если нет)", "Генератор, кВт (0, якщо немає)")}</label>
            <input id="uapGen" className="input" type="number" min="0" max="100" step="0.5" inputMode="decimal" value={field("generatorKw")} onChange={setField("generatorKw")} />
          </div>
        </div>
        <p className="uap-hint">{t3(lang,
          "Frigider, lumină, router, pompa centralei: cam 0,5 kW.",
          "Fridge, lights, router, boiler pump: about 0.5 kW.",
          "Холодильник, свет, роутер, насос котла: около 0,5 кВт.",
          "Холодильник, світло, роутер, насос котла: близько 0,5 кВт.")}</p>

        <div className={"uap-verdict" + (bo.covers ? " good" : "")} role="status">
          {battKwh > 0 ? (
            <>
              <b>{t3(lang,
                `Bateria de ${n(battKwh)} kWh ține ${n(s.essentialKw)} kW pornite ${hoursL(bo.hours)}.`,
                `The ${n(battKwh)} kWh battery keeps ${n(s.essentialKw)} kW on for ${hoursL(bo.hours)}.`,
                `Батареи ${n(battKwh)} ${kwhU} хватает на ${hoursL(bo.hours)} при нагрузке ${n(s.essentialKw)} ${kwU}.`,
                `Батареї ${n(battKwh)} ${kwhU} вистачає на ${hoursL(bo.hours)} за навантаження ${n(s.essentialKw)} ${kwU}.`)}</b>
              <span>{bo.covers
                ? t3(lang, `Ajunge pentru o pană obișnuită de ${hoursL(s.outageHours)}.`, `Enough for a typical outage of ${hoursL(s.outageHours)}.`, `Хватает на обычное отключение (${hoursL(s.outageHours)}).`, `Вистачає на звичайне відключення (${hoursL(s.outageHours)}).`)
                : t3(lang, `Nu ajunge pentru o pană de ${hoursL(s.outageHours)}: ar trebui ${bo.suggestKwh} kWh.`, `Not enough for an outage of ${hoursL(s.outageHours)}: it takes ${bo.suggestKwh} kWh.`, `Не хватит на отключение длительностью ${hoursL(s.outageHours)}: нужно ${bo.suggestKwh} ${kwhU}.`, `Не вистачить на відключення тривалістю ${hoursL(s.outageHours)}: потрібно ${bo.suggestKwh} ${kwhU}.`)}</span>
            </>
          ) : (
            <>
              <b>{t3(lang,
                "Fără baterie, sistemul se oprește odată cu rețeaua, chiar și în plin soare.",
                "Without a battery the system switches off with the grid, even in full sun.",
                "Без батареи система отключается вместе с сетью, даже при полном солнце.",
                "Без батареї система вимикається разом із мережею, навіть за повного сонця.")}</b>
              <span>{t3(lang, `Pentru o pană de ${hoursL(s.outageHours)} ar trebui ${bo.suggestKwh} kWh.`, `An outage of ${hoursL(s.outageHours)} takes ${bo.suggestKwh} kWh.`, `На отключение длительностью ${hoursL(s.outageHours)} нужно ${bo.suggestKwh} ${kwhU}.`, `На відключення тривалістю ${hoursL(s.outageHours)} потрібно ${bo.suggestKwh} ${kwhU}.`)}</span>
            </>
          )}
          {gen > 0 && (
            <span>{gen >= s.essentialKw
              ? t3(lang, "Generatorul preia restul și poate reîncărca bateria.", "The generator carries the rest and can recharge the battery.", "Остальное берёт на себя генератор, он же может подзарядить батарею.", "Решту бере на себе генератор, він же може підзарядити батарею.")
              : t3(lang, `Generatorul (${n(gen)} kW) e mai mic decât ce rămâne pornit.`, `The generator (${n(gen)} kW) is smaller than what stays on.`, `Генератор (${n(gen)} ${kwU}) слабее того, что остаётся включённым.`, `Генератор (${n(gen)} ${kwU}) слабший за те, що лишається ввімкненим.`)}</span>
          )}
        </div>
        {!bo.covers && bo.suggestKwh > 0 && onApplyBattery && (
          <button type="button" className="btn ghost sm uap-apply" onClick={() => onApplyBattery(bo.suggestKwh)}>
            {t3(lang, `Pune o baterie de ${bo.suggestKwh} kWh`, `Quote a ${bo.suggestKwh} kWh battery`, `Добавить батарею ${bo.suggestKwh} ${kwhU}`, `Додати батарею ${bo.suggestKwh} ${kwhU}`)}
          </button>
        )}
        <p className="uap-hint">{t3(lang,
          "Bateria alimentează casa în pană doar printr-un invertor hibrid cu ieșire de rezervă.",
          "A battery powers the house in an outage only through a hybrid inverter with a backup output.",
          "Батарея питает дом при отключении только через гибридный инвертор с резервным выходом.",
          "Батарея живить дім під час відключення лише через гібридний інвертор із резервним виходом.")}</p>
      </div>

      <div className="uap-block">
        <h4>{t3(lang, "Tariful verde", "Green tariff", "Зелёный тариф", "Зелений тариф")}</h4>
        <p className="uap-p">{t3(lang,
          `Surplusul fiecărei luni se vinde cu ${uah(fitUah)} pe kWh, fără TVA, până la 31 decembrie 2029, apoi cu aproximativ ${uah(afterUah)}. Cât durează tariful, o baterie nu aduce economie: e acolo pentru pene.`,
          `Each month's surplus sells at ${uah(fitUah)} a kWh, excluding VAT, until 31 December 2029, then at about ${uah(afterUah)}. While the tariff lasts a battery adds no saving: it is there for outages.`,
          `Излишек каждого месяца продаётся по ${uah(fitUah)} за ${kwhU} без НДС до 31 декабря 2029 года, затем примерно по ${uah(afterUah)}. Пока действует тариф, батарея не даёт экономии: она нужна на время отключений.`,
          `Надлишок кожного місяця продається по ${uah(fitUah)} за ${kwhU} без ПДВ до 31 грудня 2029 року, далі приблизно по ${uah(afterUah)}. Поки діє тариф, батарея не дає економії: вона потрібна на час відключень.`)}</p>
        {kw > 30 && (
          <div className="warn-card">{t3(lang,
            "Tariful verde pentru gospodării se oprește la 30 kW. Peste atât, surplusul nu se mai vinde pe el.",
            "The household green tariff stops at 30 kW. Above that, the surplus can't be sold under it.",
            "Зелёный тариф для домохозяйств ограничен 30 кВт. Сверх этого излишек по нему не продать.",
            "Зелений тариф для домогосподарств обмежено 30 кВт. Понад це надлишок за ним не продати.")}</div>
        )}
      </div>

      <div className="uap-block">
        <h4>{t3(lang, "Energokredyt (programul de stat)", "Energy Credit (state programme)", "Энергокредит (госпрограмма)", "Енергокредит (державна програма)")}</h4>
        <div className="uap-credit">
          <div className="field">
            <label htmlFor="uapYears">{t3(lang, "Termen", "Term", "Срок", "Строк")}</label>
            <select id="uapYears" className="input" value={s.creditYears} onChange={(e) => onPlan({ ...raw, creditYears: +e.target.value })}>
              {TERMS.map((y) => <option key={y} value={y}>{yearsL(y)}</option>)}
            </select>
          </div>
          <div className="uap-m"><b>{money(credit.monthlyEur)}</b><span>{t3(lang, "pe lună", "a month", "в месяц", "на місяць")}</span></div>
          <div className="uap-m"><b>{n(credit.ratePct, 1)}%</b><span>{t3(lang, "dobândă", "interest", "ставка", "ставка")}</span></div>
          <div className="uap-m good"><b>{money(credit.compensationEur)}</b><span>{t3(lang, "rambursează statul", "repaid by the state", "погашает государство", "погашає держава")}</span></div>
        </div>
        <p className="uap-p">{t3(lang,
          `Credit de ${money(credit.loanEur)} pe ${yearsL(credit.years)}. Statul rambursează apoi până la 30% din credit pentru un sistem solar.`,
          `A loan of ${money(credit.loanEur)} over ${yearsL(credit.years)}. The state then repays up to 30% of the loan for a solar set.`,
          `Кредит ${money(credit.loanEur)} на ${yearsL(credit.years)}. Затем государство погашает до 30% тела кредита за солнечную систему.`,
          `Кредит ${money(credit.loanEur)} на ${yearsL(credit.years)}. Потім держава погашає до 30% тіла кредиту за сонячну систему.`)}
          {credit.years > 3 && " " + t3(lang, `Peste 3 ani se aplică dobânda băncii (aici ${BANK_RATE}%).`, `Beyond 3 years the bank's own rate applies (${BANK_RATE}% assumed here).`, `Дольше 3 лет действует ставка банка (здесь ${BANK_RATE}%).`, `Понад 3 роки діє ставка банку (тут ${BANK_RATE}%).`)}
          {credit.capped && " " + t3(lang, "Plafonat la 480 000 UAH de gospodărie.", "Capped at 480,000 UAH per household.", "Не более 480 000 грн на домохозяйство.", "Не більше 480 000 грн на домогосподарство.")}
        </p>
        <p className="uap-hint">{t3(lang,
          `Prin ${banks}. Fiecare bancă își stabilește condițiile: e o estimare, nu o ofertă.`,
          `Through ${banks}. Each bank sets its own terms: this is an estimate, not an offer.`,
          `Через ${banks}. Условия определяет каждый банк: это оценка, а не предложение.`,
          `Через ${banks}. Умови визначає кожен банк: це оцінка, а не пропозиція.`)}</p>
      </div>
    </section>
  );
}

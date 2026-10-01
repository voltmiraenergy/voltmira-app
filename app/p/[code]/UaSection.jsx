// app/p/[code]/UaSection.jsx — the part of a Ukrainian proposal that comes
// before the payback: will the lights stay on in an outage, how the green
// tariff pays for the surplus, and what the state Energy Credit costs a month.
// Rendered from the proposal's frozen snapshot (inputs.uaPlan, the frozen FX),
// so it never changes after it was sent. Formal voice: this is the client's.
import { blackoutPlan, energyCredit, uaPlanDefaults, BANK_RATE_PCT } from "../../../lib/uaMarket.js";
import { FX } from "@voltmira/engine";

const t3 = (lang, ro, en, ru, uk) => (lang === "en" ? en : lang === "ru" ? ru : lang === "uk" ? (uk ?? en) : ro);
const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };
const KWH = { ru: "кВт·ч", uk: "кВт·год" };

const box = { background: "#fff", border: "1px solid #E3E1D6", borderRadius: 12, padding: "14px 16px" };
const h = { margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "#142A21" };
const p = { margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "#142A21" };
const small = { margin: "6px 0 0", fontSize: 12, lineHeight: 1.45, color: "#66756C" };

export default function UaSection({ inputs, quote: q, assumptions, fx, money, lang }) {
  const loc = LOC[lang] || LOC.en;
  const kwhU = KWH[lang] || "kWh";
  const kwU = lang === "ru" || lang === "uk" ? "кВт" : "kW";
  const n = (v, dec = 1) => Number(v).toLocaleString(loc, { maximumFractionDigits: dec });
  const unit = (u) => (v) => new Intl.NumberFormat(loc, { style: "unit", unit: u, unitDisplay: "long", maximumFractionDigits: 1 }).format(v);
  const hoursL = unit("hour"), yearsL = unit("year");
  const uah = (v) => `${Number(v).toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${lang === "ru" || lang === "uk" ? "грн" : "UAH"}`;

  const s = uaPlanDefaults(inputs.uaPlan);
  const battKwh = inputs.batt ? Number(inputs.battKwh) || 0 : 0;
  const bo = blackoutPlan({ battKwh, essentialKw: s.essentialKw, outageHours: s.outageHours });
  const fxUah = Number(fx?.UAH) || FX.UAH;
  const credit = energyCredit({ costEur: q.cost, fxUah, years: s.creditYears, bankRatePct: BANK_RATE_PCT });
  const fit = Number(assumptions?.uaFitUah) || 6.1331;
  const after = Number(assumptions?.uaFeedAfterUah) || 2.5;
  const gen = s.generatorKw;

  return (
    <section style={{ margin: "22px 0", display: "grid", gap: 12 }}>
      <div style={{ ...box, borderTop: `3px solid ${bo.covers ? "#1E6B4E" : "#E89B2D"}` }}>
        <h2 style={{ ...h, fontSize: 15 }}>{t3(lang, "Curent în timpul penelor", "Power during outages", "Свет во время отключений", "Світло під час відключень")}</h2>
        {battKwh > 0 ? (
          <p style={p}>
            <b>{t3(lang,
              `Bateria de ${n(battKwh)} kWh alimentează consumatorii esențiali (${n(s.essentialKw)} kW) timp de ${hoursL(bo.hours)}.`,
              `The ${n(battKwh)} kWh battery powers the essentials (${n(s.essentialKw)} kW) for ${hoursL(bo.hours)}.`,
              `Батареи ${n(battKwh)} ${kwhU} хватает на ${hoursL(bo.hours)} для самого необходимого (${n(s.essentialKw)} ${kwU}).`,
              `Батареї ${n(battKwh)} ${kwhU} вистачає на ${hoursL(bo.hours)} для найнеобхіднішого (${n(s.essentialKw)} ${kwU}).`)}</b>{" "}
            {bo.covers
              ? t3(lang, `Ajunge pentru o pană obișnuită în zona dumneavoastră (${hoursL(s.outageHours)}).`, `That covers a typical outage in your area (${hoursL(s.outageHours)}).`, `Этого хватает на обычное отключение в вашем районе (${hoursL(s.outageHours)}).`, `Цього вистачає на звичайне відключення у вашому районі (${hoursL(s.outageHours)}).`)
              : t3(lang, `O pană obișnuită în zona dumneavoastră (${hoursL(s.outageHours)}) cere în jur de ${bo.suggestKwh} kWh.`, `A typical outage in your area (${hoursL(s.outageHours)}) takes about ${bo.suggestKwh} kWh.`, `На обычное отключение в вашем районе (${hoursL(s.outageHours)}) нужно около ${bo.suggestKwh} ${kwhU}.`, `На звичайне відключення у вашому районі (${hoursL(s.outageHours)}) потрібно близько ${bo.suggestKwh} ${kwhU}.`)}
          </p>
        ) : (
          <p style={p}>
            <b>{t3(lang,
              "Fără baterie, sistemul se oprește odată cu rețeaua, chiar și când e soare.",
              "Without a battery the system switches off with the grid, even when the sun is out.",
              "Без батареи система отключается вместе с сетью, даже когда светит солнце.",
              "Без батареї система вимикається разом із мережею, навіть коли світить сонце.")}</b>{" "}
            {t3(lang,
              `Pentru curent în timpul unei pene de ${hoursL(s.outageHours)} ar trebui o baterie de circa ${bo.suggestKwh} kWh.`,
              `To keep the essentials on through an outage of ${hoursL(s.outageHours)}, it takes a battery of about ${bo.suggestKwh} kWh.`,
              `Чтобы самое необходимое работало во время отключения длительностью ${hoursL(s.outageHours)}, нужна батарея около ${bo.suggestKwh} ${kwhU}.`,
              `Щоб найнеобхідніше працювало під час відключення тривалістю ${hoursL(s.outageHours)}, потрібна батарея близько ${bo.suggestKwh} ${kwhU}.`)}
          </p>
        )}
        {gen > 0 && gen >= s.essentialKw && (
          <p style={small}>{t3(lang, "Generatorul dumneavoastră preia restul și poate reîncărca bateria.", "Your generator carries the rest and can recharge the battery.", "Остальное возьмёт на себя ваш генератор, он же может подзарядить батарею.", "Решту візьме на себе ваш генератор, він же може підзарядити батарею.")}</p>
        )}
      </div>

      <div style={box}>
        <h3 style={h}>{t3(lang, "Tariful verde", "Green tariff", "Зелёный тариф", "Зелений тариф")}</h3>
        <p style={p}>{t3(lang,
          `Surplusul fiecărei luni se vinde cu ${uah(fit)} pe kWh, fără TVA, până la 31 decembrie 2029. Calculul de mai jos ține cont de asta, iar după 2029 socotește în jur de ${uah(after)}.`,
          `Each month's surplus sells at ${uah(fit)} a kWh, excluding VAT, until 31 December 2029. The figures below already count it, and after 2029 they assume about ${uah(after)}.`,
          `Излишек каждого месяца продаётся по ${uah(fit)} за ${kwhU} без НДС до 31 декабря 2029 года. Расчёт ниже это уже учитывает, а после 2029 года берёт примерно ${uah(after)}.`,
          `Надлишок кожного місяця продається по ${uah(fit)} за ${kwhU} без ПДВ до 31 грудня 2029 року. Розрахунок нижче це вже враховує, а після 2029 року бере приблизно ${uah(after)}.`)}</p>
      </div>

      <div style={box}>
        <h3 style={h}>{t3(lang, "Energokredyt, programul de stat", "Energy Credit, the state programme", "Энергокредит, государственная программа", "Енергокредит, державна програма")}</h3>
        <p style={p}>
          <b>{t3(lang,
            `${money(credit.monthlyEur)} pe lună timp de ${yearsL(credit.years)}, la ${n(credit.ratePct)}%.`,
            `${money(credit.monthlyEur)} a month for ${yearsL(credit.years)}, at ${n(credit.ratePct)}%.`,
            `${money(credit.monthlyEur)} в месяц, срок ${yearsL(credit.years)}, ставка ${n(credit.ratePct)}%.`,
            `${money(credit.monthlyEur)} на місяць, строк ${yearsL(credit.years)}, ставка ${n(credit.ratePct)}%.`)}</b>{" "}
          {t3(lang,
            `Statul rambursează apoi până la ${money(credit.compensationEur)} din credit (30%).`,
            `The state then repays up to ${money(credit.compensationEur)} of the loan (30%).`,
            `Затем государство погашает до ${money(credit.compensationEur)} тела кредита (30%).`,
            `Потім держава погашає до ${money(credit.compensationEur)} тіла кредиту (30%).`)}
        </p>
        <p style={small}>
          {credit.capped && t3(lang, "Creditul e plafonat la 480 000 UAH de gospodărie. ", "The loan is capped at 480,000 UAH per household. ", "Кредит ограничен 480 000 грн на домохозяйство. ", "Кредит обмежено 480 000 грн на домогосподарство. ")}
          {credit.years > 3 && t3(lang, `Peste 3 ani se aplică dobânda băncii (aici ${BANK_RATE_PCT}%). `, `Beyond 3 years the bank's own rate applies (${BANK_RATE_PCT}% assumed here). `, `Дольше 3 лет действует ставка банка (здесь ${BANK_RATE_PCT}%). `, `Понад 3 роки діє ставка банку (тут ${BANK_RATE_PCT}%). `)}
          {t3(lang,
            "Condițiile finale le stabilește banca: este o estimare, nu o ofertă de credit.",
            "The bank sets the final terms: this is an estimate, not a loan offer.",
            "Окончательные условия определяет банк: это оценка, а не кредитное предложение.",
            "Остаточні умови визначає банк: це оцінка, а не кредитна пропозиція.")}
        </p>
      </div>
    </section>
  );
}

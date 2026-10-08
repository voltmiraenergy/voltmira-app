"use client";
// app/p/[code]/OfferBanner.jsx — what the proposal assistant agreed with the
// client, shown next to the accept button so the price they sign is the price
// they were told. Starts from what the server has on record (GET
// /api/proposal/[code] -> offer, chosenOption) and updates live when the chat
// agrees something (QaWidget dispatches "voltmira:offer"). Plain text only.
import { moneyFormatter } from "../../../lib/money.js";
import { useEffect, useState } from "react";
import { t } from "../../../lib/i18n.js";
import { fmtDate } from "../../../lib/tz.js";
import { ppt } from "./text.js";

const VALID_DAYS = 14;   // lib/negotiation.js OFFER_VALID_DAYS

export default function OfferBanner({ lang, accepted, offer: initialOffer, chosenOption: initialOption, optionLabels, currency = "EUR", rate = null }) {
  const [offer, setOffer] = useState(initialOffer || null);
  const [option, setOption] = useState(initialOption || null);

  useEffect(() => {
    const on = (e) => {
      if (e.detail?.offer !== undefined) setOffer(e.detail.offer ? { ...e.detail.offer, since: e.detail.offer.since || new Date().toISOString() } : null);
      if (e.detail?.option !== undefined) setOption(e.detail.option?.number ?? null);
    };
    window.addEventListener("voltmira:offer", on);
    return () => window.removeEventListener("voltmira:offer", on);
  }, []);

  if (!offer && !option) return null;
  const loc = { en: "en-IE", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "en-IE";
  const money = moneyFormatter({ currency, lang, fx: rate ? { [currency]: rate } : null });
  const until = offer?.since
    ? fmtDate(new Date(new Date(offer.since).getTime() + VALID_DAYS * 864e5).toISOString(), loc, { day: "numeric", month: "long" })
    : "";
  const label = option ? (optionLabels?.[option] || ppt("opt_n", lang, { n: option })) : "";

  return (
    <div role="status" className="pp-offer">
      {offer && (
        <p>
          <b>
            {accepted ? t("pp_offer_signed", lang, { pct: offer.pct, price: money(offer.priceEur) }) : t("pp_offer_agreed", lang, { price: money(offer.priceEur) })}
          </b>
          {!accepted && <> {ppt("offer_detail", lang, { pct: offer.pct, save: money(offer.discountEur), date: until })}</>}
        </p>
      )}
      {option && (
        <p>{accepted ? t("pp_option_signed", lang, { label }) : ppt("option_chosen", lang, { label })}</p>
      )}
    </div>
  );
}

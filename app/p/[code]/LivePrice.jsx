"use client";
// app/p/[code]/LivePrice.jsx — the price the client is about to sign, wherever
// it is repeated (side summary, phone bar, accept panel). Starts from what the
// server has on record and follows the chat live: when the proposal assistant
// agrees a discount (QaWidget dispatches "voltmira:offer"), every copy of the
// price shows the agreed figure, with the original next to it. Same event and
// shape as OfferBanner.jsx.
import { useEffect, useState } from "react";
import { moneyFormatter } from "../../../lib/money.js";
import { ppt } from "./text.js";

export default function LivePrice({ costEur, offer: initialOffer = null, currency = "EUR", rate = null, lang = "en", note = "" }) {
  const [offer, setOffer] = useState(initialOffer);
  useEffect(() => {
    const on = (e) => { if (e.detail?.offer !== undefined) setOffer(e.detail.offer || null); };
    window.addEventListener("voltmira:offer", on);
    return () => window.removeEventListener("voltmira:offer", on);
  }, []);
  const money = moneyFormatter({ currency, lang, fx: rate ? { [currency]: rate } : null });
  const agreed = offer && Number(offer.priceEur) > 0 ? Number(offer.priceEur) : null;
  return (
    <span className="pp-lp">
      <b>{money(agreed ?? costEur)}</b>
      {agreed != null
        ? <small>{ppt("agreed_was", lang, { v: money(costEur) })}</small>
        : note ? <small>{note}</small> : null}
    </span>
  );
}

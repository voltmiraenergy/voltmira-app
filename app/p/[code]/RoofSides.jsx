// app/p/[code]/RoofSides.jsx — what the offer says about the roof, side by side, and how it was designed.
// Each side of a roof faces its own way at its own pitch, so each produces differently; the table gives
// each side's panels, power and yearly energy (PVGIS, per side), and says where the pitch is only an
// estimate. The mark under it says whether the roof was designed from satellite imagery (the installer
// confirms the measurements on site) or verified on site, with the day. Server-rendered, shared by the live
// offer and its PDF. Styles: proposal.css (.pp-sides, .pp-mark).
import { compassLabel } from "../../../lib/roofLayout.js";
import { ppt } from "./text.js";

/**
 * @param {object} p
 * @param {object[]|null} p.sides   lib/roofSides.js cleanSides
 * @param {{kind:string, at:string|null}|null} p.status   lib/roofSides.js roofStatusOf
 * @param {string} p.lang
 * @param {string} p.company   the installer's short name
 * @param {string|null} p.day   the verification day, already formatted for the reader
 * @param {(n:number, d?:number)=>string} p.nf
 */
export default function RoofSides({ sides, status, lang, company, day, nf }) {
  const list = Array.isArray(sides) ? sides : [];
  if (!list.length && !status) return null;
  return (
    <div className="pp-sides">
      {list.length > 0 && (
        <>
          <h3 className="pp-h3">{ppt("rs_h", lang)}</h3>
          <div className="pp-sides-scroll">
            <table>
              <thead>
                <tr><th scope="col">{ppt("rs_face", lang)}</th><th scope="col">{ppt("rs_pitch", lang)}</th><th scope="col">{ppt("rs_panels", lang)}</th><th scope="col">kWp</th><th scope="col">{ppt("rs_kwh", lang)}</th></tr>
              </thead>
              <tbody>
                {list.map((s, i) => (
                  <tr key={i}>
                    <th scope="row">{compassLabel(s.azimuthDeg, lang)}</th>
                    <td>{s.tiltDeg}°{s.tiltEstimated ? <small>{ppt("rs_est", lang)}</small> : null}</td>
                    <td>{nf(s.count, 0)}</td>
                    <td>{nf(s.kwp, 2)}</td>
                    <td>{s.kwh ? nf(s.kwh, 0) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="pp-sides-note">{ppt("rs_note", lang)}</p>
        </>
      )}
      {status && (
        <p className={"pp-mark " + (status.kind === "verified" ? "is-ver" : "is-sat")}>
          {status.kind === "verified"
            ? (day ? ppt("mark_ver", lang, { d: day }) : ppt("mark_ver_nd", lang))
            : ppt("mark_sat", lang, { co: company })}
        </p>
      )}
    </div>
  );
}

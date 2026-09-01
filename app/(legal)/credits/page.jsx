// app/(legal)/credits/page.jsx — photography attribution for the homepage.
//
// Two of these photographs are CC BY-SA licensed, where crediting the author is
// a condition of the licence rather than a courtesy. The credits used to sit in
// a paragraph at the foot of the landing page; moving them here keeps the
// homepage clean while still discharging the obligation, which CC permits —
// attribution may be given "in any reasonable manner based on the medium", and
// a credits page linked from the footer is the usual form for a website.
//
// If a photograph is replaced with an original installation photo, delete its
// entry here too. The last one may only be removed outright: it is public
// domain and carries no attribution requirement at all.
import LegalShell from "../LegalShell.jsx";

export const metadata = {
  title: "Photography Credits — VoltMira",
  description:
    "Attribution for the photographs used on the VoltMira homepage, sourced from Wikimedia Commons.",
};

const PHOTOS = [
  {
    title: "Installation of photovoltaic modules on roof",
    author: "Stefan Thiesen",
    licence: "CC BY-SA 3.0",
    licenceHref: "https://creativecommons.org/licenses/by-sa/3.0/",
    href: "https://commons.wikimedia.org/wiki/File:Installation_of_photovoltaic_modules_on_roof.jpg",
    note: null,
  },
  {
    title: "Rooftop Solar Panels",
    author: "EY418",
    licence: "CC BY-SA 4.0",
    licenceHref: "https://creativecommons.org/licenses/by-sa/4.0/",
    href: "https://commons.wikimedia.org/wiki/File:Rooftop_Solar_Panels.jpg",
    note: "Cropped to remove the New York skyline.",
  },
  {
    title: "Solar panels on a roof",
    author: "Pujanak",
    licence: "Public domain",
    licenceHref: null,
    href: "https://commons.wikimedia.org/wiki/File:Solar_panels_on_a_roof.jpg",
    note: null,
  },
];

export default function Credits() {
  return (
    <LegalShell title="Photography Credits" updated="26 August 2026">
      <p className="note">
        The photographs on our homepage are placeholders, used while we gather
        photography from real VoltMira installations. They come from{" "}
        <a href="https://commons.wikimedia.org/" target="_blank" rel="noopener noreferrer">
          Wikimedia Commons
        </a>{" "}
        and are credited below as their licences require.
      </p>

      <h2>Photographs used</h2>
      <ul>
        {PHOTOS.map((p) => (
          <li key={p.href}>
            <a href={p.href} target="_blank" rel="noopener noreferrer">&ldquo;{p.title}&rdquo;</a>
            {" by "}<b>{p.author}</b>{" — "}
            {p.licenceHref ? (
              <a href={p.licenceHref} target="_blank" rel="noopener noreferrer">{p.licence}</a>
            ) : (
              p.licence
            )}
            {p.note ? <>. {p.note}</> : null}
          </li>
        ))}
      </ul>

      <h2>Share-alike</h2>
      <p>
        The two CC BY-SA photographs above, and any adaptation of them we publish, remain available
        under the same licence under which we received them. Nothing on this page restricts the
        rights you already hold in that material under those licences.
      </p>

      <h2>Corrections</h2>
      <p>
        If you are the author of one of these photographs and the credit here is wrong, incomplete,
        or you would prefer we stop using it, write to{" "}
        <a href="mailto:voltmiraenergy@gmail.com">voltmiraenergy@gmail.com</a> and we will correct
        or remove it promptly.
      </p>
    </LegalShell>
  );
}

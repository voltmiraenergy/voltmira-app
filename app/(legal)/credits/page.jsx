// app/(legal)/credits/page.jsx — the photographs on the homepage and sign-in page.
//
// All four come from Unsplash or Pexels, whose licences allow commercial use
// without attribution; they are credited anyway. When a photo is swapped for
// one of a real VoltMira installation, remove its entry here. The Wikimedia
// photos this page used to credit are only in the retired landing versions
// (landing-en-v2..v5.html), which are no longer served.
import LegalShell from "../LegalShell.jsx";

export const metadata = {
  title: "Photo Credits | VoltMira",
  description: "The photographers behind the images on the VoltMira homepage and sign-in page, and the licences they are used under.",
  alternates: { canonical: "/credits" },
};

const UNSPLASH = { name: "Unsplash License", href: "https://unsplash.com/license" };
const PEXELS = { name: "Pexels License", href: "https://www.pexels.com/license/" };

const PHOTOS = [
  {
    title: "Solar panels on a red tile roof",
    author: "Sergio Martins",
    source: "Unsplash",
    href: "https://unsplash.com/photos/solar-panels-on-a-red-tile-roof-1UtCVFoZwn4",
    licence: UNSPLASH,
    where: "Homepage header and sign-in page",
  },
  {
    title: "A man installing solar panels",
    author: "Trinh Trần",
    source: "Pexels",
    href: "https://www.pexels.com/photo/a-man-installing-solar-panels-14613939/",
    licence: PEXELS,
    where: "Homepage, how it works",
  },
  {
    title: "An aerial view of a parking lot with lots of solar panels",
    author: "Bernd Dittrich",
    source: "Unsplash",
    href: "https://unsplash.com/photos/an-aerial-view-of-a-parking-lot-with-lots-of-solar-panels-g-SFUAYL0MY",
    licence: UNSPLASH,
    where: "Homepage, commercial projects",
  },
  {
    title: "Close-up photo of a solar panel",
    author: "Los Muertos Crew",
    source: "Pexels",
    href: "https://www.pexels.com/photo/close-up-photo-of-a-solar-panel-8853509/",
    licence: PEXELS,
    where: "Homepage, closing section",
  },
];

export default function Credits() {
  return (
    <LegalShell title="Photo Credits" updated="26 September 2026">
      <p className="note">
        The photographs on our homepage and sign-in page come from Unsplash and Pexels. Their licences
        allow free commercial use without attribution, but the photographers deserve the credit, so
        here it is. The photos show installations elsewhere, not VoltMira customer projects.
      </p>

      <h2>Photographs used</h2>
      <ul>
        {PHOTOS.map((p) => (
          <li key={p.href}>
            <a href={p.href} target="_blank" rel="noopener noreferrer">&ldquo;{p.title}&rdquo;</a>
            {" by "}<b>{p.author}</b>{" on "}{p.source}, used under the{" "}
            <a href={p.licence.href} target="_blank" rel="noopener noreferrer">{p.licence.name}</a>.
            {" "}<span className="muted">Used on: {p.where}.</span>
          </li>
        ))}
      </ul>

      <h2>Corrections</h2>
      <p>
        If you took one of these photographs and the credit is wrong or incomplete, or you would
        rather we stopped using it, write to{" "}
        <a href="mailto:voltmiraenergy@gmail.com">voltmiraenergy@gmail.com</a> and we will correct
        or remove it promptly.
      </p>
    </LegalShell>
  );
}

// app/solar/page.jsx — the free solar design funnel in this language (app/solar/SolarPage.jsx).
import SolarPage, { solarMetadata } from "./SolarPage.jsx";

export const metadata = solarMetadata("en");

export default function Page() {
  return <SolarPage lang="en" />;
}

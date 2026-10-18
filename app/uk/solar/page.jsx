// app/uk/solar/page.jsx — the free solar design funnel in this language (app/solar/SolarPage.jsx).
import SolarPage, { solarMetadata } from "../../solar/SolarPage.jsx";

export const metadata = solarMetadata("uk");

export default function Page() {
  return <SolarPage lang="uk" />;
}

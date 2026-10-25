// app/not-found.jsx — branded 404 that respects the shared theme system, in the language the visitor last used
// (the voltmira_lang cookie the app and the proposals keep), English when there is none.
import Link from "next/link";
import { cookies } from "next/headers";
import { LogoMark } from "../lib/Logo.jsx";

const WORDS = {
  en: { title: "Page not found", eyebrow: "Error 404", h: "This roof isn't in our database.", p: "The page you're after moved, was renamed, or never existed. Head home or explore the live demo.", home: "Back home", demo: "Open the live demo" },
  ro: { title: "Pagina nu a fost găsită", eyebrow: "Eroare 404", h: "Acoperișul acesta nu e în baza noastră de date.", p: "Pagina căutată a fost mutată, redenumită sau nu a existat niciodată. Mergi acasă sau încearcă demo-ul live.", home: "Înapoi acasă", demo: "Deschide demo-ul live" },
  ru: { title: "Страница не найдена", eyebrow: "Ошибка 404", h: "Этой крыши нет в нашей базе.", p: "Страница, которую вы ищете, перемещена, переименована или никогда не существовала. Вернитесь на главную или откройте живое демо.", home: "На главную", demo: "Открыть живое демо" },
  uk: { title: "Сторінку не знайдено", eyebrow: "Помилка 404", h: "Цього даху немає в нашій базі.", p: "Сторінку, яку ви шукаєте, переміщено, перейменовано або її ніколи не існувало. Поверніться на головну або відкрийте живе демо.", home: "На головну", demo: "Відкрити живе демо" },
};
async function wordsNow() {
  let l = "en";
  try { const c = (await cookies()).get("voltmira_lang")?.value; if (WORDS[c]) l = c; } catch { /* no request: English */ }
  return { l, w: WORDS[l] };
}

export async function generateMetadata() {
  const { w } = await wordsNow();
  return { title: `${w.title} | VoltMira`, robots: { index: false, follow: true } };
}

export default async function NotFound() {
  const { l, w } = await wordsNow();
  return (
    <div lang={l} style={{
      minHeight: "100vh", background: "var(--app-bg)", color: "var(--app-text)",
      display: "grid", placeItems: "center", padding: "40px 24px",
      fontFamily: "Inter, system-ui, sans-serif",
    }}>
      <main style={{ maxWidth: 520, textAlign: "center" }}>
        <div aria-hidden="true" style={{ marginBottom: 22, display: "inline-flex" }}>
          <LogoMark size={56} />
        </div>
        <p style={{
          fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12.5,
          letterSpacing: ".14em", textTransform: "uppercase",
          color: "var(--app-muted)", margin: "0 0 12px",
        }}>{w.eyebrow}</p>
        <h1 style={{
          fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 700,
          fontSize: "clamp(30px, 5vw, 44px)", letterSpacing: "-.03em",
          lineHeight: 1.05, margin: "0 0 14px",
        }}>{w.h}</h1>
        <p style={{
          fontSize: 15.5, lineHeight: 1.55, color: "var(--app-text)",
          opacity: .78, margin: "0 0 30px",
        }}>
          {w.p}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/" style={{
            background: "#1E6B4E", color: "#fff", padding: "12px 20px",
            borderRadius: 10, fontWeight: 700, fontSize: 14.5, textDecoration: "none",
          }}>{w.home}</Link>
          <Link href="/demo" style={{
            background: "transparent", color: "var(--app-text)",
            border: "1px solid var(--app-line)", padding: "12px 20px",
            borderRadius: 10, fontWeight: 600, fontSize: 14.5, textDecoration: "none",
          }}>{w.demo}</Link>
        </div>
      </main>
    </div>
  );
}

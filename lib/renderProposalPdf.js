// lib/renderProposalPdf.js — renders a proposal to PDF bytes in headless Chromium.
//
// Shared by the download route and the email route, so a client who is sent the
// PDF receives byte-for-byte what the installer sees. Server-only: imports a
// 67MB browser.
//
// PERFORMANCE. Three things dominated the original 8.7s cold / 2.6s warm:
//   1. Launching Chromium on every request.
//   2. waitUntil:"networkidle0", which by definition sits idle for 500ms after
//      the last request AND waits on the Google Fonts stylesheet the page links
//      — a stylesheet whose result we then throw away, because we inject Inter
//      ourselves.
//   3. Loading the page's client JS, which the PDF does not need: PrintSheet is
//      server-rendered, so the layout is final at DOMContentLoaded.
// The browser is now reused across warm invocations, external CSS/JS is aborted
// at the network layer, and we wait for images rather than for the network to
// go quiet.
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { INTER_EMBED_CSS } from "./interEmbed.js";

/** Local dev has no Lambda Chromium layer — fall back to an installed browser. */
function localBrowserPath() {
  if (process.env.CHROME_EXECUTABLE_PATH) return process.env.CHROME_EXECUTABLE_PATH;
  if (process.platform === "win32") return "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  if (process.platform === "darwin") return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  return "/usr/bin/google-chrome";
}

// Module scope survives between invocations that land on the same warm
// container, so the launch cost is paid once rather than per request.
let browserPromise = null;

async function launchBrowser() {
  const onLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.VERCEL;
  if (!onLambda) {
    return puppeteer.launch({ executablePath: localBrowserPath(), headless: true });
  }
  // No WebGL needed for a document; skipping the graphics stack avoids
  // extracting swiftshader (~40MB) on every cold start.
  chromium.setGraphicsMode = false;
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}

async function getBrowser() {
  if (browserPromise) {
    try {
      const b = await browserPromise;
      // A container can be frozen and thawed between invocations; if Chromium
      // died in the meantime, fall through and relaunch rather than throwing.
      if (b.connected) return b;
    } catch { /* fall through to relaunch */ }
    browserPromise = null;
  }
  browserPromise = launchBrowser();
  try {
    return await browserPromise;
  } catch (e) {
    browserPromise = null;   // never cache a failed launch
    throw e;
  }
}

/**
 * Launch (or confirm) the shared browser without rendering anything.
 * The UI calls this the moment the share modal opens, so the ~3.5s Chromium
 * launch overlaps with the installer typing an address instead of landing on
 * them after they click Send. Warm containers return instantly.
 */
export async function warmBrowser() {
  const t0 = Date.now();
  await getBrowser();
  return Date.now() - t0;
}

/**
 * Render any page of this app to PDF.
 *
 * @param {string} target  absolute URL to render
 * @param {object} [opts]
 * @param {Array<{name:string,value:string}>} [opts.cookies]
 *        Session cookies to replay. The proposal lives on a public capability
 *        URL, but the proforma invoice is auth-scoped and RLS-filtered, so the
 *        headless browser has to carry the CALLER's own session — it must see
 *        exactly what they are allowed to see, never more.
 * @returns {Promise<{pdf: Buffer, timings: Record<string, number>}>}
 */
export async function renderPdf(target, opts = {}) {
  const t0 = Date.now();
  const mark = {};

  const browser = await getBrowser();
  mark.browser = Date.now() - t0;

  let page;
  try {
    page = await browser.newPage();

    if (opts.cookies?.length) {
      const { hostname } = new URL(target);
      await page.setCookie(...opts.cookies.map((c) => ({ ...c, domain: hostname, path: "/" })));
    }

    // Drop what the PDF cannot use. The Google Fonts stylesheet is the important
    // one: we inject Inter as base64 below, so fetching it only adds latency and
    // a chance of a slow third party stalling the render.
    await page.setRequestInterception(true);
    page.on("request", (r) => {
      const type = r.resourceType();
      const url = r.url();
      if (type === "script" || type === "media" || url.includes("fonts.googleapis.com") || url.includes("fonts.gstatic.com")) {
        r.abort().catch(() => { });
      } else {
        r.continue().catch(() => { });
      }
    });

    // Inject Inter BEFORE navigation so it is present at first paint. A
    // serverless container has no system fonts and Chromium substitutes
    // silently — a headless render of this page embedded only Segoe UI before
    // this existed.
    await page.evaluateOnNewDocument((css) => {
      window.addEventListener("DOMContentLoaded", () => {
        const el = document.createElement("style");
        el.textContent = css;
        document.head.appendChild(el);
      });
    }, INTER_EMBED_CSS);

    // domcontentloaded, not networkidle0: the sheet is server-rendered, so the
    // markup is final here and networkidle0 would just add its 500ms quiet window.
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30000 });
    mark.nav = Date.now() - t0;

    // Wait for exactly what layout depends on: the fonts and any logo image.
    await page.evaluate(async () => {
      await Promise.all([
        document.fonts.load("400 14px Inter"),
        document.fonts.load("600 14px Inter"),
        document.fonts.load("700 24px Inter"),
      ]);
      await document.fonts.ready;
      await Promise.all([...document.images].map((i) =>
        i.complete ? null : i.decode().catch(() => { })));
    });
    mark.fonts = Date.now() - t0;

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,      // honour @page{size:A4;margin:14mm}
      displayHeaderFooter: false,   // no Chrome header, no leaked URL
    });
    mark.pdf = Date.now() - t0;
    return { pdf: Buffer.from(pdf), timings: mark };
  } finally {
    // Close the PAGE, keep the BROWSER: the next warm invocation reuses it.
    try { await page?.close(); } catch { }
  }
}

/** Convenience wrapper for the public client proposal. */
export function renderProposalPdf(code, base) {
  // auto=0 suppresses AutoPrint: window.print() inside headless Chromium blocks
  // rather than returning, and we drive printing through CDP instead.
  return renderPdf(`${base}/p/${code}?print=1&auto=0`);
}

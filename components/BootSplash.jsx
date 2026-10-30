// components/BootSplash.jsx — the opening screen of the installed (home-screen) app: the VoltMira mark draws its
// three strokes, the name settles under it and a red, amber and green band fills, then it fades into the page.
// It is in the server's HTML and pure CSS, so it covers the very first paint and needs no script; it shows only in
// the installed app ((display-mode: standalone), or the is-standalone class lib/inlineScripts.js sets on older
// iPhones) and only on a full load, never on a click inside the app. The logo is the exact one (lib/Logo.jsx),
// on paper, as the manifest's background colour, so the phone's own launch screen flows straight into it.
import { LOGO_INK, LOGO_GREEN, LOGO_PAPER } from "../lib/Logo.jsx";

const CSS = `
.vm-boot{display:none}
@media (display-mode: standalone){.vm-boot{display:flex}}
html.is-standalone .vm-boot{display:flex}
.vm-boot{position:fixed;inset:0;z-index:2147483000;flex-direction:column;align-items:center;justify-content:center;gap:22px;
  background:${LOGO_PAPER};pointer-events:none;animation:vm-boot-out .42s ease 1.25s forwards}
.vm-boot-mark{width:84px;height:84px;border-radius:21px;filter:drop-shadow(0 14px 30px rgba(20,42,33,.22));
  animation:vm-boot-pop .5s cubic-bezier(.2,.9,.3,1.2) both}
.vm-boot-mark path{stroke-dasharray:24;stroke-dashoffset:24;animation:vm-boot-draw .38s ease-out forwards}
.vm-boot-mark path:nth-of-type(1){animation-delay:.18s}
.vm-boot-mark path:nth-of-type(2){animation-delay:.32s}
.vm-boot-mark path:nth-of-type(3){animation-delay:.46s}
.vm-boot-mark circle{opacity:0;transform-origin:20.5px 9px;animation:vm-boot-dot .3s ease-out .7s forwards}
.vm-boot-name{font:800 30px/1 "Inter Tight",Inter,system-ui,sans-serif;letter-spacing:-.02em;color:${LOGO_INK};
  opacity:0;transform:translateY(6px);animation:vm-boot-up .4s ease-out .5s forwards}
.vm-boot-name b{color:${LOGO_GREEN};font-weight:800}
.vm-boot-band{display:flex;gap:4px;width:120px;height:4px}
.vm-boot-band i{flex:1;border-radius:99px;background:rgba(20,42,33,.1);overflow:hidden;position:relative}
.vm-boot-band i::after{content:"";position:absolute;inset:0;transform:scaleX(0);transform-origin:left;animation:vm-boot-fill .3s ease-out forwards}
.vm-boot-band i:nth-child(1)::after{background:#C4543B;animation-delay:.6s}
.vm-boot-band i:nth-child(2)::after{background:#E89B2D;animation-delay:.8s}
.vm-boot-band i:nth-child(3)::after{background:#3FAE6A;animation-delay:1s}
@keyframes vm-boot-pop{from{opacity:0;transform:scale(.82)}to{opacity:1;transform:none}}
@keyframes vm-boot-draw{to{stroke-dashoffset:0}}
@keyframes vm-boot-dot{from{opacity:0;transform:scale(.2)}to{opacity:1;transform:none}}
@keyframes vm-boot-up{to{opacity:1;transform:none}}
@keyframes vm-boot-fill{to{transform:none}}
@keyframes vm-boot-out{to{opacity:0;visibility:hidden}}
@media (prefers-reduced-motion: reduce){
  .vm-boot{animation-delay:.5s}
  .vm-boot *,.vm-boot-band i::after{animation:none!important;opacity:1!important;transform:none!important;stroke-dashoffset:0!important}
}
`;

export default function BootSplash() {
  return (
    <div className="vm-boot" aria-hidden="true">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <svg className="vm-boot-mark" viewBox="0 0 34 34" fill="none">
        <rect width="34" height="34" rx="8" fill={LOGO_INK} />
        <path d="M8 25 L14 12" stroke="#C4543B" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M14.5 25 L20.5 9" stroke="#E89B2D" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M21 25 L27 6.5" stroke="#3FAE6A" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="20.5" cy="9" r="2.1" fill="#E89B2D" />
      </svg>
      <div className="vm-boot-name">Volt<b>Mira</b></div>
      <div className="vm-boot-band"><i /><i /><i /></div>
    </div>
  );
}

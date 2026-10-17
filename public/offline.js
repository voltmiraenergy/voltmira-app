/* public/offline.js — the offline page's words in the workspace language,
   the retry button, and going back once the network answers. A file rather
   than an inline script: the Content-Security-Policy (lib/csp.js) runs no
   inline script without a nonce or a known hash, and this page is saved by
   the offline worker (public/app-sw.js), which keeps this file next to it. */
(function () {
  var T = {
    en: ["No signal", "This page isn't saved on this device yet. Pages you have opened online, and your recent quotes, work without a signal.", "Try again", "Dashboard"],
    ro: ["Fără semnal", "Pagina asta nu e încă salvată pe acest dispozitiv. Paginile deschise cu internet și ofertele recente merg și fără semnal.", "Încearcă din nou", "Panou"],
    ru: ["Нет сети", "Эта страница ещё не сохранена на этом устройстве. Страницы, открытые с интернетом, и недавние расчёты работают и без сети.", "Повторить", "Панель"],
    uk: ["Немає мережі", "Ця сторінка ще не збережена на цьому пристрої. Сторінки, відкриті з інтернетом, і нещодавні розрахунки працюють і без мережі.", "Спробувати ще", "Панель"]
  };
  var l = "ro";
  try { l = localStorage.getItem("voltmira_lang") || "ro"; } catch (e) {}
  var s = T[l] || T.ro;
  document.documentElement.lang = T[l] ? l : "ro";
  document.getElementById("h").textContent = s[0];
  document.getElementById("p").textContent = s[1];
  document.getElementById("retry").textContent = s[2];
  document.getElementById("home").textContent = s[3];
  document.getElementById("retry").addEventListener("click", function () { location.reload(); });
  // Back online: go back to where the engineer was trying to go. Browsers
  // can report "online" while a tap on Dashboard is already leaving this
  // page; a reload then would cancel that tap and trap them here. So: never
  // once leaving, and only after the server has actually answered.
  var leaving = false;
  window.addEventListener("beforeunload", function () { leaving = true; });
  window.addEventListener("pagehide", function () { leaving = true; });
  window.addEventListener("online", function () {
    if (leaving) return;
    fetch(location.href, { method: "HEAD", cache: "no-store" })
      .then(function (r) { if (!leaving && r.ok) location.reload(); })
      .catch(function () {});
  });
})();

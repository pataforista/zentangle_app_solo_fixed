// Navegación por pasos de la barra lateral: marca el paso visible y abre el
// texto largo de ayuda al hacer clic. También arranca el modo Rápido/Personalizar.
import { initMode } from "./mode.js";

initMode();
const scroller = document.querySelector(".panel-scroll");
const links = [...document.querySelectorAll(".steps a")];
const allSections = links.map((a) => document.querySelector(a.getAttribute("href"))).filter(Boolean);

// En modo rápido algunos pasos están ocultos: no cuentan para la navegación.
const visible = (el) => el.getClientRects().length > 0;

function markCurrent() {
  const sections = allSections.filter(visible);
  if (!scroller || !sections.length) return;
  const own = scroller.scrollHeight > scroller.clientHeight + 4 && getComputedStyle(scroller).overflowY !== "visible";
  const top = (own ? scroller.getBoundingClientRect().top : 0) + 80;
  let current = sections[0];
  for (const s of sections) if (s.getBoundingClientRect().top <= top) current = s;
  // Al final del scroll, el último paso cuenta como visible.
  if (own && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4) current = sections[sections.length - 1];
  for (const a of links) a.classList.toggle("active", a.getAttribute("href") === `#${current.id}`);
  for (const s of sections) s.classList.toggle("current", s === current);
}

scroller?.addEventListener("scroll", markCurrent, { passive: true });
window.addEventListener("scroll", markCurrent, { passive: true });
for (const a of links) {
  a.addEventListener("click", (e) => {
    const target = document.querySelector(a.getAttribute("href"));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
document.addEventListener("zt:mode", markCurrent);
document.getElementById("randomHint")?.addEventListener("click", (e) => e.currentTarget.classList.toggle("open"));
markCurrent();

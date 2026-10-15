/* VertexHand — entry. Smooth scrolling + modules. */

import Lenis from "lenis";
import "./style.css";
import "./brand.js";
import "./scene.js";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* smooth scrolling: wheel steps glide instead of jumping 100px at a time */
const lenis = reduce ? null : new Lenis({ lerp: 0.09, wheelMultiplier: 0.9, anchors: true });
window.__lenis = lenis;
window.__jump = (y) => (lenis ? lenis.scrollTo(y, { immediate: true, force: true }) : scrollTo(0, y)); // debug / tests

function raf(t) {
  lenis?.raf(t);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// safety net: the hero copy waits for .ready — never leave it hidden if the 3D scene is slow or unavailable
setTimeout(() => document.body.classList.add("ready"), 6000);

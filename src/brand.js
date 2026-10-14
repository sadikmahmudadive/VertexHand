/* Brand page.
   Every block is an object in the same 3D flight as the film: it rises out
   of the deep (small, tilted, faint, near the vanishing point), settles into
   reading position, then — as you fly on — swells past the viewer and is gone.
   Pure transform/opacity, driven by scroll position, one rAF write per frame. */

import "./projects.js"; // renders the project cards before they are measured below

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const items = [...document.querySelectorAll("[data-reveal]")].map((el) => ({
  el, cx: 0, cy: 0, top: 0, bot: 0, key: "",
}));

const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
const sstep = (x) => x * x * (3 - 2 * x);

/* natural (untransformed) geometry of each block, in page coordinates */
export function diveMeasure() {
  for (const it of items) it.el.style.transform = "none";
  for (const it of items) {
    const r = it.el.getBoundingClientRect();
    it.cx = r.left + scrollX + r.width / 2;
    it.cy = r.top + scrollY + r.height / 2;
    it.top = r.top + scrollY;
    it.bot = r.bottom + scrollY;
    it.key = "";
  }
  diveUpdate(true);
}

let lastY = -1, lastW = -1;
export function diveUpdate(force = false) {
  if (reduce) return;
  const sy = scrollY, vh = innerHeight, vw = innerWidth;
  if (!force && sy === lastY && vw === lastW) return;
  lastY = sy; lastW = vw;

  for (const it of items) {
    const yt = it.top - sy;          // top edge, viewport px
    const yb = it.bot - sy;          // bottom edge, viewport px
    let s = 1, o = 1, tilt = 0;

    // arriving from the deep: begins as the top edge climbs above 62% of the screen
    const uIn = clamp01((yt - vh * 0.62) / (vh * 0.4));
    if (uIn > 0) {
      const e = sstep(uIn);
      s = 1 - 0.6 * e;
      o = Math.pow(1 - uIn, 1.5);
      tilt = e * 30;
    }
    // flying past: begins once the bottom edge rises above 42% of the screen
    const uOut = clamp01((vh * 0.42 - yb) / (vh * 0.5));
    if (uOut > 0) {
      const e = sstep(uOut);
      s = 1 + 1.15 * e;
      o = Math.min(o, Math.pow(1 - uOut, 1.3));
      tilt = -e * 8;
    }

    // scale about the screen centre = travelling along the flight line
    const dx = (s - 1) * (it.cx - vw / 2);
    const dy = (s - 1) * (it.cy - sy - vh / 2);
    const key = `${dx.toFixed(1)}|${dy.toFixed(1)}|${s.toFixed(3)}|${tilt.toFixed(1)}|${o.toFixed(3)}`;
    if (key === it.key) continue;
    it.key = key;

    const st = it.el.style;
    st.opacity = o.toFixed(3);
    st.transform = o >= 0.999 && s === 1
      ? "none"
      : `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${s.toFixed(3)}) perspective(900px) rotateX(${tilt.toFixed(1)}deg)`;
    st.pointerEvents = o < 0.35 ? "none" : "";
  }
}

// filtering projects changes the layout: re-measure every block
addEventListener("vh:relayout", () => diveMeasure());

/* nav turns solid once the film is over */
const nav = document.getElementById("brandnav");
const track = document.getElementById("track");
addEventListener("scroll", () => nav.classList.toggle("solid", scrollY > track.offsetHeight - innerHeight * 1.05), { passive: true });
nav.classList.toggle("solid", scrollY > track.offsetHeight - innerHeight * 1.05);

// cursor-following glow on service cards
document.querySelectorAll(".svc").forEach((card) =>
  card.addEventListener("pointermove", (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - r.left}px`);
    card.style.setProperty("--my", `${e.clientY - r.top}px`);
  }),
);

document.getElementById("year").textContent = new Date().getFullYear();
// late layout shifts (fonts, images) move the natural positions
addEventListener("load", () => diveMeasure());

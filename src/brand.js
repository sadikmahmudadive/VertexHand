/* Page behaviour that isn't 3D: one-shot reveals, nav state, FAQ accordion.
   Each block eases in ONCE as it enters the viewport via a CSS transition —
   no per-scroll JavaScript, so nothing can fight the browser's scrolling. */

import "./projects.js"; // renders the project cards before they are observed below

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* big headings: split into words so each can rise out of a mask */
const headings = [...document.querySelectorAll(".big")];
if (!reduce) {
  for (const h of headings) {
    h.removeAttribute("data-reveal");
    h.classList.add("split");
    let wi = 0;
    const frag = document.createDocumentFragment();
    for (const node of [...h.childNodes]) {
      if (node.nodeType === 3) {
        node.textContent.split(/\s+/).filter(Boolean).forEach((word, i, arr) => {
          const w = document.createElement("span");
          w.className = "w";
          const inner = document.createElement("span");
          inner.style.setProperty("--wi", wi++);
          inner.textContent = word;
          w.appendChild(inner);
          frag.appendChild(w);
          frag.appendChild(document.createTextNode(" "));
        });
      } else frag.appendChild(node.cloneNode(true));
    }
    h.replaceChildren(frag);
  }
  const hio = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting || e.boundingClientRect.top < 0) {
          e.target.classList.add("in");
          setTimeout(() => e.target.classList.add("done"), 2200);
          hio.unobserve(e.target);
        }
      }
    },
    { threshold: 0.2, rootMargin: "0px 0px -8% 0px" },
  );
  headings.forEach((h) => hio.observe(h));
}

const items = [...document.querySelectorAll("[data-reveal]")];

if (!reduce) {
  // stagger siblings of the same grid/row a little
  const groups = new Map();
  for (const el of items) {
    const list = groups.get(el.parentElement) ?? [];
    list.push(el);
    groups.set(el.parentElement, list);
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.forEach((el, i) => el.style.setProperty("--d", `${Math.min(i, 5) * 70}ms`));
  }

  const show = (el) => {
    el.classList.add("in");
    // once settled, drop the reveal styles so the element's own hover transitions apply
    setTimeout(() => { el.removeAttribute("data-reveal"); el.classList.remove("in"); el.style.removeProperty("--d"); }, 1700);
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        // already scrolled past (anchor jump): reveal silently; on screen: animate
        if (e.isIntersecting || e.boundingClientRect.top < 0) { show(e.target); io.unobserve(e.target); }
      }
    },
    { threshold: 0.1, rootMargin: "0px 0px -6% 0px" },
  );
  items.forEach((el) => io.observe(el));
}

/* nav turns white once the 3D scene is behind us */
const nav = document.getElementById("brandnav");
const proc = document.getElementById("process");
const syncNav = () => nav.classList.toggle("solid", proc.getBoundingClientRect().bottom < innerHeight * 0.66);
addEventListener("scroll", syncNav, { passive: true });
syncNav();

/* FAQ accordion (one open at a time) */
const faq = document.getElementById("faqList");
faq?.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const row = btn.closest(".q");
  const open = !row.classList.contains("on");
  faq.querySelectorAll(".q").forEach((q) => {
    q.classList.remove("on");
    q.querySelector("button").setAttribute("aria-expanded", "false");
  });
  if (open) { row.classList.add("on"); btn.setAttribute("aria-expanded", "true"); }
});

document.getElementById("year").textContent = new Date().getFullYear();

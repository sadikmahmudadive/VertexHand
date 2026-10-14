/* Projects showcase — edit PROJECTS below; everything else renders from it.

   To add a project: copy an entry, give it a new id, drop a screenshot into
   public/assets/projects/ and point `image` at it. (sample: true shows a
   "Sample" badge — only for placeholder entries.)

   Fields
     cat        mobile | web | systems | iot          (filter group)
     kind       app | web | dash | pos | crm | iot    (which illustration to draw)
     hue        0-360, tints the card (blue 215, cyan 190, violet 265 …)
     image      optional: path to a real screenshot (e.g. "./assets/projects/shop.webp");
                when set it replaces the illustration
     highlights 2-4 short bullet points shown in the detail popup
     url        optional live link, shown as a "Visit" button                       */

const PROJECTS = [
  {
    id: "pet-maya",
    title: "Pet Maya",
    cat: "web", catLabel: "E-commerce & pet-care platform", kind: "web", hue: 190,
    image: "./assets/projects/pet-maya.webp",
    url: "https://www.petmaya.app/",
    tagline: "Pet medicine, vets and live GPS in one place.",
    desc: "An online pet pharmacy and care platform for Dhaka. Pet parents shop genuine medicine, food and gear with cold-chain delivery, book a licensed vet, run a photo-based symptom check and track their pet on a live GPS radar.",
    highlights: ["Dispensary with cold-chain delivery and live order tracking", "Vet booking and AI photo triage that rates urgency", "GPS radar with live location and safe zones", "Subscribe-and-save refills; pay by bKash, Nagad, card or COD"],
    stack: ["React", "Vite", "Firebase", "Cloudinary"],
  },
  {
    id: "bismillah-accessories",
    title: "Bismillah Accessories",
    cat: "web", catLabel: "E-commerce store", kind: "web", hue: 160,
    image: "./assets/projects/bismillah-accessories.webp",
    url: "https://bismillah-accessories.vercel.app/",
    tagline: "A premium mobile-accessories store for Bangladesh.",
    desc: "A fast, clean online store for phone cases, charging gear and audio. Shoppers browse curated collections, save favourites, and check out with cash on delivery or bKash, with nationwide delivery and a simple returns policy.",
    highlights: ["Curated collections: phone cases, charging and audio", "Cart, wishlist and checkout", "Cash on delivery and bKash payments", "Promotional slider, reviews and authenticity badges"],
    stack: ["Next.js", "React", "Vercel"],
  },
  {
    id: "sm-science-group",
    title: "SM Science Group",
    cat: "systems", catLabel: "Education website & student portal", kind: "dash", hue: 235,
    image: "./assets/projects/sm-science-group.webp",
    url: "https://sm-science-group.vercel.app/",
    tagline: "One digital home for a school, an academy and their families.",
    desc: "The website for an education group covering a KG–Class 8 school and a science coaching academy, with an immersive 3D landing page and the SM-Annex smart portal that connects teachers, students and parents.",
    highlights: ["Public site for the school, academy and faculty", "SM-Annex portal with live attendance tracking", "Automated grade calculation and study material", "Teacher–parent messaging"],
    stack: ["Next.js", "React", "Firebase", "Vercel"],
  },
];

const CATS = [
  ["all", "All"],
  ["mobile", "Mobile"],
  ["web", "Web & e-commerce"],
  ["systems", "Business systems"],
  ["iot", "IoT & embedded"],
];

/* ── illustrations (pure SVG, tinted per project) ──────── */

const ART = {
  app: `<rect class="o" x="118" y="12" width="84" height="176" rx="15"/><rect class="f" x="128" y="32" width="64" height="30" rx="7"/>
    <rect class="g" x="128" y="70" width="30" height="30" rx="7"/><rect class="g" x="162" y="70" width="30" height="30" rx="7"/>
    <rect class="g" x="128" y="108" width="64" height="8" rx="4"/><rect class="g" x="128" y="122" width="44" height="8" rx="4"/>
    <circle class="f" cx="160" cy="162" r="7"/><path class="l" d="M30 150c30-48 62-52 86-24"/><path class="l" d="M204 56c40-26 70-18 90 18"/>
    <circle class="f" cx="30" cy="150" r="4"/><circle class="f" cx="294" cy="74" r="4"/>`,
  web: `<rect class="o" x="34" y="22" width="252" height="156" rx="9"/><path class="o" d="M34 44h252"/>
    <circle class="f" cx="46" cy="33" r="2.5"/><circle class="g" cx="55" cy="33" r="2.5"/><circle class="g" cx="64" cy="33" r="2.5"/>
    <rect class="g" x="46" y="54" width="130" height="52" rx="5"/><rect class="f" x="186" y="54" width="88" height="52" rx="5"/>
    <rect class="g" x="46" y="116" width="76" height="52" rx="5"/><rect class="g" x="130" y="116" width="76" height="52" rx="5"/><rect class="g" x="214" y="116" width="60" height="52" rx="5"/>
    <rect class="f" x="54" y="64" width="64" height="8" rx="4"/>`,
  dash: `<rect class="o" x="30" y="20" width="260" height="160" rx="9"/><path class="o" d="M72 20v160"/>
    <rect class="f" x="44" y="34" width="14" height="14" rx="4"/><rect class="g" x="44" y="62" width="14" height="14" rx="4"/><rect class="g" x="44" y="86" width="14" height="14" rx="4"/><rect class="g" x="44" y="110" width="14" height="14" rx="4"/>
    <rect class="g" x="84" y="34" width="62" height="30" rx="6"/><rect class="g" x="154" y="34" width="62" height="30" rx="6"/><rect class="f" x="224" y="34" width="54" height="30" rx="6"/>
    <path class="l" d="M86 150l26-22 24 12 30-36 28 18 30-30 24 14 28-24"/><rect class="g" x="84" y="76" width="194" height="2" rx="1"/>`,
  pos: `<rect class="o" x="26" y="22" width="268" height="156" rx="9"/>
    ${[0, 1, 2].map((r) => [0, 1, 2].map((c) => `<rect class="${r === 0 && c === 1 ? "f" : "g"}" x="${38 + c * 52}" y="${34 + r * 44}" width="44" height="36" rx="6"/>`).join("")).join("")}
    <path class="o" d="M206 22v156"/><rect class="g" x="218" y="36" width="64" height="7" rx="3.5"/><rect class="g" x="218" y="52" width="48" height="7" rx="3.5"/><rect class="g" x="218" y="68" width="58" height="7" rx="3.5"/>
    <rect class="f" x="218" y="136" width="64" height="28" rx="7"/>`,
  crm: `<rect class="o" x="26" y="22" width="268" height="156" rx="9"/>
    <rect class="g" x="38" y="34" width="74" height="132" rx="6"/><rect class="g" x="123" y="34" width="74" height="132" rx="6"/><rect class="g" x="208" y="34" width="74" height="132" rx="6"/>
    <rect class="f" x="45" y="44" width="60" height="26" rx="5"/><rect class="o" x="45" y="78" width="60" height="26" rx="5"/><rect class="o" x="45" y="112" width="60" height="26" rx="5"/>
    <rect class="o" x="130" y="44" width="60" height="26" rx="5"/><rect class="f" x="130" y="78" width="60" height="26" rx="5"/>
    <rect class="f" x="215" y="44" width="60" height="26" rx="5"/>`,
  iot: `<rect class="f" x="138" y="68" width="44" height="44" rx="7"/><rect class="o" x="128" y="58" width="64" height="64" rx="10"/>
    <path class="l" d="M128 80H70M128 100H50M192 80h58M192 100h74M150 58V28M170 122v38"/>
    <circle class="f" cx="70" cy="80" r="5"/><circle class="f" cx="50" cy="100" r="5"/><circle class="f" cx="250" cy="80" r="5"/><circle class="f" cx="266" cy="100" r="5"/><circle class="f" cx="150" cy="28" r="5"/><circle class="f" cx="170" cy="160" r="5"/>
    <path class="o" d="M30 176q22-20 44 0t44 0 44 0 44 0 44 0 44 0"/>`,
};

function visual(p) {
  if (p.image) return `<div class="pv" style="--h:${p.hue}"><img src="${p.image}" alt="${p.title}" loading="lazy" /></div>`;
  return `<div class="pv" style="--h:${p.hue}"><svg viewBox="0 0 320 200" aria-hidden="true">${ART[p.kind]}</svg></div>`;
}

const tag = (t) => `<span>${t}</span>`;

/* ── render ────────────────────────────────────────────── */

const grid = document.getElementById("projGrid");
const filters = document.getElementById("projFilters");
const dialog = document.getElementById("projModal");

if (grid && filters && dialog) {
  filters.innerHTML = CATS.filter(([id]) => id === "all" || PROJECTS.some((p) => p.cat === id))
    .map(([id, label], i) => `<button type="button" class="chip${i === 0 ? " on" : ""}" data-cat="${id}" aria-pressed="${i === 0}">${label}</button>`)
    .join("");

  grid.innerHTML = PROJECTS.map(
    (p) => `
    <article class="proj" data-reveal data-cat="${p.cat}" data-id="${p.id}" tabindex="0" role="button" aria-label="${p.title} — view details">
      ${visual(p)}
      ${p.sample ? `<span class="sample">Sample</span>` : ""}
      <div class="pbody">
        <span class="pcat">${p.catLabel}</span>
        <h3>${p.title}</h3>
        <p>${p.tagline}</p>
        <div class="tags">${p.stack.map(tag).join("")}</div>
        <span class="more">View project <i aria-hidden="true">→</i></span>
      </div>
    </article>`,
  ).join("");

  // filtering re-flows the page, so tell the dive engine to re-measure
  filters.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    filters.querySelectorAll(".chip").forEach((c) => {
      const on = c === btn;
      c.classList.toggle("on", on);
      c.setAttribute("aria-pressed", on);
    });
    const cat = btn.dataset.cat;
    grid.querySelectorAll(".proj").forEach((card) => { card.hidden = cat !== "all" && card.dataset.cat !== cat; });
    dispatchEvent(new Event("vh:relayout"));
  });

  /* detail popup */
  const open = (id) => {
    const p = PROJECTS.find((x) => x.id === id);
    if (!p) return;
    dialog.innerHTML = `
      <button type="button" class="pclose" aria-label="Close">×</button>
      <div class="pm-grid">
        <div>${visual(p)}${p.sample ? `<p class="pm-note">Sample project — shown to illustrate the kind of work we build.</p>` : ""}</div>
        <div class="pm-body">
          <span class="pcat">${p.catLabel}</span>
          <h3>${p.title}</h3>
          <p class="pm-desc">${p.desc}</p>
          <ul class="checks">${p.highlights.map((h) => `<li>${h}</li>`).join("")}</ul>
          <div class="tags">${p.stack.map(tag).join("")}</div>
          <div class="ctas left">
            <a class="cta solid" href="#contact" data-close>Start a similar project</a>
            ${p.url ? `<a class="cta" href="${p.url}" target="_blank" rel="noopener">Visit live site ↗</a>` : ""}
          </div>
        </div>
      </div>`;
    dialog.showModal();
  };

  grid.addEventListener("click", (e) => { const c = e.target.closest(".proj"); if (c) open(c.dataset.id); });
  grid.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("proj")) { e.preventDefault(); open(e.target.dataset.id); }
  });
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog || e.target.closest(".pclose") || e.target.closest("[data-close]")) dialog.close();
  });
}

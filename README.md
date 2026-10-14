# VertexHand

Website for **VertexHand** — custom Android & iOS apps, websites, e-commerce, ERP / CRM / POS / HRM / management systems, IoT & embedded, plus hosting and domains.

A scroll-driven 3D experience built with [three.js](https://threejs.org/) and [Vite](https://vitejs.dev/): scrolling flies a camera through a universe of particle objects (one per service), then carries on beneath the brand page, where every block dives in from the deep.

## Run

```bash
npm install
npm run dev      # http://localhost:5181
npm run build    # production build → dist/
npm run preview  # serve the production build
```

## Where things live

| Path | What |
|---|---|
| `index.html` | Page content: film captions + brand page sections |
| `src/main.js` | three.js scene, camera flight, captions, labels |
| `src/shapes.js` | The 8 particle objects (logo, phone, browser, systems, chip, stack, globe) |
| `src/brand.js` | Scroll-driven "dive" transforms for every page block |
| `src/projects.js` | **Project showcase data** — edit the `PROJECTS` array to add/change projects |
| `src/style.css` | All styling |
| `public/assets/` | Logo and project screenshots |

To add a project: copy an entry in `src/projects.js`, then put its screenshot in `public/assets/projects/` and set `image`.

Respects `prefers-reduced-motion`. The build uses relative paths, so it can be hosted from any sub-path (e.g. GitHub Pages).

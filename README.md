# VertexHand

Website for **VertexHand** — custom Android & iOS apps, websites, e-commerce, ERP / CRM / POS / HRM / management systems, IoT & embedded, plus hosting and domains.

A scroll-driven 3D website built with [three.js](https://threejs.org/) and [Vite](https://vitejs.dev/). One fixed 3D "clay" tech city sits behind the hero and a pinned five-step process: scrolling glides the camera from the city overview through Discover, Design, Build, Launch and Support, with a radar pulse, a tile light-wave, tiles growing into a skyline, light beams and an orbit ring. White content sections follow (what we build, projects, technology, FAQ, contact).

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
| `index.html` | All page content: hero, process steps, content sections, FAQ |
| `src/scene.js` | The 3D diorama, camera stations and scroll-driven animation |
| `src/main.js` | Entry: smooth scrolling (Lenis) |
| `src/brand.js` | One-shot reveals, nav state, FAQ accordion |
| `src/projects.js` | **Project showcase data** — edit the `PROJECTS` array |
| `src/style.css` | All styling (light theme) |
| `public/assets/` | Logos (white + dark) and project screenshots |

To add a project: copy an entry in `src/projects.js`, then put its screenshot in `public/assets/projects/` and set `image`.

Respects `prefers-reduced-motion`. The build uses relative paths, so it can be hosted from any sub-path (e.g. GitHub Pages).

# Pulsar Room Planner

"Build a responsive, modern architectural room planner web application called 'Pulsar PRO v4.0' using React, Three.js (via @react-three/fiber or standard Three.js), Lucide React icons, and Tailwind CSS.

​1. Interface & Navigation Header:

​Top Header: Brand logo 'PULSAR PRO', View Switcher (2D Draft vs 3D View), Sub-toolbar for Import Photo (Photo Tracing), Import DXF (AutoCAD), Export DXF, and Assets Catalog toggle.

​Dark futuristic UI matching Space Grotesk typography and dark slate background #050b10.

​2. 2D CAD Canvas Engine:

​Dark grid canvas with 10\text{ cm} snapping, pan, and zoom.

​Tools: Wall (draws cyan lines with live cm dimensions), Room (creates 4-wall rectangle), Stairs (creates step vector path), Door, and Window (auto-snap to nearest wall vector angle).

​Selection mode: Tap element to highlight orange, showing a Delete button and dimension HUD.

​3. 3D Architectural Extrusion (Three.js):

​Smooth 2D-to-3D extrusion: Walls render at 280\text{ cm} height and 18\text{ cm} thickness on a floor grid.

​Camera-facing front walls auto-cutaway to 100\text{ cm} for interior viewing.

​Procedural compound 3D meshes for assets:

​Sofa: Base + Backrest + Armrests + Legs.

​Kitchen Cabinet: Base + Marble countertop.

​Stairs: Solid 3D stepped riser.

​Orbit, Pan, and Zoom controls with soft directional shadows. Floating 3D text labels displaying item titles and dimensions.

​4. Photo Tracing Workstation & DXF Module:

​Image overlay layer placed behind 2D grid with Opacity slider (0\% to 100\%) and 2-point reference calibration preview.

​DXF parser helper to read .dxf lines into 2D walls and export active layout as .dxf text.

​Material Inspector popup on asset selection to switch textures (Oak, Marble, Gray Velvet, White Gloss)."**

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/403927e8-74d4-4903-a0ad-ac8f5ae06ae3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

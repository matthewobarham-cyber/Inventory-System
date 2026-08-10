# University IT Inventory — Office Equipment GLB Expansion

Twenty original, optimized office and university IT models designed to extend
the existing University IT Inventory 3D collection. Every asset is a
self-contained GLB with embedded PBR materials, metre-based scale, Y-up
orientation, and a consistent graphite, silver, off-white and blue palette.

## Included models

| Item type | GLB file | Category |
|---|---|---|
| Professional Laptop | `models/laptop.glb` | Computers |
| Desktop Tower | `models/desktop-tower.glb` | Computers |
| All-in-One Desktop | `models/all-in-one-desktop.glb` | Computers |
| Desktop Speakers | `models/desktop-speakers.glb` | Audio |
| Desktop Laser Printer | `models/laser-printer.glb` | Printing |
| Multifunction Printer | `models/multifunction-printer.glb` | Printing |
| Digital Projector | `models/projector.glb` | Classroom AV |
| Wireless Mouse | `models/wireless-mouse.glb` | Peripherals |
| Wired Optical Mouse | `models/wired-mouse.glb` | Peripherals |
| Full-Size Keyboard | `models/keyboard.glb` | Peripherals |
| Office Monitor | `models/monitor.glb` | Displays |
| Laptop Docking Station | `models/docking-station.glb` | Peripherals |
| USB Webcam | `models/webcam.glb` | Communications |
| Flatbed Document Scanner | `models/flatbed-scanner.glb` | Imaging |
| Document Camera | `models/document-camera.glb` | Classroom AV |
| USB Office Headset | `models/usb-headset.glb` | Communications |
| Wi-Fi Router | `models/wifi-router.glb` | Networking |
| 24-Port Network Switch | `models/network-switch.glb` | Networking |
| Wireless Access Point | `models/wireless-access-point.glb` | Networking |
| Handheld Barcode Scanner | `models/barcode-scanner.glb` | Inventory tools |

## Pack structure

- `models/` — the 20 production `.glb` files
- `previews/` — labelled PNG previews
- `contact-sheet.jpg` — visual overview of the complete expansion
- `manifest.json` — names, IDs, categories, dimensions and triangle counts
- `catalog.html` — browsable local catalogue
- `examples/` — React Three Fiber viewer and TypeScript model mapping
- `INTEGRATION.md` — Claude Design and VS Code import instructions
- `source/` — reproducible procedural generator and validator

## Technical details

- Format: glTF Binary 2.0
- Coordinate system: Y up
- Units: metres
- Materials: embedded PBR values
- External textures: none
- Total triangle count: 12,272
- Intended renderer: Three.js, React Three Fiber, Babylon.js, Unity or Blender

The designs are generic equipment representations rather than replicas of a
specific manufacturer's protected industrial design.

## Usage

These assets were created for the user's University IT Inventory System and may
be used, modified and distributed with that project, including internal web
deployments and packaged desktop builds.

# University IT Inventory — 3D Equipment Pack

Nineteen original, low-poly equipment models created for the University IT
Inventory System. Every model is supplied as a self-contained GLB file with
embedded materials, metre-based scale, a consistent Y-up orientation, and a
floor-level origin suitable for cards, detail viewers, and Electron builds.

## Models

| Model | File | Category |
|---|---|---|
| USB-C Cable | `models/usb-c-cable.glb` | Cables & adapters |
| HDMI Cable | `models/hdmi-cable.glb` | Cables & adapters |
| USB-C Display Adapter | `models/display-adapter.glb` | Cables & adapters |
| XLR Cable | `models/xlr-cable.glb` | Audio |
| Blue Ethernet Cable | `models/blue-ethernet-cable.glb` | Networking |
| Laptop Charger | `models/laptop-charger.glb` | Power |
| Printer Toner Cartridge | `models/printer-toner.glb` | Printer consumables |
| Waste Toner Container | `models/waste-toner.glb` | Printer consumables |
| Printer Imaging Unit | `models/printer-imaging-unit.glb` | Printer consumables |
| Printer Transfer Belt | `models/printer-transfer-belt.glb` | Printer consumables |
| Surge Protector | `models/surge-protector.glb` | Power |
| Uninterruptible Power Supply | `models/ups.glb` | Power |
| Landline Office Phone | `models/office-phone.glb` | Communications |
| Professional Microphone | `models/professional-microphone.glb` | Audio |
| Audio Mixer | `models/audio-mixer.glb` | Audio |
| Projector White Screen | `models/projector-screen.glb` | Classroom AV |
| Microphone Stand | `models/microphone-stand.glb` | Audio |
| External Hard Drive | `models/external-hard-drive.glb` | Storage |
| Presentation Clicker | `models/presentation-clicker.glb` | Classroom AV |

## What is included

- `models/` — production GLB assets
- `previews/` — labelled PNG reference renders
- `contact-sheet.jpg` — overview of the complete collection
- `manifest.json` — IDs, paths, dimensions, categories and triangle counts
- `examples/InventoryModel.tsx` — React Three Fiber viewer component
- `examples/modelMap.ts` — asset ID to GLB path mapping
- `INTEGRATION.md` — installation and integration instructions
- `source/generate_models.py` — procedural source used to generate the pack

## Design system

The models use the same restrained palette as the inventory application:
graphite, black, cool silver, off-white and UWI-style blue accents. They are
generic equipment representations rather than replicas of a particular
manufacturer's protected product design.

## Technical notes

- Format: glTF Binary 2.0 (`.glb`)
- Coordinate system: Y up
- Scale: metres
- Textures: none required
- Materials: embedded PBR factors
- Animation: handled by the application viewer, not embedded in each model
- Recommended renderer: Three.js / React Three Fiber

## License

These original assets were created for the user's University IT Inventory
System. They may be used, modified and distributed with that project, including
internal deployments and packaged desktop builds.

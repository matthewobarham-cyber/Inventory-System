# Integration with the inventory application

## 1. Copy the models

Copy the entire `models` folder into the application:

```text
your-project/
└── public/
    └── models/
        ├── usb-c-cable.glb
        ├── hdmi-cable.glb
        └── ...
```

Files placed in `public/models` are available at `/models/<filename>.glb`.

## 2. Install the 3D packages

Run this from the VS Code terminal:

```bash
npm install three @react-three/fiber @react-three/drei
npm install --save-dev @types/three
```

## 3. Add the supplied components

Copy these two files into your application:

```text
examples/InventoryModel.tsx
examples/modelMap.ts
```

Update the relative import between them if you place them in different folders.

## 4. Render a model

```tsx
import InventoryModel from "./InventoryModel";

export default function Example() {
  return (
    <div style={{ width: 320, height: 240 }}>
      <InventoryModel modelId="audio-mixer" />
    </div>
  );
}
```

## Dashboard recommendations

- Use `quality="card"` for small dashboard previews.
- Use `quality="detail"` inside the selected-asset panel.
- Render no more than six continuously rotating canvases at once.
- Pause rotation when the card is outside the viewport.
- Respect `prefers-reduced-motion`.
- Use the preview PNGs as loading placeholders.

## Electron packaging

GLB files inside `public/models` are included with the compiled web assets.
When loading the application through a custom Electron protocol, ensure that
absolute paths beginning with `/models/` resolve to the packaged renderer
assets. Vite's default relative-base configuration can also use:

```tsx
const base = import.meta.env.BASE_URL;
const modelUrl = `${base}models/audio-mixer.glb`;
```

## Persistent model IDs

Store the IDs from `manifest.json`, not filenames, in inventory records. This
allows a model file to be replaced later without changing database entries:

```json
{
  "assetType": "Audio Mixer",
  "model3d": "audio-mixer"
}
```

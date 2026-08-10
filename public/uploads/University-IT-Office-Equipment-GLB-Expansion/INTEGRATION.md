# Importing the office GLB expansion

## Claude Design

Upload the complete ZIP to Claude and use a prompt such as:

```text
Extract this 3D office-equipment expansion. Copy every file from models/ into
public/models/ without renaming it. Read manifest.json and add each entry as an
inventory item type. Use the manifest ID as model3d and load the matching GLB
from /models/<id>.glb. Preserve the existing application design and existing
models.
```

If Claude asks for individual files, upload `manifest.json` together with the
required `.glb` files from `models/`.

## VS Code / React

Copy the pack's `models` folder into your application's `public` directory:

```text
your-project/
└── public/
    └── models/
        ├── laptop.glb
        ├── desktop-tower.glb
        ├── desktop-speakers.glb
        └── ...
```

Install a Three.js renderer:

```bash
npm install three @react-three/fiber @react-three/drei
npm install --save-dev @types/three
```

Copy `examples/InventoryModel.tsx` and `examples/modelMap.ts` into the
application, then render any model by its stable manifest ID:

```tsx
import InventoryModel from "./InventoryModel";

export default function EquipmentPreview() {
  return (
    <div style={{ width: 360, height: 280 }}>
      <InventoryModel modelId="laptop" quality="detail" />
    </div>
  );
}
```

## Inventory record format

Store the stable manifest ID instead of the filename:

```json
{
  "assetType": "Professional Laptop",
  "model3d": "laptop"
}
```

The program can resolve it with:

```ts
const modelUrl = `/models/${record.model3d}.glb`;
```

## Performance recommendations

- Use preview PNGs as loading placeholders.
- Auto-rotate only the selected model or a small number of visible cards.
- Pause rendering while a card is outside the viewport.
- Use one interactive viewer on the detail screen.
- Respect `prefers-reduced-motion`.
- Keep the PNG fallback for devices where WebGL is disabled.

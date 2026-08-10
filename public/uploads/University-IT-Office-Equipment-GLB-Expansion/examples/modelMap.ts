export const INVENTORY_MODEL_PATHS = {
  "laptop": "/models/laptop.glb",
  "desktop-tower": "/models/desktop-tower.glb",
  "all-in-one-desktop": "/models/all-in-one-desktop.glb",
  "desktop-speakers": "/models/desktop-speakers.glb",
  "laser-printer": "/models/laser-printer.glb",
  "multifunction-printer": "/models/multifunction-printer.glb",
  "projector": "/models/projector.glb",
  "wireless-mouse": "/models/wireless-mouse.glb",
  "wired-mouse": "/models/wired-mouse.glb",
  "keyboard": "/models/keyboard.glb",
  "monitor": "/models/monitor.glb",
  "docking-station": "/models/docking-station.glb",
  "webcam": "/models/webcam.glb",
  "flatbed-scanner": "/models/flatbed-scanner.glb",
  "document-camera": "/models/document-camera.glb",
  "usb-headset": "/models/usb-headset.glb",
  "wifi-router": "/models/wifi-router.glb",
  "network-switch": "/models/network-switch.glb",
  "wireless-access-point": "/models/wireless-access-point.glb",
  "barcode-scanner": "/models/barcode-scanner.glb",
} as const;

export type InventoryModelId = keyof typeof INVENTORY_MODEL_PATHS;

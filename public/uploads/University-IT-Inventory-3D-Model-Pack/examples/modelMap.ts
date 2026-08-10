export const INVENTORY_MODEL_PATHS = {
  "usb-c-cable": "/models/usb-c-cable.glb",
  "hdmi-cable": "/models/hdmi-cable.glb",
  "display-adapter": "/models/display-adapter.glb",
  "xlr-cable": "/models/xlr-cable.glb",
  "blue-ethernet-cable": "/models/blue-ethernet-cable.glb",
  "laptop-charger": "/models/laptop-charger.glb",
  "printer-toner": "/models/printer-toner.glb",
  "waste-toner": "/models/waste-toner.glb",
  "printer-imaging-unit": "/models/printer-imaging-unit.glb",
  "printer-transfer-belt": "/models/printer-transfer-belt.glb",
  "surge-protector": "/models/surge-protector.glb",
  "ups": "/models/ups.glb",
  "office-phone": "/models/office-phone.glb",
  "professional-microphone": "/models/professional-microphone.glb",
  "audio-mixer": "/models/audio-mixer.glb",
  "projector-screen": "/models/projector-screen.glb",
  "microphone-stand": "/models/microphone-stand.glb",
  "external-hard-drive": "/models/external-hard-drive.glb",
  "presentation-clicker": "/models/presentation-clicker.glb",
} as const;

export type InventoryModelId = keyof typeof INVENTORY_MODEL_PATHS;

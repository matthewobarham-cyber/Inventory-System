// Lightweight procedural equipment pack. The `shape` value is consumed by the
// model-generation script; the inventory application uses the remaining fields.
export const GENERATED_MODELS = [
  { id: 'tablet', name: 'Tablet', cat: 'Computers', cons: 0, cost: 3200, pack: 'generated', shape: 'tablet' },
  { id: 'chromebook', name: 'Chromebook', cat: 'Computers', cons: 0, cost: 4200, pack: 'generated', shape: 'laptop' },
  { id: 'mini-pc', name: 'Mini PC', cat: 'Computers', cons: 0, cost: 3900, pack: 'generated', shape: 'computer' },
  { id: 'graphics-workstation', name: 'Graphics Workstation', cat: 'Computers', cons: 0, cost: 18500, pack: 'generated', shape: 'computer' },
  { id: 'rack-server', name: 'Rack Server', cat: 'Computers', cons: 0, cost: 26000, pack: 'generated', shape: 'rackunit' },
  { id: 'thin-client', name: 'Thin Client', cat: 'Computers', cons: 0, cost: 2800, pack: 'generated', shape: 'computer' },

  { id: 'smart-television', name: 'Smart Television', cat: 'Displays', cons: 0, cost: 7200, pack: 'generated', shape: 'display' },
  { id: 'smart-board', name: 'Smart Board', cat: 'Displays', cons: 0, cost: 19500, pack: 'generated', shape: 'display' },
  { id: 'interactive-panel', name: 'Interactive Panel', cat: 'Displays', cons: 0, cost: 22000, pack: 'generated', shape: 'display' },
  { id: 'portable-monitor', name: 'Portable Monitor', cat: 'Displays', cons: 0, cost: 2400, pack: 'generated', shape: 'display' },
  { id: 'digital-signage-player', name: 'Digital Signage Player', cat: 'Displays', cons: 0, cost: 1800, pack: 'generated', shape: 'computer' },

  { id: 'firewall-appliance', name: 'Firewall Appliance', cat: 'Networking', cons: 0, cost: 9800, pack: 'generated', shape: 'rackunit' },
  { id: 'broadband-modem', name: 'Broadband Modem', cat: 'Networking', cons: 0, cost: 850, pack: 'generated', shape: 'network' },
  { id: 'patch-panel', name: 'Network Patch Panel', cat: 'Networking', cons: 0, cost: 780, pack: 'generated', shape: 'rackunit' },
  { id: 'network-rack', name: 'Network Rack', cat: 'Networking', cons: 0, cost: 6400, pack: 'generated', shape: 'rack' },
  { id: 'sfp-module', name: 'SFP Module', cat: 'Networking', cons: 1, cost: 460, pack: 'generated', shape: 'component' },
  { id: 'poe-injector', name: 'PoE Injector', cat: 'Networking', cons: 1, cost: 520, pack: 'generated', shape: 'network' },

  { id: 'ptz-camera', name: 'PTZ Camera', cat: 'Audio visual', cons: 0, cost: 6900, pack: 'generated', shape: 'camera' },
  { id: 'camcorder', name: 'Digital Camcorder', cat: 'Audio visual', cons: 0, cost: 7400, pack: 'generated', shape: 'camera' },
  { id: 'camera-tripod', name: 'Camera Tripod', cat: 'Audio visual', cons: 0, cost: 950, pack: 'generated', shape: 'tripod' },
  { id: 'video-capture-card', name: 'Video Capture Card', cat: 'Audio visual', cons: 0, cost: 1250, pack: 'generated', shape: 'component' },
  { id: 'wireless-microphone-kit', name: 'Wireless Microphone Kit', cat: 'Audio', cons: 0, cost: 3600, pack: 'generated', shape: 'microphone' },
  { id: 'pa-speaker', name: 'PA Speaker', cat: 'Audio', cons: 0, cost: 5800, pack: 'generated', shape: 'speaker' },

  { id: 'conference-bar', name: 'Conference Bar', cat: 'Conferencing', cons: 0, cost: 9800, pack: 'generated', shape: 'conference' },
  { id: 'conference-speakerphone', name: 'Conference Speakerphone', cat: 'Conferencing', cons: 0, cost: 2100, pack: 'generated', shape: 'speaker' },
  { id: 'room-scheduling-panel', name: 'Room Scheduling Panel', cat: 'Conferencing', cons: 0, cost: 2700, pack: 'generated', shape: 'display' },
  { id: 'video-encoder', name: 'Video Encoder', cat: 'Conferencing', cons: 0, cost: 4900, pack: 'generated', shape: 'network' },
  { id: 'teleprompter', name: 'Teleprompter', cat: 'Conferencing', cons: 0, cost: 5200, pack: 'generated', shape: 'teleprompter' },

  { id: 'label-printer', name: 'Barcode Label Printer', cat: 'Printing', cons: 0, cost: 2400, pack: 'generated', shape: 'printer' },
  { id: 'receipt-printer', name: 'Receipt Printer', cat: 'Printing', cons: 0, cost: 1200, pack: 'generated', shape: 'printer' },
  { id: 'large-format-plotter', name: 'Large Format Plotter', cat: 'Printing', cons: 0, cost: 28500, pack: 'generated', shape: 'printer' },
  { id: '3d-printer', name: '3D Printer', cat: 'Printing', cons: 0, cost: 8900, pack: 'generated', shape: 'printer3d' },
  { id: 'printer-fuser-unit', name: 'Printer Fuser Unit', cat: 'Printer consumables', cons: 1, cost: 1900, pack: 'generated', shape: 'component' },
  { id: 'printer-drum-unit', name: 'Printer Drum Unit', cat: 'Printer consumables', cons: 1, cost: 1600, pack: 'generated', shape: 'component' },

  { id: 'nas-device', name: 'Network Attached Storage', cat: 'Storage', cons: 0, cost: 8200, pack: 'generated', shape: 'storage' },
  { id: 'solid-state-drive', name: 'Solid-State Drive', cat: 'Storage', cons: 1, cost: 950, pack: 'generated', shape: 'component' },
  { id: 'usb-flash-drive', name: 'USB Flash Drive', cat: 'Storage', cons: 1, cost: 180, pack: 'generated', shape: 'component' },
  { id: 'sd-memory-card', name: 'SD Memory Card', cat: 'Storage', cons: 1, cost: 160, pack: 'generated', shape: 'component' },
  { id: 'tape-drive', name: 'Tape Backup Drive', cat: 'Storage', cons: 0, cost: 12800, pack: 'generated', shape: 'storage' },
  { id: 'memory-card-reader', name: 'Memory Card Reader', cat: 'Storage', cons: 1, cost: 220, pack: 'generated', shape: 'component' },

  { id: 'power-distribution-unit', name: 'Power Distribution Unit', cat: 'Power', cons: 0, cost: 1100, pack: 'generated', shape: 'rackunit' },
  { id: 'power-inverter', name: 'Power Inverter', cat: 'Power', cons: 0, cost: 3400, pack: 'generated', shape: 'power' },
  { id: 'portable-generator', name: 'Portable Generator', cat: 'Power', cons: 0, cost: 14500, pack: 'generated', shape: 'generator' },
  { id: 'ups-replacement-battery', name: 'UPS Replacement Battery', cat: 'Power', cons: 1, cost: 1300, pack: 'generated', shape: 'power' },
  { id: 'power-bank', name: 'Power Bank', cat: 'Power', cons: 1, cost: 420, pack: 'generated', shape: 'power' },
  { id: 'ac-power-adapter', name: 'AC Power Adapter', cat: 'Power', cons: 1, cost: 280, pack: 'generated', shape: 'adapter' },

  { id: 'displayport-cable', name: 'DisplayPort Cable', cat: 'Cables & adapters', cons: 1, cost: 120, pack: 'generated', shape: 'cable' },
  { id: 'vga-cable', name: 'VGA Cable', cat: 'Cables & adapters', cons: 1, cost: 95, pack: 'generated', shape: 'cable' },
  { id: 'fiber-optic-patch-cable', name: 'Fiber Optic Patch Cable', cat: 'Cables & adapters', cons: 1, cost: 180, pack: 'generated', shape: 'cable' },
  { id: 'usb-hub', name: 'USB Hub', cat: 'Cables & adapters', cons: 1, cost: 260, pack: 'generated', shape: 'adapter' },
  { id: 'kvm-switch', name: 'KVM Switch', cat: 'Cables & adapters', cons: 0, cost: 1200, pack: 'generated', shape: 'network' },
  { id: 'usb-ethernet-adapter', name: 'USB Ethernet Adapter', cat: 'Cables & adapters', cons: 1, cost: 210, pack: 'generated', shape: 'adapter' },

  { id: 'cctv-camera', name: 'CCTV Camera', cat: 'Security', cons: 0, cost: 1900, pack: 'generated', shape: 'camera' },
  { id: 'network-video-recorder', name: 'Network Video Recorder', cat: 'Security', cons: 0, cost: 4400, pack: 'generated', shape: 'rackunit' },
  { id: 'biometric-reader', name: 'Biometric Reader', cat: 'Security', cons: 0, cost: 2600, pack: 'generated', shape: 'security' },
  { id: 'access-control-panel', name: 'Access Control Panel', cat: 'Security', cons: 0, cost: 3700, pack: 'generated', shape: 'security' },
  { id: 'hardware-security-key', name: 'Hardware Security Key', cat: 'Security', cons: 1, cost: 380, pack: 'generated', shape: 'component' },

  { id: 'memory-module', name: 'Memory Module', cat: 'Repair stock', cons: 1, cost: 480, pack: 'generated', shape: 'component' },
  { id: 'replacement-laptop-keyboard', name: 'Replacement Laptop Keyboard', cat: 'Repair stock', cons: 1, cost: 650, pack: 'generated', shape: 'keyboard' },
  { id: 'laptop-battery', name: 'Laptop Battery', cat: 'Repair stock', cons: 1, cost: 980, pack: 'generated', shape: 'power' },
  { id: 'cooling-fan', name: 'Computer Cooling Fan', cat: 'Repair stock', cons: 1, cost: 240, pack: 'generated', shape: 'fan' },
  { id: 'motherboard', name: 'Computer Motherboard', cat: 'Repair stock', cons: 1, cost: 2200, pack: 'generated', shape: 'board' },
  { id: 'desktop-processor', name: 'Desktop Processor', cat: 'Repair stock', cons: 1, cost: 1700, pack: 'generated', shape: 'component' },

  { id: 'network-cable-tester', name: 'Network Cable Tester', cat: 'IT tools', cons: 0, cost: 620, pack: 'generated', shape: 'tool' },
  { id: 'ethernet-crimping-tool', name: 'Ethernet Crimping Tool', cat: 'IT tools', cons: 0, cost: 340, pack: 'generated', shape: 'tool' },
  { id: 'technician-toolkit', name: 'Technician Toolkit', cat: 'IT tools', cons: 0, cost: 1350, pack: 'generated', shape: 'toolkit' },
  { id: 'drive-docking-station', name: 'Drive Docking Station', cat: 'IT tools', cons: 0, cost: 780, pack: 'generated', shape: 'storage' },
  { id: 'digital-multimeter', name: 'Digital Multimeter', cat: 'IT tools', cons: 0, cost: 520, pack: 'generated', shape: 'tool' },
  { id: 'label-applicator', name: 'Label Applicator', cat: 'IT tools', cons: 0, cost: 430, pack: 'generated', shape: 'tool' },

  { id: 'laminator', name: 'Office Laminator', cat: 'Office technology', cons: 0, cost: 850, pack: 'generated', shape: 'office' },
  { id: 'paper-shredder', name: 'Paper Shredder', cat: 'Office technology', cons: 0, cost: 1200, pack: 'generated', shape: 'office' },
  { id: 'binding-machine', name: 'Binding Machine', cat: 'Office technology', cons: 0, cost: 980, pack: 'generated', shape: 'office' },
  { id: 'monitor-arm', name: 'Monitor Arm', cat: 'Office technology', cons: 0, cost: 540, pack: 'generated', shape: 'stand' },
  { id: 'laptop-stand', name: 'Laptop Stand', cat: 'Office technology', cons: 0, cost: 320, pack: 'generated', shape: 'stand' },

  { id: 'barcode-label-roll', name: 'Barcode Label Roll', cat: 'Inventory consumables', cons: 1, cost: 140, pack: 'generated', shape: 'roll' },
  { id: 'aa-battery-pack', name: 'AA Battery Pack', cat: 'Inventory consumables', cons: 1, cost: 90, pack: 'generated', shape: 'consumable' },
  { id: 'electronics-cleaning-kit', name: 'Electronics Cleaning Kit', cat: 'Inventory consumables', cons: 1, cost: 180, pack: 'generated', shape: 'consumable' },
  { id: 'thermal-paper-roll', name: 'Thermal Paper Roll', cat: 'Inventory consumables', cons: 1, cost: 65, pack: 'generated', shape: 'roll' },
  { id: 'printer-paper-ream', name: 'Printer Paper Ream', cat: 'Inventory consumables', cons: 1, cost: 75, pack: 'generated', shape: 'consumable' },

  { id: 'headphones', name: 'Over-Ear Headphones', cat: 'Audio', cons: 0, cost: 620, pack: 'generated', shape: 'headphones' }
  ,{ id: 'laptop-bag', name: 'Laptop Bag', cat: 'Accessories', cons: 0, cost: 220, pack: 'generated', shape: 'laptopbag' }
  ,{ id: 'security-cable-lock', name: 'Equipment Security Cable Lock', cat: 'Security', cons: 0, cost: 280, pack: 'generated', shape: 'cablelock' }
  ,{ id: 'air-conditioner', name: 'Air-Conditioning Unit', cat: 'Facilities equipment', cons: 0, cost: 8500, pack: 'generated', shape: 'airconditioner' }
  ,{ id: 'standing-fan', name: 'Standing or Ceiling Fan', cat: 'Facilities equipment', cons: 0, cost: 850, pack: 'generated', shape: 'standingfan' }
  ,{ id: 'refrigerator', name: 'Refrigerator', cat: 'Office appliances', cons: 0, cost: 4200, pack: 'generated', shape: 'refrigerator' }
  ,{ id: 'microwave-oven', name: 'Microwave Oven', cat: 'Office appliances', cons: 0, cost: 1400, pack: 'generated', shape: 'microwave' }
  ,{ id: 'water-dispenser', name: 'Water Dispenser', cat: 'Office appliances', cons: 0, cost: 1800, pack: 'generated', shape: 'waterdispenser' }
  ,{ id: 'office-appliance', name: 'Office Appliance', cat: 'Office appliances', cons: 0, cost: 900, pack: 'generated', shape: 'appliance' }
  ,{ id: 'office-furniture', name: 'Office Furniture or Cabinet', cat: 'Furniture', cons: 0, cost: 2200, pack: 'generated', shape: 'furniture' }
  ,{ id: 'drone', name: 'Camera Drone', cat: 'Audio visual', cons: 0, cost: 6500, pack: 'generated', shape: 'drone' }
  ,{ id: 'printer-staple-kit', name: 'Printer Staple Kit', cat: 'Printer consumables', cons: 1, cost: 300, pack: 'generated', shape: 'staplekit' }
  ,{ id: 'other-equipment', name: 'Other Equipment', cat: 'Uncategorized equipment', cons: 0, cost: 0, pack: 'generated', shape: 'otherequipment' }
];

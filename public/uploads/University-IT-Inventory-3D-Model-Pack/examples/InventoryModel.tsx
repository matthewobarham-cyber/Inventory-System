"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import {
  Bounds,
  ContactShadows,
  Environment,
  Html,
  OrbitControls,
  useGLTF,
} from "@react-three/drei";
import { Suspense, useRef } from "react";
import type { Group } from "three";
import {
  INVENTORY_MODEL_PATHS,
  type InventoryModelId,
} from "./modelMap";

function Asset({
  modelId,
  rotate,
}: {
  modelId: InventoryModelId;
  rotate: boolean;
}) {
  const group = useRef<Group>(null);
  const { scene } = useGLTF(INVENTORY_MODEL_PATHS[modelId]);

  useFrame((_, delta) => {
    if (rotate && group.current) group.current.rotation.y += delta * 0.32;
  });

  return (
    <group ref={group}>
      <primitive object={scene.clone()} />
    </group>
  );
}

export default function InventoryModel({
  modelId,
  quality = "card",
  interactive = quality === "detail",
  autoRotate = true,
  className,
}: {
  modelId: InventoryModelId;
  quality?: "card" | "detail";
  interactive?: boolean;
  autoRotate?: boolean;
  className?: string;
}) {
  const detail = quality === "detail";

  return (
    <div className={className} style={{ width: "100%", height: "100%" }}>
      <Canvas
        dpr={detail ? [1, 1.75] : [1, 1.35]}
        camera={{ position: [0.8, 0.55, 0.8], fov: 34 }}
        gl={{ antialias: detail, alpha: true }}
      >
        <ambientLight intensity={1.25} />
        <directionalLight position={[3, 5, 4]} intensity={2.2} />
        <directionalLight position={[-4, 2, -2]} intensity={0.55} color="#8db6dc" />

        <Suspense fallback={<Html center>Loading model…</Html>}>
          <Bounds fit clip observe margin={1.25}>
            <Asset modelId={modelId} rotate={autoRotate} />
          </Bounds>
          {detail && <Environment preset="studio" />}
        </Suspense>

        <ContactShadows
          position={[0, -0.01, 0]}
          opacity={0.3}
          scale={2.2}
          blur={2.4}
          far={1.5}
        />
        {interactive && (
          <OrbitControls
            makeDefault
            enablePan={false}
            minDistance={0.25}
            maxDistance={3}
          />
        )}
      </Canvas>
    </div>
  );
}

Object.values(INVENTORY_MODEL_PATHS).forEach((path) => useGLTF.preload(path));

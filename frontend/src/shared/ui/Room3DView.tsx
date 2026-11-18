import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildRoom, paletteFor, type BuiltRoom, type RoomItem } from "@/shared/lib/room3d";
import { productImageUrl } from "@/shared/lib/catalog";
import type { Opening, StyleOverrides } from "@/shared/types";

function hasWebGL(): boolean {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/**
 * Orbitable 3D model of the room with the chosen products in the theme's
 * materials. Walls between the camera and the room hide themselves, like a
 * dollhouse. Click a piece to see the product it stands for.
 */
export default function Room3DView({
  lengthCm,
  widthCm,
  openings,
  items,
  theme,
  flaggedIds = [],
  overrides,
}: {
  lengthCm: number;
  widthCm: number;
  openings: Opening[];
  items: RoomItem[];
  theme: string;
  /** Pieces involved in a rule violation; outlined in red. */
  flaggedIds?: string[];
  /** The user's colour choices on top of the theme. */
  overrides?: StyleOverrides;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    renderer: THREE.WebGLRenderer;
    hemi: THREE.HemisphereLight;
    ambient: THREE.AmbientLight;
    sun: THREE.DirectionalLight;
    room?: BuiltRoom;
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [webglFailed] = useState(() => !hasWebGL());

  // Renderer, camera, lights and the render loop: created once.
  useEffect(() => {
    if (webglFailed) return;
    const mount = mountRef.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.08; // stay above the floor
    controls.minDistance = 1.5;
    controls.maxDistance = 18;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6;
    controls.addEventListener("start", () => (controls.autoRotate = false));

    // Colours and strengths are set per theme when the room is built.
    const hemi = new THREE.HemisphereLight();
    const ambient = new THREE.AmbientLight();
    scene.add(hemi, ambient);
    const sun = new THREE.DirectionalLight();
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);
    sceneRef.current = { scene, camera, controls, renderer, hemi, ambient, sun };

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = mount;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    // Click (not drag) picks a piece of furniture.
    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    let down: [number, number] | null = null;
    const onDown = (e: PointerEvent) => (down = [e.clientX, e.clientY]);
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const furniture = sceneRef.current?.room?.furniture ?? [];
      const hit = raycaster.intersectObjects(furniture, true)[0];
      let o: THREE.Object3D | null = hit?.object ?? null;
      while (o && o.userData.itemId === undefined) o = o.parent;
      setSelectedId(o ? (o.userData.itemId as string) : null);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    const centre = new THREE.Vector3();
    const toCamera = new THREE.Vector3();
    renderer.setAnimationLoop(() => {
      controls.update();
      const room = sceneRef.current?.room;
      if (room) {
        for (const s of room.spinners) s.rotation.y += 0.035;
        // Hide walls the camera is behind, so the room stays visible.
        centre.copy(controls.target);
        toCamera.subVectors(camera.position, centre).setY(0).normalize();
        for (const w of room.walls) w.group.visible = w.outward.dot(toCamera) < 0.35;
      }
      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      sceneRef.current?.room?.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, [webglFailed]);

  // Room contents: rebuilt whenever the layout, products or theme change.
  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;
    const first = !ctx.room;
    if (ctx.room) {
      ctx.scene.remove(ctx.room.group);
      ctx.room.dispose();
    }
    ctx.room = buildRoom(lengthCm, widthCm, openings, items, theme, overrides);
    ctx.scene.add(ctx.room.group);

    const cx = lengthCm / 200;
    const cz = widthCm / 200;
    // The theme's lighting mood: warm, cool or moody.
    const { light } = ctx.room;
    const { sun } = ctx;
    ctx.hemi.color.set(light.sky);
    ctx.hemi.groundColor.set(light.ground);
    ctx.hemi.intensity = light.hemi;
    ctx.ambient.intensity = light.ambient;
    sun.color.set(light.sunColor);
    sun.intensity = light.sun;
    ctx.renderer.toneMappingExposure = light.exposure;
    const reach = Math.max(lengthCm, widthCm) / 100;
    sun.position.set(cx - reach * 0.6, 6, cz - reach * 0.9);
    sun.target.position.set(cx, 0, cz);
    Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 0.5, far: 20 });
    sun.shadow.camera.updateProjectionMatrix();

    if (first) {
      // Start high above the south-east corner, looking down into the room.
      ctx.controls.target.set(cx, 0.4, cz);
      ctx.camera.position.set(cx + reach * 0.7, reach * 1.45, cz + reach * 1.15);
    }
  }, [lengthCm, widthCm, openings, items, theme, overrides]);

  // Outline the selected piece (brass) and any piece breaking a rule (red).
  useEffect(() => {
    const room = sceneRef.current?.room;
    if (!room) return;
    const helpers: THREE.BoxHelper[] = [];
    for (const f of room.furniture) {
      const id = f.userData.itemId as string;
      const colour = id === selectedId ? "#c8a45d" : flaggedIds.includes(id) ? "#e2725b" : null;
      if (colour) {
        const helper = new THREE.BoxHelper(f, colour);
        room.group.add(helper);
        helpers.push(helper);
      }
    }
    return () =>
      helpers.forEach((h) => {
        h.removeFromParent();
        h.geometry.dispose();
        (h.material as THREE.Material).dispose();
      });
  }, [selectedId, items, theme, flaggedIds, overrides]);

  const selected = items.find((i) => i.placement.item_id === selectedId);
  const palette = paletteFor(theme);

  return (
    <div
      className="relative h-[460px] rounded-xl overflow-hidden border border-white/10"
      style={{ background: `radial-gradient(ellipse at 50% 30%, ${palette.wall}22, transparent 70%), #0d1218` }}
    >
      <div ref={mountRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" />
      {webglFailed && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-ink-muted">
          3D view needs WebGL, which this browser has turned off.
        </div>
      )}
      <p className="pointer-events-none absolute left-3 bottom-3 text-[11px] text-ink-muted bg-ink-950/60 rounded-full px-3 py-1">
        Drag to orbit · scroll to zoom · click a piece
      </p>
      {selected && (
        <div className="absolute right-3 top-3 w-56 panel p-3 animate-fade-in">
          <button
            className="absolute right-2 top-1 text-ink-muted hover:text-paper"
            aria-label="Close"
            onClick={() => setSelectedId(null)}
          >
            ×
          </button>
          {selected.product ? (
            <>
              <img
                src={productImageUrl(selected.product)}
                alt={selected.product.name}
                className="h-28 w-full object-cover rounded-md mb-2"
              />
              <p className="text-sm font-medium leading-tight">{selected.product.name}</p>
              <p className="text-xs text-ink-muted mt-0.5">
                {selected.product.width_cm}×{selected.product.depth_cm}cm · for your {selected.placement.label}
              </p>
              <p className="font-mono text-sm text-brass-700 mt-1">{rupees(selected.product.price)}</p>
            </>
          ) : (
            <p className="text-sm">
              {selected.placement.label}
              <span className="block text-xs text-ink-muted">No catalog product chosen for this piece.</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

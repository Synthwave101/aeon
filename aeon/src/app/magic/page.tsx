"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export default function Magic() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 2.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    // @ts-expect-error: property exists at runtime in three
    renderer.physicallyCorrectLights = true;
    container.appendChild(renderer.domElement);

    // Environment lighting for realistic reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(renderer), 0.04);
    const envMap = envRT.texture;
    scene.environment = envMap;
    scene.background = new THREE.Color(0x000000);

    // Optional direct lights to add definition
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(3, 5, 4);
    scene.add(directionalLight);

    const loader = new GLTFLoader();
    let heart: THREE.Object3D | null = null;
    let baseY = 0;

    loader.load(
      "/models/heart.glb",
      (gltf) => {
        heart = gltf.scene;

        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 1.0 / maxDim;
        gltf.scene.scale.setScalar(scale);
        gltf.scene.position.sub(center.multiplyScalar(scale));

        // Boost reflections on PBR materials
        gltf.scene.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          const material = (mesh as any).material as THREE.Material | THREE.Material[] | undefined;
          if (!material) return;
          const setIntensity = (m: any) => {
            if ("envMapIntensity" in m) {
              m.envMapIntensity = 1.3;
              m.needsUpdate = true;
            }
            if ("metalness" in m && typeof m.metalness === "number") {
              m.metalness = Math.min(1, Math.max(0.2, m.metalness));
            }
            if ("roughness" in m && typeof m.roughness === "number") {
              m.roughness = Math.max(0.05, m.roughness);
            }
          };
          if (Array.isArray(material)) material.forEach(setIntensity);
          else setIntensity(material);
        });

        baseY = gltf.scene.position.y;
        scene.add(gltf.scene);
      },
      undefined,
      (err) => {
        // eslint-disable-next-line no-console
        console.error("Failed to load GLB model", err);
      }
    );

    let rafId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      if (heart) {
        heart.rotation.y += 0.01;
        heart.position.y = baseY + Math.sin(t * 1.5) * 0.05;
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const { clientWidth, clientHeight } = container;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
      pmremGenerator.dispose();
      // Dispose environment texture
      (envMap as any)?.dispose?.();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black"
      aria-label="Magic spinning heart"
    />
  );
}



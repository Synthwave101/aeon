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
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
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

    loader.load(
      "/models/AEON_Isologo.glb",
      (gltf) => {
        heart = gltf.scene;

        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = .8 / maxDim;
        gltf.scene.scale.setScalar(scale);
        gltf.scene.position.sub(center.multiplyScalar(scale));

        // Boost reflections on PBR materials without using any
        gltf.scene.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            const materialOrArray = mesh.material;
            const apply = (m: THREE.Material) => {
              if (
                m instanceof THREE.MeshStandardMaterial ||
                m instanceof THREE.MeshPhysicalMaterial
              ) {
                m.envMapIntensity = 1.3;
                m.metalness = Math.min(1, Math.max(0.2, m.metalness));
                m.roughness = Math.max(0.05, m.roughness);
                m.needsUpdate = true;
              }
            };
            if (Array.isArray(materialOrArray)) materialOrArray.forEach(apply);
            else if (materialOrArray) apply(materialOrArray);
          }
        });

        scene.add(gltf.scene);
      },
      undefined,
      (err) => {
        console.error("Failed to load GLB model", err);
      }
    );

    let rafId = 0;

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      if (heart) {
        heart.rotation.y += 0.01;
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
      // Dispose PMREM render target and clear environment
      envRT.dispose();
      scene.environment = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black"
      aria-label="AEON Isologo"
    />
  );
}



"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export default function Login() {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [expectedUser, setExpectedUser] = useState<string | null>(null);
  const [expectedPass, setExpectedPass] = useState<string | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const modelRadiusRef = useRef<number | null>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const [bgReady, setBgReady] = useState(false);
  const [logoReady, setLogoReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 2.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
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
    scene.background = null;

    // Optional direct lights to add definition
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(3, 5, 4);
    scene.add(directionalLight);

    // (Particles moved to full-screen background renderer)

    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
    // Uncomment to force JS decoder instead of WASM (fallback):
    // dracoLoader.setDecoderConfig({ type: "js" });
    loader.setDRACOLoader(dracoLoader);
    let isologo: THREE.Object3D | null = null;

    loader.load(
      "/models/AEONIsologo.glb",
      (gltf) => {
        isologo = gltf.scene;

        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = (.8 * 3) / maxDim; // 3x larger
        gltf.scene.scale.setScalar(scale);
        gltf.scene.position.sub(center.multiplyScalar(scale));

        // Fit camera so model is large but not clipped
        const sphere = new THREE.Sphere();
        new THREE.Box3().setFromObject(gltf.scene).getBoundingSphere(sphere);
        modelRadiusRef.current = sphere.radius;

        const { clientWidth, clientHeight } = container;
        camera.aspect = clientWidth / Math.max(1, clientHeight);
        const vFov = THREE.MathUtils.degToRad(camera.fov);
        const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
        const distanceV = sphere.radius / Math.tan(vFov / 2);
        const distanceH = sphere.radius / Math.tan(hFov / 2);
        const distance = Math.max(distanceV, distanceH) * 1.1;
        camera.near = Math.max(0.01, distance / 100);
        camera.far = distance * 100;
        camera.position.set(0, 0, distance);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();

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
                m.envMapIntensity = 0.7;
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
        setLogoReady(true);
      },
      undefined,
      (err) => {
        console.error("Failed to load GLB model", err);
      }
    );

    // Rotation control with inertia
    let rafId = 0;
    const baseSpeed = 0.01; // natural speed
    let speed = baseSpeed;
    let isDragging = false;
    let lastX = 0;
    let lastTime = 0;
    let momentum = 0;

    const onPointerDown = (x: number) => {
      isDragging = true;
      lastX = x;
      lastTime = performance.now();
      momentum = 0;
    };
    const onPointerMove = (x: number) => {
      if (!isDragging) return;
      const now = performance.now();
      const dx = x - lastX;
      const dt = Math.max(1, now - lastTime);
      // rotation change proportional to drag distance
      const dragSpeed = (dx / dt) * 0.5; // tune factor
      momentum = dragSpeed;
      lastX = x;
      lastTime = now;
    };
    const onPointerUp = () => {
      isDragging = false;
      // keep current momentum as temporary speed boost
      speed = baseSpeed + momentum;
    };

    const onMouseDown = (e: MouseEvent) => onPointerDown(e.clientX);
    const onMouseMove = (e: MouseEvent) => onPointerMove(e.clientX);
    const onMouseUp = () => onPointerUp();
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) onPointerDown(e.touches[0].clientX);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) onPointerMove(e.touches[0].clientX);
    };
    const onTouchEnd = () => onPointerUp();

    container.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    container.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      // ease momentum towards 0
      momentum *= 0.92;
      // ease speed back to baseSpeed
      speed += (baseSpeed - speed) * 0.02;
      if (isologo) {
        isologo.rotation.y += speed + momentum;
      }
      renderer.render(scene, camera);
    };
    animate();

    const updateSize = () => {
      if (!container) return;
      const { clientWidth, clientHeight } = container;

      camera.aspect = Math.max(0.6, clientWidth / Math.max(1, clientHeight));

      // Recompute camera distance to keep model fully visible
      if (modelRadiusRef.current) {
        const vFov = THREE.MathUtils.degToRad(camera.fov);
        const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
        const r = modelRadiusRef.current;
        const distanceV = r / Math.tan(vFov / 2);
        const distanceH = r / Math.tan(hFov / 2);
        const distance = Math.max(distanceV, distanceH) * 1.1;
        camera.near = Math.max(0.01, distance / 100);
        camera.far = distance * 100;
        camera.position.set(0, 0, distance);
        camera.lookAt(0, 0, 0);
      }

      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(clientWidth, clientHeight, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
    };

    // Handle window resize, orientation changes, and element resize
    const handleOrientation = () => {
      // Defer a bit to allow browser to recalc layout after rotation
      setTimeout(updateSize, 300);
    };
    window.addEventListener("resize", updateSize);
    window.addEventListener("orientationchange", handleOrientation);
    const resizeObserver = new ResizeObserver(() => updateSize());
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(rafId);
      container.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      container.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("resize", updateSize);
      window.removeEventListener("orientationchange", handleOrientation);
      resizeObserver.disconnect();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      dracoLoader.dispose();
      // particles are owned by background renderer
      pmremGenerator.dispose();
      // Dispose PMREM render target and clear environment
      envRT.dispose();
      scene.environment = null;
    };
  }, []);

  // Detect iOS to adjust layout offsets
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      const ua = navigator.userAgent || navigator.vendor;
      setIsIOS(/iPad|iPhone|iPod/.test(ua));
      // Detect PWA installed mode
      const mq = window.matchMedia('(display-mode: standalone)');
      const nav = window.navigator as Navigator & { standalone?: boolean };
      setIsStandalone(nav.standalone === true || mq.matches);
      try { mq.addEventListener('change', (e) => setIsStandalone(e.matches)); } catch { /* Safari older */ }
    }
  }, []);

  // Load credentials from a simple text file in /public
  useEffect(() => {
    let isMounted = true;
    const loadCreds = async () => {
      try {
        const res = await fetch("/credentials.txt", { cache: "no-store" });
        if (!res.ok) return;
        const txt = await res.text();
        // Expect lines like: user: admin\npass: 1234
        const userMatch = txt.match(/user\s*:\s*(.+)/i);
        const passMatch = txt.match(/pass\s*:\s*(.+)/i);
        if (isMounted) {
          setExpectedUser(userMatch ? userMatch[1].trim() : null);
          setExpectedPass(passMatch ? passMatch[1].trim() : null);
        }
      } catch {
        // ignore
      }
    };
    loadCreds();
    return () => {
      isMounted = false;
    };
  }, []);

  const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSubmit = useCallback(async () => {
    setError(null);
    setIsChecking(true);
    try {
      if (!expectedUser || !expectedPass) {
        setError("No se pudieron cargar las credenciales.");
        return;
      }
      const ok = username.trim() === expectedUser && password === expectedPass;
      if (!ok) {
        setError("Usuario o contraseña incorrectos.");
        return;
      }
      router.push("/dashboard");
    } finally {
      setIsChecking(false);
    }
  }, [expectedPass, expectedUser, password, router, username]);

  const handleNext = useCallback(() => {
    setEmailError(null);
    setError(null);
    if (!expectedUser) {
      setEmailError("No se pudieron cargar las credenciales.");
      return;
    }
    const requiresEmail = expectedUser.includes("@");
    if (requiresEmail && !isEmail(username)) {
      setEmailError("Introduce un email válido.");
      return;
    }
    if (username.trim() !== expectedUser) {
      setEmailError("Email incorrecto.");
      return;
    }
    setShowPassword(true);
  }, [expectedUser, username]);

  const disableNext = username.trim().length === 0;
  const disableSubmit = isChecking || password.length === 0;

  return (
    <main className="relative h-[100svh] bg-black text-white overflow-hidden overscroll-none">
      {/* Fullscreen background particles canvas */}
      <BackgroundParticles ref={bgRef} onReady={() => setBgReady(true)} visible={bgReady} />
      <div
        ref={containerRef}
        className={
          `absolute left-1/2 -translate-x-1/2 top-0 ${isIOS ? (isStandalone ? "translate-y-[9vh]" : "translate-y-[7vh]") : "translate-y-[12vh]"} w-[90vw] sm:w-[76vw] md:w-[52vw] lg:w-[40vw] h-[46vh] sm:h-[50vh] md:h-[54vh] lg:h-[56vh] pointer-events-auto z-10 transition-all duration-700 ease-out ${logoReady && bgReady ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'}`
        }
        aria-label="Iniciar sesión - AEON Isologo"
      />

      <div className={
        `absolute z-10 left-1/2 -translate-x-1/2 ${
          isIOS ? (isStandalone ? "bottom-[17vh] sm:bottom-[19vh] w-[82vw] sm:w-[68vw]" : "bottom-[26vh] sm:bottom-[28vh] w-[82vw] sm:w-[68vw]") : "bottom-[12vh] sm:bottom-[14vh] w-[86vw] sm:w-[72vw]"
        } md:w-[28rem] px-0 transition-all duration-700 ease-out ${logoReady && bgReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} delay-150`
      }>
          <div className="w-full space-y-4">
            <div>
              <input
                type="email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ingresa tu usuario (email)"
                className={
                  "w-full rounded-xl bg-transparent text-white placeholder:text-zinc-500 px-4 py-3 outline-none border transition " +
                  (emailError ? "border-red-500/70 focus:ring-red-500/30" : "border-zinc-500/60 focus:border-zinc-300/70 focus:ring-2 focus:ring-zinc-400/40")
                }
                autoComplete="email"
                inputMode="email"
              />
              {emailError && (
                <p className="mt-1 text-xs text-red-400">{emailError}</p>
              )}
            </div>

            {showPassword && (
              <div className="fade-in-down">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                className="w-full rounded-xl bg-transparent text-white placeholder:text-zinc-500 px-4 py-3 outline-none border border-zinc-500/60 shadow-[0_0_0_1px_rgba(255,255,255,0.05)_inset,0_1px_2px_rgba(255,255,255,0.05)] focus:border-zinc-300/70 focus:ring-2 focus:ring-zinc-400/40 transition"
                  autoComplete="current-password"
                />
              </div>
            )}

            {!showPassword ? (
              <button
                onClick={handleNext}
                disabled={disableNext}
                className="w-full rounded-xl border border-zinc-400/70 text-white px-4 py-3 bg-gradient-to-b from-zinc-800/30 to-zinc-900/30 hover:from-zinc-700/30 hover:to-zinc-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.5)]"
              >
                Siguiente
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={disableSubmit}
                className="w-full rounded-xl border border-zinc-400/70 text-white px-4 py-3 bg-gradient-to-b from-zinc-800/30 to-zinc-900/30 hover:from-zinc-700/30 hover:to-zinc-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.5)]"
              >
                {isChecking ? "Verificando..." : "Entrar"}
              </button>
            )}

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}
          </div>
        </div>
    </main>
  );
}

// Fullscreen background particles component
type BgProps = { onReady?: () => void; visible?: boolean };
const BackgroundParticles = React.forwardRef<HTMLDivElement, BgProps>(function BackgroundParticles({ onReady, visible }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 22);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const isMobile = window.innerWidth < 768;
    // Layered approach for depth and definition
    const counts = {
      fine: isMobile ? 2400 : 4200,
      mid: isMobile ? 900 : 1500,
      spark: isMobile ? 200 : 320,
    };

    // Glitter-like sharp particle texture (less blur)
    const texCanvas = document.createElement("canvas");
    texCanvas.width = 64; texCanvas.height = 64;
    const tctx = texCanvas.getContext("2d")!;
    const r = 18; // smaller core for crisp edge
    const g = tctx.createRadialGradient(32, 32, 0, 32, 32, r);
    g.addColorStop(0.0, "rgba(255,255,255,1.0)");
    g.addColorStop(0.06, "rgba(255,255,255,0.98)");
    g.addColorStop(0.12, "rgba(255,255,255,0.20)");
    g.addColorStop(1.0, "rgba(255,255,255,0.0)");
    tctx.fillStyle = g; tctx.beginPath(); tctx.arc(32, 32, r, 0, Math.PI*2); tctx.fill();
    const sharpTexture = new THREE.CanvasTexture(texCanvas);
    sharpTexture.colorSpace = THREE.SRGBColorSpace;
    sharpTexture.magFilter = THREE.NearestFilter;
    sharpTexture.minFilter = THREE.NearestFilter;

    const platinum = new THREE.Color(0xE5E4E2);

    const makeCloud = (count: number, size: number, opacity: number, spreadZ: number, armCount: number, alphaTest = 0.4) => {
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const t = i / count;
        const angle = t * Math.PI * 8 + (Math.floor(t * armCount) / armCount) * 1.1;
        const radius = 4 + 30 * Math.pow(t, 0.92) + (Math.random() - 0.5) * 1.8;
        pos[i3 + 0] = Math.cos(angle) * radius + (Math.random() - 0.5) * 0.8;
        pos[i3 + 1] = (Math.sin(angle) * radius * 0.5) + (Math.random() - 0.5) * 0.8;
        pos[i3 + 2] = (Math.random() - 0.5) * spreadZ;
        const c = platinum.clone().multiplyScalar(0.85 + Math.random() * 0.25);
        col[i3 + 0] = c.r; col[i3 + 1] = c.g; col[i3 + 2] = c.b;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      const mat = new THREE.PointsMaterial({
        size,
        map: sharpTexture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        opacity,
        sizeAttenuation: true,
      });
      mat.alphaTest = alphaTest;
      const pts = new THREE.Points(geo, mat);
      return { geo, mat, pts, baseSize: size };
    };

    const fine = makeCloud(counts.fine, isMobile ? 0.6 : 0.7, 0.30, 12, 10, 0.5);
    const mid = makeCloud(counts.mid, isMobile ? 0.9 : 1.1, 0.48, 14, 8, 0.45);
    const sparkA = makeCloud(counts.spark, isMobile ? 1.2 : 1.5, 0.62, 16, 7, 0.4);
    const sparkB = makeCloud(counts.spark, isMobile ? 1.2 : 1.5, 0.62, 16, 9, 0.4);

    fine.pts.rotation.x = -0.28;
    mid.pts.rotation.x = -0.26;
    sparkA.pts.rotation.x = -0.24;
    sparkB.pts.rotation.x = -0.24;
    scene.add(fine.pts, mid.pts, sparkA.pts, sparkB.pts);

    let raf = 0; let t = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      t += 0.016;
      fine.pts.rotation.z += 0.0008;
      mid.pts.rotation.z += 0.0011;
      sparkA.pts.rotation.z += 0.0016;
      sparkB.pts.rotation.z -= 0.0014;
      // sparkle pulsation (layer-wise) and slight size twinkles
      const twA = 0.5 + 0.5 * Math.sin(t * 2.2);
      const twB = 0.5 + 0.5 * Math.cos(t * 1.8);
      sparkA.mat.opacity = 0.45 + 0.35 * twA;
      sparkB.mat.opacity = 0.45 + 0.35 * twB;
      sparkA.mat.size = sparkA.baseSize * (1.0 + 0.35 * twA);
      sparkB.mat.size = sparkB.baseSize * (1.0 + 0.35 * twB);
      renderer.render(scene, camera);
    };
    animate();
    // signal ready after first frame
    requestAnimationFrame(() => {
      onReady?.();
    });

    const onResize = () => {
      if (!host) return;
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      host.removeChild(renderer.domElement);
      fine.geo.dispose(); mid.geo.dispose(); sparkA.geo.dispose(); sparkB.geo.dispose();
      fine.mat.dispose(); mid.mat.dispose(); sparkA.mat.dispose(); sparkB.mat.dispose();
      sharpTexture.dispose();
    };
  }, []);

  return <div ref={(node) => { hostRef.current = node!; if (typeof ref === 'function') ref(node!); else if (ref && 'current' in (ref as unknown as { current?: HTMLDivElement | null })) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node; }} className={`pointer-events-none absolute inset-0 z-0 transition-opacity duration-700 ease-out ${visible ? 'opacity-100' : 'opacity-0'}`} />;
});



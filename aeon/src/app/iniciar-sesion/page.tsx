"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const modelRadiusRef = useRef<number | null>(null);

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

    // Rotation control with inertia
    let rafId = 0;
    let baseSpeed = 0.01; // natural speed
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
      <div
        ref={containerRef}
        className="absolute left-1/2 -translate-x-1/2 top-0 translate-y-[12vh] w-[90vw] sm:w-[76vw] md:w-[52vw] lg:w-[40vw] h-[46vh] sm:h-[50vh] md:h-[54vh] lg:h-[56vh] pointer-events-auto z-0"
        aria-label="Iniciar sesión - AEON Isologo"
      />

      <div className={
        `absolute z-10 left-1/2 -translate-x-1/2 ${
          isIOS ? "bottom-[20vh] sm:bottom-[22vh] w-[82vw] sm:w-[68vw]" : "bottom-[12vh] sm:bottom-[14vh] w-[86vw] sm:w-[72vw]"
        } md:w-[28rem] px-0`
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



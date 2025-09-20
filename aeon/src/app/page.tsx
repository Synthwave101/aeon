"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const handleLogin = useCallback(() => {
    router.push("/iniciar-sesion");
  }, [router]);

  return (
    <main className="min-h-screen grid place-items-center bg-black text-white">
      <div className="grid gap-6 place-items-center text-center">
        <h1 className="text-4xl md:text-6xl font-semibold tracking-tight">
          i love you baby
        </h1>

        <button
          onClick={handleLogin}
          className="px-5 py-3 rounded-md bg-white text-black hover:bg-zinc-200 active:scale-[0.98] transition"
        >
          Iniciar sesión
        </button>
      </div>
    </main>
  );
}
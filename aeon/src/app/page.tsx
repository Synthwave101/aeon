"use client";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const [isSafari, setIsSafari] = useState(false);
  const arLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(userAgent);
    setIsSafari(isSafariBrowser || isIOS);
  }, []);

  const handleOpenAR = () => {
    if (arLinkRef.current) {
      arLinkRef.current.click();
    } else {
      window.location.href = "/models/heart.usdz";
    }
  };

  return (
    <main className="min-h-screen grid place-items-center bg-black text-white">
      <div className="grid gap-6 place-items-center text-center">
        <h1 className="text-4xl md:text-6xl font-semibold tracking-tight">
          i love you baby
        </h1>

        {isSafari && (
          <>
            <a
              ref={arLinkRef}
              rel="ar"
              href="/models/heart.usdz"
              className="hidden"
            >
              AR
            </a>
            <button
              onClick={handleOpenAR}
              className="px-5 py-3 rounded-md bg-white text-black hover:bg-zinc-200 active:scale-[0.98] transition"
            >
              You wanna see a magic trick?
            </button>
          </>
        )}
      </div>
    </main>
  );
}
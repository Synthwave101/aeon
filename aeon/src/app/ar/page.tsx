export default function ARHeartIOS() {
  return (
    <main className="h-screen w-screen bg-black flex items-center justify-center relative">
      {/* Botón que abre AR Quick Look */}
      <a
        rel="ar"
        href="/models/heart.usdz#allowsContentScaling=1&autoplay=1"
        className="px-6 py-3 rounded-full bg-white text-black text-lg font-medium"
      >
        CLICK
      </a>

      {/* Overlay de texto fijo en pantalla */}
      <div className="pointer-events-none absolute top-6 w-full text-center text-white text-2xl">
        I Love You Dorka
      </div> 
    </main>
  );
}
'use client'
import 'model-viewer' // npm i @google/model-viewer
import Link from 'next/link'

export default function ARPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-black text-white p-6">
      <h1 className="text-3xl md:text-5xl font-semibold">❤️ AR Heart</h1>

      {/* Botón AR nativo en iOS (Quick Look) */}
      <a
        rel="ar"
        href="/models/heart.usdz#allowsContentScaling=1"
        className="px-5 py-3 rounded-2xl bg-white text-black font-medium"
      >
        Open in AR (iOS)
      </a>

      {/* Viewer web: giro + “float” */}
      <div className="float-wrap">
        <model-viewer
          style={{ width: '90vw', maxWidth: 640, height: 480 }}
          src="/models/heart.glb"
          ios-src="/models/heart.usdz"
          ar
          ar-modes="webxr scene-viewer quick-look"
          camera-controls
          auto-rotate
          auto-rotate-speed="0.5"   /* giro sobre su eje */
          shadow-intensity="1"
          exposure="1"
          disable-zoom
        />
      </div>

      <Link href="/" className="opacity-70 underline">← Home</Link>

      {/* Animación “float” suave */}
      <style jsx>{`
        .float-wrap {
          animation: floatY 3.5s ease-in-out infinite;
        }
        @keyframes floatY {
          0%   { transform: translateY(0px); }
          50%  { transform: translateY(-16px); }
          100% { transform: translateY(0px); }
        }
      `}</style>
    </main>
  )
}
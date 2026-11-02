"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col justify-center items-center px-6 py-12 select-none text-center">
      <div className="w-full max-w-sm space-y-4">
        <span className="text-sm font-extrabold tracking-tight text-neutral-950 font-sans block">
          Comercialización<span className="text-emerald-600">.</span>
        </span>

        <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-neutral-200 to-transparent pointer-events-none" />

        <div className="space-y-1.5 py-2">
          <p className="text-sm font-medium text-neutral-900 tracking-tight">
            Transición temporal de sesión
          </p>
          <p className="text-xs text-neutral-500 font-normal">
            Estamos sincronizando tu sesión con el servidor.
          </p>
        </div>

        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.href = "/";
              } else {
                reset();
              }
            }}
            className="text-xs font-semibold text-neutral-900 hover:text-emerald-700 transition-colors cursor-pointer py-1.5 px-3"
          >
            Continuar
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              } else {
                reset();
              }
            }}
            className="text-xs font-normal text-neutral-400 hover:text-neutral-800 transition-colors cursor-pointer py-1.5 px-3"
          >
            Recargar página
          </button>
        </div>
      </div>
    </div>
  );
}

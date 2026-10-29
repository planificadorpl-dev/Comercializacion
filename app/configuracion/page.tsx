"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ConfiguracionPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin?tab=personal");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFDFD] text-xs font-mono text-neutral-400">
      Redirigiendo al apartado Personal dentro del Panel Administrador...
    </div>
  );
}

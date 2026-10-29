"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Plus,
  RotateCw,
  Search,
} from "lucide-react";
import { EvaluacionRecord } from "@/lib/evaluaciones-data";
import { EvaluacionesAnalytics } from "@/components/evaluaciones/evaluaciones-analytics";
import { EvaluacionDetailModal } from "@/components/evaluaciones/evaluacion-detail-modal";
import { cn } from "@/lib/utils";

function RendimientoContent() {
  const router = useRouter();
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingRecord, setViewingRecord] = useState<EvaluacionRecord | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/evaluaciones?t=${Date.now()}`, {
        cache: "no-store",
      }).then((r) => r.json());

      if (res.success && Array.isArray(res.evaluaciones)) {
        setEvaluaciones(res.evaluaciones);
      }
    } catch (err) {
      console.error("Error loading evaluaciones for analytics:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-neutral-900 font-sans antialiased selection:bg-neutral-900 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-20 h-14 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 px-4 sm:px-6 flex items-center justify-between select-none">
        <div className="flex items-center gap-3">
          <Link
            href="/evaluaciones"
            className="min-w-[40px] min-h-[40px] -ml-2 p-2 text-neutral-500 hover:text-neutral-900 transition-colors flex items-center justify-center cursor-pointer"
            title="Volver a Registro de Evaluaciones"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2]" />
          </Link>
          <div>
            <h1 className="text-sm font-bold text-neutral-950 font-sans leading-tight">
              Rendimiento por Asesor
            </h1>
            <p className="text-[10px] text-neutral-400 font-mono leading-none">
              Métricas de supervisión y promedios por colaborador
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            className="p-2 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
            title="Actualizar datos"
          >
            <RotateCw className={cn("w-3.5 h-3.5 stroke-[1.75]", loading && "animate-spin text-neutral-900")} />
          </button>

          <Link
            href="/evaluaciones/nueva"
            className="inline-flex items-center gap-1.5 py-1.5 px-3 text-xs font-semibold text-neutral-950 hover:text-neutral-600 transition-colors cursor-pointer select-none"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2]" />
            <span>Nueva evaluación</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto p-4 sm:p-6 pb-24 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-6 border-b border-neutral-200/80 pb-2 text-xs select-none">
          <Link
            href="/evaluaciones"
            className="min-h-[44px] py-2.5 font-medium transition-colors border-b-2 -mb-2 cursor-pointer flex items-center gap-2 border-transparent text-neutral-400 hover:text-neutral-700"
          >
            <span>Registro de evaluaciones</span>
          </Link>

          <span
            className="min-h-[44px] py-2.5 font-medium border-b-2 -mb-2 flex items-center gap-2 border-neutral-900 text-neutral-950 font-semibold cursor-default"
          >
            <span>Rendimiento por asesor</span>
          </span>
        </div>

        {loading ? (
          <div className="py-20 text-center text-xs text-neutral-400 font-mono">
            Cargando análisis de rendimiento...
          </div>
        ) : (
          <EvaluacionesAnalytics
            evaluaciones={evaluaciones}
            onNewEvaluationForAdvisor={(advisorName) => {
              router.push(`/evaluaciones/nueva?asesor=${encodeURIComponent(advisorName)}`);
            }}
            onViewEvaluation={(rec) => setViewingRecord(rec)}
          />
        )}
      </main>

      {/* Detail Modal */}
      {viewingRecord && (
        <EvaluacionDetailModal
          record={viewingRecord}
          onClose={() => setViewingRecord(null)}
          onEdit={() => {
            const id = viewingRecord.id;
            setViewingRecord(null);
            router.push(`/evaluaciones/nueva?id=${encodeURIComponent(id)}`);
          }}
        />
      )}
    </div>
  );
}

export default function RendimientoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FDFDFD] text-xs font-mono text-neutral-400">
          Cargando rendimiento...
        </div>
      }
    >
      <RendimientoContent />
    </Suspense>
  );
}

"use client";

import { Zap, Box, Star, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OperationalSummaryProps {
    metrics: any;
    financials: any;
}

export function OperationalSummary({ metrics, financials }: OperationalSummaryProps) {
    return (
        <div className="bg-[#181818] p-6 lg:p-8 rounded-[40px] h-full flex flex-col">
            <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-medium text-white">Resumen Operativo</h3>
                <div className="flex gap-1">
                    <div className="w-1 h-1 rounded-full bg-zinc-600"></div>
                    <div className="w-1 h-1 rounded-full bg-zinc-600"></div>
                    <div className="w-1 h-1 rounded-full bg-zinc-600"></div>
                </div>
            </div>

            {/* Revenue / Value Highlight */}
            <div className="mb-8">
                <p className="text-sm font-medium text-zinc-400 mb-2">Ingresos Estimados</p>
                <h2 className="text-3xl font-bold text-white mb-2">
                    $ {financials?.totalRevenue?.toLocaleString() || "0"} <span className="text-base font-normal text-zinc-500">/Mes</span>
                </h2>
                <div className="flex items-center gap-2 text-emerald-400 text-sm">
                    <TrendingUp className="w-4 h-4" />
                    <span>+12% vs mes anterior</span>
                </div>
            </div>

            {/* Detailed Metrics List */}
            <div className="space-y-6">

                {/* Metric 1: New Services */}
                <div className="bg-[#1f1f1f] p-4 rounded-2xl flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#2d2d2d] flex items-center justify-center shrink-0">
                        <Zap className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                        <h4 className="font-medium text-white">Nuevos Servicios</h4>
                        <p className="text-xs text-zinc-500">Total Instalados</p>
                    </div>
                    <div className="ml-auto">
                        <span className="text-xl font-bold text-white">{metrics?.counters?.nuevosServicios || 0}</span>
                    </div>
                </div>

                {/* Metric 2: Routers */}
                <div className="bg-[#1f1f1f] p-4 rounded-2xl flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#2d2d2d] flex items-center justify-center shrink-0">
                        <Box className="w-6 h-6 text-orange-500" />
                    </div>
                    <div>
                        <h4 className="font-medium text-white">Routers</h4>
                        <p className="text-xs text-zinc-500">Equipos Asignados</p>
                    </div>
                    <div className="ml-auto">
                        <span className="text-xl font-bold text-white">{metrics?.counters?.routerCount || 0}</span>
                    </div>
                </div>

                {/* Metric 3: Top Advisor Highlight */}
                <div className="bg-[#1f1f1f] p-4 rounded-2xl">
                    <div className="flex items-center gap-4 mb-3">
                        <div className="w-12 h-12 rounded-full bg-[#2d2d2d] flex items-center justify-center shrink-0">
                            <Star className="w-6 h-6 text-yellow-500" />
                        </div>
                        <div>
                            <h4 className="font-medium text-white">Top Asesor</h4>
                            <p className="text-xs text-zinc-500">Mayor Rendimiento</p>
                        </div>
                    </div>
                    <div className="bg-[#252525] p-3 rounded-xl flex justify-between items-center">
                        <span className="text-zinc-300 text-sm truncate max-w-[120px]" title={metrics?.counters?.topAsesor}>
                            {metrics?.counters?.topAsesor || "N/A"}
                        </span>
                        <span className="text-emerald-400 text-sm font-bold">
                            {metrics?.counters?.maxVentas} ventas
                        </span>
                    </div>
                </div>

            </div>

            <div className="mt-auto pt-8">
                <Button className="w-full h-12 rounded-xl bg-[#2d2d2d] hover:bg-[#3d3d3d] text-zinc-300 font-medium text-sm">
                    Ver Reporte Completo
                </Button>
            </div>
        </div>
    );
}

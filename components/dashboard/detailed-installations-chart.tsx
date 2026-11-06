"use client";

import { useState } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Calendar, Maximize2, X, Users, MapPinned, TrendingUp } from "lucide-react";
import { DetailedDailyMetric } from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";

interface Props {
    data: DetailedDailyMetric[];
}

export function DetailedInstallationsChart({ data }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState<'daily' | 'monthly'>('daily');

    // Meta diaria de instalaciones
    const GOAL_THRESHOLD = 5;

    // Derived Monthly Data for the alternative View
    const monthlyData = data.reduce((acc, curr) => {
        const month = curr.name.split('-')[1]; // e.g. "01" from "02-01"
        // Need a robust way to extract or map month, but 'curr.fullDate' has it like "FEBRERO 02"
        const monthName = curr.fullDate ? curr.fullDate.split(' ')[0] : curr.name;

        const existing = acc.find(item => item.name === monthName);
        if (existing) {
            existing.instalaciones += curr.instalaciones;
            existing.solicitudes += curr.solicitudes;
        } else {
            acc.push({
                ...curr,
                name: monthName,
                fullDate: monthName,
                instalaciones: curr.instalaciones,
                solicitudes: curr.solicitudes
            });
        }
        return acc;
    }, [] as DetailedDailyMetric[]);

    const activeData = view === 'daily' ? data : monthlyData;

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const dayData = payload[0].payload as DetailedDailyMetric;
            return (
                <div className="bg-[#1A1A1A] border border-white/[0.08] p-3 rounded-lg shadow-2xl text-white min-w-[200px]">
                    <p className="font-semibold text-xs mb-2 pb-1.5 border-b border-white/[0.06] text-center text-[#D1D5DB]">{dayData.fullDate}</p>
                    <div className="flex flex-col gap-1.5 text-xs">
                        <div className="flex justify-between items-center">
                            <span className="text-[#6B7280] font-medium">Instalaciones:</span>
                            <span className="font-semibold text-emerald-400 text-sm">
                                {dayData.instalaciones}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[#6B7280] font-medium">Solicitudes (Volumen):</span>
                            <span className="font-semibold text-white text-sm">{dayData.solicitudes}</span>
                        </div>
                        <div className="mt-2 pt-2 border-t border-white/[0.06]">
                            <div className="flex items-center gap-1.5 text-[#6B7280] mb-1">
                                <Users className="w-3 h-3" />
                                <span>Asesor Top:</span>
                            </div>
                            <p className="font-semibold text-white">{dayData.asesor_top}</p>
                        </div>
                        <div className="mt-1">
                            <div className="flex items-center gap-1.5 text-[#6B7280] mb-1">
                                <MapPinned className="w-3 h-3" />
                                <span>Sector:</span>
                            </div>
                            <p className="font-semibold text-white">{dayData.sector_principal}</p>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    const MiniTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const dayData = payload[0].payload as DetailedDailyMetric;
            return (
                <div className="bg-[#1A1A1A] border border-white/[0.08] p-2.5 rounded-lg shadow-2xl text-white min-w-[120px]">
                    <p className="font-semibold text-xs mb-1 text-[#6B7280]">{dayData.fullDate}</p>
                    <div className="flex justify-between items-center text-xs">
                        <span>Instalaciones:</span>
                        <span className="font-semibold text-emerald-400">
                            {dayData.instalaciones}
                        </span>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <>
            {/* MINI CHART (Dashboard Card) */}
            <div
                className="glass-card p-5 flex flex-col h-full overflow-hidden cursor-pointer group hover:border-white/[0.1] transition-all"
                onClick={() => setIsOpen(true)}
            >
                <div className="pb-3 flex justify-between items-center border-b border-white/[0.04] shrink-0">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                        <h3 className="text-sm font-semibold tracking-tight text-white">Instalaciones Diarias (Línea de Tiempo)</h3>
                    </div>
                    <Maximize2 className="w-4 h-4 text-[#6B7280] group-hover:text-white transition-colors" />
                </div>

                    <div className="flex-1 p-1 min-h-0 mt-3">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorGreenDetail" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.5} />
                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="name"
                                    tick={{ fontSize: 10, fill: "#6B7280" }}
                                    axisLine={{ stroke: 'rgba(255,255,255,0.04)' }}
                                    tickLine={false}
                                    interval={0}
                                    angle={-45}
                                    textAnchor="end"
                                    height={50}
                                />
                                <Tooltip content={<MiniTooltip />} cursor={{ stroke: '#10B981', strokeWidth: 1 }} />
                                <Area
                                    type="monotone"
                                    dataKey="instalaciones"
                                    stroke="#10B981"
                                    fill="url(#colorGreenDetail)"
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
            </div>

            {/* EXPANDED CHART MODAL */}
            {isOpen && (
                <div className="fixed inset-0 z-[999] bg-[#0A0A0A] flex flex-col animate-in fade-in duration-200">
                    {/* Modal Header */}
                    <div className="h-14 border-b border-white/[0.06] px-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <TrendingUp className="w-5 h-5 text-emerald-400" />
                            <h2 className="text-lg font-bold text-white">Análisis de Instalaciones vs Solicitudes</h2>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex bg-[#1A1A1A] border border-white/[0.06] rounded-lg p-0.5">
                                <button
                                    onClick={() => setView('daily')}
                                    className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", view === 'daily' ? "bg-emerald-500/15 text-emerald-400" : "text-[#6B7280] hover:text-white")}
                                >
                                    Vista Diaria
                                </button>
                                <button
                                    onClick={() => setView('monthly')}
                                    className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", view === 'monthly' ? "bg-emerald-500/15 text-emerald-400" : "text-[#6B7280] hover:text-white")}
                                >
                                    Vista Mensual
                                </button>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 hover:bg-white/[0.05] rounded-lg transition-colors text-[#6B7280] hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Modal Content */}
                    <div className="flex-1 flex flex-col p-4 gap-4">
                        {/* Upper Chart (Instalaciones) - 70% */}
                        <div className="flex-[7] min-h-0 border border-white/[0.06] rounded-lg p-4 bg-[#111111] relative">
                            <h3 className="absolute top-4 left-6 text-[11px] text-[#6B7280] font-semibold tracking-tight z-10 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-sm bg-emerald-400"></span>
                                INSTALACIONES (COMPLETADAS)
                            </h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={activeData} syncId="tradingViewChart" margin={{ top: 30, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="tvGreenColor" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                    <XAxis dataKey="name" hide />
                                    <YAxis
                                        tick={{ fill: '#6B7280', fontSize: 11 }}
                                        axisLine={false}
                                        tickLine={false}
                                        orientation="right"
                                    />
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#6B7280', strokeWidth: 1, strokeDasharray: '3 3' }} />
                                    <Area
                                        type="monotone"
                                        dataKey="instalaciones"
                                        stroke="#10B981"
                                        fillOpacity={1}
                                        fill="url(#tvGreenColor)"
                                        strokeWidth={2.5}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Lower Chart (Solicitudes) - 30% */}
                        <div className="flex-[3] min-h-0 border border-white/[0.06] rounded-lg p-4 bg-[#111111] relative">
                            <h3 className="absolute top-4 left-6 text-[11px] text-[#6B7280] font-semibold tracking-tight z-10 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-sm bg-[#6B7280]"></span>
                                VOLUMEN DE SOLICITUDES
                            </h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={activeData} syncId="tradingViewChart" margin={{ top: 25, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fill: '#6B7280', fontSize: 11 }}
                                        tickLine={false}
                                        axisLine={{ stroke: 'rgba(255,255,255,0.04)' }}
                                    />
                                    <YAxis
                                        tick={{ fill: '#6B7280', fontSize: 11 }}
                                        axisLine={false}
                                        tickLine={false}
                                        orientation="right"
                                        tickCount={4}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                                        content={<></>}
                                    />
                                    <Bar dataKey="solicitudes" fill="#374151" radius={[2, 2, 0, 0]} maxBarSize={30} opacity={0.5} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

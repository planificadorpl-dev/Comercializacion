"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const staticData = [
    { name: "Jan", last: 4000, running: 2400 },
    { name: "Feb", last: 13000, running: 1398 },
    { name: "Mar", last: 20000, running: 8000 },
    { name: "Apr", last: 17800, running: 21908 },
    { name: "May", last: 16890, running: 38000 },
    { name: "Jun", last: 2390, running: 23800 },
    { name: "Jul", last: 3490, running: 23400 },
];

interface EnergyChartProps {
    data?: any[];
}

export function EnergyChart({ data = staticData }: EnergyChartProps) {
    return (
        <div className="bg-[#1f1f1f] p-6 rounded-3xl col-span-1 lg:col-span-2 relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h3 className="text-xl font-medium text-white">Ingresos Mensuales</h3>
                    <div className="mt-4">
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-white">$ 2,180/=</span>
                        </div>
                        <p className="text-emerald-400 text-sm flex items-center gap-1">
                            ↑ 18% <span className="text-zinc-500">vs mes anterior</span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-[#2d2d2d] rounded-full px-2 py-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-400 hover:text-white rounded-full">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium text-zinc-300 px-2">Diciembre, 2025</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-400 hover:text-white rounded-full">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="h-[250px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} barGap={8}>
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#71717a", fontSize: 12 }}
                            dy={10}
                        />
                        <YAxis
                            hide={true} // Hide Y Axis as per design roughly
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: "#2d2d2d", border: "none", borderRadius: "8px", color: "#fff" }}
                            cursor={{ fill: "transparent" }}
                        />
                        {/* Last Month Bar - Grey/Dimmed */}
                        <Bar
                            dataKey="last"
                            fill="#52525b"
                            radius={[4, 4, 4, 4]}
                            barSize={30}
                        />
                        {/* Running Month Bar - Custom Colors for specific columns if possible, else standard blue/cyan */}
                        <Bar
                            dataKey="running"
                            fill="#3b82f6"
                            radius={[4, 4, 4, 4]}
                            barSize={30}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="flex gap-6 mt-4 pl-2">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-cyan-400"></div>
                    <span className="text-xs text-zinc-400">Mes Pasado</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                    <span className="text-xs text-zinc-400">Mes Actual</span>
                </div>
            </div>
        </div>
    );
}

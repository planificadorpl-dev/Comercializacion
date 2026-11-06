"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type Installation } from "@/lib/dashboard-data";
import {
    Bar,
    BarChart,
    Line,
    LineChart,
    Pie,
    PieChart,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from "recharts";

// Vibrant neon colors matching reference design
const NEON_COLORS = ["#00D9FF", "#0099FF", "#7B61FF", "#00FFAA", "#FF6B9D"];

interface ChartsProps {
    data: Installation[];
}

export function DashboardCharts({ data }: ChartsProps) {
    // 1. Status Distribution
    const statusData = data.reduce((acc, curr) => {
        const found = acc.find((d) => d.status === curr.estatus);
        if (found) {
            found.value += 1;
        } else {
            acc.push({
                status: curr.estatus,
                value: 1,
                fill: NEON_COLORS[acc.length % NEON_COLORS.length]
            });
        }
        return acc;
    }, [] as { status: string; value: number; fill: string }[]);

    // 2. Advisor Performance
    const advisorData = data.reduce((acc, curr) => {
        const found = acc.find((d) => d.asesor === curr.asesor);
        if (found) {
            found.value += 1;
        } else {
            acc.push({ asesor: curr.asesor, value: 1 });
        }
        return acc;
    }, [] as { asesor: string; value: number }[]);

    // 3. Sector Distribution (Top 5)
    const sectorData = data.reduce((acc, curr) => {
        const found = acc.find((d) => d.sector === curr.sector);
        if (found) {
            found.value += 1;
        } else {
            acc.push({ sector: curr.sector, value: 1 });
        }
        return acc;
    }, [] as { sector: string; value: number }[])
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

    // 4. Service & Plan
    const servicePlanData = data.reduce((acc, curr) => {
        const key = `${curr.servicio} - ${curr.plan}`;
        const found = acc.find((d) => d.name === key);
        if (found) {
            found.value += 1;
        } else {
            acc.push({ name: key, value: 1 });
        }
        return acc;
    }, [] as { name: string; value: number }[])
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);

    // 5. Monthly Trend
    const monthlyDataRaw = data.reduce((acc, curr) => {
        const found = acc.find((d) => d.mes === curr.mes);
        if (found) {
            found.solicitudes += 1;
        } else {
            acc.push({ mes: curr.mes, solicitudes: 1 });
        }
        return acc;
    }, [] as { mes: string; solicitudes: number }[]);

    const totalSolicitudes = data.length;
    const uniqueMonths = new Set(data.map(d => d.mes)).size || 1;
    const average = Math.round(totalSolicitudes / uniqueMonths);

    const monthlyData = monthlyDataRaw.map(d => ({
        mes: d.mes,
        solicitudes: d.solicitudes,
        promedio: average
    }));

    // 6. Zones
    const zoneData = data.reduce((acc, curr) => {
        const found = acc.find((d) => d.zona === curr.zona);
        if (found) {
            found.value += 1;
        } else {
            acc.push({ zona: curr.zona, value: 1 });
        }
        return acc;
    }, [] as { zona: string; value: number }[]);

    return (
        <div className="grid gap-4 md:grid-cols-2">
            {/* Tendencia Mensual */}
            <Card className="col-span-full bg-card/50">
                <CardHeader>
                    <CardTitle className="text-lg">Tendencia Mensual</CardTitle>
                </CardHeader>
                <CardContent className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthlyData}>
                            <XAxis
                                dataKey="mes"
                                stroke="hsl(var(--muted-foreground))"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12 }}
                            />
                            <YAxis
                                stroke="hsl(var(--muted-foreground))"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12 }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "hsl(var(--card))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                    color: "hsl(var(--foreground))"
                                }}
                            />
                            <Line
                                dataKey="solicitudes"
                                type="monotone"
                                stroke="#00D9FF"
                                strokeWidth={3}
                                dot={false}
                            />
                            <Line
                                dataKey="promedio"
                                type="monotone"
                                stroke="#7B61FF"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Tipo de Solicitud */}
            <Card className="bg-card/50">
                <CardHeader>
                    <CardTitle className="text-lg">Tipo de Solicitud</CardTitle>
                </CardHeader>
                <CardContent className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={statusData}
                                dataKey="value"
                                nameKey="status"
                                cx="50%"
                                cy="50%"
                                outerRadius={70}
                                label={(entry) => entry.status}
                            >
                                {statusData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "hsl(var(--card))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                    color: "hsl(var(--foreground))"
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Por Asesor */}
            <Card className="bg-card/50">
                <CardHeader>
                    <CardTitle className="text-lg">Por Asesor</CardTitle>
                </CardHeader>
                <CardContent className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={advisorData} layout="vertical">
                            <XAxis
                                type="number"
                                stroke="hsl(var(--muted-foreground))"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12 }}
                            />
                            <YAxis
                                dataKey="asesor"
                                type="category"
                                width={100}
                                stroke="hsl(var(--muted-foreground))"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 11 }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "hsl(var(--card))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                    color: "hsl(var(--foreground))"
                                }}
                            />
                            <Bar
                                dataKey="value"
                                fill="#00D9FF"
                                radius={[0, 4, 4, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Top 5 Sectores */}
            <Card className="bg-card/50">
                <CardHeader>
                    <CardTitle className="text-lg">Top 5 Sectores</CardTitle>
                </CardHeader>
                <CardContent className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={sectorData}>
                            <XAxis
                                dataKey="sector"
                                stroke="hsl(var(--muted-foreground))"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12 }}
                            />
                            <YAxis
                                stroke="hsl(var(--muted-foreground))"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12 }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "hsl(var(--card))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                    color: "hsl(var(--foreground))"
                                }}
                            />
                            <Bar
                                dataKey="value"
                                fill="#0099FF"
                                radius={[4, 4, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Por Zona */}
            <Card className="bg-card/50">
                <CardHeader>
                    <CardTitle className="text-lg">Por Zona</CardTitle>
                </CardHeader>
                <CardContent className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={zoneData}>
                            <XAxis
                                dataKey="zona"
                                stroke="hsl(var(--muted-foreground))"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12 }}
                            />
                            <YAxis
                                stroke="hsl(var(--muted-foreground))"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12 }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "hsl(var(--card))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                    color: "hsl(var(--foreground))"
                                }}
                            />
                            <Bar
                                dataKey="value"
                                fill="#7B61FF"
                                radius={[4, 4, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Servicios y Planes */}
            <Card className="col-span-full bg-card/50">
                <CardHeader>
                    <CardTitle className="text-lg">Servicios y Planes</CardTitle>
                </CardHeader>
                <CardContent className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={servicePlanData}>
                            <XAxis
                                dataKey="name"
                                stroke="hsl(var(--muted-foreground))"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 11 }}
                            />
                            <YAxis
                                stroke="hsl(var(--muted-foreground))"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12 }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "hsl(var(--card))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                    color: "hsl(var(--foreground))"
                                }}
                            />
                            <Bar
                                dataKey="value"
                                fill="#00FFAA"
                                radius={[4, 4, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}

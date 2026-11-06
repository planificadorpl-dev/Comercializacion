import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area, LabelList } from "recharts";
import { cn } from "@/lib/utils";
import { LucideIcon, MoreHorizontal } from "lucide-react";

interface ReportChartProps {
    title: string;
    data: any[];
    type?: "bar" | "pie" | "horizontal-bar" | "area" | "donut";
    xAxisAngle?: number;
    className?: string;
    action?: React.ReactNode;
    icon?: LucideIcon;
    highlightTopN?: number;
}

// Green-based palette matching reference design
const CHART_COLORS = ["#10B981", "#34D399", "#6EE7B7", "#6B7280", "#374151"];

export function ReportChart({ title, data, type = "bar", xAxisAngle = -45, className, action, icon: Icon, highlightTopN = 1 }: ReportChartProps) {
    const donutData = useMemo(() => {
        if (type !== "donut" && type !== "pie") return data;
        const sorted = [...data].sort((a, b) => b.value - a.value);
        const top4 = sorted.slice(0, 4);
        const others = sorted.slice(4).reduce((sum, item) => sum + item.value, 0);
        if (others > 0) {
            top4.push({ name: "OTROS", value: others });
        }
        return top4;
    }, [data, type]);

    const totalDonutValue = useMemo(() => {
        return donutData.reduce((acc, curr) => acc + (curr.value || 0), 0);
    }, [donutData]);

    return (
        <div className={cn("glass-card p-5 flex flex-col h-full overflow-hidden", className)}>
            {/* Header */}
            <div className="pb-4 flex justify-between items-center shrink-0">
                <div>
                    <div className="flex items-center gap-2">
                        {Icon && <Icon className="w-4 h-4 text-emerald-400 shrink-0" />}
                        <h3 className="text-sm font-semibold tracking-tight text-white">{title}</h3>
                    </div>
                    <p className="text-[11px] text-[#6B7280] mt-0.5 ml-6">Distribución porcentual</p>
                </div>
                <button className="p-1 text-[#6B7280] hover:text-white transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                </button>
            </div>

                {/* Content */}
                <div className={cn(
                    "flex-1 p-1 min-h-0 relative",
                    type === "horizontal-bar" ? "overflow-y-auto overflow-x-hidden custom-scrollbar" : ""
                )}>
                    <div style={{ height: type === "horizontal-bar" ? Math.max(data.length * 30, 200) : '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            {type === "pie" || type === "donut" ? (
                            <PieChart>
                                <Pie
                                    data={donutData}
                                    cx="42%"
                                    cy="50%"
                                    innerRadius={type === "donut" ? 54 : 0}
                                    outerRadius={78}
                                    paddingAngle={3}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {donutData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        fontSize: '12px',
                                        backgroundColor: '#1A1A1A',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        color: '#FFFFFF',
                                        borderRadius: '10px',
                                        boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
                                    }}
                                    itemStyle={{ color: '#FFFFFF' }}
                                    formatter={(value: number, name: string, props: any) => [
                                        `${value.toLocaleString()} (${totalDonutValue > 0 ? Math.round((value / totalDonutValue) * 100) : 0}%)`,
                                        props.payload.name
                                    ]}
                                />
                                <Legend
                                    layout="vertical"
                                    verticalAlign="middle"
                                    align="right"
                                    iconType="circle"
                                    iconSize={8}
                                    formatter={(value, entry: any) => {
                                        const val = entry?.payload?.value || 0;
                                        const pct = totalDonutValue > 0 ? Math.round((val / totalDonutValue) * 100) : 0;
                                        return (
                                            <span className="text-[11px] font-medium text-[#D1D5DB] ml-1">
                                                {value} <span className="text-[#6B7280] font-mono">({pct}%)</span>
                                            </span>
                                        );
                                    }}
                                    wrapperStyle={{ right: 0 }}
                                />
                            </PieChart>
                        ) : type === "horizontal-bar" ? (
                            <BarChart layout="vertical" data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                                <XAxis type="number" hide />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    width={120}
                                    tick={{ fontSize: 10, fill: "#6B7280" }}
                                    axisLine={false}
                                    tickLine={false}
                                    interval={0}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                    contentStyle={{ fontSize: '12px', backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', color: '#FFFFFF', borderRadius: '10px' }}
                                    itemStyle={{ color: '#FFFFFF' }}
                                    formatter={(value: number) => [value, "Cantidad"]}
                                />
                                <Bar dataKey="value" barSize={16} radius={[0, 6, 6, 0]}>
                                    <LabelList dataKey="value" position="right" fill="#FFFFFF" fontSize={10} fontWeight="bold" />
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index < highlightTopN ? "#10B981" : "#1F1F1F"} />
                                    ))}
                                </Bar>
                            </BarChart>
                        ) : type === "area" ? (
                            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorGreen" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.7} />
                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="name"
                                    tick={{ fontSize: 10, fill: "#6B7280" }}
                                    axisLine={{ stroke: 'rgba(255,255,255,0.04)' }}
                                    tickLine={false}
                                    interval={0}
                                    angle={xAxisAngle}
                                    textAnchor={xAxisAngle !== 0 ? "end" : "middle"}
                                    height={60}
                                />
                                <Tooltip
                                    cursor={{ stroke: '#10B981', strokeWidth: 1 }}
                                    contentStyle={{ fontSize: '12px', backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', color: '#FFFFFF', borderRadius: '10px' }}
                                    itemStyle={{ color: '#FFFFFF' }}
                                    formatter={(value: number) => [value, "Cantidad"]}
                                />
                                <Area type="monotone" dataKey="value" stroke="#10B981" fillOpacity={1} fill="url(#colorGreen)" strokeWidth={2.5} />
                            </AreaChart>
                        ) : (
                            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <XAxis
                                    dataKey="name"
                                    tick={{ fontSize: 10, fill: "#6B7280" }}
                                    axisLine={{ stroke: 'rgba(255,255,255,0.04)' }}
                                    tickLine={false}
                                    interval={0}
                                    angle={xAxisAngle}
                                    textAnchor={xAxisAngle !== 0 ? "end" : "middle"}
                                    height={60}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                    contentStyle={{ fontSize: '12px', backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', color: '#FFFFFF', borderRadius: '10px' }}
                                    itemStyle={{ color: '#FFFFFF' }}
                                    formatter={(value: number) => [value, "Cantidad"]}
                                />
                                <Bar dataKey="value" barSize={28} radius={[6, 6, 0, 0]}>
                                    <LabelList dataKey="value" position="top" fill="#FFFFFF" fontSize={11} fontWeight="bold" />
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? "#10B981" : "#1F1F1F"} />
                                    ))}
                                </Bar>
                            </BarChart>
                        )}
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
    );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Wifi, Award, ShoppingCart, Tv, Activity, CalendarDays } from "lucide-react";

interface StatsCardsProps {
    stats: {
        totalSolicitudes: number;
        powerGoCount: number;
        routerCount: number;
        diasLaborados: number;
        nuevosServicios: number;
        maxVentas: number;
        topAsesor: string;
    };
}

export function StatsCards({ stats }: StatsCardsProps) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Solicitudes</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalSolicitudes}</div>
                    <p className="text-xs text-muted-foreground">Total general</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">TV</CardTitle>
                    <Tv className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.powerGoCount}</div>
                    <p className="text-xs text-muted-foreground">Servicios TV adquiridos</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Max Ventas</CardTitle>
                    <Award className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.maxVentas}</div>
                    <p className="text-xs text-muted-foreground">Por {stats.topAsesor}</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Mejor Asesor</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold truncate">{stats.topAsesor}</div>
                    <p className="text-xs text-muted-foreground">Más ventas registradas</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Routers Vendidos</CardTitle>
                    <Wifi className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.routerCount}</div>
                    <p className="text-xs text-muted-foreground">Total equipos entregados</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Nuevos Servicios</CardTitle>
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.nuevosServicios}</div>
                    <p className="text-xs text-muted-foreground">Instalaciones nuevas</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Días Laborados</CardTitle>
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.diasLaborados}</div>
                    <p className="text-xs text-muted-foreground">Días con instalaciones</p>
                </CardContent>
            </Card>
        </div>
    );
}

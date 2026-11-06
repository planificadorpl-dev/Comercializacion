"use client";

import { useEffect, useState } from "react";
import { Map, MapMarker, MapPopup, MarkerContent } from "@/components/ui/map";
import { fetchNetworkNodes, type NetworkNode } from "@/lib/dashboard-data";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { cn } from "@/lib/utils";
import { Layers, Loader2 } from "lucide-react";

const mapStyles = {
    dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
};

export function NetworkMap({ className }: { className?: string }) {
    const [nodes, setNodes] = useState<NetworkNode[]>([]);
    const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            const data = await fetchNetworkNodes();
            setNodes(data);
            setLoading(false);
        }
        load();
    }, []);

    // Determine color based on type (simple heuristic)
    const getNodeColor = (type: string) => {
        const t = (type || "").toLowerCase();
        if (t.includes('manga 96') || t.includes('empalme')) return "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]";
        if (t.includes('manga 48') || t.includes('nap')) return "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]";
        return "bg-neutral-400";
    };

    return (
        <div className={cn("relative h-full rounded-[1.25rem] border-[0.75px] border-border p-2 md:rounded-[1.5rem] md:p-3 overflow-hidden", className)}>
            <GlowingEffect
                spread={40}
                glow={true}
                disabled={false}
                proximity={64}
                inactiveZone={0.01}
                borderWidth={3}
            />

            <div className="relative flex h-full flex-col overflow-hidden rounded-xl border-[0.75px] bg-background/40 backdrop-blur-md shadow-sm">

                {/* Header Overlay */}
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-background/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-border/50">
                    <Layers className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Mapa de Red</span>
                    {loading && <Loader2 className="w-3 h-3 animate-spin ml-2" />}
                </div>

                <Map
                    center={[-66.905, 10.467]}
                    zoom={13}
                    styles={mapStyles}
                    dragPan={true}
                    scrollZoom={true}
                    doubleClickZoom={true}
                >
                    {nodes.map((node) => (
                        <MapMarker
                            key={node.id}
                            longitude={node.longitud}
                            latitude={node.latitud}
                            onClick={() => setSelectedNode(node)}
                        >
                            <MarkerContent>
                                <div className={cn(
                                    "w-3 h-3 rounded-full border border-white/20 transition-transform hover:scale-150 cursor-pointer",
                                    getNodeColor(node.tipo)
                                )} />
                            </MarkerContent>
                        </MapMarker>
                    ))}

                    {selectedNode && (
                        <MapPopup
                            longitude={selectedNode.longitud}
                            latitude={selectedNode.latitud}
                            onClose={() => setSelectedNode(null)}
                            className="p-0 border-none bg-transparent shadow-none"
                            closeButton={false}
                        >
                            <div className="bg-popover/90 backdrop-blur-md border border-border rounded-lg p-3 shadow-xl min-w-[150px]">
                                <h4 className="font-bold text-sm mb-1">{selectedNode.nombre}</h4>
                                <div className="text-xs text-muted-foreground uppercase">{selectedNode.tipo}</div>
                                <div className="text-[10px] text-muted-foreground mt-2 font-mono">
                                    {selectedNode.latitud.toFixed(5)}, {selectedNode.longitud.toFixed(5)}
                                </div>
                            </div>
                        </MapPopup>
                    )}
                </Map>
            </div>
        </div>
    );
}

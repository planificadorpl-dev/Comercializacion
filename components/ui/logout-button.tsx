"use client"

import { createClient } from "@/lib/supabase/client"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"

export function LogoutButton() {
    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        window.location.href = "/login"
    }

    return (
        <Button
            variant="ghost"
            onClick={handleLogout}
            className="text-zinc-400 hover:text-red-600 font-medium flex items-center justify-center gap-2 mx-auto transition-colors px-4 py-2 rounded-full hover:bg-zinc-100"
        >
            <LogOut size={18} /> Cerrar Sesión
        </Button>
    )
}

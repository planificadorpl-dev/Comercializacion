import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@/components/providers/user-provider";
import { ModulesProvider } from "@/components/providers/modules-provider";
import { AsesorProvider } from "@/components/providers/asesor-provider";
import { SidebarProvider } from "@/components/providers/sidebar-provider";
import { MobileBottomNav } from "@/components/dashboard/mobile-nav";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata = {
  title: "Buildly - Rendimiento Operativo y Comercial",
  description: "Panel de control para monitoreo y análisis de rendimiento operativo y comercial con datos sincronizados en tiempo real",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${plusJakartaSans.variable} ${plusJakartaSans.className} bg-white text-[#09090B]`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${plusJakartaSans.className} antialiased min-h-screen bg-white text-[#09090B] font-sans selection:bg-neutral-900 selection:text-white`}>
        <UserProvider>
          <ModulesProvider>
            <SidebarProvider>
              <AsesorProvider>
                {children}
                <MobileBottomNav />
              </AsesorProvider>
            </SidebarProvider>
          </ModulesProvider>
        </UserProvider>
      </body>
    </html>
  );
}


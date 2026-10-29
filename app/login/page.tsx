"use client";

import { useState } from "react";
import { useUser } from "@/components/providers/user-provider";
import { Eye, EyeOff, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const { login } = useUser();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanId = identifier.trim();
    if (!cleanId || !password) {
      setErrorMsg("Ingresa tu correo o usuario y tu contraseña");
      return;
    }

    setSubmitting(true);
    try {
      const res = await login({
        emailOrUsername: cleanId,
        password,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Credenciales incorrectas");
      }
    } catch {
      setErrorMsg("Ocurrió un error al conectar con el servidor");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col justify-center items-center px-6 py-12 select-none">
      <div className="w-full max-w-xs space-y-7">
        {/* Brand header */}
        <div className="space-y-1.5 text-center">
          <span className="text-base font-extrabold tracking-tight text-neutral-950 font-sans block">
            Comercialización<span className="text-emerald-600">.</span>
          </span>
          <p className="text-[11px] text-neutral-400 font-normal">
            Ingreso al sistema operativo y comercial
          </p>
        </div>

        {/* Blurred gradient line separator */}
        <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-neutral-200 to-transparent pointer-events-none" />

        {/* Minimalist Typographic Form - Zero boxes, Zero frames */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identifier input */}
          <div className="space-y-1">
            <label
              htmlFor="identifier"
              className="block text-[11px] font-medium text-neutral-500"
            >
              Correo electrónico o usuario
            </label>
            <input
              id="identifier"
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="nombre@powerlink.com"
              disabled={submitting}
              className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 text-sm sm:text-xs py-2 text-neutral-900 placeholder:text-neutral-300 focus:outline-none transition-colors"
            />
          </div>

          {/* Password input */}
          <div className="space-y-1">
            <label
              htmlFor="password"
              className="block text-[11px] font-medium text-neutral-500"
            >
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={submitting}
                className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 text-sm sm:text-xs py-2 pr-9 text-neutral-900 placeholder:text-neutral-300 focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute right-0 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] p-2.5 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer flex items-center justify-center -mr-2"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4 stroke-[1.25]" />
                ) : (
                  <Eye className="w-4 h-4 stroke-[1.25]" />
                )}
              </button>
            </div>
          </div>

          {/* Error feedback - purely typographic */}
          {errorMsg && (
            <div className="text-[11px] text-neutral-800 flex items-center gap-1.5 pt-1">
              <span className="w-1 h-1 rounded-full bg-neutral-900 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Minimalist Action - Word and icon only, ZERO boxes or pills */}
          <div className="pt-2 flex items-center justify-between">
            <button
              type="submit"
              disabled={submitting}
              className="group min-h-[44px] py-2.5 flex items-center gap-2 text-sm sm:text-xs font-semibold text-neutral-950 hover:text-neutral-500 transition-colors cursor-pointer disabled:opacity-50"
            >
              <span>{submitting ? "Verificando..." : "Iniciar sesión"}</span>
              <ArrowRight className="w-3.5 h-3.5 stroke-[1.5] transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </form>

        {/* Blurred gradient line separator */}
        <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-neutral-200 to-transparent pointer-events-none" />

        {/* Discrete notice */}
        <div className="text-center">
          <p className="text-[10px] text-neutral-400 font-normal leading-relaxed">
            Las cuentas son asignadas por la administración.
          </p>
        </div>
      </div>
    </div>
  );
}

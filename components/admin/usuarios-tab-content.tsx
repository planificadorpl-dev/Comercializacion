"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { PenLine, X, Search, RotateCw, Plus, Shield, Check, Key, LogIn } from "lucide-react";
import {
  AppUser,
  AppUserRole,
  getAppUsers,
  createAppUser,
  updateAppUser,
  deleteAppUser,
} from "@/app/actions/auth";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { useAsesor } from "@/components/providers/asesor-provider";
import { useUser } from "@/components/providers/user-provider";
import { cn } from "@/lib/utils";

interface UsuariosTabContentProps {
  showToast: (text: string, type?: "success" | "error") => void;
  onTotalCountChange?: (count: number) => void;
  refreshTrigger?: number;
}

const ROLE_OPTIONS = [
  { value: "asesor", label: "Asesor (Operaciones de campo)" },
  { value: "supervisor", label: "Supervisor (Paneles principales)" },
  { value: "impulsador", label: "Asesor Impulsador (Paneles principales)" },
  { value: "admin", label: "Administrador (Acceso total)" },
];

export function UsuariosTabContent({
  showToast,
  onTotalCountChange,
  refreshTrigger = 0,
}: UsuariosTabContentProps) {
  const { availableAsesores } = useAsesor();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");

  // Modal create/edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [saving, setSaving] = useState(false);

  // Form states
  const [formNombre, setFormNombre] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRol, setFormRol] = useState<AppUserRole>("asesor");
  const [formColaborador, setFormColaborador] = useState("");
  const [formActivo, setFormActivo] = useState(true);

  // Delete modal confirmation
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    id: string;
    nombre: string;
  } | null>(null);

  const { user, isLoading: userLoading, impersonate } = useUser();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const onTotalCountChangeRef = useRef(onTotalCountChange);
  onTotalCountChangeRef.current = onTotalCountChange;

  const loadUsers = useCallback(async () => {
    if (userLoading) return;
    if (!user || (user.rol !== "admin" && !user.isImpersonated)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await getAppUsers();
      if (res.success && res.users) {
        setUsers(res.users);
        if (onTotalCountChangeRef.current) onTotalCountChangeRef.current(res.users.length);
      } else {
        showToastRef.current(res.error || "Error al cargar usuarios", "error");
      }
    } catch {
      showToastRef.current("Error de conexión al cargar usuarios", "error");
    } finally {
      setLoading(false);
    }
  }, [user, userLoading]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers, refreshTrigger]);

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormNombre("");
    setFormEmail("");
    setFormPassword("");
    setFormRol("asesor");
    setFormColaborador("");
    setFormActivo(true);
    setModalOpen(true);
  };

  const handleOpenEdit = (user: AppUser) => {
    setEditingUser(user);
    setFormNombre(user.nombre);
    setFormEmail(user.email);
    setFormPassword(""); // Empty means unchanged
    setFormRol(user.rol);
    setFormColaborador(user.colaboradorId || user.nombre);
    setFormActivo(user.activo);
    setModalOpen(true);
  };

  const handleSelectColaborador = (colaboradorName: string) => {
    setFormColaborador(colaboradorName);
    if (!formNombre) {
      setFormNombre(colaboradorName);
    }
    if (!formEmail && colaboradorName) {
      const clean = colaboradorName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, ".");
      setFormEmail(`${clean}@powerlink.com`);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail.trim() || !formNombre.trim()) {
      showToast("El correo y el nombre son obligatorios", "error");
      return;
    }

    if (!editingUser && (!formPassword || formPassword.length < 6)) {
      showToast("La contraseña debe tener al menos 6 caracteres", "error");
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        const payload: any = {
          email: formEmail,
          nombre: formNombre,
          rol: formRol,
          colaboradorId: formColaborador,
          activo: formActivo,
        };
        if (formPassword && formPassword.length >= 6) {
          payload.password = formPassword;
        }

        const res = await updateAppUser(editingUser.id, payload);
        if (res.success) {
          showToast(`Usuario "${formNombre}" actualizado exitosamente`);
          setModalOpen(false);
          loadUsers();
        } else {
          showToast(res.error || "Error al actualizar usuario", "error");
        }
      } else {
        const res = await createAppUser({
          email: formEmail,
          nombre: formNombre,
          password: formPassword,
          rol: formRol,
          colaboradorId: formColaborador,
        });

        if (res.success) {
          showToast(`Usuario "${formNombre}" creado exitosamente`);
          setModalOpen(false);
          loadUsers();
        } else {
          showToast(res.error || "Error al crear usuario", "error");
        }
      }
    } catch {
      showToast("Error de conexión al guardar usuario", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    try {
      const res = await deleteAppUser(deleteDialog.id);
      if (res.success) {
        showToast(`Usuario "${deleteDialog.nombre}" eliminado`);
        setDeleteDialog(null);
        loadUsers();
      } else {
        showToast(res.error || "Error al eliminar usuario", "error");
      }
    } catch {
      showToast("Error de conexión al eliminar usuario", "error");
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = users.length;
    const asesores = users.filter((u) => u.rol === "asesor").length;
    const supervisores = users.filter((u) => u.rol === "supervisor" || u.rol === "impulsador").length;
    const admins = users.filter((u) => u.rol === "admin").length;
    return { total, asesores, supervisores, admins };
  }, [users]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.nombre.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (u.colaboradorId && u.colaboradorId.toLowerCase().includes(searchQuery.toLowerCase().trim()));

      if (!matchesSearch) return false;
      if (filterRole === "all") return true;
      return u.rol === filterRole;
    });
  }, [users, searchQuery, filterRole]);

  const colaboradorOptions = useMemo(() => {
    return availableAsesores.map((nombre) => ({
      value: nombre,
      label: nombre,
    }));
  }, [availableAsesores]);

  if (!userLoading && (!user || (user.rol !== "admin" && !user.isImpersonated))) {
    return (
      <div className="py-16 px-4 text-center space-y-3 font-sans">
        <p className="text-xs text-neutral-500 font-sans">
          Para ver y gestionar los usuarios del sistema, debes iniciar sesión con una cuenta de Administrador.
        </p>
        <div>
          <Link
            href="/login"
            className="inline-block text-xs font-semibold text-neutral-900 underline hover:text-neutral-600 transition-colors cursor-pointer font-sans"
          >
            Iniciar sesión como Administrador
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumen tipográfico limpio - Cero cuadros, solo métricas tipográficas y líneas difuminadas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 py-1 sm:py-2">
        <div className="flex flex-col py-0.5">
          <span className="text-[11px] sm:text-xs font-normal text-neutral-500 font-sans">Total usuarios</span>
          <span className="text-lg sm:text-xl font-bold tracking-tight text-neutral-950 mt-0.5 font-mono">
            {metrics.total}
          </span>
        </div>
        <div className="flex flex-col py-0.5">
          <span className="text-[11px] sm:text-xs font-normal text-neutral-500 font-sans">Asesores de campo</span>
          <span className="text-lg sm:text-xl font-bold tracking-tight text-neutral-950 mt-0.5 font-mono">
            {metrics.asesores}
          </span>
        </div>
        <div className="flex flex-col py-0.5">
          <span className="text-[11px] sm:text-xs font-normal text-neutral-500 font-sans">Supervisión e impulso</span>
          <span className="text-lg sm:text-xl font-bold tracking-tight text-neutral-950 mt-0.5 font-mono">
            {metrics.supervisores}
          </span>
        </div>
        <div className="flex flex-col py-0.5">
          <span className="text-[11px] sm:text-xs font-normal text-neutral-500 font-sans">Administradores</span>
          <span className="text-lg sm:text-xl font-bold tracking-tight text-neutral-950 mt-0.5 font-mono">
            {metrics.admins}
          </span>
        </div>
      </div>

      {/* Blurred gradient line separator */}
      <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-neutral-200 to-transparent pointer-events-none" />

      {/* Action Bar: Search, Role Filter, and New User Action */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-4 flex-1">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre o correo..."
              className="w-full pl-6 pr-2 py-1.5 text-sm sm:text-xs bg-transparent border-b border-neutral-200 focus:border-neutral-900 text-neutral-900 placeholder:text-neutral-400 focus:outline-none transition-colors font-sans"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 sm:w-48 sm:flex-initial">
              <CustomDropdown
                value={filterRole}
                onChange={setFilterRole}
                options={[
                  { value: "all", label: "Todos los roles" },
                  { value: "asesor", label: "Asesores" },
                  { value: "supervisor", label: "Supervisores" },
                  { value: "impulsador", label: "Impulsadores" },
                  { value: "admin", label: "Administradores" },
                ]}
                placeholder="Filtrar rol"
              />
            </div>

            {/* Mobile refresh */}
            <button
              type="button"
              onClick={loadUsers}
              disabled={loading}
              className="sm:hidden min-w-[44px] min-h-[44px] p-2.5 text-neutral-400 hover:text-neutral-900 transition-colors flex items-center justify-center cursor-pointer shrink-0"
              title="Refrescar lista"
            >
              <RotateCw className={cn("w-3.5 h-3.5 stroke-[1.5]", loading && "animate-spin text-neutral-900")} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-0.5 sm:pt-0">
          <button
            type="button"
            onClick={loadUsers}
            disabled={loading}
            className="hidden sm:inline-flex min-w-[40px] min-h-[40px] p-2 items-center justify-center text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
            title="Refrescar lista"
          >
            <RotateCw className={cn("w-4 h-4 stroke-[1.5]", loading && "animate-spin text-neutral-900")} />
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="min-h-[44px] py-2 px-2.5 flex items-center gap-1.5 text-xs font-semibold text-neutral-950 hover:text-neutral-500 transition-colors cursor-pointer select-none ml-auto sm:ml-0"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2]" />
            <span>Nuevo usuario</span>
          </button>
        </div>
      </div>

      {/* Desktop Table of Users */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs font-sans">
          <thead>
            <tr className="border-b border-neutral-200/80 text-neutral-400 font-normal text-[11px] select-none">
              <th className="py-2.5 pr-4 font-normal">Colaborador / Nombre</th>
              <th className="py-2.5 px-4 font-normal">Correo o usuario</th>
              <th className="py-2.5 px-4 font-normal">Rol asignado</th>
              <th className="py-2.5 px-4 font-normal">Alcance de acceso</th>
              <th className="py-2.5 px-4 font-normal">Estado</th>
              <th className="py-2.5 pl-4 text-right font-normal">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
              {filteredUsers.map((u) => {
                const roleBadge =
                  u.rol === "admin"
                    ? { label: "Administrador", access: "Total (Paneles + Admin)", class: "text-neutral-900 font-bold" }
                    : u.rol === "supervisor"
                    ? { label: "Supervisor", access: "Solo 3 paneles principales", class: "text-neutral-800 font-medium" }
                    : u.rol === "impulsador"
                    ? { label: "Asesor impulsador", access: "Solo 3 paneles principales", class: "text-neutral-800 font-medium" }
                    : { label: "Asesor comercial", access: "Solo Operaciones de campo", class: "text-neutral-600 font-normal" };

                return (
                  <tr
                    key={u.id}
                    className="hover:bg-neutral-50/50 transition-colors group"
                  >
                    <td className="py-2.5 px-4 font-semibold text-neutral-900">
                      <div className="flex flex-col">
                        <span>{u.nombre}</span>
                        {u.colaboradorId && u.colaboradorId !== u.nombre && (
                          <span className="text-[10px] text-neutral-400 font-normal">
                            Vinculado: {u.colaboradorId}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-neutral-600 font-mono text-[11px]">
                      {u.email}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={roleBadge.class}>{roleBadge.label}</span>
                    </td>
                    <td className="py-2.5 px-4 text-neutral-500 text-[11px]">
                      {roleBadge.access}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-[11px] font-medium",
                          u.activo ? "text-neutral-800" : "text-neutral-400"
                        )}
                      >
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            u.activo ? "bg-emerald-500" : "bg-neutral-300"
                          )}
                        />
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {u.id !== user?.id && u.activo && (
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await impersonate(u.id);
                              if (!res.success) {
                                showToast(res.error || "No se pudo cambiar de perfil", "error");
                              }
                            }}
                            className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-1"
                            title={`Ingresar como ${u.nombre} (${roleBadge.label})`}
                          >
                            <LogIn className="w-3.5 h-3.5 stroke-[1.5]" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(u)}
                          className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                          title="Editar usuario"
                        >
                          <PenLine className="w-3.5 h-3.5 stroke-[1.25]" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteDialog({
                              isOpen: true,
                              id: u.id,
                              nombre: u.nombre,
                            })
                          }
                          className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                          title="Eliminar usuario"
                        >
                          <X className="w-3.5 h-3.5 stroke-[1.5]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredUsers.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-neutral-400">
                    No se encontraron usuarios registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      {/* Mobile Card List of Users - Optimized for phone screens without horizontal scroll */}
      <div className="md:hidden divide-y divide-neutral-100">
        {filteredUsers.map((u) => {
          const roleBadge =
            u.rol === "admin"
              ? { label: "Administrador", access: "Total (Paneles + Admin)", class: "text-neutral-950 font-bold" }
              : u.rol === "supervisor"
              ? { label: "Supervisor", access: "Solo 3 paneles", class: "text-neutral-800 font-medium" }
              : u.rol === "impulsador"
              ? { label: "Impulsador", access: "Solo 3 paneles", class: "text-neutral-800 font-medium" }
              : { label: "Asesor", access: "Operaciones de campo", class: "text-neutral-600 font-normal" };

          return (
            <div key={u.id} className="py-3.5 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-neutral-950 text-xs">{u.nombre}</span>
                    <span className={cn("text-[10px] px-1.5 py-0.2 rounded bg-neutral-100", roleBadge.class)}>
                      {roleBadge.label}
                    </span>
                  </div>
                  <span className="text-neutral-500 font-mono text-[11px] block mt-0.5 break-all">
                    {u.email}
                  </span>
                  {u.colaboradorId && u.colaboradorId !== u.nombre && (
                    <span className="text-[10px] text-neutral-400 block mt-0.5">
                      Vinculado: {u.colaboradorId}
                    </span>
                  )}
                </div>

                {/* Direct Touch Action Buttons (Visible on mobile, no hover dependency) */}
                <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                  {u.id !== user?.id && u.activo && (
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await impersonate(u.id);
                        if (!res.success) {
                          showToast(res.error || "No se pudo cambiar de perfil", "error");
                        }
                      }}
                      className="min-h-[36px] px-2 text-neutral-800 hover:text-neutral-950 transition-colors flex items-center gap-1 cursor-pointer text-xs font-semibold select-none"
                      title={`Ingresar como ${u.nombre}`}
                      aria-label={`Ingresar como ${u.nombre}`}
                    >
                      <LogIn className="w-3.5 h-3.5 stroke-[2] text-neutral-900" />
                      <span>Ingresar</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(u)}
                    className="min-w-[36px] min-h-[36px] p-2 text-neutral-400 hover:text-neutral-900 transition-colors flex items-center justify-center cursor-pointer"
                    title="Editar usuario"
                    aria-label="Editar usuario"
                  >
                    <PenLine className="w-3.5 h-3.5 stroke-[1.25]" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteDialog({
                        isOpen: true,
                        id: u.id,
                        nombre: u.nombre,
                      })
                    }
                    className="min-w-[36px] min-h-[36px] p-2 text-neutral-400 hover:text-neutral-900 transition-colors flex items-center justify-center cursor-pointer"
                    title="Eliminar usuario"
                    aria-label="Eliminar usuario"
                  >
                    <X className="w-3.5 h-3.5 stroke-[1.5]" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-0.5 border-t border-neutral-50">
                <span>{roleBadge.access}</span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      u.activo ? "bg-emerald-500" : "bg-neutral-300"
                    )}
                  />
                  <span className={u.activo ? "text-neutral-700 font-medium" : "text-neutral-400"}>
                    {u.activo ? "Activo" : "Inactivo"}
                  </span>
                </span>
              </div>
            </div>
          );
        })}

        {filteredUsers.length === 0 && !loading && (
          <div className="py-8 text-center text-xs text-neutral-400">
            No se encontraron usuarios registrados
          </div>
        )}
      </div>

      {/* CREATE / EDIT USER MODAL (Rule 4: In-app modal) */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/20 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-white rounded-xl shadow-xl p-4 sm:p-6 space-y-5 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3">
              <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">
                {editingUser ? "Editar usuario y acceso" : "Crear nuevo acceso de usuario"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 stroke-[1.5]" />
              </button>
            </div>

            {/* Blurred line */}
            <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-neutral-200 to-transparent" />

            <form onSubmit={handleSave} className="space-y-4">
              {/* Vincular colaborador selector */}
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-neutral-500">
                  Vincular a colaborador existente
                </label>
                <CustomDropdown
                  value={formColaborador}
                  onChange={handleSelectColaborador}
                  options={colaboradorOptions}
                  placeholder="Selecciona un colaborador del equipo..."
                  searchPlaceholder="Buscar colaborador por nombre..."
                />
                <span className="text-[10px] text-neutral-400 block pt-0.5">
                  Selecciona el colaborador para vincular sus reportes y fijar su sesión.
                </span>
              </div>

              {/* Nombre completo */}
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-neutral-500">
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  placeholder="Ej: Gabriela Marrero"
                  className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-300 focus:outline-none transition-colors"
                />
              </div>

              {/* Correo / Usuario */}
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-neutral-500">
                  Correo electrónico o identificador de acceso
                </label>
                <input
                  type="text"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="gabriela@powerlink.com"
                  className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-300 focus:outline-none transition-colors"
                />
              </div>

              {/* Contraseña */}
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-neutral-500">
                  {editingUser ? "Nueva contraseña (dejar en blanco para mantener)" : "Contraseña de acceso"}
                </label>
                <input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={editingUser ? "Mantener contraseña actual" : "Mínimo 6 caracteres"}
                  className="w-full bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-300 focus:outline-none transition-colors"
                />
              </div>

              {/* Rol */}
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-neutral-500">
                  Tipo de usuario y restricciones
                </label>
                <CustomDropdown
                  value={formRol}
                  onChange={(val) => setFormRol(val as AppUserRole)}
                  options={ROLE_OPTIONS}
                  placeholder="Selecciona el rol"
                />
              </div>

              {/* Activo / Inactivo */}
              {editingUser && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-neutral-500 font-medium">Estado de la cuenta</span>
                  <button
                    type="button"
                    onClick={() => setFormActivo(!formActivo)}
                    className={cn(
                      "text-xs font-medium transition-colors cursor-pointer",
                      formActivo ? "text-emerald-700" : "text-neutral-400"
                    )}
                  >
                    {formActivo ? "Habilitada (Activo)" : "Deshabilitada (Inactivo)"}
                  </button>
                </div>
              )}

              {/* Blurred line before buttons */}
              <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-neutral-200 to-transparent pt-1" />

              {/* Modal footer buttons (Rule 1: clean words) */}
              <div className="flex items-center justify-end gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="text-xs text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="text-xs font-semibold text-neutral-950 hover:text-neutral-500 transition-colors cursor-pointer"
                >
                  {saving ? "Guardando..." : editingUser ? "Actualizar usuario" : "Crear usuario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG (Rule 4: In-app modal) */}
      <DeleteConfirmDialog
        isOpen={!!deleteDialog}
        title="Eliminar acceso de usuario"
        description={`¿Estás seguro de que deseas eliminar la cuenta de "${deleteDialog?.nombre}"? El colaborador ya no podrá iniciar sesión en la plataforma.`}
        confirmLabel="Eliminar usuario"
        cancelLabel="Cancelar"
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog(null)}
      />
    </div>
  );
}

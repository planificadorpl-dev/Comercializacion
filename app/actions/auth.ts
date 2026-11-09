"use server";

import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { query, queryRow } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export type AppUserRole = "admin" | "supervisor" | "impulsador" | "asesor";

export interface AppUser {
  id: string;
  email: string;
  nombre: string;
  rol: AppUserRole;
  colaboradorId?: string;
  activo: boolean;
  createdAt: string;
  lastLogin?: string;
  isImpersonated?: boolean;
  impersonatorAdminId?: string;
  impersonatorAdminName?: string;
  customAccess?: boolean;
  allowedModules?: string[];
}

interface StoredUser extends AppUser {
  passwordHash: string;
}

const USERS_FILE_PATH = path.join(process.cwd(), "data", "users.json");
const SESSION_COOKIE_NAME = "ventas_auth_session";
const IMPERSONATOR_COOKIE_NAME = "ventas_auth_impersonator";
const SESSION_SECRET = process.env.AUTH_SECRET || "powerlink-super-secure-auth-secret-key-2026";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${key}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(":");
    if (!salt || !key) return false;
    const attempt = crypto.scryptSync(password, salt, 64).toString("hex");
    return attempt === key;
  } catch {
    return false;
  }
}

function signSession(userId: string): string {
  const hmac = crypto.createHmac("sha256", SESSION_SECRET).update(userId).digest("hex");
  return `${userId}.${hmac}`;
}

function verifySession(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [userId, hmac] = parts;
    const expected = crypto.createHmac("sha256", SESSION_SECRET).update(userId).digest("hex");
    if (hmac !== expected) return null;
    return userId;
  } catch {
    return null;
  }
}

function sanitizeUser(u: StoredUser): AppUser {
  const { passwordHash, ...safe } = u;
  return safe;
}

function rowToStoredUser(row: any): StoredUser {
  let allowedModules: string[] | undefined = undefined;
  if (Array.isArray(row.allowed_modules)) {
    allowedModules = row.allowed_modules;
  } else if (typeof row.allowed_modules === "string") {
    try {
      allowedModules = JSON.parse(row.allowed_modules);
    } catch {}
  }

  return {
    id: row.id,
    email: row.email,
    nombre: row.nombre,
    rol: row.rol as AppUserRole,
    colaboradorId: row.colaborador_id || undefined,
    activo: row.activo !== false,
    passwordHash: row.password_hash || "",
    createdAt: row.created_at || new Date().toISOString(),
    lastLogin: row.last_login || undefined,
    customAccess: Boolean(row.custom_access),
    allowedModules,
  };
}

function storedUserToRow(u: StoredUser): any {
  return {
    id: u.id,
    email: u.email.toLowerCase().trim(),
    nombre: u.nombre.trim(),
    rol: u.rol,
    colaborador_id: u.colaboradorId || null,
    activo: u.activo,
    password_hash: u.passwordHash,
    created_at: u.createdAt,
    last_login: u.lastLogin || null,
    custom_access: Boolean(u.customAccess),
    allowed_modules: u.allowedModules || null,
  };
}

// ─── LOCAL STORAGE FALLBACK ───────────────────────────────────────────────

async function readUsersLocal(): Promise<StoredUser[]> {
  try {
    const content = await fs.readFile(USERS_FILE_PATH, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function writeUsersLocal(users: StoredUser[]): Promise<void> {
  if (process.env.VERCEL) return;
  try {
    await fs.mkdir(path.dirname(USERS_FILE_PATH), { recursive: true });
    await fs.writeFile(USERS_FILE_PATH, JSON.stringify(users, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not write local users cache:", err);
  }
}

// ─── DATA RETRIEVAL (POSTGRESQL FIRST, SUPABASE/LOCAL FALLBACK) ───────────

async function readUsers(): Promise<StoredUser[]> {
  // 1. Try Native PostgreSQL First
  try {
    try {
      await query("ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS custom_access BOOLEAN DEFAULT false;");
      await query("ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS allowed_modules TEXT[];");
    } catch {}

    const rows = await query("SELECT * FROM public.usuarios ORDER BY created_at ASC");
    if (Array.isArray(rows) && rows.length > 0) {
      const parsed = rows.map(rowToStoredUser);
      writeUsersLocal(parsed).catch(() => {});
      return parsed;
    }
  } catch (pgErr) {}

  // 2. Try Supabase fallback
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("usuarios")
      .select("*")
      .order("created_at", { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      const parsed = data.map(rowToStoredUser);
      writeUsersLocal(parsed).catch(() => {});
      return parsed;
    }
  } catch (err) {
    console.warn("Supabase read failed, reading from local cache:", err);
  }

  return readUsersLocal();
}

// ─── AUTHENTICATION ACTIONS ───────────────────────────────────────────────

export async function loginUser(credentials: {
  emailOrUsername: string;
  password: string;
}): Promise<{ success: boolean; user?: AppUser; error?: string }> {
  try {
    const cleanIdentifier = credentials.emailOrUsername.toLowerCase().trim();
    const users = await readUsers();

    const user = users.find((u) => {
      const email = u.email.toLowerCase().trim();
      const nombre = u.nombre.toLowerCase().trim();
      const cedula = u.id.replace(/^usr-/, "").toLowerCase().trim();
      const colab = u.colaboradorId ? u.colaboradorId.toLowerCase().trim() : "";
      const normInput = cleanIdentifier.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const normNombre = nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const normColab = colab.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      return (
        email === cleanIdentifier ||
        nombre === cleanIdentifier ||
        cedula === cleanIdentifier ||
        colab === cleanIdentifier ||
        normNombre === normInput ||
        (normColab !== "" && normColab === normInput)
      );
    });

    if (!user) {
      return { success: false, error: "Credenciales incorrectas" };
    }

    if (!user.activo) {
      return { success: false, error: "Esta cuenta está inactiva. Contacte al administrador" };
    }

    const isValid = verifyPassword(credentials.password, user.passwordHash);
    if (!isValid) {
      return { success: false, error: "Credenciales incorrectas" };
    }

    // Update lastLogin
    user.lastLogin = new Date().toISOString();

    // 1. Update in PostgreSQL
    try {
      await query("UPDATE public.usuarios SET last_login = NOW() WHERE id = $1", [user.id]);
    } catch {}

    // 2. Update in Supabase
    try {
      const supabase = await createClient();
      await supabase
        .from("usuarios")
        .update({ last_login: user.lastLogin })
        .eq("id", user.id);
    } catch (e) {}

    // 3. Update local cache
    await writeUsersLocal(users);

    // Set signed HTTP-only cookie
    const token = signSession(user.id);
    const cookieStore = await cookies();
    const isExplicitSecure = process.env.COOKIE_SECURE === "true";
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isExplicitSecure, // Crucial: must be false on HTTP / LAN IP (http://192.168.x.x:3001) so mobile browsers don't discard it
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return { success: true, user: sanitizeUser(user) };
  } catch (err: any) {
    console.error("Login error:", err);
    return { success: false, error: "Error en el servidor al iniciar sesión" };
  }
}

export async function logoutUser(): Promise<{ success: boolean }> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
    cookieStore.set(IMPERSONATOR_COOKIE_NAME, "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
    return { success: true };
  } catch {
    return { success: true };
  }
}

export async function getCurrentSessionUser(): Promise<AppUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const userId = verifySession(token);
    if (!userId) return null;

    let targetUser: AppUser | null = null;

    // 1. Try PostgreSQL first
    try {
      const row = await queryRow("SELECT * FROM public.usuarios WHERE id = $1 AND activo = true", [userId]);
      if (row) {
        targetUser = sanitizeUser(rowToStoredUser(row));
      }
    } catch {}

    // 2. Try Supabase
    if (!targetUser) {
      try {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("usuarios")
          .select("*")
          .eq("id", userId)
          .eq("activo", true)
          .single();

        if (!error && data) {
          targetUser = sanitizeUser(rowToStoredUser(data));
        }
      } catch {}
    }

    // 3. Fallback to local cache
    if (!targetUser) {
      const users = await readUsersLocal();
      const user = users.find((u) => u.id === userId && u.activo);
      if (user) {
        targetUser = sanitizeUser(user);
      }
    }

    if (!targetUser) return null;

    // Check if currently impersonating
    const impersonatorToken = cookieStore.get(IMPERSONATOR_COOKIE_NAME)?.value;
    if (impersonatorToken) {
      const adminId = verifySession(impersonatorToken);
      if (adminId) {
        targetUser.isImpersonated = true;
        targetUser.impersonatorAdminId = adminId;
        // Lookup admin name
        try {
          const adminRow = await queryRow("SELECT nombre FROM public.usuarios WHERE id = $1", [adminId]);
          if (adminRow?.nombre) {
            targetUser.impersonatorAdminName = adminRow.nombre;
          }
        } catch {}
      }
    }

    return targetUser;
  } catch {
    return null;
  }
}

// ─── IMPERSONATION / PERFIL SWITCH ACTIONS ───────────────────────────────

export async function impersonateUser(targetUserId: string): Promise<{
  success: boolean;
  user?: AppUser;
  error?: string;
}> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const impersonatorToken = cookieStore.get(IMPERSONATOR_COOKIE_NAME)?.value;

    let adminId: string | null = null;
    if (impersonatorToken) {
      adminId = verifySession(impersonatorToken);
    } else if (sessionToken) {
      adminId = verifySession(sessionToken);
    }

    if (!adminId) {
      return { success: false, error: "No hay una sesión activa para cambiar de perfil" };
    }

    const allUsers = await readUsers();
    const adminUser = allUsers.find((u) => u.id === adminId);
    if (!adminUser || adminUser.rol !== "admin" || !adminUser.activo) {
      return { success: false, error: "Solo los administradores pueden ingresar a otros perfiles" };
    }

    const targetUser = allUsers.find((u) => u.id === targetUserId);
    if (!targetUser) {
      return { success: false, error: "Usuario seleccionado no encontrado" };
    }

    if (!targetUser.activo) {
      return { success: false, error: "Este usuario se encuentra inactivo" };
    }

    const isExplicitSecure = process.env.COOKIE_SECURE === "true";

    // Store real admin in impersonator cookie
    cookieStore.set(IMPERSONATOR_COOKIE_NAME, signSession(adminUser.id), {
      httpOnly: true,
      secure: isExplicitSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    // Set session cookie to target user
    cookieStore.set(SESSION_COOKIE_NAME, signSession(targetUser.id), {
      httpOnly: true,
      secure: isExplicitSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    const safeTarget = sanitizeUser(targetUser);
    safeTarget.isImpersonated = true;
    safeTarget.impersonatorAdminId = adminUser.id;
    safeTarget.impersonatorAdminName = adminUser.nombre;

    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true, user: safeTarget };
  } catch (err: any) {
    console.error("Impersonate error:", err);
    return { success: false, error: err.message || "Error al cambiar de perfil" };
  }
}

export async function stopImpersonation(): Promise<{
  success: boolean;
  user?: AppUser;
  error?: string;
}> {
  try {
    const cookieStore = await cookies();
    const impersonatorToken = cookieStore.get(IMPERSONATOR_COOKIE_NAME)?.value;
    if (!impersonatorToken) {
      return { success: false, error: "No hay una sesión simulada activa" };
    }

    const adminId = verifySession(impersonatorToken);
    if (!adminId) {
      return { success: false, error: "Sesión de administrador no válida" };
    }

    const allUsers = await readUsers();
    const adminUser = allUsers.find((u) => u.id === adminId);
    if (!adminUser) {
      return { success: false, error: "Usuario administrador no encontrado" };
    }

    const isExplicitSecure = process.env.COOKIE_SECURE === "true";

    // Restore session cookie to admin
    cookieStore.set(SESSION_COOKIE_NAME, signSession(adminUser.id), {
      httpOnly: true,
      secure: isExplicitSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    // Clear impersonator cookie
    cookieStore.set(IMPERSONATOR_COOKIE_NAME, "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });

    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true, user: sanitizeUser(adminUser) };
  } catch (err: any) {
    console.error("Stop impersonation error:", err);
    return { success: false, error: err.message || "Error al restaurar sesión" };
  }
}

// ─── ADMIN USER MANAGEMENT ACTIONS ────────────────────────────────────────

export async function getAppUsers(): Promise<{ success: boolean; users?: AppUser[]; error?: string }> {
  try {
    const currentUser = await getCurrentSessionUser();
    if (!currentUser || (currentUser.rol !== "admin" && !currentUser.isImpersonated)) {
      return { success: false, error: "No autorizado" };
    }

    const users = await readUsers();
    return { success: true, users: users.map(sanitizeUser) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createAppUser(payload: {
  email: string;
  password: string;
  nombre: string;
  rol: AppUserRole;
  colaboradorId?: string;
  customAccess?: boolean;
  allowedModules?: string[];
}): Promise<{ success: boolean; user?: AppUser; error?: string }> {
  try {
    const currentUser = await getCurrentSessionUser();
    if (!currentUser || currentUser.rol !== "admin") {
      return { success: false, error: "Solo los administradores pueden crear usuarios" };
    }

    const cleanEmail = payload.email.toLowerCase().trim();
    const cleanNombre = payload.nombre.trim();

    if (!cleanEmail || !payload.password || !cleanNombre) {
      return { success: false, error: "Todos los campos son obligatorios" };
    }

    if (payload.password.length < 6) {
      return { success: false, error: "La contraseña debe tener al menos 6 caracteres" };
    }

    const users = await readUsers();
    const existing = users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      return { success: false, error: "Ya existe un usuario con este correo electrónico" };
    }

    const newUser: StoredUser = {
      id: `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      email: cleanEmail,
      nombre: cleanNombre,
      rol: payload.rol,
      colaboradorId: payload.colaboradorId || cleanNombre,
      activo: true,
      passwordHash: hashPassword(payload.password),
      createdAt: new Date().toISOString(),
      customAccess: Boolean(payload.customAccess),
      allowedModules: payload.customAccess && Array.isArray(payload.allowedModules) ? payload.allowedModules : undefined,
    };

    // 1. Guardar en PostgreSQL
    let pgSaved = false;
    try {
      try {
        await query("ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS custom_access BOOLEAN DEFAULT false;");
        await query("ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS allowed_modules TEXT[];");
      } catch {}

      await query(
        `INSERT INTO public.usuarios (id, email, nombre, rol, colaborador_id, activo, password_hash, created_at, custom_access, allowed_modules)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          newUser.id,
          newUser.email,
          newUser.nombre,
          newUser.rol,
          newUser.colaboradorId || null,
          newUser.activo,
          newUser.passwordHash,
          newUser.createdAt,
          newUser.customAccess || false,
          newUser.allowedModules || null,
        ]
      );
      pgSaved = true;
    } catch (pgErr) {
      console.warn("Postgres insert aviso:", pgErr);
    }

    // 2. Supabase fallback
    try {
      const supabase = await createClient();
      const row = storedUserToRow(newUser);
      await supabase.from("usuarios").insert([row]);
    } catch (dbErr) {
      if (!pgSaved) {
        console.error("Supabase & PostgreSQL failed to create user:", dbErr);
      }
    }

    // 3. Mantener copia local sincronizada
    users.push(newUser);
    await writeUsersLocal(users);

    revalidatePath("/admin");
    return { success: true, user: sanitizeUser(newUser) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateAppUser(
  id: string,
  updates: {
    email?: string;
    nombre?: string;
    rol?: AppUserRole;
    colaboradorId?: string;
    password?: string;
    activo?: boolean;
    customAccess?: boolean;
    allowedModules?: string[];
  }
): Promise<{ success: boolean; user?: AppUser; error?: string }> {
  try {
    const currentUser = await getCurrentSessionUser();
    if (!currentUser || (currentUser.rol !== "admin" && !currentUser.isImpersonated)) {
      return { success: false, error: "No autorizado" };
    }

    const users = await readUsers();
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) {
      return { success: false, error: "Usuario no encontrado" };
    }

    const target = users[index];
    const pgFields: string[] = [];
    const pgValues: any[] = [];
    let pIdx = 1;

    if (updates.email) {
      target.email = updates.email.toLowerCase().trim();
      pgFields.push(`email = $${pIdx++}`);
      pgValues.push(target.email);
    }
    if (updates.nombre) {
      target.nombre = updates.nombre.trim();
      pgFields.push(`nombre = $${pIdx++}`);
      pgValues.push(target.nombre);
    }
    if (updates.rol) {
      target.rol = updates.rol;
      pgFields.push(`rol = $${pIdx++}`);
      pgValues.push(target.rol);
    }
    if (updates.colaboradorId !== undefined) {
      target.colaboradorId = updates.colaboradorId;
      pgFields.push(`colaborador_id = $${pIdx++}`);
      pgValues.push(target.colaboradorId || null);
    }
    if (updates.activo !== undefined) {
      target.activo = updates.activo;
      pgFields.push(`activo = $${pIdx++}`);
      pgValues.push(target.activo);
    }
    if (updates.customAccess !== undefined) {
      target.customAccess = updates.customAccess;
      pgFields.push(`custom_access = $${pIdx++}`);
      pgValues.push(target.customAccess);
    }
    if (updates.allowedModules !== undefined) {
      target.allowedModules = updates.allowedModules;
      pgFields.push(`allowed_modules = $${pIdx++}`);
      pgValues.push(target.allowedModules);
    }
    if (updates.password && updates.password.trim().length >= 6) {
      target.passwordHash = hashPassword(updates.password.trim());
      pgFields.push(`password_hash = $${pIdx++}`);
      pgValues.push(target.passwordHash);
    }

    // 1. Actualizar en PostgreSQL
    if (pgFields.length > 0) {
      try {
        try {
          await query("ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS custom_access BOOLEAN DEFAULT false;");
          await query("ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS allowed_modules TEXT[];");
        } catch {}

        pgValues.push(id);
        await query(`UPDATE public.usuarios SET ${pgFields.join(", ")} WHERE id = $${pIdx}`, pgValues);
      } catch (pgErr) {
        console.warn("Postgres update aviso:", pgErr);
      }
    }

    // 2. Supabase fallback
    try {
      const supabase = await createClient();
      const supPayload: any = {};
      if (updates.email) supPayload.email = target.email;
      if (updates.nombre) supPayload.nombre = target.nombre;
      if (updates.rol) supPayload.rol = target.rol;
      if (updates.colaboradorId !== undefined) supPayload.colaborador_id = target.colaboradorId || null;
      if (updates.activo !== undefined) supPayload.activo = target.activo;
      if (updates.customAccess !== undefined) supPayload.custom_access = target.customAccess;
      if (updates.allowedModules !== undefined) supPayload.allowed_modules = target.allowedModules;
      if (updates.password && updates.password.trim().length >= 6) supPayload.password_hash = target.passwordHash;
      await supabase.from("usuarios").update(supPayload).eq("id", id);
    } catch (dbErr) {}

    // 3. Mantener copia local sincronizada
    await writeUsersLocal(users);

    revalidatePath("/admin");
    return { success: true, user: sanitizeUser(target) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteAppUser(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await getCurrentSessionUser();
    if (!currentUser || (currentUser.rol !== "admin" && !currentUser.isImpersonated)) {
      return { success: false, error: "No autorizado" };
    }

    if (currentUser.id === id) {
      return { success: false, error: "No puedes eliminar tu propio usuario en sesión" };
    }

    // 1. Eliminar en PostgreSQL
    try {
      await query("DELETE FROM public.usuarios WHERE id = $1", [id]);
    } catch (pgErr) {}

    // 2. Eliminar en Supabase
    try {
      const supabase = await createClient();
      await supabase.from("usuarios").delete().eq("id", id);
    } catch (dbErr) {}

    // 3. Mantener copia local sincronizada
    let users = await readUsersLocal();
    users = users.filter((u) => u.id !== id);
    await writeUsersLocal(users);

    revalidatePath("/admin");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

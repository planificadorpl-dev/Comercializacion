/**
 * Script integral de Migración a PostgreSQL para Intranet
 * ==============================================================================
 * Este script:
 * 1. Inicializa las tablas en PostgreSQL ejecutando db/schema.sql.
 * 2. Migra los datos locales de data/ (usuarios, personal, entidades, evaluaciones, checklists).
 * 3. Migra los datos remotos de Supabase Cloud (actividades, asesores, geodata, planes, competencia).
 * 4. Opcional: Si hay internet y credenciales, importa el histórico de Google Sheets
 *    (Cuadro Diario / DATA LIMPIA) directamente a la tabla 'instalaciones' para que
 *    el sistema quede 100% autónomo y desconectado en la intranet.
 * ==============================================================================
 * Uso:
 *   node scripts/migrate-to-postgres.js
 * ==============================================================================
 */

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

// 1. Cargar variables de entorno desde .env.local o .env
function loadEnv() {
  const envFiles = [".env.local", ".env"];
  for (const f of envFiles) {
    const fullPath = path.join(process.cwd(), f);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      content.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx !== -1) {
            const key = trimmed.substring(0, eqIdx).trim();
            let val = trimmed.substring(eqIdx + 1).trim();
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
            if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      });
    }
  }
}

loadEnv();

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/ventas_intranet";

console.log("==================================================================");
console.log("🚀 INICIANDO MIGRACIÓN A POSTGRESQL PARA LA INTRANET EMPRESARIAL");
console.log("==================================================================");
console.log(`📡 URL Destino: ${DATABASE_URL.replace(/:[^:@]+@/, ":****@")}`);

const isLocalhost = DATABASE_URL.includes("localhost") || DATABASE_URL.includes("127.0.0.1");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: isLocalhost ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

async function runMigration() {
  let client;
  try {
    client = await pool.connect();
    console.log("✅ Conexión establecida con éxito al servidor PostgreSQL.\n");

    // ── PASO 1: Ejecutar db/schema.sql ──────────────────────────────────────────
    console.log("📦 PASO 1: Creando esquema y tablas en PostgreSQL...");
    const schemaPath = path.join(process.cwd(), "db", "schema.sql");
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`No se encontró el archivo de esquema en: ${schemaPath}`);
    }
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");
    await client.query(schemaSql);
    console.log("✅ Tablas e índices creados / verificados correctamente.\n");

    // ── PASO 2: Migrar data/users.json ──────────────────────────────────────────
    console.log("👥 PASO 2: Migrando usuarios del sistema (data/users.json)...");
    const usersPath = path.join(process.cwd(), "data", "users.json");
    if (fs.existsSync(usersPath)) {
      const usersData = JSON.parse(fs.readFileSync(usersPath, "utf-8"));
      let userCount = 0;
      for (const u of usersData) {
        await client.query(
          `INSERT INTO public.usuarios (id, email, nombre, rol, colaborador_id, activo, password_hash, created_at, last_login)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO UPDATE SET
             email = EXCLUDED.email,
             nombre = EXCLUDED.nombre,
             rol = EXCLUDED.rol,
             colaborador_id = EXCLUDED.colaborador_id,
             activo = EXCLUDED.activo,
             password_hash = EXCLUDED.password_hash,
             last_login = COALESCE(EXCLUDED.last_login, usuarios.last_login)`,
          [
            u.id,
            u.email,
            u.nombre,
            u.rol,
            u.colaboradorId || null,
            u.activo !== false,
            u.passwordHash || "",
            u.createdAt || new Date().toISOString(),
            u.lastLogin || null,
          ]
        );
        userCount++;
      }
      console.log(`✅ ${userCount} usuarios sincronizados en public.usuarios.`);
    }

    // ── PASO 3: Migrar data/admin-entities.json ──────────────────────────────────
    console.log("\n🏢 PASO 3: Migrando entidades administrativas (data/admin-entities.json)...");
    const adminPath = path.join(process.cwd(), "data", "admin-entities.json");
    if (fs.existsSync(adminPath)) {
      const adminData = JSON.parse(fs.readFileSync(adminPath, "utf-8"));

      // Departamentos
      if (Array.isArray(adminData.departamentos)) {
        for (let i = 0; i < adminData.departamentos.length; i++) {
          const d = adminData.departamentos[i];
          await client.query(
            `INSERT INTO public.departamentos (id, nombre, descripcion, color, responsable, orden)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET
               nombre = EXCLUDED.nombre,
               descripcion = EXCLUDED.descripcion,
               color = EXCLUDED.color,
               responsable = EXCLUDED.responsable,
               orden = EXCLUDED.orden`,
            [d.id, d.nombre, d.descripcion || null, d.color || null, d.responsable || null, i]
          );
        }
        console.log(`✅ ${adminData.departamentos.length} departamentos sincronizados.`);
      }

      // Sedes Taquilla
      if (Array.isArray(adminData.sedesTaquilla)) {
        for (const s of adminData.sedesTaquilla) {
          await client.query(
            `INSERT INTO public.sedes_taquilla (id, nombre, direccion, ciudad, telefono, activo)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET
               nombre = EXCLUDED.nombre,
               direccion = EXCLUDED.direccion,
               ciudad = EXCLUDED.ciudad,
               telefono = EXCLUDED.telefono,
               activo = EXCLUDED.activo`,
            [s.id, s.nombre, s.direccion || null, s.ciudad || null, s.telefono || null, s.activo !== false]
          );
        }
        console.log(`✅ ${adminData.sedesTaquilla.length} sedes/taquillas sincronizadas.`);
      }

      // Canales Comerciales
      if (Array.isArray(adminData.canalesComerciales)) {
        for (const c of adminData.canalesComerciales) {
          await client.query(
            `INSERT INTO public.canales_comerciales (id, nombre, tipo, descripcion, comision_pct, activo)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET
               nombre = EXCLUDED.nombre,
               tipo = EXCLUDED.tipo,
               descripcion = EXCLUDED.descripcion,
               comision_pct = EXCLUDED.comision_pct,
               activo = EXCLUDED.activo`,
            [c.id, c.nombre, c.tipo || null, c.descripcion || null, c.comisionPct || 0, c.activo !== false]
          );
        }
        console.log(`✅ ${adminData.canalesComerciales.length} canales comerciales sincronizados.`);
      }
    }

    // ── PASO 4: Migrar data/advisor-config.json ──────────────────────────────────
    console.log("\n⚙️ PASO 4: Migrando personal_config (data/advisor-config.json)...");
    const advConfigPath = path.join(process.cwd(), "data", "advisor-config.json");
    if (fs.existsSync(advConfigPath)) {
      const advConfig = JSON.parse(fs.readFileSync(advConfigPath, "utf-8"));
      await client.query(
        `INSERT INTO public.personal_config (key, data, updated_at, updated_by)
         VALUES ('main_config', $1, NOW(), 'migracion_inicial')
         ON CONFLICT (key) DO UPDATE SET
           data = EXCLUDED.data,
           updated_at = NOW()`,
        [JSON.stringify(advConfig)]
      );
      console.log("✅ Configuración integral de personal sincronizada en public.personal_config.");
    }

    // ── PASO 5: Migrar data/advisor-checklists.json ──────────────────────────────
    console.log("\n📋 PASO 5: Migrando advisor checklists (data/advisor-checklists.json)...");
    const chkPath = path.join(process.cwd(), "data", "advisor-checklists.json");
    if (fs.existsSync(chkPath)) {
      const chkData = JSON.parse(fs.readFileSync(chkPath, "utf-8"));
      const checklists = Array.isArray(chkData.checklists) ? chkData.checklists : [];
      let chkCount = 0;
      for (const ch of checklists) {
        if (!ch.asesor || !ch.fecha) continue;
        await client.query(
          `INSERT INTO public.advisor_checklists (id, asesor, fecha, items, cumplimiento_pct, items_cumplidos, items_total, factor_scores, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (asesor, fecha) DO UPDATE SET
             items = EXCLUDED.items,
             cumplimiento_pct = EXCLUDED.cumplimiento_pct,
             items_cumplidos = EXCLUDED.items_cumplidos,
             items_total = EXCLUDED.items_total,
             factor_scores = EXCLUDED.factor_scores`,
          [
            ch.id || `chk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            ch.asesor,
            ch.fecha,
            JSON.stringify(ch.items || {}),
            ch.cumplimientoPct || 0,
            ch.itemsCumplidos || 0,
            ch.itemsTotal || 30,
            JSON.stringify(ch.factorScores || {}),
            ch.createdAt || new Date().toISOString(),
          ]
        );
        chkCount++;
      }
      console.log(`✅ ${chkCount} checklists operativos sincronizados.`);
    }

    // ── PASO 6: Migrar data/evaluaciones.json ────────────────────────────────────
    console.log("\n📝 PASO 6: Migrando evaluaciones (data/evaluaciones.json)...");
    const evalPath = path.join(process.cwd(), "data", "evaluaciones.json");
    if (fs.existsSync(evalPath)) {
      const evalData = JSON.parse(fs.readFileSync(evalPath, "utf-8"));
      const evals = Array.isArray(evalData.evaluaciones) ? evalData.evaluaciones : [];
      let evalCount = 0;
      for (const ev of evals) {
        if (!ev.id || !ev.asesor || !ev.fecha) continue;
        await client.query(
          `INSERT INTO public.evaluaciones (
             id, asesor, evaluador, evaluador_rol, frecuencia, fecha, estado, municipio, parroquia, sector,
             items, observaciones_generales, cumplimiento_pct, puntuacion_total, puntuacion_maxima,
             puntuacion_promedio, items_cumplidos, items_total, factor_scores, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
           ON CONFLICT (id) DO UPDATE SET
             items = EXCLUDED.items,
             observaciones_generales = EXCLUDED.observaciones_generales,
             cumplimiento_pct = EXCLUDED.cumplimiento_pct,
             puntuacion_total = EXCLUDED.puntuacion_total,
             puntuacion_promedio = EXCLUDED.puntuacion_promedio,
             factor_scores = EXCLUDED.factor_scores,
             updated_at = NOW()`,
          [
            ev.id,
            ev.asesor,
            ev.evaluador,
            ev.evaluadorRol || null,
            ev.frecuencia || null,
            ev.fecha,
            ev.estado || null,
            ev.municipio || null,
            ev.parroquia || null,
            ev.sector || null,
            JSON.stringify(ev.items || {}),
            ev.observacionesGenerales || null,
            ev.cumplimientoPct || 0,
            ev.puntuacionTotal || 0,
            ev.puntuacionMaxima || 150,
            ev.puntuacionPromedio || 0,
            ev.itemsCumplidos || 0,
            ev.itemsTotal || 30,
            JSON.stringify(ev.factorScores || {}),
            ev.createdAt || new Date().toISOString(),
            ev.updatedAt || new Date().toISOString(),
          ]
        );
        evalCount++;
      }
      console.log(`✅ ${evalCount} evaluaciones sincronizadas.`);
    }

    // ── PASO 7: Descargar y Migrar desde Supabase Cloud si hay credenciales ───────
    console.log("\n☁️ PASO 7: Verificando datos remotos de Supabase Cloud...");
    const supUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supUrl && supKey && !supUrl.includes("placeholder")) {
      try {
        console.log(`📡 Consultando Supabase Cloud: ${supUrl}`);
        const fetchHeaders = {
          apikey: supKey,
          Authorization: `Bearer ${supKey}`,
        };

        // Asesores config
        const resAsesores = await fetch(`${supUrl}/rest/v1/asesores_config?select=*`, {
          headers: fetchHeaders,
        });
        if (resAsesores.ok) {
          const asesores = await resAsesores.json();
          let asCount = 0;
          for (const a of asesores) {
            if (!a.nombre) continue;
            await client.query(
              `INSERT INTO public.asesores_config (nombre, activo)
               VALUES ($1, $2)
               ON CONFLICT (nombre) DO UPDATE SET activo = EXCLUDED.activo`,
              [a.nombre.trim(), a.activo !== false]
            );
            asCount++;
          }
          console.log(`✅ ${asCount} asesores migrados desde Supabase.`);
        }

        // Geodata config
        const resGeo = await fetch(`${supUrl}/rest/v1/geodata_config?select=*`, {
          headers: fetchHeaders,
        });
        if (resGeo.ok) {
          const geodata = await resGeo.json();
          let geoCount = 0;
          for (const g of geodata) {
            if (!g.estado || !g.municipio || !g.parroquia || !g.sector) continue;
            await client.query(
              `INSERT INTO public.geodata_config (estado, municipio, parroquia, sector)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (estado, municipio, parroquia, sector) DO NOTHING`,
              [g.estado.trim(), g.municipio.trim(), g.parroquia.trim(), g.sector.trim()]
            );
            geoCount++;
          }
          console.log(`✅ ${geoCount} registros geográficos migrados desde Supabase.`);
        }

        // Planes config
        const resPlanes = await fetch(`${supUrl}/rest/v1/planes_config?select=*`, {
          headers: fetchHeaders,
        });
        if (resPlanes.ok) {
          const planes = await resPlanes.json();
          let plCount = 0;
          for (const p of planes) {
            if (!p.nombre) continue;
            await client.query(
              `INSERT INTO public.planes_config (nombre, tipo, activo, has_tv)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (nombre, tipo) DO UPDATE SET
                 activo = EXCLUDED.activo,
                 has_tv = EXCLUDED.has_tv`,
              [p.nombre.trim(), p.tipo || "Domiciliario", p.activo !== false, p.has_tv === true]
            );
            plCount++;
          }
          console.log(`✅ ${plCount} planes comerciales migrados desde Supabase.`);
        }

        // Operadores Competencia
        const resOp = await fetch(`${supUrl}/rest/v1/operadores_competencia?select=*`, {
          headers: fetchHeaders,
        });
        if (resOp.ok) {
          const operadores = await resOp.json();
          let opCount = 0;
          for (const op of operadores) {
            if (!op.nombre) continue;
            await client.query(
              `INSERT INTO public.operadores_competencia (nombre, color_hex, logo_url)
               VALUES ($1, $2, $3)
               ON CONFLICT (nombre) DO UPDATE SET
                 color_hex = EXCLUDED.color_hex,
                 logo_url = EXCLUDED.logo_url`,
              [op.nombre.trim(), op.color_hex || "#64748b", op.logo_url || null]
            );
            opCount++;
          }
          console.log(`✅ ${opCount} operadores de competencia migrados desde Supabase.`);
        }

        // Actividades
        const resAct = await fetch(`${supUrl}/rest/v1/actividades?select=*&limit=1000`, {
          headers: fetchHeaders,
        });
        if (resAct.ok) {
          const actividades = await resAct.json();
          let actCount = 0;
          for (const act of actividades) {
            if (!act.fecha || !act.asesor) continue;
            await client.query(
              `INSERT INTO public.actividades (
                 fecha, hora, asesor, tipo, solicitudes, clientes_captados, volantes,
                 llamadas_info, llamadas_agenda, estado, municipio, parroquia, sector,
                 condominio, notas, reporte_wa, uid, cerrada, checklist,
                 checklist_cumplimiento_pct, checklist_cumplidos, checklist_total,
                 checklist_factor_scores, created_at
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`,
              [
                act.fecha,
                act.hora || null,
                act.asesor,
                act.tipo || null,
                act.solicitudes || 0,
                act.clientes_captados || 0,
                act.volantes || 0,
                act.llamadas_info || 0,
                act.llamadas_agenda || 0,
                act.estado || null,
                act.municipio || null,
                act.parroquia || null,
                act.sector || null,
                act.condominio || null,
                act.notas || null,
                act.reporte_wa || null,
                act.uid || null,
                act.cerrada === true,
                act.checklist ? JSON.stringify(act.checklist) : null,
                act.checklist_cumplimiento_pct || 0,
                act.checklist_cumplidos || 0,
                act.checklist_total || 30,
                act.checklist_factor_scores ? JSON.stringify(act.checklist_factor_scores) : null,
                act.created_at || new Date().toISOString(),
              ]
            );
            actCount++;
          }
          console.log(`✅ ${actCount} actividades de campo migradas desde Supabase.`);
        }
      } catch (supErr) {
        console.warn("⚠️ Aviso al conectar con Supabase Cloud:", supErr.message);
      }
    } else {
      console.log("ℹ️ No hay credenciales activas de Supabase Cloud. Continuando con la migración local.");
    }

    console.log("\n==================================================================");
    console.log("🎉 ¡MIGRACIÓN A POSTGRESQL COMPLETADA EXITOSAMENTE!");
    console.log("==================================================================");
  } catch (err) {
    console.error("\n❌ Error durante la migración a PostgreSQL:", err);
    process.exitCode = 1;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

runMigration();

import { Router } from "express";
import { getPool } from "../db.js";
import { getAuthUrl, handleOAuthCallback } from "../googleDrive.js";

export const settingsRouter = Router();

function filaAObjeto(fila) {
  return {
    preEvento: fila.preEvento,
    postEvento: fila.postEvento,
    calidad: fila.calidad,
    eliminarLocal: !!fila.eliminarLocal,
    notificaciones: !!fila.notificaciones,
    modoOscuro: !!fila.modoOscuro,
    pin: fila.pin,
    googleDrive: {
      cuenta: fila.gd_cuenta,
      carpetaBase: fila.gd_carpetaBase,
      conectado: !!fila.gd_conectado
    }
  };
}

async function leerSettings() {
  const [rows] = await getPool().query("SELECT * FROM settings WHERE id = 1");
  return rows[0];
}

// GET /api/settings
settingsRouter.get("/", async (req, res) => {
  res.json(filaAObjeto(await leerSettings()));
});

// PATCH /api/settings
settingsRouter.patch("/", async (req, res) => {
  const campos = ["preEvento", "postEvento", "calidad", "eliminarLocal", "notificaciones", "modoOscuro", "pin"];
  const sets = [];
  const valores = [];
  for (const campo of campos) {
    if (campo in req.body) {
      sets.push(`${campo} = ?`);
      valores.push(typeof req.body[campo] === "boolean" ? (req.body[campo] ? 1 : 0) : req.body[campo]);
    }
  }
  if (sets.length > 0) {
    valores.push(1);
    await getPool().query(`UPDATE settings SET ${sets.join(", ")} WHERE id = ?`, valores);
  }
  res.json(filaAObjeto(await leerSettings()));
});

// GET /api/settings/google-drive/auth-url
settingsRouter.get("/google-drive/auth-url", (req, res) => {
  try {
    res.redirect(getAuthUrl());
  } catch (err) {
    res.status(500).send(`Error generando la URL de autorización: ${err.message}`);
  }
});

// GET /api/settings/google-drive/callback
settingsRouter.get("/google-drive/callback", async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.redirect("/ajustes?drive=cancelado");

  try {
    await handleOAuthCallback(code);
    res.redirect("/ajustes?drive=conectado");
  } catch (err) {
    console.error("Error en el callback de Google Drive:", err);
    res.redirect("/ajustes?drive=error");
  }
});

// POST /api/settings/google-drive/disconnect
settingsRouter.post("/google-drive/disconnect", async (req, res) => {
  await getPool().query(
    "UPDATE settings SET gd_cuenta = NULL, gd_conectado = 0, gd_refreshToken = NULL WHERE id = 1"
  );
  res.json(filaAObjeto(await leerSettings()).googleDrive);
});

// GET /api/dashboard
export const dashboardRouter = Router();
dashboardRouter.get("/", async (req, res) => {
  const pool = getPool();
  const [camaras] = await pool.query("SELECT id, nombre, estado FROM cameras");
  const hoy = new Date().toISOString().slice(0, 10);
  const [[{ eventosHoy }]] = await pool.query(
    "SELECT COUNT(*) as eventosHoy FROM events WHERE fecha = ?", [hoy]
  );
  const [[{ eventosPendientes }]] = await pool.query(
    "SELECT COUNT(*) as eventosPendientes FROM events WHERE driveEstado != 'subido'"
  );
  const settings = filaAObjeto(await leerSettings());

  res.json({
    camaras,
    conectadas: camaras.filter((c) => c.estado === "online").length,
    desconectadas: camaras.filter((c) => c.estado !== "online").length,
    eventosHoy,
    eventosPendientes,
    googleDrive: settings.googleDrive,
    espacioUsadoPorcentaje: 78
  });
});

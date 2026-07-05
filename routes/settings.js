import { Router } from "express";
import { getDb } from "../db.js";
import { getAuthUrl, handleOAuthCallback } from "../googleDrive.js";

export const settingsRouter = Router();

// GET /api/settings
settingsRouter.get("/", async (req, res) => {
  const db = await getDb();
  // Nunca exponemos el refreshToken al frontend.
  const { refreshToken, ...googleDrivePublico } = db.data.settings.googleDrive;
  res.json({ ...db.data.settings, googleDrive: googleDrivePublico });
});

// PATCH /api/settings
settingsRouter.patch("/", async (req, res) => {
  const db = await getDb();
  db.data.settings = { ...db.data.settings, ...req.body };
  await db.write();
  const { refreshToken, ...googleDrivePublico } = db.data.settings.googleDrive;
  res.json({ ...db.data.settings, googleDrive: googleDrivePublico });
});

// GET /api/settings/google-drive/auth-url
// El frontend redirige el navegador completo a esta URL (no es un fetch),
// porque Google necesita mostrar su propia pantalla de consentimiento.
settingsRouter.get("/google-drive/auth-url", (req, res) => {
  try {
    res.redirect(getAuthUrl());
  } catch (err) {
    res.status(500).send(`Error generando la URL de autorización: ${err.message}`);
  }
});

// GET /api/settings/google-drive/callback
// Google redirige aquí después de que el usuario acepta (o cancela).
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
  const db = await getDb();
  db.data.settings.googleDrive = {
    cuenta: null,
    carpetaBase: db.data.settings.googleDrive.carpetaBase ?? "SecureCam Drive",
    conectado: false,
    refreshToken: null
  };
  await db.write();
  res.json(db.data.settings.googleDrive);
});

// GET /api/dashboard — resumen para la pantalla principal
export const dashboardRouter = Router();
dashboardRouter.get("/", async (req, res) => {
  const db = await getDb();
  const hoy = new Date().toISOString().slice(0, 10);
  const eventosHoy = db.data.events.filter((e) => e.fecha === hoy);
  const { refreshToken, ...googleDrivePublico } = db.data.settings.googleDrive;

  res.json({
    camaras: db.data.cameras.map((c) => ({ id: c.id, nombre: c.nombre, estado: c.estado })),
    conectadas: db.data.cameras.filter((c) => c.estado === "online").length,
    desconectadas: db.data.cameras.filter((c) => c.estado !== "online").length,
    eventosHoy: eventosHoy.length,
    eventosPendientes: db.data.events.filter((e) => e.driveEstado !== "subido").length,
    googleDrive: googleDrivePublico,
    espacioUsadoPorcentaje: 78
  });
});

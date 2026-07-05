import { Router } from "express";
import { getDb } from "../db.js";

export const settingsRouter = Router();

// GET /api/settings
settingsRouter.get("/", async (req, res) => {
  const db = await getDb();
  res.json(db.data.settings);
});

// PATCH /api/settings
settingsRouter.patch("/", async (req, res) => {
  const db = await getDb();
  db.data.settings = { ...db.data.settings, ...req.body };
  await db.write();
  res.json(db.data.settings);
});

// POST /api/settings/google-drive/connect
settingsRouter.post("/google-drive/connect", async (req, res) => {
  const db = await getDb();
  const { cuenta } = req.body;
  db.data.settings.googleDrive = {
    ...db.data.settings.googleDrive,
    cuenta: cuenta ?? db.data.settings.googleDrive.cuenta,
    conectado: true
  };
  await db.write();
  res.json(db.data.settings.googleDrive);
});

// POST /api/settings/google-drive/disconnect
settingsRouter.post("/google-drive/disconnect", async (req, res) => {
  const db = await getDb();
  db.data.settings.googleDrive = { cuenta: null, carpetaBase: "SecureCam Drive", conectado: false };
  await db.write();
  res.json(db.data.settings.googleDrive);
});

// GET /api/dashboard — resumen para la pantalla principal
export const dashboardRouter = Router();
dashboardRouter.get("/", async (req, res) => {
  const db = await getDb();
  const hoy = new Date().toISOString().slice(0, 10);
  const eventosHoy = db.data.events.filter((e) => e.fecha === hoy);

  res.json({
    camaras: db.data.cameras.map((c) => ({ id: c.id, nombre: c.nombre, estado: c.estado })),
    conectadas: db.data.cameras.filter((c) => c.estado === "online").length,
    desconectadas: db.data.cameras.filter((c) => c.estado !== "online").length,
    eventosHoy: eventosHoy.length,
    eventosPendientes: db.data.events.filter((e) => e.driveEstado !== "subido").length,
    googleDrive: db.data.settings.googleDrive,
    espacioUsadoPorcentaje: 78
  });
});

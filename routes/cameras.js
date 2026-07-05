import { Router } from "express";
import { nanoid } from "nanoid";
import { getDb } from "../db.js";

export const camerasRouter = Router();

// GET /api/cameras
camerasRouter.get("/", async (req, res) => {
  const db = await getDb();
  res.json(db.data.cameras);
});

// GET /api/cameras/:id
camerasRouter.get("/:id", async (req, res) => {
  const db = await getDb();
  const camara = db.data.cameras.find((c) => c.id === req.params.id);
  if (!camara) return res.status(404).json({ error: "Cámara no encontrada" });
  res.json(camara);
});

// POST /api/cameras
camerasRouter.post("/", async (req, res) => {
  const db = await getDb();
  const {
    nombre,
    ip,
    puerto,
    usuario,
    contrasena,
    fabricante,
    modelo,
    rtsp,
    onvif
  } = req.body;

  if (!nombre || !ip) {
    return res.status(400).json({ error: "nombre e ip son obligatorios" });
  }

  const nuevaCamara = {
    id: `cam_${nanoid(8)}`,
    nombre,
    ip,
    puerto: puerto ?? 554,
    usuario: usuario ?? "",
    contrasena: contrasena ?? "",
    fabricante: fabricante ?? "Desconocido",
    modelo: modelo ?? "",
    rtsp: rtsp ?? `rtsp://${ip}:${puerto ?? 554}/stream1`,
    onvif: onvif ?? false,
    estado: "pendiente"
  };

  db.data.cameras.push(nuevaCamara);
  await db.write();

  req.app.get("broadcast")?.({ type: "camera_added", camera: nuevaCamara });
  res.status(201).json(nuevaCamara);
});

// PUT /api/cameras/:id — actualizar datos de una cámara
camerasRouter.put("/:id", async (req, res) => {
  const db = await getDb();
  const idx = db.data.cameras.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Cámara no encontrada" });

  db.data.cameras[idx] = { ...db.data.cameras[idx], ...req.body };
  await db.write();
  req.app.get("broadcast")?.({ type: "camera_updated", camera: db.data.cameras[idx] });
  res.json(db.data.cameras[idx]);
});

// DELETE /api/cameras/:id
camerasRouter.delete("/:id", async (req, res) => {
  const db = await getDb();
  const before = db.data.cameras.length;
  db.data.cameras = db.data.cameras.filter((c) => c.id !== req.params.id);
  await db.write();

  if (db.data.cameras.length === before) {
    return res.status(404).json({ error: "Cámara no encontrada" });
  }
  req.app.get("broadcast")?.({ type: "camera_removed", id: req.params.id });
  res.status(204).end();
});

// POST /api/cameras/discover — simula el descubrimiento ONVIF/LAN
// En producción esta acción la realiza el SecureCam Bridge en la tablet,
// que escanea la LAN y reporta aquí los resultados vía WebSocket.
camerasRouter.post("/discover", async (req, res) => {
  res.json({
    mensaje:
      "Descubrimiento delegado al SecureCam Bridge. Escuchando resultados por WebSocket (evento 'discovery_result').",
    encontradas: []
  });
});

// POST /api/cameras/:id/test — probar conexión RTSP/ONVIF
camerasRouter.post("/:id/test", async (req, res) => {
  const db = await getDb();
  const camara = db.data.cameras.find((c) => c.id === req.params.id);
  if (!camara) return res.status(404).json({ error: "Cámara no encontrada" });

  // Placeholder: la prueba real la ejecuta el Bridge contra la LAN.
  res.json({ camaraId: camara.id, resultado: "pendiente_de_bridge" });
});

import { Router } from "express";
import { nanoid } from "nanoid";
import { getPool } from "../db.js";

export const camerasRouter = Router();

// GET /api/cameras
camerasRouter.get("/", async (req, res) => {
  const [rows] = await getPool().query("SELECT * FROM cameras");
  res.json(rows);
});

// GET /api/cameras/:id
camerasRouter.get("/:id", async (req, res) => {
  const [rows] = await getPool().query("SELECT * FROM cameras WHERE id = ?", [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: "Cámara no encontrada" });
  res.json(rows[0]);
});

// POST /api/cameras
camerasRouter.post("/", async (req, res) => {
  const { nombre, ip, puerto, usuario, contrasena, fabricante, modelo, rtsp, onvif } = req.body;
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
    onvif: onvif ? 1 : 0,
    estado: "pendiente"
  };

  await getPool().query(
    `INSERT INTO cameras (id, nombre, ip, puerto, usuario, contrasena, fabricante, modelo, rtsp, onvif, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      nuevaCamara.id, nuevaCamara.nombre, nuevaCamara.ip, nuevaCamara.puerto,
      nuevaCamara.usuario, nuevaCamara.contrasena, nuevaCamara.fabricante,
      nuevaCamara.modelo, nuevaCamara.rtsp, nuevaCamara.onvif, nuevaCamara.estado
    ]
  );

  req.app.get("broadcast")?.({ type: "camera_added", camera: nuevaCamara });
  res.status(201).json(nuevaCamara);
});

// PUT /api/cameras/:id
camerasRouter.put("/:id", async (req, res) => {
  const pool = getPool();
  const [existentes] = await pool.query("SELECT * FROM cameras WHERE id = ?", [req.params.id]);
  if (existentes.length === 0) return res.status(404).json({ error: "Cámara no encontrada" });

  const actualizada = { ...existentes[0], ...req.body };
  await pool.query(
    `UPDATE cameras SET nombre=?, ip=?, puerto=?, usuario=?, contrasena=?, fabricante=?, modelo=?, rtsp=?, onvif=?, estado=? WHERE id=?`,
    [
      actualizada.nombre, actualizada.ip, actualizada.puerto, actualizada.usuario,
      actualizada.contrasena, actualizada.fabricante, actualizada.modelo,
      actualizada.rtsp, actualizada.onvif ? 1 : 0, actualizada.estado, req.params.id
    ]
  );

  req.app.get("broadcast")?.({ type: "camera_updated", camera: actualizada });
  res.json(actualizada);
});

// DELETE /api/cameras/:id
camerasRouter.delete("/:id", async (req, res) => {
  const [resultado] = await getPool().query("DELETE FROM cameras WHERE id = ?", [req.params.id]);
  if (resultado.affectedRows === 0) return res.status(404).json({ error: "Cámara no encontrada" });

  req.app.get("broadcast")?.({ type: "camera_removed", id: req.params.id });
  res.status(204).end();
});

// POST /api/cameras/discover — delegado al Bridge (sin cambios de comportamiento)
camerasRouter.post("/discover", async (req, res) => {
  res.json({
    mensaje:
      "Descubrimiento delegado al SecureCam Bridge. Escuchando resultados por WebSocket (evento 'discovery_result').",
    encontradas: []
  });
});

// POST /api/cameras/:id/test
camerasRouter.post("/:id/test", async (req, res) => {
  const [rows] = await getPool().query("SELECT * FROM cameras WHERE id = ?", [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: "Cámara no encontrada" });

  res.json({ camaraId: rows[0].id, resultado: "pendiente_de_bridge" });
});

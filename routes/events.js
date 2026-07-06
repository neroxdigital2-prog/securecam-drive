import { Router } from "express";
import { getPool } from "../db.js";

export const eventsRouter = Router();

// GET /api/events?camara=&fecha=&tipo=
eventsRouter.get("/", async (req, res) => {
  const { camara, fecha, tipo } = req.query;
  const condiciones = [];
  const valores = [];

  if (camara) { condiciones.push("camaraId = ?"); valores.push(camara); }
  if (fecha) { condiciones.push("fecha = ?"); valores.push(fecha); }
  if (tipo) { condiciones.push("tipo = ?"); valores.push(tipo); }

  const whereSql = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  const [rows] = await getPool().query(
    `SELECT * FROM events ${whereSql} ORDER BY fecha DESC, hora DESC`,
    valores
  );
  res.json(rows);
});

// GET /api/events/:id
eventsRouter.get("/:id", async (req, res) => {
  const [rows] = await getPool().query("SELECT * FROM events WHERE id = ?", [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: "Evento no encontrado" });
  res.json(rows[0]);
});

// POST /api/events
eventsRouter.post("/", async (req, res) => {
  const { camaraId, camara, tipo, duracion, miniatura } = req.body;
  if (!camaraId) return res.status(400).json({ error: "camaraId es obligatorio" });

  const ahora = new Date();
  const nuevoEvento = {
    id: `evt_${Date.now()}`,
    camaraId,
    camara: camara ?? camaraId,
    fecha: ahora.toISOString().slice(0, 10),
    hora: ahora.toTimeString().slice(0, 5),
    tipo: tipo ?? "Movimiento",
    duracion: duracion ?? 0,
    miniatura: miniatura ?? null,
    driveEstado: "subiendo",
    driveRuta: null
  };

  await getPool().query(
    `INSERT INTO events (id, camaraId, camara, fecha, hora, tipo, duracion, miniatura, driveEstado, driveRuta)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      nuevoEvento.id, nuevoEvento.camaraId, nuevoEvento.camara, nuevoEvento.fecha,
      nuevoEvento.hora, nuevoEvento.tipo, nuevoEvento.duracion, nuevoEvento.miniatura,
      nuevoEvento.driveEstado, nuevoEvento.driveRuta
    ]
  );

  req.app.get("broadcast")?.({ type: "new_event", event: nuevoEvento });
  res.status(201).json(nuevoEvento);
});

// PATCH /api/events/:id
eventsRouter.patch("/:id", async (req, res) => {
  const pool = getPool();
  const [existentes] = await pool.query("SELECT * FROM events WHERE id = ?", [req.params.id]);
  if (existentes.length === 0) return res.status(404).json({ error: "Evento no encontrado" });

  const actualizado = { ...existentes[0], ...req.body };
  await pool.query(
    `UPDATE events SET camaraId=?, camara=?, fecha=?, hora=?, tipo=?, duracion=?, miniatura=?, driveEstado=?, driveRuta=?, driveFileId=?, driveLink=? WHERE id=?`,
    [
      actualizado.camaraId, actualizado.camara, actualizado.fecha, actualizado.hora,
      actualizado.tipo, actualizado.duracion, actualizado.miniatura, actualizado.driveEstado,
      actualizado.driveRuta, actualizado.driveFileId, actualizado.driveLink, req.params.id
    ]
  );

  req.app.get("broadcast")?.({ type: "event_updated", event: actualizado });
  res.json(actualizado);
});

// DELETE /api/events/:id
eventsRouter.delete("/:id", async (req, res) => {
  const [resultado] = await getPool().query("DELETE FROM events WHERE id = ?", [req.params.id]);
  if (resultado.affectedRows === 0) return res.status(404).json({ error: "Evento no encontrado" });
  res.status(204).end();
});

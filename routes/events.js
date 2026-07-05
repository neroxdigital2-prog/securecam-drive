import { Router } from "express";
import { getDb } from "../db.js";

export const eventsRouter = Router();

// GET /api/events?camara=&fecha=&tipo=
eventsRouter.get("/", async (req, res) => {
  const db = await getDb();
  const { camara, fecha, tipo } = req.query;

  let resultado = db.data.events;
  if (camara) resultado = resultado.filter((e) => e.camaraId === camara);
  if (fecha) resultado = resultado.filter((e) => e.fecha === fecha);
  if (tipo) resultado = resultado.filter((e) => e.tipo === tipo);

  resultado = [...resultado].sort(
    (a, b) => new Date(`${b.fecha}T${b.hora}`) - new Date(`${a.fecha}T${a.hora}`)
  );

  res.json(resultado);
});

// GET /api/events/:id
eventsRouter.get("/:id", async (req, res) => {
  const db = await getDb();
  const evento = db.data.events.find((e) => e.id === req.params.id);
  if (!evento) return res.status(404).json({ error: "Evento no encontrado" });
  res.json(evento);
});

// POST /api/events — el Bridge notifica un nuevo evento grabado
eventsRouter.post("/", async (req, res) => {
  const db = await getDb();
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

  db.data.events.unshift(nuevoEvento);
  await db.write();

  req.app.get("broadcast")?.({ type: "new_event", event: nuevoEvento });
  res.status(201).json(nuevoEvento);
});

// PATCH /api/events/:id — actualizar estado de subida a Drive
eventsRouter.patch("/:id", async (req, res) => {
  const db = await getDb();
  const idx = db.data.events.findIndex((e) => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Evento no encontrado" });

  db.data.events[idx] = { ...db.data.events[idx], ...req.body };
  await db.write();
  req.app.get("broadcast")?.({ type: "event_updated", event: db.data.events[idx] });
  res.json(db.data.events[idx]);
});

// DELETE /api/events/:id
eventsRouter.delete("/:id", async (req, res) => {
  const db = await getDb();
  const before = db.data.events.length;
  db.data.events = db.data.events.filter((e) => e.id !== req.params.id);
  await db.write();

  if (db.data.events.length === before) {
    return res.status(404).json({ error: "Evento no encontrado" });
  }
  res.status(204).end();
});

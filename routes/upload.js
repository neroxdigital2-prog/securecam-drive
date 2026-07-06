import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { getPool } from "../db.js";
import { uploadClipToDrive } from "../googleDrive.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upload = multer({ dest: path.join(__dirname, "..", "tmp_uploads") });

export const uploadRouter = Router();

// POST /api/upload
uploadRouter.post("/", upload.single("archivo"), async (req, res) => {
  const { eventId } = req.body;
  if (!req.file) return res.status(400).json({ error: "Falta el archivo 'archivo'" });
  if (!eventId) return res.status(400).json({ error: "Falta eventId" });

  const pool = getPool();
  const [eventos] = await pool.query("SELECT * FROM events WHERE id = ?", [eventId]);
  if (eventos.length === 0) {
    fs.unlink(req.file.path, () => {});
    return res.status(404).json({ error: "Evento no encontrado" });
  }
  const evento = eventos[0];

  const [[settingsRow]] = await pool.query("SELECT gd_conectado, gd_carpetaBase, eliminarLocal FROM settings WHERE id = 1");
  if (!settingsRow.gd_conectado) {
    fs.unlink(req.file.path, () => {});
    return res.status(409).json({ error: "Google Drive no está conectado. Ve a Ajustes y conecta tu cuenta." });
  }

  try {
    const resultado = await uploadClipToDrive({
      localPath: req.file.path,
      filename: req.file.originalname || `${evento.id}.mp4`,
      carpetaBase: settingsRow.gd_carpetaBase,
      camara: evento.camara,
      fecha: evento.fecha instanceof Date ? evento.fecha.toISOString().slice(0, 10) : evento.fecha
    });

    await pool.query(
      "UPDATE events SET driveEstado = 'subido', driveRuta = ?, driveFileId = ?, driveLink = ? WHERE id = ?",
      [resultado.ruta, resultado.fileId, resultado.webViewLink, eventId]
    );

    if (settingsRow.eliminarLocal) {
      fs.unlink(req.file.path, () => {});
    }

    const [[eventoActualizado]] = await pool.query("SELECT * FROM events WHERE id = ?", [eventId]);
    req.app.get("broadcast")?.({ type: "event_updated", event: eventoActualizado });

    res.json({
      ok: true,
      archivo: req.file.originalname,
      tamano: req.file.size,
      driveRuta: resultado.ruta,
      driveLink: resultado.webViewLink
    });
  } catch (err) {
    console.error("Error subiendo a Google Drive:", err);
    fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: `No se pudo subir a Google Drive: ${err.message}` });
  }
});

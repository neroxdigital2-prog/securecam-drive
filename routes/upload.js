import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { getDb } from "../db.js";
import { uploadClipToDrive } from "../googleDrive.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upload = multer({ dest: path.join(__dirname, "..", "tmp_uploads") });

export const uploadRouter = Router();

// POST /api/upload
// El Bridge envía aquí el archivo MP4 grabado junto al eventId asociado.
// Lo subimos a la cuenta de Google Drive conectada, dentro de
// SecureCam Drive/<cámara>/<año>/<mes>/<día>/, y actualizamos el evento.
uploadRouter.post("/", upload.single("archivo"), async (req, res) => {
  const { eventId } = req.body;
  if (!req.file) return res.status(400).json({ error: "Falta el archivo 'archivo'" });
  if (!eventId) return res.status(400).json({ error: "Falta eventId" });

  const db = await getDb();
  const idx = db.data.events.findIndex((e) => e.id === eventId);
  if (idx === -1) {
    fs.unlink(req.file.path, () => {});
    return res.status(404).json({ error: "Evento no encontrado" });
  }

  if (!db.data.settings.googleDrive.conectado) {
    fs.unlink(req.file.path, () => {});
    return res.status(409).json({ error: "Google Drive no está conectado. Ve a Ajustes y conecta tu cuenta." });
  }

  try {
    const evento = db.data.events[idx];
    const resultado = await uploadClipToDrive({
      localPath: req.file.path,
      filename: req.file.originalname || `${evento.id}.mp4`,
      carpetaBase: db.data.settings.googleDrive.carpetaBase,
      camara: evento.camara,
      fecha: evento.fecha
    });

    db.data.events[idx].driveEstado = "subido";
    db.data.events[idx].driveRuta = resultado.ruta;
    db.data.events[idx].driveFileId = resultado.fileId;
    db.data.events[idx].driveLink = resultado.webViewLink;

    // Borra la copia local temporal según la preferencia de Ajustes.
    if (db.data.settings.eliminarLocal !== false) {
      fs.unlink(req.file.path, () => {});
    }

    await db.write();
    req.app.get("broadcast")?.({ type: "event_updated", event: db.data.events[idx] });

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

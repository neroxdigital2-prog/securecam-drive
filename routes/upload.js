import { Router } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "../db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upload = multer({ dest: path.join(__dirname, "..", "tmp_uploads") });

export const uploadRouter = Router();

// POST /api/upload
// El Bridge envía aquí el archivo MP4 grabado junto al eventId asociado.
// El backend se encarga de reenviarlo a la cuenta de Google Drive del
// usuario (vía la API de Drive) y de actualizar el estado del evento.
uploadRouter.post("/", upload.single("archivo"), async (req, res) => {
  const { eventId } = req.body;
  if (!req.file) return res.status(400).json({ error: "Falta el archivo 'archivo'" });
  if (!eventId) return res.status(400).json({ error: "Falta eventId" });

  const db = await getDb();
  const idx = db.data.events.findIndex((e) => e.id === eventId);

  // TODO: integrar con Google Drive API (OAuth2) para subir req.file.path
  // a la carpeta SecureCam Drive/<cámara>/<año>/<mes>/<día>/
  const rutaDrive = idx !== -1
    ? `${db.data.settings.googleDrive.carpetaBase}/${db.data.events[idx].camara}/${db.data.events[idx].fecha.replace(/-/g, "/")}/${req.file.originalname}`
    : null;

  if (idx !== -1) {
    db.data.events[idx].driveEstado = "subido";
    db.data.events[idx].driveRuta = rutaDrive;
    await db.write();
    req.app.get("broadcast")?.({ type: "event_updated", event: db.data.events[idx] });
  }

  res.json({
    ok: true,
    archivo: req.file.originalname,
    tamano: req.file.size,
    driveRuta: rutaDrive
  });
});

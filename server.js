import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

import { camerasRouter } from "./routes/cameras.js";
import { eventsRouter } from "./routes/events.js";
import { uploadRouter } from "./routes/upload.js";
import { settingsRouter, dashboardRouter } from "./routes/settings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

// La aplicación web (PWA) ya viene compilada dentro de esta misma carpeta,
// en /public. No hace falta correr ningún build en el hosting.
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

// Difunde un mensaje JSON a todos los clientes conectados (la Web y,
// potencialmente, varias instancias del Bridge).
function broadcast(payload) {
  const data = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) client.send(data);
  });
}
app.set("broadcast", broadcast);

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "connected", mensaje: "Conectado a SecureCam Drive" }));

  ws.on("message", (raw) => {
    // Mensajes esperados desde el Bridge:
    //  { type: "camera_status", id, estado }
    //  { type: "discovery_result", camaras: [...] }
    //  { type: "motion_detected", camaraId }
    try {
      const msg = JSON.parse(raw.toString());
      broadcast(msg); // reenvía a los demás clientes (p. ej. la Web)
    } catch {
      // ignora mensajes no válidos
    }
  });
});

app.get("/api/health", (req, res) => res.json({ ok: true, servicio: "SecureCam Drive API" }));

app.use("/api/cameras", camerasRouter);
app.use("/api/events", eventsRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/dashboard", dashboardRouter);

// Cualquier otra ruta que no sea /api o /ws devuelve la web (React Router
// maneja la navegación en el navegador: /camaras, /historial, /ajustes...).
app.get(/^(?!\/api|\/ws).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`SecureCam Drive API escuchando en http://localhost:${PORT}`);
  console.log(`WebSocket disponible en ws://localhost:${PORT}/ws`);
});

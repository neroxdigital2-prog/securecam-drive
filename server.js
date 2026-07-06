import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

import { initSchema } from "./db.js";
import { camerasRouter } from "./routes/cameras.js";
import { eventsRouter } from "./routes/events.js";
import { uploadRouter } from "./routes/upload.js";
import { settingsRouter, dashboardRouter } from "./routes/settings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

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
    try {
      const msg = JSON.parse(raw.toString());
      broadcast(msg);
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

app.get(/^(?!\/api|\/ws).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 4000;

initSchema()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`SecureCam Drive API escuchando en http://localhost:${PORT}`);
      console.log(`WebSocket disponible en ws://localhost:${PORT}/ws`);
      console.log("Base de datos MariaDB inicializada correctamente.");
    });
  })
  .catch((err) => {
    console.error("Error inicializando la base de datos:", err);
    process.exit(1);
  });

import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, "data.json");

const defaultData = {
  cameras: [
    {
      id: "cam_sala",
      nombre: "Sala",
      ip: "192.168.1.66",
      puerto: 554,
      usuario: "tapo",
      contrasena: "********",
      fabricante: "TP-Link Tapo",
      modelo: "C210",
      rtsp: "rtsp://192.168.1.66:554/stream1",
      onvif: true,
      estado: "online"
    },
    {
      id: "cam_entrada",
      nombre: "Entrada",
      ip: "192.168.1.67",
      puerto: 554,
      usuario: "tapo",
      contrasena: "********",
      fabricante: "TP-Link Tapo",
      modelo: "C210",
      rtsp: "rtsp://192.168.1.67:554/stream1",
      onvif: true,
      estado: "online"
    },
    {
      id: "cam_patio",
      nombre: "Patio",
      ip: "192.168.1.68",
      puerto: 554,
      usuario: "admin",
      contrasena: "********",
      fabricante: "Reolink",
      modelo: "RLC-810A",
      rtsp: "rtsp://192.168.1.68:554/stream1",
      onvif: true,
      estado: "offline"
    }
  ],
  events: [
    {
      id: "evt_1",
      camaraId: "cam_sala",
      camara: "Sala",
      fecha: "2026-07-05",
      hora: "18:43",
      tipo: "Persona",
      duracion: 18,
      miniatura: null,
      driveEstado: "subido",
      driveRuta: "SecureCam Drive/Sala/2026/07/05/18-42.mp4"
    }
  ],
  settings: {
    preEvento: 5,
    postEvento: 10,
    calidad: "1080p",
    eliminarLocal: true,
    notificaciones: true,
    modoOscuro: true,
    pin: "1234",
    googleDrive: {
      cuenta: null,
      carpetaBase: "SecureCam Drive",
      conectado: false,
      refreshToken: null
    }
  },
  usuarios: [
    { id: "u1", nombre: "Admin", rol: "administrador" }
  ]
};

export async function getDb() {
  const adapter = new JSONFile(file);
  const db = new Low(adapter, defaultData);
  await db.read();
  db.data ||= defaultData;
  return db;
}

import mysql from "mysql2/promise";

// Estos 5 valores se configuran como "Environment Variables" en Render.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  ssl: { rejectUnauthorized: false }
});

export function getPool() {
  return pool;
}

// Crea las tablas si no existen, y siembra los datos iniciales la primera vez.
export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cameras (
      id VARCHAR(64) PRIMARY KEY,
      nombre VARCHAR(255) NOT NULL,
      ip VARCHAR(64) NOT NULL,
      puerto INT DEFAULT 554,
      usuario VARCHAR(255),
      contrasena VARCHAR(255),
      fabricante VARCHAR(255),
      modelo VARCHAR(255),
      rtsp VARCHAR(500),
      onvif TINYINT(1) DEFAULT 0,
      estado VARCHAR(32) DEFAULT 'pendiente'
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id VARCHAR(64) PRIMARY KEY,
      camaraId VARCHAR(64),
      camara VARCHAR(255),
      fecha DATE,
      hora VARCHAR(8),
      tipo VARCHAR(64),
      duracion INT DEFAULT 0,
      miniatura TEXT,
      driveEstado VARCHAR(32) DEFAULT 'subiendo',
      driveRuta VARCHAR(1000),
      driveFileId VARCHAR(255),
      driveLink VARCHAR(1000)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      id INT PRIMARY KEY DEFAULT 1,
      preEvento INT DEFAULT 5,
      postEvento INT DEFAULT 10,
      calidad VARCHAR(16) DEFAULT '1080p',
      eliminarLocal TINYINT(1) DEFAULT 1,
      notificaciones TINYINT(1) DEFAULT 1,
      modoOscuro TINYINT(1) DEFAULT 1,
      pin VARCHAR(16) DEFAULT '1234',
      gd_cuenta VARCHAR(255),
      gd_carpetaBase VARCHAR(255) DEFAULT 'SecureCam Drive',
      gd_conectado TINYINT(1) DEFAULT 0,
      gd_refreshToken TEXT
    )
  `);

  // Semilla: solo si las tablas están vacías (primera vez que arranca).
  const [[{ total }]] = await pool.query("SELECT COUNT(*) as total FROM cameras");
  if (total === 0) {
    await pool.query(
      `INSERT INTO cameras (id, nombre, ip, puerto, usuario, contrasena, fabricante, modelo, rtsp, onvif, estado) VALUES
       ('cam_sala', 'Sala', '192.168.1.66', 554, 'tapo', '********', 'TP-Link Tapo', 'C210', 'rtsp://192.168.1.66:554/stream1', 1, 'online'),
       ('cam_entrada', 'Entrada', '192.168.1.67', 554, 'tapo', '********', 'TP-Link Tapo', 'C210', 'rtsp://192.168.1.67:554/stream1', 1, 'online'),
       ('cam_patio', 'Patio', '192.168.1.68', 554, 'admin', '********', 'Reolink', 'RLC-810A', 'rtsp://192.168.1.68:554/stream1', 1, 'offline')`
    );
  }

  const [[{ total: totalEventos }]] = await pool.query("SELECT COUNT(*) as total FROM events");
  if (totalEventos === 0) {
    await pool.query(
      `INSERT INTO events (id, camaraId, camara, fecha, hora, tipo, duracion, driveEstado, driveRuta) VALUES
       ('evt_1', 'cam_sala', 'Sala', '2026-07-05', '18:43', 'Persona', 18, 'subido', 'SecureCam Drive/Sala/2026/07/05/18-42.mp4')`
    );
  }

  const [[{ total: totalSettings }]] = await pool.query("SELECT COUNT(*) as total FROM settings");
  if (totalSettings === 0) {
    await pool.query("INSERT INTO settings (id) VALUES (1)");
  }
}

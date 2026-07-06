import { google } from "googleapis";
import fs from "fs";
import { getPool } from "./db.js";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

const SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/drive.file"
];

function newOAuthClient() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    throw new Error(
      "Faltan las variables de entorno GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET o GOOGLE_REDIRECT_URI"
    );
  }
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

export function getAuthUrl() {
  const client = newOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES
  });
}

export async function handleOAuthCallback(code) {
  const client = newOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ auth: client, version: "v2" });
  const { data: perfil } = await oauth2.userinfo.get();

  const pool = getPool();
  if (tokens.refresh_token) {
    await pool.query(
      "UPDATE settings SET gd_conectado = 1, gd_cuenta = ?, gd_refreshToken = ? WHERE id = 1",
      [perfil.email, tokens.refresh_token]
    );
  } else {
    // Google no siempre reenvía el refresh_token si ya existía uno; conservamos el guardado.
    await pool.query(
      "UPDATE settings SET gd_conectado = 1, gd_cuenta = ? WHERE id = 1",
      [perfil.email]
    );
  }

  return perfil.email;
}

async function getAuthorizedClient() {
  const [[fila]] = await getPool().query("SELECT gd_refreshToken FROM settings WHERE id = 1");
  if (!fila?.gd_refreshToken) {
    throw new Error("Google Drive no está conectado (sin refresh token guardado)");
  }
  const client = newOAuthClient();
  client.setCredentials({ refresh_token: fila.gd_refreshToken });
  return client;
}

async function ensureFolder(drive, name, parentId) {
  const query = [
    `name='${name.replace(/'/g, "\\'")}'`,
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
    parentId ? `'${parentId}' in parents` : "'root' in parents"
  ].join(" and ");

  const { data } = await drive.files.list({ q: query, fields: "files(id, name)" });
  if (data.files && data.files.length > 0) return data.files[0].id;

  const { data: creada } = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined
    },
    fields: "id"
  });
  return creada.id;
}

async function ensureFolderPath(drive, parts) {
  let parentId = undefined;
  for (const part of parts) {
    parentId = await ensureFolder(drive, part, parentId);
  }
  return parentId;
}

export async function uploadClipToDrive({ localPath, filename, carpetaBase, camara, fecha }) {
  const client = await getAuthorizedClient();
  const drive = google.drive({ version: "v3", auth: client });

  const [anio, mes, dia] = fecha.split("-");
  const folderId = await ensureFolderPath(drive, [carpetaBase, camara, anio, mes, dia]);

  const { data } = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: { body: fs.createReadStream(localPath) },
    fields: "id, webViewLink"
  });

  return {
    fileId: data.id,
    webViewLink: data.webViewLink,
    ruta: `${carpetaBase}/${camara}/${anio}/${mes}/${dia}/${filename}`
  };
}

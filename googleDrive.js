import { google } from "googleapis";
import fs from "fs";
import { getDb } from "./db.js";

// Estas tres variables se configuran como "Environment Variables" en Render
// (o en un archivo .env local). Ver README-GOOGLE-DRIVE.md para el paso a paso.
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI; // ej: https://tu-app.onrender.com/api/settings/google-drive/callback

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

// Construye la URL a la que mandamos al usuario para que autorice el acceso.
export function getAuthUrl() {
  const client = newOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline", // necesario para recibir un refresh_token
    prompt: "consent", // fuerza a que siempre entregue refresh_token
    scope: SCOPES
  });
}

// Intercambia el "code" que Google manda de vuelta por tokens reales,
// y los guarda en la base de datos junto con el email de la cuenta.
export async function handleOAuthCallback(code) {
  const client = newOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ auth: client, version: "v2" });
  const { data: perfil } = await oauth2.userinfo.get();

  const db = await getDb();
  db.data.settings.googleDrive = {
    ...db.data.settings.googleDrive,
    conectado: true,
    cuenta: perfil.email,
    refreshToken: tokens.refresh_token ?? db.data.settings.googleDrive.refreshToken
  };
  await db.write();

  return perfil.email;
}

// Reconstruye un cliente autorizado a partir del refresh_token guardado.
async function getAuthorizedClient() {
  const db = await getDb();
  const refreshToken = db.data.settings.googleDrive.refreshToken;
  if (!refreshToken) {
    throw new Error("Google Drive no está conectado (sin refresh token guardado)");
  }
  const client = newOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

// Busca una carpeta por nombre dentro de un padre; si no existe, la crea.
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

// Crea (o reutiliza) la ruta completa SecureCam Drive/<cámara>/<año>/<mes>/<día>/
// y devuelve el id de la carpeta final.
async function ensureFolderPath(drive, parts) {
  let parentId = undefined;
  for (const part of parts) {
    parentId = await ensureFolder(drive, part, parentId);
  }
  return parentId;
}

// Sube un archivo local a la ruta de carpetas indicada y devuelve el link.
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

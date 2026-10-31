import { google } from 'googleapis';
import { Readable } from 'stream';

/**
 * Checks whether Google Drive upload is configured via environment variables.
 */
export function isDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY &&
    process.env.GOOGLE_DRIVE_FOLDER_ID
  );
}

/**
 * Returns an authenticated Google Drive v3 client using GoogleAuth with Service Account credentials.
 */
function getDriveClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !key) {
    throw new Error('Google Service Account credentials (EMAIL or PRIVATE_KEY) missing in environment.');
  }

  const cleanKey = key
    .replace(/\\n/g, '\n')
    .replace(/^"(.*)"$/, '$1')
    .trim();

  if (!cleanKey.includes('BEGIN PRIVATE KEY')) {
    throw new Error('GOOGLE_PRIVATE_KEY is malformed in environment.');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: cleanKey,
    },
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file'
    ],
  });

  return google.drive({ version: 'v3', auth });
}

export interface DriveUploadResult {
  fileId: string;
  url: string;
  fileName: string;
}

/**
 * Uploads a PDF buffer directly to the configured Google Drive folder,
 * grants public read permission ("anyone with the link can view"),
 * and returns the Google Drive preview link.
 */
export async function uploadPdfToDrive(options: {
  buffer: Buffer;
  fileName: string;
  folderId?: string;
}): Promise<DriveUploadResult> {
  const drive = getDriveClient();
  const folderId = options.folderId || process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();

  if (!folderId) {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID is required to upload files to Google Drive.');
  }

  const stream = Readable.from(options.buffer);

  // 1. Create the file in the shared Google Drive folder
  const fileMetadata: Record<string, any> = {
    name: options.fileName,
    parents: [folderId],
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: {
      mimeType: 'application/pdf',
      body: stream,
    },
    fields: 'id, name, webViewLink, webContentLink',
    supportsAllDrives: true,
  });

  const fileId = response.data.id;
  if (!fileId) {
    throw new Error('Google Drive API failed to return an uploaded file ID.');
  }

  // 2. Grant public read permission ("Anyone with link can view")
  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
      supportsAllDrives: true,
    });
  } catch (permErr: any) {
    console.warn(`⚠️ Warning: Could not explicitly set public permissions on Drive file ${fileId}:`, permErr?.message);
    // If the folder itself is already public, this is inherited automatically
  }

  // 3. Construct a reliable web view link
  const url = response.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;

  console.log(`✅ Successfully uploaded "${options.fileName}" to Google Drive (ID: ${fileId})`);

  return {
    fileId,
    url,
    fileName: response.data.name || options.fileName,
  };
}

/**
 * Deletes a file from Google Drive by its file ID.
 */
export async function deletePdfFromDrive(fileId: string): Promise<boolean> {
  try {
    const drive = getDriveClient();
    await drive.files.delete({
      fileId,
      supportsAllDrives: true,
    });
    console.log(`🗑️ Successfully deleted file from Google Drive (ID: ${fileId})`);
    return true;
  } catch (err: any) {
    console.error(`Failed to delete file ${fileId} from Google Drive:`, err?.message);
    return false;
  }
}

/**
 * Extracts a Google Drive file ID from a URL if present.
 */
export function extractDriveFileId(url: string): string | null {
  if (!url) return null;
  const matchFile = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchFile && matchFile[1]) return matchFile[1];
  const matchId = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchId && matchId[1]) return matchId[1];
  return null;
}

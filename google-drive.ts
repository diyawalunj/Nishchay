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
  folderId: string;
  folderName?: string;
}

// In-memory cache for created/found subfolders to minimize Google Drive API roundtrips
const folderCache = new Map<string, string>();

/**
 * Finds an existing subfolder by name inside a parent folder,
 * or creates it automatically if it does not exist yet.
 * Returns the subfolder ID.
 */
export async function getOrCreateFolder(options: {
  folderName: string;
  parentFolderId?: string;
}): Promise<string> {
  const drive = getDriveClient();
  const parentId = (options.parentFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim();

  if (!parentId) {
    throw new Error('Root parent folder ID is required to locate or create a subfolder.');
  }

  const cleanName = options.folderName.trim();
  const cacheKey = `${parentId}:${cleanName.toLowerCase()}`;

  // Return cached folder ID if already resolved in this process
  if (folderCache.has(cacheKey)) {
    return folderCache.get(cacheKey)!;
  }

  // 1. Search if the subfolder already exists in the parent folder
  const escapedName = cleanName.replace(/'/g, "\\'");
  const q = `'${parentId}' in parents and name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

  try {
    const listRes = await drive.files.list({
      q,
      fields: 'files(id, name)',
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const existingFolder = listRes.data.files?.[0];
    if (existingFolder?.id) {
      folderCache.set(cacheKey, existingFolder.id);
      return existingFolder.id;
    }
  } catch (searchErr: any) {
    console.warn(`Could not query subfolder "${cleanName}", proceeding to create:`, searchErr?.message);
  }

  // 2. Folder does not exist: create it inside the parent folder
  console.log(`📁 Creating Google Drive subfolder: "${cleanName}" inside parent: ${parentId}`);

  const createRes = await drive.files.create({
    requestBody: {
      name: cleanName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id, name',
    supportsAllDrives: true,
  });

  const newFolderId = createRes.data.id;
  if (!newFolderId) {
    throw new Error(`Failed to create Google Drive subfolder for "${cleanName}".`);
  }

  // 3. Grant public read permission on the subfolder
  try {
    await drive.permissions.create({
      fileId: newFolderId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
      supportsAllDrives: true,
    });
  } catch (permErr: any) {
    console.warn(`⚠️ Warning: Subfolder "${cleanName}" permissions note:`, permErr?.message);
  }

  folderCache.set(cacheKey, newFolderId);
  return newFolderId;
}

/**
 * Uploads a PDF buffer directly to a target Google Drive folder,
 * optionally placing it into an automatically created/located subject subfolder (e.g. "Mathematics", "English").
 * Grants public read permission ("anyone with the link can view"),
 * and returns the Google Drive preview link.
 */
export async function uploadPdfToDrive(options: {
  buffer: Buffer;
  fileName: string;
  subfolderName?: string;
  folderId?: string;
}): Promise<DriveUploadResult> {
  const drive = getDriveClient();
  let targetFolderId = (options.folderId || process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim();

  if (!targetFolderId) {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID is required to upload files to Google Drive.');
  }

  // Automatically find or create the subject subfolder inside the root Drive directory
  let effectiveFolderId = targetFolderId;
  if (options.subfolderName && options.subfolderName.trim()) {
    try {
      effectiveFolderId = await getOrCreateFolder({
        folderName: options.subfolderName.trim(),
        parentFolderId: targetFolderId,
      });
      console.log(`📂 Using subfolder "${options.subfolderName}" (ID: ${effectiveFolderId})`);
    } catch (folderErr: any) {
      console.warn(`Could not create subfolder "${options.subfolderName}", falling back to root Drive folder:`, folderErr?.message);
      effectiveFolderId = targetFolderId;
    }
  }

  const stream = Readable.from(options.buffer);

  // 1. Create the PDF file inside the target folder
  const fileMetadata: Record<string, any> = {
    name: options.fileName,
    parents: [effectiveFolderId],
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
  }

  // 3. Construct a reliable web view link
  const url = response.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;

  console.log(`✅ Successfully uploaded "${options.fileName}" into "${options.subfolderName || 'Root'}" (ID: ${fileId})`);

  return {
    fileId,
    url,
    fileName: response.data.name || options.fileName,
    folderId: effectiveFolderId,
    folderName: options.subfolderName,
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

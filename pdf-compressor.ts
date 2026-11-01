import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// Cached binary paths
let cachedGsPath: string | null = null;
let cachedQpdfPath: string | null = null;
let cachedMutoolPath: string | null = null;

/**
 * Automatically locate the Ghostscript binary across platforms (Linux, macOS, Windows, Docker).
 */
export function findGhostscriptBinary(): string | null {
  if (cachedGsPath) return cachedGsPath;

  // 1. Check explicit environment variable
  if (process.env.GHOSTSCRIPT_PATH && fs.existsSync(process.env.GHOSTSCRIPT_PATH)) {
    cachedGsPath = process.env.GHOSTSCRIPT_PATH;
    return cachedGsPath;
  }

  // 2. Check workspace local binaries (e.g., ./bin/gs/)
  const localCandidates = [
    path.join(process.cwd(), 'bin', 'gs', 'gswin64c.exe'),
    path.join(process.cwd(), 'bin', 'gs', 'gswin32c.exe'),
    path.join(process.cwd(), 'bin', 'gs', 'gs'),
  ];
  for (const candidate of localCandidates) {
    if (fs.existsSync(candidate)) {
      cachedGsPath = candidate;
      return cachedGsPath;
    }
  }

  // 3. Check Windows Program Files standard installations
  if (process.platform === 'win32') {
    const programFilesDirs = [
      process.env['ProgramFiles'],
      process.env['ProgramFiles(x86)'],
      'C:\\Program Files',
      'C:\\Program Files (x86)',
    ].filter(Boolean) as string[];

    for (const baseDir of programFilesDirs) {
      const gsRoot = path.join(baseDir, 'gs');
      if (fs.existsSync(gsRoot)) {
        try {
          const versions = fs.readdirSync(gsRoot);
          for (const ver of versions) {
            const win64Bin = path.join(gsRoot, ver, 'bin', 'gswin64c.exe');
            if (fs.existsSync(win64Bin)) {
              cachedGsPath = win64Bin;
              return cachedGsPath;
            }
            const win32Bin = path.join(gsRoot, ver, 'bin', 'gswin32c.exe');
            if (fs.existsSync(win32Bin)) {
              cachedGsPath = win32Bin;
              return cachedGsPath;
            }
          }
        } catch {
          // Ignore read errors
        }
      }
    }
  }

  // 4. Check Linux / Unix standard paths
  const unixCandidates = ['/usr/bin/gs', '/usr/local/bin/gs', '/bin/gs', '/opt/homebrew/bin/gs'];
  for (const candidate of unixCandidates) {
    if (fs.existsSync(candidate)) {
      cachedGsPath = candidate;
      return cachedGsPath;
    }
  }

  return null;
}

/**
 * Automatically locate QPDF binary across platforms.
 */
export function findQpdfBinary(): string | null {
  if (cachedQpdfPath) return cachedQpdfPath;

  if (process.env.QPDF_PATH && fs.existsSync(process.env.QPDF_PATH)) {
    cachedQpdfPath = process.env.QPDF_PATH;
    return cachedQpdfPath;
  }

  if (process.platform === 'win32') {
    const programFilesDirs = [
      process.env['ProgramFiles'],
      process.env['ProgramFiles(x86)'],
      'C:\\Program Files',
      'C:\\Program Files (x86)',
    ].filter(Boolean) as string[];

    for (const baseDir of programFilesDirs) {
      try {
        const entries = fs.readdirSync(baseDir);
        for (const entry of entries) {
          if (entry.toLowerCase().startsWith('qpdf')) {
            const exe = path.join(baseDir, entry, 'bin', 'qpdf.exe');
            if (fs.existsSync(exe)) {
              cachedQpdfPath = exe;
              return cachedQpdfPath;
            }
          }
        }
      } catch {}
    }
  }

  const unixCandidates = ['/usr/bin/qpdf', '/usr/local/bin/qpdf', '/bin/qpdf', '/opt/homebrew/bin/qpdf'];
  for (const candidate of unixCandidates) {
    if (fs.existsSync(candidate)) {
      cachedQpdfPath = candidate;
      return cachedQpdfPath;
    }
  }

  return null;
}

/**
 * Automatically locate MuPDF mutool binary across platforms.
 */
export function findMutoolBinary(): string | null {
  if (cachedMutoolPath) return cachedMutoolPath;

  if (process.env.MUTOOL_PATH && fs.existsSync(process.env.MUTOOL_PATH)) {
    cachedMutoolPath = process.env.MUTOOL_PATH;
    return cachedMutoolPath;
  }

  if (process.platform === 'win32') {
    const candidates = [
      path.join(process.env['LOCALAPPDATA'] || '', 'Microsoft', 'WinGet', 'Links', 'mutool.exe'),
      path.join(process.cwd(), 'bin', 'gs', 'mutool.exe'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        cachedMutoolPath = c;
        return cachedMutoolPath;
      }
    }
  }

  const unixCandidates = ['/usr/bin/mutool', '/usr/local/bin/mutool', '/bin/mutool', '/opt/homebrew/bin/mutool'];
  for (const c of unixCandidates) {
    if (fs.existsSync(c)) {
      cachedMutoolPath = c;
      return cachedMutoolPath;
    }
  }

  return null;
}

/**
 * Checks if a PDF compression engine (Ghostscript or QPDF) is available.
 */
export async function isCompressionEngineAvailable(): Promise<{ available: boolean; engine: string | null }> {
  const gs = findGhostscriptBinary();
  if (gs) {
    try {
      await execFileAsync(gs, ['--version']);
      return { available: true, engine: `Ghostscript (${gs})` };
    } catch {}
  }

  const qpdf = findQpdfBinary();
  if (qpdf) {
    try {
      await execFileAsync(qpdf, ['--version']);
      return { available: true, engine: `QPDF (${qpdf})` };
    } catch {}
  }

  const mutool = findMutoolBinary();
  if (mutool) {
    try {
      await execFileAsync(mutool, ['-v']);
      return { available: true, engine: `MuPDF mutool (${mutool})` };
    } catch {}
  }

  return { available: false, engine: null };
}

// Backwards-compatible alias
export const isGhostscriptAvailable = async () => (await isCompressionEngineAvailable()).available;

export interface CompressResult {
  buffer: Buffer;
  compressed: boolean;
  originalBytes: number;
  finalBytes: number;
  originalSizeMb: string;
  finalSizeMb: string;
  durationMs: number;
  presetUsed?: string;
  note?: string;
}

/**
 * Automatically compresses a PDF buffer.
 * If file is already <= targetMaxBytes (default 4.2 MB), returns original immediately.
 * Uses Ghostscript raster downsampling (150 DPI) when available, and/or QPDF stream recompression.
 */
export async function compressPdfBuffer(
  inputBuffer: Buffer,
  options?: {
    targetMaxBytes?: number;
    forceCompress?: boolean;
  }
): Promise<CompressResult> {
  const startTime = Date.now();
  const targetMaxBytes = options?.targetMaxBytes || 4.2 * 1024 * 1024; // 4.2 MB threshold

  const originalBytes = inputBuffer.length;
  const originalSizeMb = (originalBytes / (1024 * 1024)).toFixed(2);

  if (!options?.forceCompress && originalBytes <= targetMaxBytes) {
    return {
      buffer: inputBuffer,
      compressed: false,
      originalBytes,
      finalBytes: originalBytes,
      originalSizeMb,
      finalSizeMb: originalSizeMb,
      durationMs: Date.now() - startTime,
      note: 'File size is already within 4 MB limit; no compression required.',
    };
  }

  const gsBinary = findGhostscriptBinary();
  const qpdfBinary = findQpdfBinary();
  const mutoolBinary = findMutoolBinary();

  if (!gsBinary && !qpdfBinary && !mutoolBinary) {
    throw new Error(
      `No PDF compression engine (Ghostscript, MuPDF, or QPDF) found on this server. Please ensure Ghostscript, MuPDF, or QPDF is installed to compress files larger than 4 MB.`
    );
  }

  const tempId = crypto.randomBytes(6).toString('hex');
  const tempInPath = path.join(os.tmpdir(), `nishchay-raw-${tempId}.pdf`);
  const tempOutPath = path.join(os.tmpdir(), `nishchay-opt-${tempId}.pdf`);

  try {
    fs.writeFileSync(tempInPath, inputBuffer);

    let currentInputPath = tempInPath;
    let engineUsed = '';

    // Step 1: Ghostscript pass (downsample scanned high-res images to 150 DPI)
    if (gsBinary) {
      const preset = '/ebook';
      const gsArgs = [
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.4',
        `-dPDFSETTINGS=${preset}`,
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',
        `-sOutputFile=${tempOutPath}`,
        currentInputPath,
      ];
      try {
        await execFileAsync(gsBinary, gsArgs, { timeout: 35000 });
        if (fs.existsSync(tempOutPath) && fs.statSync(tempOutPath).size > 0) {
          currentInputPath = tempOutPath;
          engineUsed = 'Ghostscript (150 DPI)';
        }
      } catch (gsErr) {
        console.warn('Ghostscript pass warning:', gsErr);
      }
    }

    // Step 2: MuPDF mutool pass (clean objects, deduplicate fonts, deflate streams)
    if (mutoolBinary) {
      const mutoolOutPath = path.join(os.tmpdir(), `nishchay-mu-${tempId}.pdf`);
      try {
        await execFileAsync(mutoolBinary, ['clean', '-ggg', '-z', currentInputPath, mutoolOutPath], { timeout: 35000 });
        if (fs.existsSync(mutoolOutPath) && fs.statSync(mutoolOutPath).size > 0) {
          const muSize = fs.statSync(mutoolOutPath).size;
          const currentSize = fs.existsSync(tempOutPath) ? fs.statSync(tempOutPath).size : originalBytes;
          if (muSize < currentSize) {
            if (fs.existsSync(tempOutPath)) fs.unlinkSync(tempOutPath);
            fs.renameSync(mutoolOutPath, tempOutPath);
            currentInputPath = tempOutPath;
            engineUsed = engineUsed ? `${engineUsed} + MuPDF Clean` : 'MuPDF Clean';
          } else {
            try { fs.unlinkSync(mutoolOutPath); } catch {}
          }
        }
      } catch (muErr) {
        console.warn('MuPDF pass warning:', muErr);
      }
    }

    // Step 3: QPDF pass (recompress flate streams and generate compact object streams)
    if (qpdfBinary) {
      const qpdfOutPath = path.join(os.tmpdir(), `nishchay-qpdf-${tempId}.pdf`);
      const qpdfArgs = [
        '--compress-streams=y',
        '--recompress-flate',
        '--object-streams=generate',
        '--linearize',
        currentInputPath,
        qpdfOutPath,
      ];
      try {
        await execFileAsync(qpdfBinary, qpdfArgs, { timeout: 35000 });
        if (fs.existsSync(qpdfOutPath) && fs.statSync(qpdfOutPath).size > 0) {
          const qpdfSize = fs.statSync(qpdfOutPath).size;
          const currentSize = fs.existsSync(tempOutPath) ? fs.statSync(tempOutPath).size : originalBytes;

          if (qpdfSize < currentSize) {
            if (fs.existsSync(tempOutPath)) fs.unlinkSync(tempOutPath);
            fs.renameSync(qpdfOutPath, tempOutPath);
            engineUsed = engineUsed ? `${engineUsed} + QPDF Stream Optimize` : 'QPDF Stream Optimize';
          } else {
            try { fs.unlinkSync(qpdfOutPath); } catch {}
          }
        }
      } catch (qpdfErr) {
        console.warn('QPDF pass warning:', qpdfErr);
      }
    }

    if (!fs.existsSync(tempOutPath) || fs.statSync(tempOutPath).size === 0) {
      throw new Error('Compression finished without generating a valid output PDF.');
    }

    const compressedBuffer = fs.readFileSync(tempOutPath);
    const finalBytes = compressedBuffer.length;
    const finalSizeMb = (finalBytes / (1024 * 1024)).toFixed(2);

    // If compression resulted in larger file, keep original
    if (finalBytes >= originalBytes) {
      return {
        buffer: inputBuffer,
        compressed: false,
        originalBytes,
        finalBytes: originalBytes,
        originalSizeMb,
        finalSizeMb: originalSizeMb,
        durationMs: Date.now() - startTime,
        note: 'Input PDF was already optimally compressed.',
      };
    }

    return {
      buffer: compressedBuffer,
      compressed: true,
      originalBytes,
      finalBytes,
      originalSizeMb,
      finalSizeMb,
      durationMs: Date.now() - startTime,
      presetUsed: engineUsed,
      note: `Successfully compressed from ${originalSizeMb} MB to ${finalSizeMb} MB using ${engineUsed} (${Date.now() - startTime}ms).`,
    };
  } finally {
    try {
      if (fs.existsSync(tempInPath)) fs.unlinkSync(tempInPath);
    } catch {}
    try {
      if (fs.existsSync(tempOutPath)) fs.unlinkSync(tempOutPath);
    } catch {}
  }
}

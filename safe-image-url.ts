const BASE64_IMAGE_URL = /^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i;
const LOCAL_UPLOAD_URL = /^\/(?:api\/)?uploads\/[a-z0-9._-]+$/i;

/** Restrict image sources to safe image data, local uploads, or web URLs. */
export function safeImageUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const candidate = value.trim();
  if (!candidate || candidate.length > 300_000) return '';
  if (BASE64_IMAGE_URL.test(candidate)) return candidate;
  if (LOCAL_UPLOAD_URL.test(candidate) && !candidate.includes('..')) return candidate;

  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}

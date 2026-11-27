// F-09: which files may be attached to a request. BR-22.

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_REQUEST = 5;

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];

// The stored type follows the first bytes of the file, which must agree with the extension.
const TYPES: Record<string, { type: string; head: number[] }> = {
  pdf: { type: "application/pdf", head: PDF },
  png: { type: "image/png", head: PNG },
  jpg: { type: "image/jpeg", head: JPEG },
  jpeg: { type: "image/jpeg", head: JPEG },
};

const extensionOf = (fileName: string) => /\.([^.]+)$/.exec(fileName)?.[1].toLowerCase() ?? "";

// The X-File-Name header is percent-encoded UTF-8. Returns null when the name is not acceptable.
export function parseFileName(header: string | undefined): string | null {
  if (header === undefined || !/^[\x20-\x7e]*$/.test(header)) return null;
  let name: string;
  try {
    name = decodeURIComponent(header).trim();
  } catch {
    return null;
  }
  if (name.length < 1 || name.length > 100) return null;
  if (/[/\\\u0000-\u001f\u007f]/.test(name)) return null;
  return name;
}

// Returns the type to store, or null when the type is not allowed or the content does not match the name.
export function checkFile(fileName: string, content: Buffer): string | null {
  const extension = extensionOf(fileName);
  if (!Object.prototype.hasOwnProperty.call(TYPES, extension)) return null;
  const { type, head } = TYPES[extension];
  return content.length >= head.length && head.every((byte, i) => content[i] === byte) ? type : null;
}

// Always a download, never shown inside the page. The real name goes in filename* (RFC 5987).
export function contentDisposition(fileName: string, fileType: string): string {
  const fallback = fileType === "application/pdf" ? "pdf" : fileType === "image/png" ? "png" : "jpg";
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="attachment.${fallback}"; filename*=UTF-8''${encoded}`;
}

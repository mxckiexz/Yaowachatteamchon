// F-10: BR-24. The text after trimming, or null when it is not allowed. The length is the JavaScript
// string length, as for the other text fields. PostgreSQL cannot store the character U+0000.
export const MAX_COMMENT_LENGTH = 1000;

export function parseCommentText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (text.length < 1 || text.length > MAX_COMMENT_LENGTH || text.includes("\u0000")) return null;
  return text;
}

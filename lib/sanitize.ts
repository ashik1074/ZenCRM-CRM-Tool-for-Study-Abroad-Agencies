import DOMPurify from "isomorphic-dompurify";

/** Sanitize rich-text HTML from the editor before storing or rendering. */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li", "h1", "h2", "h3", "blockquote", "code", "pre", "hr"],
    ALLOWED_ATTR: ["href", "target", "rel"],
  });
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(br|\/p|\/li|\/h[1-3]|\/blockquote)>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

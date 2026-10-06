// Serialises structured data for a <script type="application/ld+json"> tag.
// Escaping "<" stops copy that contains "</script>" from closing the tag early;
// JSON parsers read < back as "<", so the data is unchanged.
export function toJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

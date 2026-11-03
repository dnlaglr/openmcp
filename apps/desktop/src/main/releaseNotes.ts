const entities: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };

const plain = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39);/g, (entity) => entities[entity])
    .trim();

export function highlights(notes: string | { note: string | null }[] | null | undefined) {
  const text = Array.isArray(notes) ? notes.map((entry) => entry.note ?? "").join("\n") : (notes ?? "");
  const items = [...text.matchAll(/<li>([\s\S]*?)<\/li>/gi)].map((match) => match[1]);
  const bullets =
    items.length > 0 ? items : text.split("\n").flatMap((line) => /^\s*[-*]\s+(.+)/.exec(line)?.[1] ?? []);

  return bullets.map(plain).filter(Boolean).slice(0, 3);
}

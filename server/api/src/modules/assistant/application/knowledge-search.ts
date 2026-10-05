import { KNOWLEDGE, type KnowledgeArticle } from '../content/knowledge';

/**
 * Deterministic keyword search over the knowledge base (ADR-061 D-h).
 *
 * The same question returns the same entries every time, which is the
 * property a reliability phase needs more than recall across loose wording.
 * A title word counts three times, a tag twice, a summary or body word once.
 * Only `current` entries are ever returned.
 */
const STOPWORDS = new Set(
  'a an and are as at be can do does for from how i if in is it me my of on or so the to what when where which who why will with you your'.split(
    ' ',
  ),
);

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

/**
 * A deliberately small English stemmer: enough that "properties" meets
 * "property" and "listing" meets "list", and nothing that could turn two
 * different words into one. Short words are left alone ("bus", "yes").
 */
function stem(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  for (const suffix of ['ing', 'ed']) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) return word.slice(0, -suffix.length);
  }
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

export interface KnowledgeHit {
  article: KnowledgeArticle;
  score: number;
}

export function searchKnowledge(query: string, limit = 3): KnowledgeHit[] {
  const wanted = new Set(tokens(query));
  if (wanted.size === 0) return [];

  const hits: KnowledgeHit[] = [];
  for (const article of KNOWLEDGE) {
    if (article.status !== 'current') continue;
    const title = new Set(tokens(article.title));
    const tags = new Set(article.tags.flatMap((t) => tokens(t)));
    const text = new Set(tokens(`${article.summary} ${article.body}`));
    let score = 0;
    for (const word of wanted) {
      if (title.has(word)) score += 3;
      if (tags.has(word)) score += 2;
      if (text.has(word)) score += 1;
    }
    if (score > 0) hits.push({ article, score });
  }
  // Ties break on id so the order never depends on array position.
  hits.sort((a, b) => b.score - a.score || a.article.id.localeCompare(b.article.id));
  return hits.slice(0, limit);
}

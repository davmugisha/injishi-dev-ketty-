import { fakeReads } from '../testing/fake-listings';
import { ToolSet } from './assistant-tools';

const anonymous = { userId: null, catalogueOpen: false };
const tools = new ToolSet(fakeReads);

describe('assistant tools (ADR-061 D-f)', () => {
  it('offers the public search to an anonymous caller', () => {
    expect(tools.offered(anonymous).map((t) => t.name)).toEqual(['search_help', 'get_task_guide', 'find_tutorial', 'suggest_human_support']);
  });

  it('gives every offered tool a strict schema', () => {
    for (const tool of tools.offered({ ...anonymous, catalogueOpen: true })) {
      expect(tool.inputSchema.additionalProperties).toBe(false);
      expect(Array.isArray(tool.inputSchema.required)).toBe(true);
    }
  });

  it('refuses a tool that does not exist, as an error result', async () => {
    const outcome = await tools.run('update_price', { to: 70000 }, anonymous);
    expect(outcome.isError).toBe(true);
    expect(outcome.sources).toEqual([]);
  });

  it('refuses malformed input rather than searching on it', async () => {
    expect((await tools.run('search_help', { q: 'x' }, anonymous)).isError).toBe(true);
    expect((await tools.run('search_help', { query: '' }, anonymous)).isError).toBe(true);
  });

  it('returns articles with sources the answer may cite', async () => {
    const outcome = await tools.run('search_help', { query: 'publish my property' }, anonymous);
    expect(outcome.isError).toBe(false);
    expect(outcome.sources[0]).toMatchObject({ kind: 'article', id: 'cannot-publish-listing' });
    expect(JSON.parse(outcome.content).results[0].id).toBe('cannot-publish-listing');
  });

  it('tells the model not to answer from memory when nothing matches', async () => {
    const outcome = await tools.run('search_help', { query: 'zxqv blorf' }, anonymous);
    expect(JSON.parse(outcome.content)).toMatchObject({ results: [], note: expect.stringMatching(/memory/) });
  });

  it('turns a tool that throws into an error result, never a failed turn', async () => {
    const broken = new ToolSet({
      ...fakeReads,
      listPublished: () => Promise.reject(new Error('database down')),
    });
    const outcome = await broken.run('search_listings', { query: 'Musanze' }, { ...anonymous, catalogueOpen: true });
    expect(outcome).toMatchObject({ isError: true, sources: [] });
    expect(outcome.content).not.toMatch(/database down/);
  });
});

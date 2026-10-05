import { ConflictException, ForbiddenException } from '@nestjs/common';

import { runBulk } from './bulk';

/**
 * A bulk action is the single command, once per id (058-list-framework AC-LF6):
 * one refusal is that row's result and never undoes the others.
 */

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const C = '00000000-0000-4000-8000-00000000000c';

describe('runBulk', () => {
  it('reports each row, keeping the command own words for a refusal', async () => {
    const done: string[] = [];
    const { results } = await runBulk([A, B, C], async (id) => {
      if (id === B) throw new ConflictException('This request was already decided.');
      done.push(id);
    });
    expect(done).toEqual([A, C]);
    expect(results).toEqual([
      { id: A, ok: true },
      { id: B, ok: false, status: 409, error: 'This request was already decided.' },
      { id: C, ok: true },
    ]);
  });

  it('runs ids one after another, each once', async () => {
    let running = 0;
    let most = 0;
    const seen: string[] = [];
    await runBulk([A, B, A], async (id) => {
      running += 1;
      most = Math.max(most, running);
      seen.push(id);
      await new Promise((resolve) => setTimeout(resolve, 1));
      running -= 1;
    });
    expect(most).toBe(1);
    expect(seen).toEqual([A, B]);
  });

  it('turns a fault into a 500 on its own row and carries on', async () => {
    const { results } = await runBulk([A, B], async (id) => {
      if (id === A) throw new Error('connection reset');
    });
    expect(results[0]).toMatchObject({ id: A, ok: false, status: 500 });
    expect(results[0].error).not.toContain('connection reset');
    expect(results[1]).toEqual({ id: B, ok: true });
  });

  it('reads an object body refusal by its message', async () => {
    const { results } = await runBulk([A], async () => {
      throw new ForbiddenException({ code: 'not_yours', message: 'Nobody decides their own leave.' });
    });
    expect(results[0]).toEqual({ id: A, ok: false, status: 403, error: 'Nobody decides their own leave.' });
  });
});

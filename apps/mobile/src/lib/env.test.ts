/**
 * The web origin follows the build profile, like the API origin.
 *
 * `env.ts` reads the environment once, at import, so each case loads a fresh
 * copy of the module with the variables it needs and puts them back after.
 */

type Env = { EXPO_PUBLIC_API_URL?: string; EXPO_PUBLIC_WEB_URL?: string };

function webOriginWith(env: Env): string | null {
  const saved: Env = {
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
    EXPO_PUBLIC_WEB_URL: process.env.EXPO_PUBLIC_WEB_URL,
  };
  try {
    for (const key of Object.keys(saved) as (keyof Env)[]) {
      if (key in env && env[key] === undefined) delete process.env[key];
      else if (env[key] !== undefined) process.env[key] = env[key];
    }
    let origin: string | null = null;
    jest.isolateModules(() => {
      origin = (require('./env') as typeof import('./env')).WEB_ORIGIN;
    });
    return origin;
  } finally {
    for (const key of Object.keys(saved) as (keyof Env)[]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

describe('WEB_ORIGIN', () => {
  it('uses the value the build profile sets, without a trailing slash', () => {
    expect(
      webOriginWith({
        EXPO_PUBLIC_API_URL: 'https://api-demo.injishi.com',
        EXPO_PUBLIC_WEB_URL: 'https://www-demo.injishi.com/',
      }),
    ).toBe('https://www-demo.injishi.com');
  });

  it('falls back to the API host on port 3000 on a local build', () => {
    expect(
      webOriginWith({ EXPO_PUBLIC_API_URL: 'http://192.168.1.10:8000', EXPO_PUBLIC_WEB_URL: undefined }),
    ).toBe('http://192.168.1.10:3000');
  });

  it('is null rather than a guess when neither says, so the link cannot open the wrong stack', () => {
    expect(
      webOriginWith({ EXPO_PUBLIC_API_URL: 'https://api.injishi.com', EXPO_PUBLIC_WEB_URL: undefined }),
    ).toBeNull();
  });
});

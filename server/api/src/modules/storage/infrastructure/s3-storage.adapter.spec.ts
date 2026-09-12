import { createServer, type Server, type Socket } from 'node:net';

import {
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3ServiceException,
} from '@aws-sdk/client-s3';

import {
  MAX_SIGNED_URL_TTL_SECONDS,
  S3Storage,
  S3StorageAdapter,
  createS3Clients,
  type S3Clients,
} from './s3-storage.adapter';
import { resolveS3StorageConfig, type StorageEnv } from './s3-storage.config';

const SECRET = 'do-not-print-this-secret-0123456789';
const KEY = 'certificate/2026/09/0b7d2a3c-1111-4222-8333-944455556666.pdf';

const ENV: StorageEnv = {
  STORAGE_S3_ENDPOINT: 'http://injishi-minio:9000',
  STORAGE_S3_PUBLIC_ENDPOINT: 'https://storage.injishi.com',
  STORAGE_S3_ACCESS_KEY: 'injishi-api',
  STORAGE_S3_SECRET_KEY: SECRET,
};

interface Sent {
  command: unknown;
  input: Record<string, unknown>;
  signal?: AbortSignal;
}

function stubSend(clients: S3Clients, answer: (sent: Sent) => unknown = () => ({})): Sent[] {
  const sent: Sent[] = [];
  (jest.spyOn(clients.client, 'send') as unknown as jest.SpyInstance).mockImplementation(
    async (command: { input: Record<string, unknown> }, options?: { abortSignal?: AbortSignal }) => {
      const record = { command, input: command.input, signal: options?.abortSignal };
      sent.push(record);
      const result = answer(record);
      if (result instanceof Error) throw result;
      return result;
    },
  );
  return sent;
}

const s3Error = (name: string, status: number): S3ServiceException =>
  new S3ServiceException({ name, $fault: 'client', $metadata: { httpStatusCode: status }, message: name });

const open: S3Clients[] = [];
function clientsFor(env: StorageEnv = ENV, timeouts?: Parameters<typeof createS3Clients>[1]): S3Clients {
  const clients = createS3Clients(resolveS3StorageConfig(env), timeouts);
  open.push(clients);
  return clients;
}
afterEach(() => {
  jest.restoreAllMocks();
});
afterAll(() => {
  for (const clients of open) {
    clients.client.destroy();
    clients.signer.destroy();
  }
});

describe('S3StorageAdapter.put', () => {
  it('writes the bytes under a minted key, with the mime, inside a deadline', async () => {
    const clients = clientsFor();
    const sent = stubSend(clients);
    const body = Buffer.from('%PDF-1.7 certificate');

    const result = await new S3StorageAdapter(clients, 'injishi').put({
      body,
      mime: 'application/pdf',
      filename: '../../../etc/passwd',
      kind: 'certificate',
    });

    expect(result.sizeBytes).toBe(body.byteLength);
    expect(result.objectKey).toMatch(/^certificate\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.pdf$/);
    expect(sent).toHaveLength(1);
    expect(sent[0].command).toBeInstanceOf(PutObjectCommand);
    expect(sent[0].input).toEqual({
      Bucket: 'injishi',
      Key: result.objectKey,
      Body: body,
      ContentLength: body.byteLength,
      ContentType: 'application/pdf',
    });
    expect(sent[0].signal).toBeInstanceOf(AbortSignal);
  });

  it('converges a hinted upload on one key', async () => {
    const clients = clientsFor();
    stubSend(clients);
    const adapter = new S3StorageAdapter(clients, 'injishi-demo');
    const upload = {
      body: Buffer.from('jpg'),
      mime: 'image/jpeg',
      filename: 'x.jpg',
      kind: 'id_photo' as const,
      keyHint: 'Zk3_-abc',
    };
    expect((await adapter.put(upload)).objectKey).toBe('id_photo/Zk3_-abc.jpg');
    expect((await adapter.put(upload)).objectKey).toBe('id_photo/Zk3_-abc.jpg');
  });

  it('reports a failed write with the bucket and key, never the secret', async () => {
    const clients = clientsFor();
    stubSend(clients, () => s3Error('NoSuchBucket', 404));
    const failure = new S3StorageAdapter(clients, 'injishi').put({
      body: Buffer.from('x'),
      mime: 'image/png',
      filename: 'x.png',
      kind: 'avatar',
    });
    await expect(failure).rejects.toThrow(/Storing avatar\/.*\.png in bucket "injishi" failed: NoSuchBucket, HTTP 404/);
    await failure.catch((error: Error) => expect(error.message).not.toContain(SECRET));
  });
});

describe('S3StorageAdapter.signedUrl', () => {
  const expiry = (url: string): number => Number(new URL(url).searchParams.get('X-Amz-Expires'));

  it('signs a GET against the public endpoint, path-style, without sending anything', async () => {
    const clients = clientsFor();
    const sent = stubSend(clients);
    const signerSend = jest.spyOn(clients.signer, 'send');

    const url = new URL(await new S3StorageAdapter(clients, 'injishi').signedUrl(KEY, 300));

    expect(url.origin).toBe('https://storage.injishi.com');
    expect(url.pathname).toBe(`/injishi/${KEY}`);
    expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(url.searchParams.get('X-Amz-Credential')).toMatch(/^injishi-api\/\d{8}\/us-east-1\/s3\/aws4_request$/);
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    expect(url.searchParams.get('x-id')).toBe('GetObject');
    // A plain link: no checksum negotiation a browser cannot take part in.
    expect([...url.searchParams.keys()].some((k) => k.toLowerCase().includes('checksum'))).toBe(false);
    expect(url.toString()).not.toContain(SECRET);
    expect(sent).toHaveLength(0);
    expect(signerSend).not.toHaveBeenCalled();
  });

  it('signs against the internal endpoint when no public one is set', async () => {
    const clients = clientsFor({ ...ENV, STORAGE_S3_PUBLIC_ENDPOINT: undefined });
    const url = new URL(await new S3StorageAdapter(clients, 'injishi').signedUrl(KEY, 60));
    expect(url.origin).toBe('http://injishi-minio:9000');
  });

  it.each([
    [1, 1],
    [1.9, 1],
    [60, 60],
    [300, 300],
    [MAX_SIGNED_URL_TTL_SECONDS, 900],
    [901, 900],
    [3600, 900],
    [7 * 24 * 3600, 900],
  ])('a requested TTL of %ss expires in %ss', async (requested, expected) => {
    const adapter = new S3StorageAdapter(clientsFor(), 'injishi');
    expect(expiry(await adapter.signedUrl(KEY, requested))).toBe(expected);
  });

  it.each([0, -5, 0.5, Number.NaN, Number.POSITIVE_INFINITY])('refuses a TTL of %s', async (ttl) => {
    const adapter = new S3StorageAdapter(clientsFor(), 'injishi');
    await expect(adapter.signedUrl(KEY, ttl)).rejects.toThrow(/at least one second/);
  });

  it.each(['../etc/passwd', 'certificate/../other/x.pdf', 'certificate/x.pdf?acl', ''])(
    'refuses to sign the key %j',
    async (key) => {
      await expect(new S3StorageAdapter(clientsFor(), 'injishi').signedUrl(key, 60)).rejects.toThrow(
        'Invalid object key.',
      );
    },
  );

  it('holds a signing client that refuses to send', async () => {
    const clients = clientsFor();
    await expect(clients.signer.send(new HeadBucketCommand({ Bucket: 'injishi' }))).rejects.toThrow(
      /signs URLs and never sends/,
    );
  });
});

describe('S3StorageAdapter.remove', () => {
  it('deletes the object, inside a deadline', async () => {
    const clients = clientsFor();
    const sent = stubSend(clients);
    await new S3StorageAdapter(clients, 'injishi-demo').remove(KEY);
    expect(sent[0].command).toBeInstanceOf(DeleteObjectCommand);
    expect(sent[0].input).toEqual({ Bucket: 'injishi-demo', Key: KEY });
    expect(sent[0].signal).toBeInstanceOf(AbortSignal);
  });

  it('is idempotent: removing what is already gone succeeds', async () => {
    const clients = clientsFor();
    stubSend(clients, () => s3Error('NoSuchKey', 404));
    await expect(new S3StorageAdapter(clients, 'injishi').remove(KEY)).resolves.toBeUndefined();
  });

  it('reports any other failure', async () => {
    const clients = clientsFor();
    stubSend(clients, () => s3Error('NoSuchBucket', 404));
    await expect(new S3StorageAdapter(clients, 'injishi').remove(KEY)).rejects.toThrow(
      /Removing .* from bucket "injishi" failed: NoSuchBucket/,
    );
  });

  it('refuses a key that walks out of its prefix before it reaches the store', async () => {
    const clients = clientsFor();
    const sent = stubSend(clients);
    await expect(new S3StorageAdapter(clients, 'injishi').remove('certificate/../../x.pdf')).rejects.toThrow(
      'Invalid object key.',
    );
    expect(sent).toHaveLength(0);
  });
});

describe('S3Storage', () => {
  const quiet = { log: jest.fn(), warn: jest.fn() };
  const allPresent = (): unknown => ({
    ServerSideEncryptionConfiguration: {
      Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } }],
    },
  });

  it('hands out one port over the one bucket, on the one client', async () => {
    const clients = clientsFor();
    stubSend(clients, allPresent);
    const storage = await S3Storage.open(resolveS3StorageConfig(ENV), clients, quiet);

    expect(storage.port.bucket).toBe('injishi');
    expect(storage.port['clients'].client).toBe(clients.client);
  });

  it('refuses to open, and releases its clients, when verification fails', async () => {
    const clients = clientsFor();
    stubSend(clients, () => s3Error('NotFound', 404));
    const destroyed = jest.spyOn(clients.client, 'destroy');
    await expect(S3Storage.open(resolveS3StorageConfig(ENV), clients, quiet)).rejects.toThrow(
      /Bucket "injishi" does not exist/,
    );
    expect(destroyed).toHaveBeenCalled();
  });

  it('releases its clients on shutdown', async () => {
    const clients = clientsFor();
    stubSend(clients, allPresent);
    const storage = await S3Storage.open(resolveS3StorageConfig(ENV), clients, quiet);
    const destroyed = jest.spyOn(clients.client, 'destroy');
    const signerDestroyed = jest.spyOn(clients.signer, 'destroy');
    storage.onApplicationShutdown();
    expect(destroyed).toHaveBeenCalled();
    expect(signerDestroyed).toHaveBeenCalled();
  });

  it('warns when production turns off the encryption check or signs over plain http', async () => {
    const env = {
      ...ENV,
      NODE_ENV: 'production',
      STORAGE_REQUIRE_ENCRYPTION: 'false',
      STORAGE_S3_PUBLIC_ENDPOINT: 'http://storage.injishi.com',
    };
    const clients = clientsFor(env);
    stubSend(clients, allPresent);
    const log = { log: jest.fn(), warn: jest.fn() };
    await S3Storage.open(resolveS3StorageConfig(env), clients, log);
    expect(log.warn).toHaveBeenCalledWith(expect.stringMatching(/STORAGE_REQUIRE_ENCRYPTION=false/));
    expect(log.warn).toHaveBeenCalledWith(expect.stringMatching(/plain http/));
    for (const [line] of [...log.log.mock.calls, ...log.warn.mock.calls]) {
      expect(line).not.toContain(SECRET);
    }
  });
});

/**
 * The time bounds, proved against a server that accepts the connection and
 * never answers — the stall no amount of configuration review catches.
 */
describe('every S3 call is time-bounded', () => {
  let server: Server;
  let endpoint: string;
  const sockets = new Set<Socket>();

  beforeAll(async () => {
    server = createServer((socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
      socket.on('data', () => undefined);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('no port');
    endpoint = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const stalled = (timeouts: Parameters<typeof createS3Clients>[1]): S3Clients =>
    clientsFor({ ...ENV, STORAGE_S3_ENDPOINT: endpoint, STORAGE_S3_PUBLIC_ENDPOINT: undefined }, timeouts);

  it('abandons a stalled upload at the operation deadline, retries included', async () => {
    const adapter = new S3StorageAdapter(
      stalled({ connectMs: 1_000, requestMs: 60_000, operationMs: 800 }),
      'injishi',
    );
    const started = Date.now();
    await expect(
      adapter.put({ body: Buffer.from('x'), mime: 'image/png', filename: 'x.png', kind: 'avatar' }),
    ).rejects.toThrow(/Storing avatar\/.* failed: (AbortError|TimeoutError)/);
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it('abandons each stalled attempt at the request timeout', async () => {
    const adapter = new S3StorageAdapter(
      stalled({ connectMs: 1_000, requestMs: 300, operationMs: 60_000 }),
      'injishi',
    );
    const started = Date.now();
    await expect(adapter.remove(KEY)).rejects.toThrow(/failed: TimeoutError/);
    // Three attempts at 300ms plus the SDK's backoff, nowhere near a minute.
    expect(Date.now() - started).toBeLessThan(10_000);
  });

  it('refuses to boot, rather than hang, against a stalled store', async () => {
    const clients = stalled({ connectMs: 1_000, requestMs: 60_000, operationMs: 800 });
    await expect(
      S3Storage.open(resolveS3StorageConfig({ ...ENV, STORAGE_S3_ENDPOINT: endpoint }), clients, {
        log: jest.fn(),
        warn: jest.fn(),
      }),
    ).rejects.toThrow(/Timed out trying to reach bucket "injishi"/);
  });
});

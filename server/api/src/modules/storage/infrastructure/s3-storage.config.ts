import { inspect } from 'node:util';

import { isProduction } from '../../../shared/config/security.config';

/**
 * What the live store is configured to be, resolved once at boot (F-S09).
 *
 * Every value the mode and the live store are chosen by is named in
 * `STORAGE_SETTING_NAMES` and read nowhere else (the local adapter's
 * `STORAGE_LOCAL_ROOT` is its own). The names and defaults are the storage
 * contract's, shared with the compose files and the MinIO provisioning, so a
 * variable spelled here and not there is a deployment that boots on a default
 * nobody chose.
 *
 * Refuses rather than defaults whenever a wrong value would still boot: an
 * endpoint that is not a plain origin, a bucket S3 would reject at the first
 * upload, a flag that reads as neither true nor false. A store that starts and
 * only reveals at the upload step that it cannot keep what it was given has
 * already taken a person's national ID scan.
 */

/** Every environment variable the mode and the live store are read from. */
export const STORAGE_SETTING_NAMES = [
  'STORAGE_ADAPTER_MODE',
  'STORAGE_S3_ENDPOINT',
  'STORAGE_S3_PUBLIC_ENDPOINT',
  'STORAGE_S3_REGION',
  'STORAGE_S3_ACCESS_KEY',
  'STORAGE_S3_SECRET_KEY',
  'STORAGE_BUCKET',
  'STORAGE_REQUIRE_ENCRYPTION',
  'STORAGE_CREATE_BUCKETS',
  // Not the seam's own, but it decides with them: whether this is production.
  'NODE_ENV',
] as const;

export type StorageSettingName = (typeof STORAGE_SETTING_NAMES)[number];
export type StorageEnv = Partial<Record<StorageSettingName, string>>;

export const DEFAULT_REGION = 'us-east-1';
export const DEFAULT_BUCKET = 'injishi';

/** The API's own S3 credentials. Redacted when printed; see `credentialsOf`. */
export interface S3Credentials {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

export interface S3StorageConfig {
  /** Where this process reaches S3. An origin, never carrying credentials. */
  readonly endpoint: string;
  /**
   * The origin written into signed URLs, the one a browser can reach. Used to
   * sign and never to send, which is what lets it differ from `endpoint`: the
   * API talks to MinIO by its name inside the compose network while a guest's
   * phone fetches from `https://storage.injishi.com`.
   */
  readonly publicEndpoint: string;
  readonly region: string;
  readonly credentials: S3Credentials;
  /** This stack's one bucket (ADR-043: the demo has a MinIO of its own). */
  readonly bucket: string;
  /** Refuse to boot unless the bucket has default server-side encryption. */
  readonly requireEncryption: boolean;
  /** Create a missing bucket at boot. Development only. */
  readonly createBuckets: boolean;
  readonly production: boolean;
}

/**
 * Resolve the live store's configuration, or refuse with a message that names
 * the variable and says what to do about it.
 *
 * Error messages never echo a credential or a raw endpoint value: an endpoint
 * that fails to parse may be one with a password in it.
 */
export function resolveS3StorageConfig(env: StorageEnv): S3StorageConfig {
  const read = (name: StorageSettingName): string => env[name]?.trim() ?? '';
  const production = isProduction(read('NODE_ENV'));

  const missing = (
    ['STORAGE_S3_ENDPOINT', 'STORAGE_S3_ACCESS_KEY', 'STORAGE_S3_SECRET_KEY'] as const
  ).filter((name) => read(name) === '');
  if (missing.length > 0) {
    throw new Error(
      `STORAGE_ADAPTER_MODE=live needs ${missing.join(', ')}. Set ` +
        `${missing.length === 1 ? 'it' : 'them'} to the MinIO endpoint and the ` +
        "API's own access key (the ones minio-init provisions), or run with " +
        'STORAGE_ADAPTER_MODE=local.',
    );
  }

  const endpoint = originOf('STORAGE_S3_ENDPOINT', read('STORAGE_S3_ENDPOINT'));
  const publicEndpoint = read('STORAGE_S3_PUBLIC_ENDPOINT')
    ? originOf('STORAGE_S3_PUBLIC_ENDPOINT', read('STORAGE_S3_PUBLIC_ENDPOINT'))
    : endpoint;

  // Empty is unset. A compose file that interpolates an unset variable writes
  // `STORAGE_BUCKET=""`, and "" must mean "the default", never a bucket named
  // nothing.
  const bucket = bucketName('STORAGE_BUCKET', read('STORAGE_BUCKET') || DEFAULT_BUCKET);

  const createBuckets = flag('STORAGE_CREATE_BUCKETS', read('STORAGE_CREATE_BUCKETS'), false);
  if (createBuckets && production) {
    throw new Error(
      'STORAGE_CREATE_BUCKETS=true is refused under NODE_ENV=production. ' +
        'Production buckets are provisioned private and encrypted by minio-init ' +
        '(infra/docker/minio/provision.sh); a bucket the API created on its own ' +
        'would be neither. Unset STORAGE_CREATE_BUCKETS and provision the bucket.',
    );
  }

  return {
    endpoint,
    publicEndpoint,
    region: read('STORAGE_S3_REGION') || DEFAULT_REGION,
    credentials: credentialsOf(read('STORAGE_S3_ACCESS_KEY'), read('STORAGE_S3_SECRET_KEY')),
    bucket,
    requireEncryption: flag(
      'STORAGE_REQUIRE_ENCRYPTION',
      read('STORAGE_REQUIRE_ENCRYPTION'),
      production,
    ),
    createBuckets,
    production,
  };
}

/**
 * A plain origin: scheme, host and port.
 *
 * Credentials in the URL are refused rather than stripped, because a URL with a
 * password in it gets logged, and the SDK signs with the access key anyway. A
 * path is refused because signed URLs are written against this origin, and
 * "name the public storage host" means exactly that.
 */
function originOf(name: string, raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${name} must be a URL such as http://injishi-minio:9000.`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${name} must be an http or https URL, got scheme "${url.protocol}".`);
  }
  if (url.username || url.password) {
    throw new Error(
      `${name} must not carry credentials. The API signs with ` +
        'STORAGE_S3_ACCESS_KEY and STORAGE_S3_SECRET_KEY; remove the user:password part.',
    );
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(
      `${name} must be an origin (scheme, host and port) with no path, such as ${url.origin}.`,
    );
  }
  return url.origin;
}

/**
 * S3's bucket naming rule, checked at boot rather than discovered at the first
 * upload as an `InvalidBucketName` from inside a request.
 */
function bucketName(name: string, value: string): string {
  const valid =
    /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(value) &&
    !value.includes('..') &&
    !/^\d{1,3}(\.\d{1,3}){3}$/.test(value);
  if (!valid) {
    throw new Error(
      `${name} "${value}" is not a valid bucket name: 3 to 63 lowercase ` +
        'letters, digits, dots or hyphens, starting and ending with a letter or digit.',
    );
  }
  return value;
}

/**
 * A boolean setting. Unset or empty takes the default; anything that reads as
 * neither true nor false refuses, because "STORAGE_REQUIRE_ENCRYPTION=ture"
 * quietly meaning false is an unencrypted bucket that passed its boot check.
 */
function flag(name: string, raw: string, fallback: boolean): boolean {
  const value = raw.toLowerCase();
  if (value === '') return fallback;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  throw new Error(`${name} must be "true" or "false", got "${raw}".`);
}

/**
 * Credentials that print as redacted.
 *
 * The object is handed to the SDK as it is, so the two fields stay ordinary
 * properties. What changes is every way the object could reach a log line by
 * accident: `JSON.stringify` and `util.inspect` (which is what a logger, a
 * `console.log` of the config, or Nest's error formatter use) all see a
 * placeholder. Not frozen: the SDK annotates the credentials object it is given.
 */
function credentialsOf(accessKeyId: string, secretAccessKey: string): S3Credentials {
  const credentials = { accessKeyId, secretAccessKey };
  Object.defineProperties(credentials, {
    toJSON: { value: () => '[redacted]', enumerable: false },
    [inspect.custom]: { value: () => '[redacted credentials]', enumerable: false },
  });
  return credentials;
}

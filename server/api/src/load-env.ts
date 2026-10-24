/**
 * The env file, into `process.env`, before anything else loads.
 *
 * `main.ts` imports this ahead of every other module, because some modules read
 * `process.env` while they load (`shared/config/env-files.ts`, `loadEnvFiles`).
 * A side effect on import on purpose: an ES import list runs in order, so the
 * one way to run code before `AppModule` loads is a module of its own.
 */
import { loadEnvFiles } from './shared/config/env-files';

loadEnvFiles();

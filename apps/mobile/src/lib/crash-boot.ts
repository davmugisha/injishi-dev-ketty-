/**
 * Starts crash reporting, first thing (ADR-063, "Boot order on the phone").
 *
 * `index.js` imports this before `expo-router/entry`, so Sentry's JavaScript
 * and native handlers exist before Expo Router loads any route module, and an
 * error thrown while one loads is reported. It imports only the reporter, which
 * imports nothing that throws at load, and `startCrashReporting` never throws.
 */
import { startCrashReporting } from './crash-reporter';

startCrashReporting();

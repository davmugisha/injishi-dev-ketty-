import 'reflect-metadata';
// The env file first: modules below read process.env while they load
// (payments.module.ts picks its adapter from PAYMENT_ADAPTER_MODE). ConfigModule
// alone would load the file too late for them (shared/config/env-files.ts).
import './load-env';
// Then crash reporting, before any module below loads (ADR-063).
import './instrument';
import { AppModule } from './app.module';
import { isWorkerProcess } from './shared/process/process-role';

const bootstrap = isWorkerProcess() ? AppModule.worker : AppModule.main;

bootstrap().catch((error: unknown) => {
  // Logger is not available if bootstrap itself failed.
  console.error(error);
  process.exit(1);
});

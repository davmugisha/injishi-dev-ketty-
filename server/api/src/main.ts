import 'reflect-metadata';
import { AppModule } from './app.module';
import { isWorkerProcess } from './shared/process/process-role';

const bootstrap = isWorkerProcess() ? AppModule.worker : AppModule.main;

bootstrap().catch((error: unknown) => {
  // Logger is not available if bootstrap itself failed.
  console.error(error);
  process.exit(1);
});

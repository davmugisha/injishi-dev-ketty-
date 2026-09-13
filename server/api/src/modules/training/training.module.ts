import { Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { isWorkerProcess } from '../../shared/process/process-role';
import { MailerModule } from '../mailer/mailer.module';
import { StorageModule } from '../storage/storage.module';
import { TrainingCatalogueService } from './application/training-catalogue.service';
import { TrainingCertificateService } from './application/training-certificate.service';
import { TrainingNotificationsService } from './application/training-notifications.service';
import { TrainingRegistrationService } from './application/training-registration.service';
import { TrainingRosterService } from './application/training-roster.service';
import { TrainingSessionService } from './application/training-session.service';
import { TrainingVerificationService } from './application/training-verification.service';
import {
  CERTIFICATE_RENDERER,
  type CertificateRenderer,
} from './domain/training-certificate';
import {
  TRAINING_CONFIG,
  readTrainingConfig,
  type TrainingConfig,
} from './domain/training-config';
import { VERIFICATION_CACHE } from './domain/verification-cache';
import { InMemoryVerificationCache } from './infrastructure/in-memory-verification-cache';
import { PdfCertificateRenderer } from './infrastructure/pdf-certificate.renderer';
import { TrainingMailProcessor } from './infrastructure/training-mail.processor';
import { TrainingMailer } from './infrastructure/training-mailer';

/**
 * The training domain (ADR-049, F-S15).
 *
 * Six services, one per question the feature answers, and two seams. Nothing
 * outside this module names an adapter, the same rule the storage and payment
 * seams follow.
 *
 * `StorageModule` is imported for `StorageService`, which owns writing a
 * `stored_objects` row beside the bytes. The training module deliberately does
 * NOT reach for `STORAGE_PORT` itself: a second writer of that table is how an
 * object without a row eventually exists, and an object without a row is
 * outside retention and outside legal hold.
 *
 * Both seams are exported alongside the services because the controllers need
 * neither, and the ADMIN and PUBLIC controller modules need the services. The
 * config provider is exported too, so the verification throttler can read the
 * per-IP limit from the same place everything else reads it.
 */
export function buildTrainingProviders(): Provider[] {
  return [
    {
      provide: TRAINING_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService): TrainingConfig =>
        readTrainingConfig(config),
    },
    {
      // `pdf-lib` drawing vector rectangles, per ADR-049. The seam exists so a
      // later decision about what a certificate LOOKS like is one provider,
      // and because the artwork is explicitly unspecified in the ADR.
      provide: CERTIFICATE_RENDERER,
      useClass: PdfCertificateRenderer,
    },
    {
      // In this process's memory. `domain/verification-cache.ts` records what
      // that costs on more than one API instance and what replaces it.
      provide: VERIFICATION_CACHE,
      useClass: InMemoryVerificationCache,
    },
    TrainingCatalogueService,
    TrainingSessionService,
    TrainingRegistrationService,
    TrainingRosterService,
    TrainingCertificateService,
    TrainingVerificationService,
    // Queues what a learner is told (ADR-049 AC-20, AC-21). In BOTH processes:
    // the HTTP one raises the events, and the worker's reminder job calls it
    // back to fan one due reminder out into a mail per learner.
    TrainingNotificationsService,
    // The words. Registered either side because the processor is the only
    // consumer and a provider nothing injects costs nothing.
    TrainingMailer,
    // The sender runs in the worker alone, the same shape `BookingModule` uses.
    // A processor in the HTTP process would have the API competing with the
    // worker for jobs it has no business drawing.
    ...(isWorkerProcess() ? [TrainingMailProcessor] : []),
  ];
}

@Module({
  // `MailerModule` for `MAILER_PORT`, which `TrainingMailer` composes into.
  // Training never names a transport, the same rule the storage seam follows.
  imports: [StorageModule, MailerModule],
  providers: buildTrainingProviders(),
  exports: [
    TRAINING_CONFIG,
    TrainingCatalogueService,
    TrainingSessionService,
    TrainingRegistrationService,
    TrainingRosterService,
    TrainingCertificateService,
    TrainingVerificationService,
    TrainingNotificationsService,
  ],
})
export class TrainingModule {}

/** Re-exported so a consumer can type an injected renderer without the path. */
export type { CertificateRenderer };

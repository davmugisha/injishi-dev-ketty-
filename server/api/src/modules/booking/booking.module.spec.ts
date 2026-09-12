import { getQueueToken } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';

import { DRIZZLE } from '../../shared/database/database.module';
import { QUEUES } from '../../shared/queues/queues.module';
import { MAILER_PORT, type MailerPort } from '../mailer/domain/mailer-port';
import { BookingNotificationsService } from './application/booking-notifications.service';
import { BookingMailer } from './infrastructure/booking-mailer';

/**
 * The wiring that only fails at BOOT.
 *
 * Every other test in this module constructs its services by hand —
 * `new BookingService(repo, listings, payments, …)` — which is the right shape
 * for testing money ordering and the wrong shape for catching a missing module
 * import. A provider that Nest cannot resolve does not fail a typecheck, does
 * not fail a unit test, and does not fail a route: it fails at start-up, on a
 * container nobody is watching, with a "can't resolve dependencies of the
 * BookingMailer (?)" that names a class rather than the import that is absent.
 *
 * That is not hypothetical. `BookingMailer` injects `MAILER_PORT`, and
 * `MailerModule` is not `@Global` — so adding the booking emails (ADR-047)
 * without adding that import would have taken the ENTIRE API down, every
 * endpoint, until someone read a stack trace. `EbmModule` pins its own
 * structure for the same reason and says so in as many words.
 */
describe('BookingModule wiring', () => {
  const mailer: MailerPort = { send: async () => undefined };

  /** Stands in for the `@Global` database and queue modules. */
  @Global()
  @Module({
    providers: [
      { provide: DRIZZLE, useValue: {} },
      {
        provide: getQueueToken(QUEUES.email),
        useValue: { add: jest.fn().mockResolvedValue({}) },
      },
    ],
    exports: [DRIZZLE, getQueueToken(QUEUES.email)],
  })
  class FakeInfrastructureModule {}

  /**
   * `BookingMailer` resolves only because something supplies `MAILER_PORT`.
   *
   * The real graph gets it from `MailerModule`, which `BookingModule` imports.
   * Here the port is faked, because what is being pinned is that the MAILER is
   * constructible at all with nothing but a port — if it ever grows a second
   * dependency, this fails here rather than at boot.
   */
  async function build(): Promise<TestingModule> {
    return Test.createTestingModule({
      imports: [FakeInfrastructureModule],
      providers: [
        { provide: MAILER_PORT, useValue: mailer },
        BookingMailer,
        BookingNotificationsService,
      ],
    }).compile();
  }

  it('constructs the mailer from the port alone', async () => {
    const moduleRef = await build();
    expect(moduleRef.get(BookingMailer)).toBeInstanceOf(BookingMailer);
  });

  it('constructs the notifications service from the Email queue alone', async () => {
    const moduleRef = await build();
    expect(moduleRef.get(BookingNotificationsService)).toBeInstanceOf(
      BookingNotificationsService,
    );
  });

  /**
   * The guarantee every caller depends on: `notify` is called from paths that
   * have ALREADY taken money and committed a booking, so it must never throw.
   * A queue that refuses is a late email, not a rolled-back reservation.
   */
  it('swallows a queue failure rather than failing a committed booking', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeInfrastructureModule],
      providers: [
        { provide: MAILER_PORT, useValue: mailer },
        BookingMailer,
        BookingNotificationsService,
      ],
    })
      .overrideProvider(getQueueToken(QUEUES.email))
      .useValue({
        add: jest.fn().mockRejectedValue(new Error('redis is down')),
      })
      .compile();

    const notifications = moduleRef.get(BookingNotificationsService);
    await expect(
      notifications.notify('booking-1', 'confirmed'),
    ).resolves.toBeUndefined();
  });

  it('deduplicates by booking and event, so one booking sends one mail', async () => {
    const moduleRef = await build();
    const queue = moduleRef.get<{ add: jest.Mock }>(getQueueToken(QUEUES.email));
    const notifications = moduleRef.get(BookingNotificationsService);

    await notifications.notify('booking-1', 'confirmed');
    await notifications.notify('booking-1', 'confirmed');

    expect(queue.add.mock.calls[0][2].jobId).toBe(
      queue.add.mock.calls[1][2].jobId,
    );
  });
});

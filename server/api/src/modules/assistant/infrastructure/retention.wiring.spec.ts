import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { DatabaseModule } from '../../../shared/database/database.module';
import { AssistantRetentionService } from '../application/retention.service';
import { RetentionRepository } from './retention.repository';

/**
 * The retention providers resolve against what `DatabaseModule` actually
 * EXPORTS (ADR-061 slice H).
 *
 * The first version injected `PG_POOL`, which the module deliberately keeps to
 * itself. Every unit test passed, because each built the repository by hand,
 * and the API then refused to boot (found in the live walk). This builds the
 * providers through Nest's injector against a stand in that exports exactly
 * the real module's export list, read from its metadata rather than copied, so
 * a token the real module does not share fails here instead of at boot.
 */
describe('retention wiring (ADR-061 D-d)', () => {
  it('injects only tokens DatabaseModule exports', async () => {
    const exported = (Reflect.getMetadata('exports', DatabaseModule) ?? []) as unknown[];
    expect(exported.length).toBeGreaterThan(0);

    @Global()
    @Module({
      providers: exported.map((token) => ({ provide: token as symbol, useValue: {} })),
      exports: exported as symbol[],
    })
    class ExportedDatabase {}

    const moduleRef = await Test.createTestingModule({
      imports: [ExportedDatabase],
      providers: [RetentionRepository, AssistantRetentionService],
    }).compile();

    expect(moduleRef.get(AssistantRetentionService)).toBeInstanceOf(AssistantRetentionService);
  });
});

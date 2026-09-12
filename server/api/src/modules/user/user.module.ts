import { Module } from '@nestjs/common';

import { ProfileService } from './application/profile.service';
import { ProfileRepository } from './infrastructure/profile.repository';

/**
 * Identity capture — the person behind a login (architecture.md, `user`).
 *
 * Layering matches every other module: application/ (use cases) —
 * infrastructure/ (Drizzle). `ProfileService` is the only export, so nothing
 * outside can write `identity_documents` around the uniqueness rule that makes
 * "one human, one account" true.
 */
@Module({
  providers: [ProfileRepository, ProfileService],
  exports: [ProfileService],
})
export class UserModule {}

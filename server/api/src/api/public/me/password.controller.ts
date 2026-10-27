import type { AuthInstance } from '@injishi/auth';
import { Body, Controller, Get, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';

import { AUTH_INSTANCE } from '../../../modules/auth/auth.module';
import {
  PasswordSetupService,
  type PasswordStatus,
} from '../../../modules/auth/application/password-setup.service';
import {
  CurrentSession,
  CurrentUser,
  SessionGuard,
  type SessionRecord,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * The signed-in person's password (2026-10-23). Passwords are for tenants
 * only: `GET` says whether one is offered and whether it is set, `POST` sets a
 * tenant's FIRST password straight after the invitation's emailed code.
 * Changing one is Better Auth's own `/change-password`, which needs the
 * current password.
 */
const CreatePassword = z.object({
  password: z.string().min(8, 'Use at least 8 characters.').max(128, 'Use at most 128 characters.'),
});
type CreatePassword = z.infer<typeof CreatePassword>;

interface RawRequest {
  headers: Record<string, string | string[] | undefined>;
}

function toHeaders(raw: RawRequest['headers']): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else if (value != null) headers.append(key, String(value));
  }
  return headers;
}

type SetPasswordApi = (args: { body: { newPassword: string }; headers: Headers }) => Promise<unknown>;

@Controller('me/password')
@UseGuards(SessionGuard)
export class PasswordController {
  constructor(
    private readonly passwords: PasswordSetupService,
    @Inject(AUTH_INSTANCE) private readonly auth: AuthInstance,
  ) {}

  @Get()
  status(@CurrentUser() user: SessionUser): Promise<PasswordStatus> {
    return this.passwords.status(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: SessionUser,
    @CurrentSession() session: SessionRecord,
    @Req() request: RawRequest,
    @Body(new ZodValidationPipe(CreatePassword)) body: CreatePassword,
  ): Promise<PasswordStatus> {
    const setPassword = this.auth.api.setPassword as unknown as SetPasswordApi;
    return this.passwords.create(user.id, session.id, body.password, async (newPassword) => {
      await setPassword({ body: { newPassword }, headers: toHeaders(request.headers) });
    });
  }
}

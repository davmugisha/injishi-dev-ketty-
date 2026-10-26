import {
  KioskPairRequest,
  KioskPunchRequest,
  type KioskPunchResult,
  type KioskSession,
} from '@injishi/contracts';
import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';

import { KioskService, type KioskContext } from '../../../modules/hr/application/kiosk.service';
import { isProduction } from '../../../shared/config/security.config';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import { KioskThrottlerGuard } from './kiosk-throttler.guard';
import { CurrentKiosk, KIOSK_COOKIE, KIOSK_COOKIE_PATH, KioskGuard } from './kiosk.guard';

/**
 * The part of Fastify's reply this controller uses, as `@fastify/cookie`
 * decorates it. Spelled out rather than imported, as `auth-http.ts` does: the
 * API does not depend on `fastify` directly.
 */
interface CookieReply {
  setCookie(
    name: string,
    value: string,
    options: { path: string; httpOnly: boolean; sameSite: 'strict'; secure: boolean; maxAge: number },
  ): unknown;
  clearCookie(name: string, options: { path: string }): unknown;
}

/** Browsers cap a cookie's life at 400 days; a kiosk past that pairs again. */
const KIOSK_COOKIE_MAX_AGE_S = 400 * 24 * 60 * 60;

/**
 * The kiosk -> /api/v1/kiosk (ADR-058, 058-time AC-TM10).
 *
 * A shared tablet on web's `/kiosk` page. No session: `pair` trades a one time
 * code for a device token, set here as an HttpOnly, SameSite=Strict cookie on
 * these routes only and never in a body, so the page cannot read it. After
 * that `KioskGuard` is the door, and the kiosk answers with a branch name and,
 * after a right PIN, the name of the person who punched. It never lists people.
 */
@Controller({ path: 'kiosk', version: '1' })
export class KioskController {
  constructor(
    private readonly kiosks: KioskService,
    private readonly config: ConfigService,
  ) {}

  @Post('pair')
  @HttpCode(200)
  @UseGuards(KioskThrottlerGuard)
  @SkipThrottle({ 'kiosk-punch': true })
  async pair(
    @Body(new ZodValidationPipe(KioskPairRequest)) body: KioskPairRequest,
    @Req() request: { ip?: string; protocol?: string },
    @Res({ passthrough: true }) reply: CookieReply,
  ): Promise<KioskSession> {
    const { token, session } = await this.kiosks.pair(body.code, request.ip);
    reply.setCookie(KIOSK_COOKIE, token, {
      path: KIOSK_COOKIE_PATH,
      httpOnly: true,
      sameSite: 'strict',
      // A laptop serves plain http; Chrome keeps a Secure cookie for localhost
      // anyway, but other browsers would drop it, so it is Secure where it can be.
      secure: isProduction(this.config.get<string>('NODE_ENV')) || request.protocol === 'https',
      maxAge: KIOSK_COOKIE_MAX_AGE_S,
    });
    return session;
  }

  @Get('session')
  @UseGuards(KioskGuard)
  session(@CurrentKiosk() kiosk: KioskContext): KioskSession {
    return this.kiosks.session(kiosk);
  }

  /** In when the person has no open record, else out. Validated as it is written. */
  @Post('punch')
  @HttpCode(200)
  @UseGuards(KioskGuard, KioskThrottlerGuard)
  @SkipThrottle({ 'kiosk-pair': true })
  punch(
    @Body(new ZodValidationPipe(KioskPunchRequest)) body: KioskPunchRequest,
    @CurrentKiosk() kiosk: KioskContext,
  ): Promise<KioskPunchResult> {
    return this.kiosks.punch(kiosk, body);
  }

  /** The tablet forgets its pairing; the kiosk stays, for a new code. */
  @Post('forget')
  @HttpCode(204)
  forget(@Res({ passthrough: true }) reply: CookieReply): void {
    reply.clearCookie(KIOSK_COOKIE, { path: KIOSK_COOKIE_PATH });
  }
}

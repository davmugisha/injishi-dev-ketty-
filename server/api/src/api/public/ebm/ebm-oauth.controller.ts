import { Controller, Get, Query, Redirect, UseGuards } from '@nestjs/common';

import { EbmConnectionService } from '../../../modules/ebm/application/ebm-connection.service';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';

/**
 * Where the EBM provider sends the taxpayer's browser after consent →
 * GET /api/v1/ebm/oauth/callback (ADR-041). Must equal `EBM_OAUTH_REDIRECT_URI`
 * and the redirect URI registered with the provider.
 *
 * `SessionGuard` only. This is a top-level browser navigation from another
 * origin, so it carries the session cookie and no workspace header; the org is
 * recovered from the single-use `state`, and the service checks the signed-in
 * person is the one who started the consent. No permission is re-checked here
 * because none is being exercised: `ebm.manage` was required to START the
 * consent, and the state is only redeemable by the person who held it then.
 *
 * Every outcome is a redirect back to the operator app, never a JSON body: the
 * person is mid-navigation, and an error document would strand them on the API
 * origin with nothing to click.
 */
@Controller({ path: 'ebm/oauth', version: '1' })
@UseGuards(SessionGuard)
export class EbmOauthController {
  constructor(private readonly ebm: EbmConnectionService) {}

  @Get('callback')
  @Redirect()
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @CurrentUser() user: SessionUser,
  ): Promise<{ url: string; statusCode: number }> {
    const url = await this.ebm.complete(
      {
        code: typeof code === 'string' ? code : undefined,
        state: typeof state === 'string' ? state : undefined,
        error: typeof error === 'string' ? error : undefined,
      },
      user.id,
    );
    // 303: the next request is a plain GET of the operator app, whatever
    // method arrived here.
    return { url, statusCode: 303 };
  }
}

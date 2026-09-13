import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  GuestMessage,
  GuestMessagePage,
  MyProfile,
  MyThreads,
  MyTrips,
  OversightConsoleGrant,
  StaffAccess,
  WorkspaceAccess,
} from '@injishi/contracts';
import {
  MessagePageQuery,
  PersonalDetails,
  SendGuestMessageInput,
  staffRequiresStepUp,
  workspaceLabel,
} from '@injishi/contracts';

import { GuestTripsService } from '../../../modules/booking/application/guest-trips.service';
import { MessagingService } from '../../../modules/operations/application/messaging.service';
import { ProfileService } from '../../../modules/user/application/profile.service';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

import {
  CurrentSession,
  CurrentUser,
  SessionGuard,
  type SessionRecord,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import {
  TwoFactorService,
  type TwoFactorStatus,
} from '../../../shared/auth/two-factor.service';
import { WorkspaceService } from '../../../shared/auth/workspace.service';

/**
 * Who am I, and what may I do (Spec 0004).
 *
 * The operator app used to answer both from local state, which made its role
 * picker a costume rather than a credential. These routes are the replacement:
 * the workspace list is derived from real grants, and the active workspace is
 * recorded on the session server-side.
 */
@Controller('me')
@UseGuards(SessionGuard)
export class MeController {
  constructor(
    private readonly workspaces: WorkspaceService,
    private readonly profiles: ProfileService,
    private readonly twoFactor: TwoFactorService,
    private readonly trips: GuestTripsService,
    private readonly messaging: MessagingService,
  ) {}

  /**
   * The caller's own stays — every booking they hold, newest first.
   *
   * This is the endpoint `/trips` in `apps/web` did not have. That screen
   * rendered a hardcoded empty state, which meant a guest who had just paid was
   * shown "No trips yet" with their money in escrow; the page had to be reworded
   * to admit it could not list anything. It can now.
   *
   * The guest id comes from the SESSION and there is no parameter to override
   * it. A route that took a user id would be a route somebody would eventually
   * pass somebody else's; `GuestTripsRepository` scopes the query by it too, so
   * the safety is in both layers rather than in a reviewer's memory.
   */
  @Get('trips')
  myTrips(@CurrentUser() user: SessionUser): Promise<MyTrips> {
    return this.trips.forGuest(user.id);
  }

  /**
   * The caller's own conversations (ADR-032).
   *
   * `SessionGuard` alone, and no `@RequirePermission`, which is a decision and
   * not an omission: `require-permission-on-guarded-route` governs routes behind
   * `WorkspaceGuard` or `StaffGuard`, and a thread's workspace is the PROPERTY's,
   * so neither guard can speak for a guest. Ownership is the guard here —
   * `MessagingService.assertMine()` resolves the thread through its subject and
   * answers 404 for anything that is not this person's.
   */
  @Get('threads')
  async myThreads(@CurrentUser() user: SessionUser): Promise<MyThreads> {
    return { threads: await this.messaging.listGuestThreads(user.id) };
  }

  /**
   * One conversation, newest messages first, paged by cursor.
   *
   * Cursor rather than page number because a chat gains messages while somebody
   * is reading it, and an offset would skip or repeat a line every time it did.
   */
  @Get('threads/:id/messages')
  myThreadMessages(
    @Param('id', new ParseUUIDPipe()) threadId: string,
    @Query(new ZodValidationPipe(MessagePageQuery)) query: MessagePageQuery,
    @CurrentUser() user: SessionUser,
  ): Promise<GuestMessagePage> {
    return this.messaging.listGuestMessages(user.id, threadId, query);
  }

  /** Say something. The sender is the session; the body cannot name one. */
  @Post('threads/:id/messages')
  sendToThread(
    @Param('id', new ParseUUIDPipe()) threadId: string,
    @Body(new ZodValidationPipe(SendGuestMessageInput))
    body: SendGuestMessageInput,
    @CurrentUser() user: SessionUser,
  ): Promise<GuestMessage> {
    return this.messaging.sendGuestMessage(user.id, threadId, body);
  }

  /**
   * I have read this conversation. 204, because there is nothing to say back.
   *
   * The time recorded is the server's, never a client's: a device with a fast
   * clock would mark messages that have not arrived yet as already read, and
   * they would never show as unread again.
   */
  @Post('threads/:id/read')
  @HttpCode(204)
  async markThreadRead(
    @Param('id', new ParseUUIDPipe()) threadId: string,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    await this.messaging.markGuestRead(user.id, threadId);
  }

  /**
   * The caller's own Step 1 answers — name, document, gender, date of birth,
   * phone, address — plus whether they add up to a complete profile (FL01 §1).
   *
   * A new account gets every field null and `complete: false`, which is what
   * tells the wizard to ask rather than to confirm. The identity document comes
   * back masked; the full number is never sent to a browser.
   */
  @Get('profile')
  myProfile(@CurrentUser() user: SessionUser): Promise<MyProfile> {
    return this.profiles.read(user.id);
  }

  /**
   * Save Step 1.
   *
   * A PUT because it replaces the whole block rather than merging a patch into
   * it: a person correcting their document type must not be left holding half
   * of the old answer. Refuses with 409 when the document already anchors
   * another account, which routes to recovery rather than a second identity.
   *
   * Registration also accepts this block inline, so a first-time registrant
   * never has to call this route. It exists because a returning person editing
   * their details is not registering anything.
   */
  @Put('profile')
  saveProfile(
    @Body(new ZodValidationPipe(PersonalDetails)) body: PersonalDetails,
    @CurrentUser() user: SessionUser,
  ): Promise<MyProfile> {
    return this.profiles.save(user.id, body);
  }

  /**
   * Every workspace the caller actually holds, each with the permissions that
   * apply there. A person legitimately holds several.
   */
  @Get('workspaces')
  async listWorkspaces(
    @CurrentUser() user: SessionUser,
    @CurrentSession() session: SessionRecord,
  ): Promise<{
    workspaces: (WorkspaceAccess & { label: string })[];
    activeWorkspaceId: string | null;
    /**
     * Whether the emailed step-up stands between this session and the operator
     * screens (F-S02). Sent with the grants so the operator app learns it from
     * the same answer it learns what it holds, and can send the person to the
     * code screen before any 403 rather than after one.
     */
    twoFactor: TwoFactorStatus;
  }> {
    const [found, activeWorkspaceId, grants, twoFactorState] =
      await Promise.all([
        this.workspaces.listForUser(user.id),
        this.workspaces.activeWorkspaceIdFor(session.id),
        this.workspaces.oversightGrantsForUser(user.id),
        this.twoFactor.stateFor(user.id, session.id),
      ]);
    const required =
      found.some((w) => w.kind === 'business' || w.kind === 'broker') ||
      grants.length > 0;
    return {
      twoFactor: { required, ...twoFactorState },
      workspaces: found.map((w) => ({ ...w, label: workspaceLabel(w) })),
      // The workspace this session last acted in (ADR-018, D-m). It is what
      // lets the redirect shim tell three hotels apart, all of which rank the
      // same on kind. A hint about ORDER, never about access: every workspace
      // in the list above is one the caller holds, and this names one of them
      // or nothing.
      activeWorkspaceId,
    };
  }

  /**
   * The government consoles the caller may open. Empty when they hold no active
   * assignment, which is the same outcome as holding none at all — a revoked
   * grant does not leave a blank console behind.
   */
  @Get('oversight')
  async listOversight(
    @CurrentUser() user: SessionUser,
    @CurrentSession() session: SessionRecord,
  ): Promise<{
    /**
     * Every seat this person holds, with the words their console renders
     * (ADR-049, AC-G5).
     *
     * It used to return the body CODE and nothing else resolvable, so the console
     * rendered the officer's name, institution, title and district from a static
     * fixture of two invented officers. Those are all here now, read from the
     * database, and the fixture is deleted.
     */
    consoles: OversightConsoleGrant[];
    /** Same answer as `/me/workspaces` carries, for the console's own gate. */
    twoFactor: TwoFactorStatus;
  }> {
    const [consoles, twoFactor] = await Promise.all([
      this.workspaces.oversightConsoleGrantsForUser(user.id),
      this.twoFactor.statusFor(user.id, session.id),
    ]);
    return { twoFactor, consoles };
  }

  /**
   * Whether the caller is platform staff, and which powers that carries.
   *
   * The admin console's gate. It is served from `/me/*` beside the workspace
   * list rather than from an admin-only controller on purpose: this route has
   * to answer for a caller who is NOT staff, and answer `isStaff: false`
   * plainly, so the console can tell "you may not open this" from "we could not
   * ask". A route mounted behind a staff guard could only ever 403, and a 403
   * is indistinguishable from a server that is having a bad day. That is also
   * why this route is NOT behind `StaffGuard` now that the guard demands the
   * emailed step-up: the console has to learn the step-up is owed from here.
   *
   * `twoFactor` tells the console, before it renders, whether `StaffGuard`
   * would refuse this session for the emailed code (F-S02). Without it the
   * console's first sign would be a page read coming back 403 halfway through
   * painting. Reporting it here, beside the grant, means the boundary decides
   * "enter your code" from the same answer it decides "you are staff" — the way
   * `/me/workspaces` already carries `twoFactor` for the operator app.
   *
   * `required` comes from `staffRequiresStepUp`, the rule the guard enforces,
   * and deliberately NOT from `TwoFactorService.statusFor`: that answers the
   * operator and officer rule, which does not count staff, so it would tell a
   * staffer holding no workspace "not required" while the guard refuses them.
   * The session read runs beside the staff read for everyone, so a non-staffer
   * pays no extra latency and is still told `required: false` rather than
   * being asked for a code that would open nothing.
   */
  @Get('staff')
  async myStaffAccess(
    @CurrentUser() user: SessionUser,
    @CurrentSession() session: SessionRecord,
  ): Promise<StaffAccess> {
    const [access, state] = await Promise.all([
      this.workspaces.staffAccessForUser(user.id),
      this.twoFactor.stateFor(user.id, session.id),
    ]);
    return {
      ...access,
      twoFactor: { required: staffRequiresStepUp(access), ...state },
    };
  }

  /** Whether this person may take on a privileged role (Spec 0003 gate). */
  @Get('may-elevate')
  async mayElevate(
    @CurrentUser() user: SessionUser,
  ): Promise<{ mayElevate: boolean }> {
    return { mayElevate: await this.workspaces.mayElevate(user.id) };
  }

  /**
   * Switch the workspace this session is acting in, refusing when the caller
   * does not hold it. This is the thin end-to-end thread: the guard is the
   * control, and the choice is recorded server-side on `sessions`, not kept in
   * the client's head.
   */
  @Post('active-workspace')
  @UseGuards(WorkspaceGuard)
  async setActiveWorkspace(
    @CurrentSession() session: SessionRecord,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<{
    activeWorkspace: WorkspaceAccess & { label: string };
    persisted: boolean;
  }> {
    // The body carries `workspaceId`, and `WorkspaceGuard` is the only thing
    // that reads it. Binding it to a parameter here would declare a value this
    // method never uses.
    const written = await this.workspaces.setActiveWorkspace(
      session.id,
      workspace.workspaceId,
    );
    return {
      activeWorkspace: { ...workspace, label: workspaceLabel(workspace) },
      persisted: written === 1,
    };
  }
}

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import * as c from "../dist/index.js";

describe("signing and invitations (WP 1.5b)", () => {
  test("a resend with a new email runs the typo guard, unless confirmed", () => {
    assert.equal(c.ResendInvitationRequest.safeParse({}).success, true);
    const typo = c.ResendInvitationRequest.safeParse({ email: "aline@gmial.com" });
    assert.equal(typo.success, false);
    assert.equal(typo.error.issues[0].message, "Check the email. Did you mean aline@gmail.com?");
    assert.deepEqual(typo.error.issues[0].path, ["email"]);
    const confirmed = c.ResendInvitationRequest.parse({ email: " Aline@Gmial.com ", confirmEmail: true });
    assert.equal(confirmed.email, "aline@gmial.com");
  });

  test("an invitation token is base64url of 32 to 64 characters", () => {
    assert.equal(c.LeaseInvitationToken.safeParse("a".repeat(43)).success, true);
    assert.equal(c.LeaseInvitationToken.safeParse("short").success, false);
    assert.equal(c.LeaseInvitationToken.safeParse("a".repeat(42) + "/").success, false);
  });

  test("accepting takes a token or an invitation id, never both or neither", () => {
    assert.equal(c.AcceptLeaseInvitationRequest.safeParse({ token: "b".repeat(43) }).success, true);
    assert.equal(c.AcceptLeaseInvitationRequest.safeParse({ invitationId: "66666666-6666-4666-8666-666666666666" }).success, true);
    assert.equal(c.AcceptLeaseInvitationRequest.safeParse({}).success, false);
    assert.equal(
      c.AcceptLeaseInvitationRequest.safeParse({ token: "b".repeat(43), invitationId: "66666666-6666-4666-8666-666666666666" }).success,
      false,
    );
  });

  test("the landlord's signature may confirm the tenant's email", () => {
    const hash = "a".repeat(64);
    const body = c.SignLeaseRequest.parse({ typedName: "Jean Mugabo", code: "123456", documentHash: hash, confirmEmail: true });
    assert.equal(body.confirmEmail, true);
  });

  test("the app paths the emails link to", () => {
    const id = "66666666-6666-4666-8666-666666666666";
    assert.equal(c.RENTALS_APP_PATHS.invitation("tok_1"), "/invite/lease/tok_1");
    assert.equal(c.RENTALS_APP_PATHS.tenantLease(id), `/home/${id}/lease`);
    assert.equal(c.RENTALS_APP_PATHS.landlordLease(id), `/leases/${id}`);
  });

  test("the code and invitation windows", () => {
    assert.equal(c.SIGNING_CODE_TTL_SECONDS, 600);
    assert.equal(c.SIGNING_CODE_MAX_ATTEMPTS, 5);
    assert.equal(c.SIGNING_CODE_RESEND_SECONDS, 60);
    assert.equal(c.LEASE_INVITATION_DAYS, 14);
  });
});

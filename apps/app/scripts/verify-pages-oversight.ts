/**
 * The officer and setup pages, rendered by the running app (:3002) for each person over HTTP, exactly as a
 * browser gets them: the API's own Better Auth session cookie, which the app reads as it is.
 *
 *   APP_URL=http://localhost:3002 pnpm --filter @injishi/app exec tsx scripts/verify-pages-oversight.ts
 *
 * Proves, on a registration created for this run:
 *   - the Gasabo field verifier's /officer lists it by name, with no sample business on the page;
 *   - its /officer/cases/<orgId> renders the case with the verifier's decision controls;
 *   - after field verification, the approver's case page offers the approval;
 *   - after approval, the owner's /w/<workspaceId>/setup renders the live setup steps for their own business;
 *   - a business still in review gets the closed setup page; another person's workspace is a 404;
 *   - signed out, the setup page sends the person to sign in and back, and sign-in keeps the way back.
 * Prints "PAGES OK <n>" only when every check held.
 */
import { approve, fieldVerify } from "../src/server/mutations/oversight";
import { check, contextForEmail, cookieForEmail, main } from "./lib/harness";
import { GASABO, OFFICERS, registerBusiness } from "./lib/registration";

const APP = (process.env.APP_URL ?? "http://localhost:3002").replace(/\/$/, "");

/** Sample businesses the oversight fixtures draw; none may appear on a live page. */
const SAMPLE_NAMES = [
  "Kivu Sunset Guesthouse",
  "Rubona Bay Cottages",
  "Gisenyi Beach Lodge",
  "Isangano Lakeside Hotel",
];

let checks = 0;
function expect(condition: unknown, message: string): asserts condition {
  check(condition, message);
  checks++;
}

/** A page as this person's browser gets it. Next dev compiles a route on first request, so the wait is long. */
async function page(path: string, email: string | null): Promise<{ status: number; html: string; location: string }> {
  const headers: Record<string, string> = { accept: "text/html" };
  if (email) headers.cookie = await cookieForEmail(email);
  const res = await fetch(`${APP}${path}`, { headers, redirect: "manual", signal: AbortSignal.timeout(240_000) });
  return { status: res.status, html: await res.text(), location: res.headers.get("location") ?? "" };
}

/** Text a person reads, without markup, so a check cannot pass on an attribute or a script payload alone. */
function visible(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");
}

function workspaceOf(ctx: Awaited<ReturnType<typeof contextForEmail>>): string {
  const ws = ctx.account?.workspaces.find((w) => w.kind === "business");
  check(ws, "the owner holds no business workspace");
  return ws.workspaceId;
}

void main(async () => {
  const business = await registerBusiness(GASABO, "pages");
  console.log(`  registered ${business.legalName}`);

  // ── The field verifier ───────────────────────────────────────────────────────────────────────────
  const queue = await page("/officer", OFFICERS.gasaboVerifier);
  expect(queue.status === 200, `the verifier's /officer answered ${queue.status}`);
  const queueText = visible(queue.html);
  expect(queueText.includes(business.legalName), "the verifier's /officer does not list the new registration");
  for (const name of SAMPLE_NAMES)
    expect(!queueText.includes(name), `the verifier's /officer shows the sample "${name}"`);
  expect(queueText.includes("Gasabo"), "the verifier's /officer does not name their jurisdiction");
  console.log("  /officer lists it for the Gasabo verifier, with no sample business");

  const caseUrl = `/officer/cases/${business.orgId}`;
  const verifierCase = await page(caseUrl, OFFICERS.gasaboVerifier);
  expect(verifierCase.status === 200, `the verifier's case page answered ${verifierCase.status}`);
  const verifierText = visible(verifierCase.html);
  expect(verifierText.includes(business.legalName), "the case page does not name the business");
  expect(verifierText.includes("Record verification"), "the verifier's case page offers no verification");
  expect(
    verifierText.includes("Record rejection") || verifierText.includes("Reject"),
    "the case page offers no rejection",
  );
  expect(
    !verifierText.includes("Request more information"),
    "the live case offers an information request the API cannot record",
  );
  console.log("  the case page renders with the verifier's decision controls");

  const elsewhere = await page(caseUrl, OFFICERS.otherDistrictVerifier);
  expect(elsewhere.status === 404, `an out-of-district verifier's case page answered ${elsewhere.status}, not 404`);

  // ── The approver ─────────────────────────────────────────────────────────────────────────────────
  await fieldVerify(await contextForEmail(OFFICERS.gasaboVerifier), business.orgId);
  const approverCase = await page(caseUrl, OFFICERS.gasaboApprover);
  expect(approverCase.status === 200, `the approver's case page answered ${approverCase.status}`);
  const approverText = visible(approverCase.html);
  expect(approverText.includes("Approve this business"), "the approver's case page offers no approval");
  expect(
    approverText.includes("You are the approving officer"),
    "the approver's case page does not say whose decision it is",
  );
  console.log("  after field verification the approver's case page offers the approval");

  // ── The owner's setup ────────────────────────────────────────────────────────────────────────────
  const closed = await registerBusiness(GASABO, "pages-closed");
  const closedWs = workspaceOf(await contextForEmail(closed.email));
  const closedPage = await page(`/w/${closedWs}/setup`, closed.email);
  expect(closedPage.status === 200, `the closed setup page answered ${closedPage.status}`);
  const closedText = visible(closedPage.html);
  expect(
    closedText.includes("Setup opens once your registration is approved"),
    "a business in review is not told setup is closed",
  );
  expect(!closedText.includes("Add room type"), "a business in review is offered a room type form");
  console.log("  a business in review gets the closed setup page");

  await approve(await contextForEmail(OFFICERS.gasaboApprover), business.orgId);
  const ownerWs = workspaceOf(await contextForEmail(business.email));
  const setupUrl = `/w/${ownerWs}/setup`;
  const setup = await page(setupUrl, business.email);
  expect(setup.status === 200, `the owner's setup page answered ${setup.status}`);
  const setupText = visible(setup.html);
  expect(setupText.includes("Set up your property"), "the setup page has no heading");
  expect(setupText.includes(business.legalName), "the setup page does not name the owner's business");
  for (const label of ["Property details", "A priced room type", "A photograph", "Publish"])
    expect(setupText.includes(label), `the setup page has no "${label}" step`);
  expect(setupText.includes("Add at least one room type"), "the setup page does not say what stops a publish");
  for (const name of SAMPLE_NAMES) expect(!setupText.includes(name), `the setup page shows the sample "${name}"`);
  console.log("  the approved owner's setup page renders their own business, live");

  const notMine = await page(`/w/${closedWs}/setup`, business.email);
  expect(notMine.status === 404, `another person's setup page answered ${notMine.status}, not 404`);

  const signedOut = await page(setupUrl, null);
  expect(signedOut.status >= 300 && signedOut.status < 400, `signed out, the setup page answered ${signedOut.status}`);
  expect(
    signedOut.location.includes(`/sign-in?next=${encodeURIComponent(setupUrl)}`),
    `signed out, the setup page sent the person to "${signedOut.location}"`,
  );
  const signIn = await page(`/sign-in?next=${encodeURIComponent(setupUrl)}`, null);
  expect(signIn.html.includes(`name="next" value="${setupUrl}"`), "sign-in dropped the way back to setup");
  console.log("  signed out it goes to sign-in and back; another person's setup is a 404");

  return `PAGES OK ${checks}`;
});

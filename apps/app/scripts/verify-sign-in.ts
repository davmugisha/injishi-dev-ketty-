/**
 * Every persona signs in through the API with the demo code and resolves to its own interface shell;
 * a wrong code is refused; a forged cookie is nobody. Prints "SIGN-IN OK <n>" only when all of it holds.
 *
 *   INJISHI_API_URL=http://localhost:8040 pnpm --filter @injishi/app exec tsx scripts/verify-sign-in.ts
 */
import { PERSONA_IDS, personas } from "@injishi/data";
import { accountFor, sendSignInCode, verifySignInCode } from "../src/server/auth";
import { check, cookieFor, demoCode, main } from "./lib/harness";

void main(async () => {
  await demoCode();
  for (const id of PERSONA_IDS) {
    const cookie = await cookieFor(id);
    const account = await accountFor(cookie);
    check(account, `${personas[id].email} signed in but the API does not know the session`);
    check(account.user.email === personas[id].email, `${id}: the session belongs to ${account.user.email}`);
    check(
      account.persona.id === id,
      `${personas[id].email} resolved to the "${account.persona.id}" shell, not "${id}"`,
    );
    console.log(
      `  ${id.padEnd(12)} ${account.user.email} → ${account.persona.id}, ${account.workspaces.length} workspace(s)`,
    );
  }

  // A wrong code is refused (and does not lock the account: the demo allows retries).
  const victim = personas.frontdesk.email;
  const sent = await sendSignInCode(victim);
  check(sent.ok, "could not send a code for the wrong-code check");
  const wrong = await verifySignInCode(victim, "000001");
  check(!wrong.ok && wrong.reason === "wrong-code", `a wrong code was not refused as wrong: ${JSON.stringify(wrong)}`);

  // A cookie the API never issued is nobody.
  const forged = await accountFor("injishi-demo.session_token=forged.signature");
  check(forged === null, "a forged session cookie resolved to an account");

  return `SIGN-IN OK ${PERSONA_IDS.length}`;
});

/**
 * `injishi/no-client-authz` — a client may not resolve a permission from a role.
 *
 * ADR-012, AC-4. `can(role, permission)` and `permissionsForRole(role)` are the
 * server's predicates. When an app imports them it ships a second copy of the
 * permission matrix to the browser, and the two answers can disagree — which
 * they did: the operator app offered all 21 powers to the owner of a business
 * still in the registration pipeline, every one of which the API refuses,
 * because the client asked the role and the server asked the grant.
 *
 * A client renders from the array `GET /api/v1/me/workspaces` resolved, and
 * from nothing else.
 *
 * What is still allowed, and why: `PERMISSION_LABEL` and
 * `REGISTRATION_STAGE_MESSAGE` are wording, `isOperational` and
 * `workspaceAllows` read an answer that already exists. None of them can grant
 * anything. Only the two role-to-permission resolvers are banned.
 *
 * Re-exports count. `export { can } from "@injishi/contracts"` is how the ban
 * used to be routed around one file at a time.
 */

const BANNED = new Map([
  [
    'can',
    'ask the resolved permissions array (useCapability in a screen, permissionsOf in the store)',
  ],
  [
    'permissionsForRole',
    'read the permissions array the server resolved on GET /api/v1/me/workspaces',
  ],
]);

/** Does this import path lead to the authorization model? */
function isAuthzSource(value) {
  if (typeof value !== 'string') return false;
  if (value === '@injishi/contracts') return true;
  // A local bridge file that re-exports the model. `../authz`, `./authz`,
  // `@/pms/authz` — the name is the convention in this repo.
  return /(^|\/)authz$/.test(value);
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ban importing or re-exporting the role-to-permission resolvers in an app. Clients render from the server-resolved permissions array.',
    },
    schema: [],
    messages: {
      banned:
        "Don't import `{{name}}` in an app: it resolves a permission from a role in the browser, which is the answer the server already gave and can disagree with (ADR-012, AC-4). Instead, {{advice}}.",
      bannedReexport:
        "Don't re-export `{{name}}` from an app: it puts the role-to-permission table back within reach of a screen (ADR-012, AC-4). Instead, {{advice}}.",
    },
  },

  create(context) {
    /** The name a specifier actually pulls out of the module. */
    function importedName(specifier) {
      if (specifier.type !== 'ImportSpecifier') return null;
      const imported = specifier.imported;
      return imported.type === 'Identifier' ? imported.name : imported.value;
    }

    function exportedName(specifier) {
      const local = specifier.local;
      return local.type === 'Identifier' ? local.name : local.value;
    }

    return {
      ImportDeclaration(node) {
        // A type-only import cannot call anything, and `can` has no type form,
        // so there is nothing to catch there.
        if (node.importKind === 'type') return;
        if (!isAuthzSource(node.source.value)) return;

        for (const specifier of node.specifiers) {
          if (specifier.importKind === 'type') continue;
          const name = importedName(specifier);
          const advice = name && BANNED.get(name);
          if (advice) {
            context.report({
              node: specifier,
              messageId: 'banned',
              data: { name, advice },
            });
          }
        }
      },

      ExportNamedDeclaration(node) {
        if (!node.source || node.exportKind === 'type') return;
        if (!isAuthzSource(node.source.value)) return;

        for (const specifier of node.specifiers) {
          if (specifier.exportKind === 'type') continue;
          const name = exportedName(specifier);
          const advice = name && BANNED.get(name);
          if (advice) {
            context.report({
              node: specifier,
              messageId: 'bannedReexport',
              data: { name, advice },
            });
          }
        }
      },
    };
  },
};

export default rule;

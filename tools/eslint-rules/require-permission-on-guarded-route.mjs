/**
 * `injishi/require-permission-on-guarded-route` — a guarded route must say
 * what power it needs, reads included.
 *
 * ADR-012, AC-1. This is the enforcement that matters most, because the failure
 * it catches is silent. A `@Post` sitting under `@UseGuards(SessionGuard,
 * WorkspaceGuard)` with no `@RequirePermission` still returns 200. It is not
 * unguarded — the caller must hold the workspace — but it allows EVERY member
 * of that workspace to run it, including a housekeeper approving a booking.
 * Nothing about it looks wrong in review: the guard is right there.
 *
 * What is checked, and what is not:
 *
 *   - **Every verb** (`@Get`, `@Head`, `@Options`, `@All`, `@Post`, `@Put`,
 *     `@Patch`, `@Delete`). Reads used to be exempt, on the ADR's reasoning
 *     that a desk that cannot see its own reservations cannot work. The
 *     exemption was the hole the platform audit found (H1): with no declaration
 *     `WorkspaceGuard` admits every member, so a housekeeper read the rent roll
 *     and the owner of a business still in the registration pipeline, whose
 *     permission set is EMPTY, read every operator list. The desk still reads
 *     its reservations — because the read now names the powers the desk holds,
 *     usually as `@RequireAnyPermission(...)`, not because it names none.
 *   - **Only routes reached through a permission-bearing guard.**
 *     `WorkspaceGuard` and `StaffGuard` are the two that resolve a
 *     permission. `SessionGuard` alone proves an identity and `OversightGuard`
 *     resolves a government assignment; neither has a permission to declare, so
 *     a route carrying only those is not this rule's business.
 *   - **Class and handler together.** A declaration on either satisfies the
 *     rule, because Nest resolves both — `@RequirePermission` on the class
 *     covers every handler under it, which is how `InventoryController` is
 *     written.
 *
 * The `allow` option names the deliberate exceptions as `Class.method`, so one
 * cannot appear by accident: it has to be typed into a config file where a
 * reviewer sees it. It is the ONLY escape hatch, for reads as for writes, and it
 * is meant for a route whose whole check genuinely is "holds this workspace"
 * (`MeController.setActiveWorkspace` is the one today). A read that merely
 * seems harmless is not that: an empty permission set must still be refused it,
 * and only a declaration does that. Every entry carries a comment saying why.
 */

/** The decorators that put a request through a permission-resolving guard. */
const PERMISSION_GUARDS = new Set(['WorkspaceGuard', 'StaffGuard']);

/** The decorators that declare which power a route needs. */
const PERMISSION_DECLARATIONS = new Set([
  'RequirePermission',
  'RequireAnyPermission',
  'RequireStaffPermission',
]);

/** Every Nest route decorator. No verb is exempt; see the note above. */
const ROUTE_METHODS = new Set([
  'Get',
  'Head',
  'Options',
  'All',
  'Post',
  'Put',
  'Patch',
  'Delete',
]);

/** The name a decorator invokes, whether or not it is called with arguments. */
function decoratorName(decorator) {
  const expression = decorator.expression;
  if (!expression) return null;
  if (expression.type === 'Identifier') return expression.name;
  if (
    expression.type === 'CallExpression' &&
    expression.callee.type === 'Identifier'
  ) {
    return expression.callee.name;
  }
  return null;
}

/** Every guard named in the `@UseGuards(...)` decorators on this node. */
function guardsOn(node) {
  const guards = new Set();
  for (const decorator of node.decorators ?? []) {
    if (decoratorName(decorator) !== 'UseGuards') continue;
    const expression = decorator.expression;
    if (expression.type !== 'CallExpression') continue;
    for (const argument of expression.arguments) {
      if (argument.type === 'Identifier') guards.add(argument.name);
    }
  }
  return guards;
}

/** Does this node carry a permission declaration of its own? */
function declaresPermission(node) {
  return (node.decorators ?? []).some((decorator) =>
    PERMISSION_DECLARATIONS.has(decoratorName(decorator)),
  );
}

/** The HTTP verbs this handler answers. */
function httpMethodsOn(node) {
  const methods = new Set();
  for (const decorator of node.decorators ?? []) {
    const name = decoratorName(decorator);
    if (name && ROUTE_METHODS.has(name)) methods.add(name);
  }
  return methods;
}

/** `ClassName.methodName`, the key the `allow` option is written in. */
function routeKey(className, methodName) {
  return `${className ?? '<anonymous>'}.${methodName ?? '<computed>'}`;
}

function memberName(node) {
  const key = node.key;
  if (!key) return null;
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'Literal') return String(key.value);
  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require an explicit permission declaration on every route, reads included, that runs behind WorkspaceGuard or StaffGuard.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allow: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Routes that are guarded but declare no permission on purpose, as "Class.method". Each one is an exception the ADR names.',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missing:
        '`{{route}}` runs behind {{guard}} but declares no permission, so every member of the workspace may reach it, including one whose permission set is empty (ADR-012, AC-1; audit H1). Add `@{{declaration}}(...)` to the handler or its controller. If it is genuinely meant to need only workspace membership, name it in this rule\'s `allow` option with a comment saying why.',
    },
  },

  create(context) {
    const allow = new Set(context.options?.[0]?.allow ?? []);

    /**
     * Walk one class: read the guards and any declaration it carries, then
     * judge each handler with the class's own context folded in. Nest resolves
     * both levels, so the rule has to as well.
     */
    function checkClass(node) {
      const className = node.id?.name ?? null;
      const classGuards = guardsOn(node);
      const classDeclares = declaresPermission(node);

      for (const member of node.body.body) {
        if (member.type !== 'MethodDefinition') continue;

        const verbs = httpMethodsOn(member);
        if (verbs.size === 0) continue;

        const guards = new Set([...classGuards, ...guardsOn(member)]);
        const guard = [...guards].find((g) => PERMISSION_GUARDS.has(g));
        if (!guard) continue;

        if (classDeclares || declaresPermission(member)) continue;

        const route = routeKey(className, memberName(member));
        if (allow.has(route)) continue;

        context.report({
          node: member.key ?? member,
          messageId: 'missing',
          data: {
            route,
            guard,
            declaration:
              guard === 'StaffGuard'
                ? 'RequireStaffPermission'
                : 'RequirePermission',
          },
        });
      }
    }

    return {
      ClassDeclaration: checkClass,
      ClassExpression: checkClass,
    };
  },
};

export default rule;

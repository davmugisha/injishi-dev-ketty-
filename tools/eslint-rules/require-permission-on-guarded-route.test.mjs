/**
 * Tests for `injishi/require-permission-on-guarded-route`.
 *
 * Run from the repository root:
 *   node --test tools/eslint-rules/require-permission-on-guarded-route.test.mjs
 *
 * `tools/eslint-rules` has no package of its own, so ESLint and the TypeScript
 * parser are resolved through `server/api`, the one workspace member that lints
 * with this rule on. Decorators need the TypeScript parser.
 */
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

import rule from './require-permission-on-guarded-route.mjs';

const requireFromApi = createRequire(
  new URL('../../server/api/package.json', import.meta.url),
);
const { RuleTester } = requireFromApi('eslint');
const tseslint = requireFromApi('typescript-eslint');

const tester = new RuleTester({
  languageOptions: { parser: tseslint.parser },
});

// RuleTester reports each case through whatever describe/it it is handed.
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const workspaceController = (body, classDecorators = '') => `
@Controller('ops/things')
@UseGuards(SessionGuard, WorkspaceGuard)
${classDecorators}
class OpsThingsController {
${body}
}`;

// Every business route below names its product, as ADR-076 G10 requires;
// the product cases at the end test that twin check on its own.
const PRODUCT = `@RequireProduct('pms')`;

tester.run('require-permission-on-guarded-route', rule, {
  valid: [
    // A read that names one power.
    workspaceController(`
  @Get()
  @RequirePermission('message.send')
  list() {}`, PRODUCT),
    // A read open to several powers (audit H1).
    workspaceController(`
  @Get()
  @RequireAnyPermission('stay.checkin', 'housekeeping.set')
  list() {}`, PRODUCT),
    // A class-level declaration covers every handler under it.
    workspaceController(
      `
  @Get('connection')
  connection() {}`,
      `@RequirePermission('ebm.manage')\n${PRODUCT}`,
    ),
    // The product on the handler instead of the class.
    workspaceController(`
  @Get()
  @RequirePermission('stay.checkin')
  @RequireProduct('pms')
  list() {}`),
    // A platform capability route names any of its products.
    workspaceController(`
  @Get()
  @RequirePermission('listing.manage')
  list() {}`, `@RequireAnyProduct('pms', 'residence', 'outlets')`),
    // A controller that answers to no one product yet, named by class.
    {
      code: workspaceController(`
  @Get()
  @RequirePermission('ebm.manage')
  list() {}`),
      options: [{ productAllow: ['OpsThingsController'] }],
    },
    // SessionGuard alone has no permission to declare.
    `
@Controller('me')
@UseGuards(SessionGuard)
class MeController {
  @Get('trips')
  trips() {}
}`,
    // A method that is not a route is not judged.
    workspaceController(`
  helper() {}`),
    // The one escape hatch: a route named in \`allow\`.
    {
      code: `
@Controller('me')
@UseGuards(SessionGuard)
class MeController {
  @Post('active-workspace')
  @UseGuards(WorkspaceGuard)
  setActiveWorkspace() {}
}`,
      options: [{ allow: ['MeController.setActiveWorkspace'] }],
    },
    // The staff side is judged the same way, with its own declaration.
    `
@Controller('admin/users')
@UseGuards(SessionGuard, StaffGuard)
class UsersController {
  @Get()
  @RequireStaffPermission('users.read')
  list() {}
}`,
  ],
  invalid: [
    // The shape the audit found: a guarded read declaring nothing.
    {
      code: workspaceController(`
  @Get()
  list() {}`),
      errors: [{ messageId: 'missing', data: { route: 'OpsThingsController.list', guard: 'WorkspaceGuard', declaration: 'RequirePermission' } }],
    },
    {
      code: workspaceController(`
  @Get(':id/messages')
  messages() {}`),
      errors: [{ messageId: 'missing' }],
    },
    // Mutations, as before.
    {
      code: workspaceController(`
  @Post(':id/approve')
  approve() {}`),
      errors: [{ messageId: 'missing' }],
    },
    // \`allow\` names one route, not the controller.
    {
      code: workspaceController(`
  @Get()
  list() {}
  @Get('other')
  other() {}`),
      options: [{ allow: ['OpsThingsController.list'] }],
      errors: [{ messageId: 'missing', data: { route: 'OpsThingsController.other', guard: 'WorkspaceGuard', declaration: 'RequirePermission' } }],
    },
    // A staff read with no declaration.
    {
      code: `
@Controller('admin/users')
@UseGuards(SessionGuard, StaffGuard)
class UsersController {
  @Get()
  list() {}
}`,
      errors: [{ messageId: 'missing', data: { route: 'UsersController.list', guard: 'StaffGuard', declaration: 'RequireStaffPermission' } }],
    },
    // ADR-076 G10: a business route that declares a permission and no product.
    {
      code: workspaceController(`
  @Get()
  @RequirePermission('stay.checkin')
  list() {}`),
      errors: [{ messageId: 'productMissing', data: { route: 'OpsThingsController.list' } }],
    },
    // `productAllow` names a class, so another class is still judged.
    {
      code: workspaceController(`
  @Get()
  @RequirePermission('stay.checkin')
  list() {}`),
      options: [{ productAllow: ['SomeOtherController'] }],
      errors: [{ messageId: 'productMissing' }],
    },
    // A staff route never declares a product.
    {
      code: `
@Controller('admin/orgs')
@UseGuards(SessionGuard, StaffGuard)
@RequireProduct('pms')
class OrgsController {
  @Get()
  @RequireStaffPermission('admin.business.view')
  list() {}
}`,
      errors: [{ messageId: 'productOnStaff', data: { route: 'OrgsController.list', guard: 'StaffGuard' } }],
    },
    // Nor does an oversight route.
    {
      code: `
@Controller('oversight/cases')
@UseGuards(SessionGuard, OversightGuard)
class CasesController {
  @Get()
  @RequireAnyProduct('pms', 'residence')
  list() {}
}`,
      errors: [{ messageId: 'productOnStaff', data: { route: 'CasesController.list', guard: 'OversightGuard' } }],
    },
  ],
});

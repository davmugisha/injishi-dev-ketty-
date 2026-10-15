import type { OperatorCertificateList } from '@injishi/contracts';
import { Controller, Get, UseGuards } from '@nestjs/common';

import { CertificatesService } from '../../../modules/organization/application/certificates.service';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { SessionGuard } from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';

/**
 * Licences and registrations on file -> `GET /api/v1/ops/certificates`.
 *
 * **`listing.manage` OR `money.view`.** A tourism licence and a grading are
 * what a listing rests on, so whoever keeps the listings reads them; a tax
 * clearance and the incorporation are the business's fiscal standing, so
 * whoever reads the money reads them too. The front desk and the housekeeper
 * hold neither and are refused. Read only: a document is filed at
 * registration and checked by a field verifier, never edited here.
 */
@Controller({ path: 'ops/certificates', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsCertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Get()
  @RequireAnyPermission('listing.manage', 'money.view')
  list(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<OperatorCertificateList> {
    return this.certificates.list(workspace);
  }
}

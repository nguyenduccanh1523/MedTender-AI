import { Module } from '@nestjs/common'

import { DatabaseModule } from '../../database/database.module'
import { IdentityModule } from '../identity/identity.module'
import { AdminApplicationsService } from './application/admin-applications.service'
import { ApplicationsService } from './application/applications.service'
import { ApprovalMailer } from './infrastructure/approval-mailer'
import { AdminApplicationsController } from './presentation/http/admin-applications.controller'
import { ApplicationsController } from './presentation/http/applications.controller'
import { SystemAdminGuard } from './presentation/http/guards/system-admin.guard'

@Module({
  imports: [DatabaseModule, IdentityModule],
  controllers: [ApplicationsController, AdminApplicationsController],
  providers: [ApplicationsService, AdminApplicationsService, ApprovalMailer, SystemAdminGuard],
})
export class ProvisioningModule {}

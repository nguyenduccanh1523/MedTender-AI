import { Module } from '@nestjs/common'

import { DatabaseModule } from '../../database/database.module'
import { IdentityModule } from '../identity/identity.module'
import { InvitationsController } from './presentation/http/invitations.controller'
import { InvitationsService } from './application/invitations.service'
import { OrganizationsController } from './presentation/http/organizations.controller'
import { OrganizationsService } from './application/organizations.service'

@Module({
  imports: [DatabaseModule, IdentityModule],
  controllers: [OrganizationsController, InvitationsController],
  providers: [OrganizationsService, InvitationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}

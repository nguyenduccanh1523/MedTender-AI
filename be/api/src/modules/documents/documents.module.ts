import { Module } from '@nestjs/common'
import { DatabaseModule } from '../../database/database.module'
import { IdentityModule } from '../identity/identity.module'
import { OrganizationsModule } from '../organizations/organizations.module'
import { DocumentsController } from './documents.controller'
import { DocumentsService } from './documents.service'

@Module({
  imports: [DatabaseModule, IdentityModule, OrganizationsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}

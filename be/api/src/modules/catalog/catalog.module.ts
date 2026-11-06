import { Module } from '@nestjs/common'
import { IdentityModule } from '../identity/identity.module'
import { OrganizationsModule } from '../organizations/organizations.module'
import { CatalogController } from './catalog.controller'
import { CatalogService } from './catalog.service'

@Module({
  imports: [IdentityModule, OrganizationsModule],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}

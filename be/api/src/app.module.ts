import { Module } from '@nestjs/common'

import { HealthController } from './modules/health/health.controller'
import { IdentityModule } from './modules/identity/identity.module'
import { OrganizationsModule } from './modules/organizations/organizations.module'
import { ProvisioningModule } from './modules/provisioning/provisioning.module'
import { TendersModule } from './modules/tenders/tenders.module'
import { CatalogModule } from './modules/catalog/catalog.module'

@Module({
  imports: [IdentityModule, OrganizationsModule, ProvisioningModule, TendersModule, CatalogModule],
  controllers: [HealthController],
})
export class AppModule {}

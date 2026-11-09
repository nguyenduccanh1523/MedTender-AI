import { Module } from '@nestjs/common'

import { HealthController } from './modules/health/health.controller'
import { IdentityModule } from './modules/identity/identity.module'
import { OrganizationsModule } from './modules/organizations/organizations.module'
import { ProvisioningModule } from './modules/provisioning/provisioning.module'
import { TendersModule } from './modules/tenders/tenders.module'
import { CatalogModule } from './modules/catalog/catalog.module'
import { DocumentsModule } from './modules/documents/documents.module'
import { ObjectStorageModule } from './integrations/object-storage/object-storage.module'
import { TurnstileModule } from './integrations/turnstile/turnstile.module'
import { AiPoliciesModule } from './modules/ai-policies/ai-policies.module'

@Module({
  imports: [
    ObjectStorageModule,
    TurnstileModule,
    AiPoliciesModule,
    IdentityModule,
    OrganizationsModule,
    ProvisioningModule,
    TendersModule,
    CatalogModule,
    DocumentsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

import { Module } from '@nestjs/common'
import { DatabaseModule } from '../../database/database.module'
import { IdentityModule } from '../identity/identity.module'
import { OrganizationsModule } from '../organizations/organizations.module'
import { TendersController } from './tenders.controller'
import { TendersService } from './tenders.service'

@Module({ imports: [DatabaseModule, IdentityModule, OrganizationsModule], controllers: [TendersController], providers: [TendersService] })
export class TendersModule {}

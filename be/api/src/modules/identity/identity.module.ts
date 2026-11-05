import { Module } from '@nestjs/common'

import { AuthRateGuard } from './presentation/http/guards/auth-rate.guard'
import { SessionGuard } from './presentation/http/guards/session.guard'
import { WebMutationGuard } from '../../common/http/web-mutation.guard'
import { DatabaseModule } from '../../database/database.module'
import { IdentityController } from './presentation/http/identity.controller'
import { IdentityService } from './application/identity.service'

@Module({
  imports: [DatabaseModule],
  controllers: [IdentityController],
  providers: [IdentityService, SessionGuard, WebMutationGuard, AuthRateGuard],
  exports: [IdentityService, SessionGuard, WebMutationGuard],
})
export class IdentityModule {}

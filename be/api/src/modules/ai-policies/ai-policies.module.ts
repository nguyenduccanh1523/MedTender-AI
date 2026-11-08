import { Global, Module } from '@nestjs/common'
import { AiPoliciesService } from './ai-policies.service'

@Global()
@Module({
  providers: [AiPoliciesService],
  exports: [AiPoliciesService],
})
export class AiPoliciesModule {}

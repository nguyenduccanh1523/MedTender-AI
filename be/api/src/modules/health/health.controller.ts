import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger'

class HealthResponse {
  @ApiProperty({ enum: ['api'] })
  service = 'api' as const

  @ApiProperty({ enum: ['ok'] })
  status = 'ok' as const
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get('live')
  @ApiOkResponse({ type: HealthResponse })
  liveness(): HealthResponse {
    return new HealthResponse()
  }
}

import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness check', description: 'Returns 200 when the API is up.' })
  @ApiOkResponse({ schema: { example: { status: 'ok', timestamp: '2026-01-01T00:00:00.000Z' } } })
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

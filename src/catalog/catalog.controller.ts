import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/interfaces.js';
import { CatalogService } from './catalog.service.js';
import { CatalogDto } from './dto/catalog.dto.js';

@ApiTags('catalog')
@ApiBearerAuth('access-token')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  @ApiOperation({
    summary: "Get the academic catalog for the authenticated user's program",
    description:
      "Returns the caller's own program catalog: the program, its semesters, its active " +
      'subjects (with prerequisite ids), the active sections offering those subjects in the ' +
      "program's semesters, the professors teaching those sections, and the section schedules. " +
      'All identifiers are canonical backend UUIDs. The scope is derived from the caller\'s ' +
      '`programId` — there is no program parameter, so no other program can be requested. ' +
      'Inactive subjects and sections are excluded; an empty catalog is a valid response.',
  })
  @ApiOkResponse({ type: CatalogDto })
  getCatalog(@CurrentUser() user: AuthenticatedUser): Promise<CatalogDto> {
    return this.catalogService.getCatalogForUser(user);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../common/enums.js';
import type { AuthenticatedUser } from '../common/interfaces.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { QueryEventsDto } from './dto/query-events.dto.js';
import { UpdateEventDto } from './dto/update-event.dto.js';
import { AcademicEvent } from './entities/academic-event.entity.js';
import { EventsService } from './events.service.js';

@ApiTags('events')
@ApiBearerAuth('access-token')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @ApiOperation({ summary: 'List / filter academic calendar events' })
  @ApiOkResponse({ description: 'Paginated list of events' })
  findAll(@Query() query: QueryEventsDto) {
    return this.eventsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an event' })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<AcademicEvent> {
    return this.eventsService.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create a calendar event (admin)' })
  @ApiCreatedResponse({ type: AcademicEvent })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEventDto,
  ): Promise<AcademicEvent> {
    return this.eventsService.create(user, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a calendar event (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEventDto,
  ): Promise<AcademicEvent> {
    return this.eventsService.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a calendar event (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.eventsService.remove(id);
  }
}

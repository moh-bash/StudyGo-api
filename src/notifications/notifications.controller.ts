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
import { CreateNotificationDto } from './dto/create-notification.dto.js';
import { QueryNotificationsDto } from './dto/query-notifications.dto.js';
import { Notification } from './entities/notification.entity.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List my notifications' })
  @ApiOkResponse({ description: 'Paginated list of notifications' })
  findMine(@CurrentUser('id') userId: string, @Query() query: QueryNotificationsDto) {
    return this.notificationsService.findMine(userId, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Count my unread notifications' })
  unreadCount(@CurrentUser('id') userId: string) {
    return this.notificationsService.unreadCount(userId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  markAllRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllRead(userId);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Send a notification to a user (admin)' })
  @ApiCreatedResponse({ type: Notification })
  create(@Body() dto: CreateNotificationDto): Promise<Notification> {
    return this.notificationsService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a notification (owner or admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<Notification> {
    return this.notificationsService.findOne(user, id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read (owner or admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<Notification> {
    return this.notificationsService.markRead(user, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a notification (owner or admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.notificationsService.remove(user, id);
  }
}

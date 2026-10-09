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
import type { AuthenticatedUser } from '../common/interfaces.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { QueryTasksDto } from './dto/query-tasks.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { Task } from './entities/task.entity.js';
import { TasksService } from './tasks.service.js';

@ApiTags('tasks')
@ApiBearerAuth('access-token')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a personal task' })
  @ApiCreatedResponse({ type: Task })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTaskDto): Promise<Task> {
    return this.tasksService.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List / filter my tasks (admin may filter by owner)' })
  @ApiOkResponse({ description: 'Paginated list of tasks' })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryTasksDto) {
    return this.tasksService.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a task (owner or admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<Task> {
    return this.tasksService.findOne(user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a task (owner or admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<Task> {
    return this.tasksService.update(user, id, dto);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Mark a task as completed (owner or admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<Task> {
    return this.tasksService.complete(user, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a task (owner or admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.tasksService.remove(user, id);
  }
}

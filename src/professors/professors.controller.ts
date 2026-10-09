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
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../common/enums.js';
import { CreateProfessorDto } from './dto/create-professor.dto.js';
import { QueryProfessorsDto } from './dto/query-professors.dto.js';
import { UpdateProfessorDto } from './dto/update-professor.dto.js';
import { Professor } from './entities/professor.entity.js';
import { ProfessorsService } from './professors.service.js';

@ApiTags('professors')
@ApiBearerAuth('access-token')
@Controller('professors')
export class ProfessorsController {
  constructor(private readonly professorsService: ProfessorsService) {}

  @Get()
  @ApiOperation({ summary: 'List / search professors' })
  @ApiOkResponse({ description: 'Paginated list of professors' })
  findAll(@Query() query: QueryProfessorsDto) {
    return this.professorsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a professor' })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<Professor> {
    return this.professorsService.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create a professor (admin)' })
  @ApiCreatedResponse({ type: Professor })
  create(@Body() dto: CreateProfessorDto): Promise<Professor> {
    return this.professorsService.create(dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a professor (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProfessorDto,
  ): Promise<Professor> {
    return this.professorsService.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a professor (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.professorsService.remove(id);
  }
}

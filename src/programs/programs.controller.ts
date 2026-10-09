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
import { CreateProgramDto } from './dto/create-program.dto.js';
import { QueryProgramsDto } from './dto/query-programs.dto.js';
import { UpdateProgramDto } from './dto/update-program.dto.js';
import { AcademicProgram } from './entities/program.entity.js';
import { ProgramsService } from './programs.service.js';

@ApiTags('programs')
@ApiBearerAuth('access-token')
@Controller('programs')
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  @Get()
  @ApiOperation({ summary: 'List academic programs' })
  @ApiOkResponse({ description: 'Paginated list of programs' })
  findAll(@Query() query: QueryProgramsDto) {
    return this.programsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an academic program' })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<AcademicProgram> {
    return this.programsService.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create an academic program (admin)' })
  @ApiCreatedResponse({ type: AcademicProgram })
  create(@Body() dto: CreateProgramDto): Promise<AcademicProgram> {
    return this.programsService.create(dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update an academic program (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProgramDto,
  ): Promise<AcademicProgram> {
    return this.programsService.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an academic program (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.programsService.remove(id);
  }
}

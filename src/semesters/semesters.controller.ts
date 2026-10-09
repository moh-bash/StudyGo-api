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
import { CreateSemesterDto } from './dto/create-semester.dto.js';
import { QuerySemestersDto } from './dto/query-semesters.dto.js';
import { UpdateSemesterDto } from './dto/update-semester.dto.js';
import { Semester } from './entities/semester.entity.js';
import { SemestersService } from './semesters.service.js';

@ApiTags('semesters')
@ApiBearerAuth('access-token')
@Controller('semesters')
export class SemestersController {
  constructor(private readonly semestersService: SemestersService) {}

  @Get()
  @ApiOperation({ summary: 'List semesters' })
  @ApiOkResponse({ description: 'Paginated list of semesters' })
  findAll(@Query() query: QuerySemestersDto) {
    return this.semestersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a semester' })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<Semester> {
    return this.semestersService.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create a semester (admin)' })
  @ApiCreatedResponse({ type: Semester })
  create(@Body() dto: CreateSemesterDto): Promise<Semester> {
    return this.semestersService.create(dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a semester (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSemesterDto,
  ): Promise<Semester> {
    return this.semestersService.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a semester (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.semestersService.remove(id);
  }
}

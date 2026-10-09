import { PartialType } from '@nestjs/swagger';
import { CreateSemesterDto } from './create-semester.dto.js';

export class UpdateSemesterDto extends PartialType(CreateSemesterDto) {}

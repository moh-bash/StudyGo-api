import { PartialType } from '@nestjs/swagger';
import { CreateSubjectDto } from './create-subject.dto.js';

export class UpdateSubjectDto extends PartialType(CreateSubjectDto) {}

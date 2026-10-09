import { PartialType } from '@nestjs/swagger';
import { CreateSectionDto } from './create-section.dto.js';

export class UpdateSectionDto extends PartialType(CreateSectionDto) {}

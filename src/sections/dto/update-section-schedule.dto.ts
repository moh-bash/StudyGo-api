import { PartialType } from '@nestjs/swagger';
import { CreateSectionScheduleDto } from './create-section-schedule.dto.js';

export class UpdateSectionScheduleDto extends PartialType(CreateSectionScheduleDto) {}

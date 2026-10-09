import { PartialType } from '@nestjs/swagger';
import { CreateProfessorDto } from './create-professor.dto.js';

export class UpdateProfessorDto extends PartialType(CreateProfessorDto) {}

import { PartialType } from '@nestjs/swagger';
import { CreateNotificationDto } from './create-notification.dto.js';

export class UpdateNotificationDto extends PartialType(CreateNotificationDto) {}

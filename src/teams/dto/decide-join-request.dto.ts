import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { JoinRequestStatus } from '../../common/enums.js';

export class DecideJoinRequestDto {
  @ApiProperty({
    enum: [JoinRequestStatus.APPROVED, JoinRequestStatus.REJECTED],
    description: 'Approve or reject a pending join request.',
  })
  @IsIn([JoinRequestStatus.APPROVED, JoinRequestStatus.REJECTED])
  status!: JoinRequestStatus.APPROVED | JoinRequestStatus.REJECTED;
}

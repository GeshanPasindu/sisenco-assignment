import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
export class NotificationQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsIn(['all', 'unread', 'read']) readStatus:
    'all' | 'unread' | 'read' = 'all';
}
export class NotificationResponseDto {
  id!: string;
  type!: string;
  actor!: { id: string; firstName: string; lastName: string };
  title!: string;
  message!: string;
  reportId!: string | null;
  reportVersionId!: string | null;
  reportReviewId!: string | null;
  taskId!: string | null;
  createdAt!: string;
  readAt!: string | null;
}
export class UnreadCountResponseDto {
  count!: number;
}
export class ReadAllResponseDto {
  updatedCount!: number;
  readThrough!: string;
}

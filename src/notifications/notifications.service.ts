import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser, PaginatedResult } from '../common/interfaces.js';
import { UserRole } from '../common/enums.js';
import { buildPaginatedResult, getSkip } from '../common/utils/pagination.util.js';
import { User } from '../users/entities/user.entity.js';
import { CreateNotificationDto } from './dto/create-notification.dto.js';
import { QueryNotificationsDto } from './dto/query-notifications.dto.js';
import { Notification } from './entities/notification.entity.js';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async create(dto: CreateNotificationDto): Promise<Notification> {
    if (!(await this.users.exists({ where: { id: dto.userId } }))) {
      throw new BadRequestException('Recipient user not found');
    }
    const notification = this.notifications.create({
      userId: dto.userId,
      title: dto.title.trim(),
      body: dto.body,
      type: dto.type,
      data: dto.data ?? null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });
    return this.notifications.save(notification);
  }

  async findMine(
    userId: string,
    query: QueryNotificationsDto,
  ): Promise<PaginatedResult<Notification>> {
    const qb = this.notifications
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC');
    if (query.isRead !== undefined) {
      qb.andWhere('notification.isRead = :isRead', { isRead: query.isRead });
    }
    if (query.type) {
      qb.andWhere('notification.type = :type', { type: query.type });
    }
    qb.skip(getSkip(query.page, query.limit)).take(query.limit);
    const [data, total] = await qb.getManyAndCount();
    return buildPaginatedResult(data, total, query.page, query.limit);
  }

  async unreadCount(userId: string): Promise<{ unread: number }> {
    const unread = await this.notifications.count({ where: { userId, isRead: false } });
    return { unread };
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<Notification> {
    const notification = await this.notifications.findOne({ where: { id } });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    this.assertOwnerOrAdmin(notification, actor);
    return notification;
  }

  async markRead(actor: AuthenticatedUser, id: string): Promise<Notification> {
    const notification = await this.findOne(actor, id);
    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await this.notifications.save(notification);
    }
    return notification;
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notifications.update(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
    return { updated: result.affected ?? 0 };
  }

  async remove(actor: AuthenticatedUser, id: string): Promise<void> {
    const notification = await this.findOne(actor, id);
    await this.notifications.remove(notification);
  }

  private assertOwnerOrAdmin(notification: Notification, actor: AuthenticatedUser): void {
    if (actor.role !== UserRole.ADMIN && notification.userId !== actor.id) {
      throw new ForbiddenException('You can only access your own notifications');
    }
  }
}

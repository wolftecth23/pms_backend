import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface LogCRActivityParams {
  changeRequestId: string;
  userId: string;
  eventType: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  message?: string;
}

@Injectable()
export class CRActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async logActivity(params: LogCRActivityParams) {
    return this.prisma.cRActivity.create({
      data: {
        changeRequestId: params.changeRequestId,
        userId: params.userId,
        eventType: params.eventType,
        oldValue: params.oldValue ?? Prisma.JsonNull,
        newValue: params.newValue ?? Prisma.JsonNull,
        message: params.message,
      },
    });
  }

  async getActivities(changeRequestId: string) {
    return this.prisma.cRActivity.findMany({
      where: { changeRequestId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
            designation: true,
          },
        },
      },
    });
  }
}

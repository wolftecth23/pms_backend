import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectContext } from '../project/project.service';
import {
  TaskActivityEntity,
  TaskActivityEvent,
} from './constants/task-activity-event.enum';
import { TaskActivityService } from './task-activity.service';

interface MockPrisma {
  taskActivity: {
    create: jest.Mock;
    createMany: jest.Mock;
    count: jest.Mock;
    findMany: jest.Mock;
  };
  task: {
    findUnique: jest.Mock;
  };
}

describe('TaskActivityService', () => {
  let service: TaskActivityService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = {
      taskActivity: {
        create: jest.fn(),
        createMany: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      task: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskActivityService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<TaskActivityService>(TaskActivityService);
  });

  describe('log', () => {
    it('should create an activity record', async () => {
      const mockResult = { id: 'act_1' };
      prisma.taskActivity.create.mockResolvedValue(mockResult);

      const res = await service.log({
        taskId: 'task_1',
        userId: 'user_1',
        eventType: TaskActivityEvent.TASK_CREATED,
        entityType: TaskActivityEntity.TASK,
        entityId: 'task_1',
        newValue: { title: 'New Task' },
        message: 'created this task',
      });

      expect(res).toBe(mockResult);
      expect(prisma.taskActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            taskId: 'task_1',
            userId: 'user_1',
            eventType: TaskActivityEvent.TASK_CREATED,
            entityType: TaskActivityEntity.TASK,
            entityId: 'task_1',
            message: 'created this task',
          }) as unknown,
        }),
      );
    });

    it('should use provided transaction client when provided', async () => {
      const txMock = {
        taskActivity: {
          create: jest.fn().mockResolvedValue({ id: 'act_tx' }),
        },
      };
      const mockTx = txMock as unknown as Prisma.TransactionClient;

      const res = await service.log(
        {
          taskId: 'task_1',
          userId: 'user_1',
          eventType: TaskActivityEvent.TASK_STATUS_CHANGED,
          entityType: TaskActivityEntity.TASK,
        },
        mockTx,
      );

      expect(txMock.taskActivity.create).toHaveBeenCalled();
      expect(prisma.taskActivity.create).not.toHaveBeenCalled();
      expect(res).toEqual({ id: 'act_tx' });
    });
  });

  describe('logMany', () => {
    it('should return { count: 0 } without querying if records array is empty', async () => {
      const res = await service.logMany([]);
      expect(res).toEqual({ count: 0 });
      expect(prisma.taskActivity.createMany).not.toHaveBeenCalled();
    });

    it('should batch create activities', async () => {
      prisma.taskActivity.createMany.mockResolvedValue({ count: 2 });

      const res = await service.logMany([
        {
          taskId: 'task_1',
          userId: 'user_1',
          eventType: TaskActivityEvent.TASK_ASSIGNED,
          entityType: TaskActivityEntity.TASK_ASSIGNEE,
        },
        {
          taskId: 'task_1',
          userId: 'user_1',
          eventType: TaskActivityEvent.TASK_TAG_ADDED,
          entityType: TaskActivityEntity.TASK_TAG,
        },
      ]);

      expect(res).toEqual({ count: 2 });
      expect(prisma.taskActivity.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            taskId: 'task_1',
            eventType: TaskActivityEvent.TASK_ASSIGNED,
          }),
          expect.objectContaining({
            taskId: 'task_1',
            eventType: TaskActivityEvent.TASK_TAG_ADDED,
          }),
        ]) as unknown,
      });
    });
  });

  describe('getTaskActivities', () => {
    it('should throw NotFoundException if task does not exist', async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(service.getTaskActivities('task_none')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if task is soft-deleted', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 'task_1',
        deletedAt: new Date(),
        project: { id: 'p1', deletedAt: null },
      });

      await expect(service.getTaskActivities('task_1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if context organization or workspace does not match', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 'task_1',
        deletedAt: null,
        project: {
          id: 'p1',
          deletedAt: null,
          organizationId: 'org_a',
          workspaceId: 'ws_a',
        },
      });

      const context = {
        organizationId: 'org_b',
        workspaceId: 'ws_b',
      } as unknown as ProjectContext;

      await expect(
        service.getTaskActivities('task_1', 1, 20, context),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return paginated activities for valid task', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 'task_1',
        deletedAt: null,
        project: {
          id: 'p1',
          deletedAt: null,
          organizationId: 'org_a',
          workspaceId: 'ws_a',
        },
      });

      const mockActivities = [
        { id: 'act_1', eventType: TaskActivityEvent.TASK_CREATED },
        { id: 'act_2', eventType: TaskActivityEvent.TASK_ASSIGNED },
      ];

      prisma.taskActivity.count.mockResolvedValue(2);
      prisma.taskActivity.findMany.mockResolvedValue(mockActivities);

      const context = {
        organizationId: 'org_a',
        workspaceId: 'ws_a',
      } as unknown as ProjectContext;

      const result = await service.getTaskActivities('task_1', 1, 10, context);

      expect(result).toEqual({
        data: mockActivities,
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
        },
      });
      expect(prisma.taskActivity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { taskId: 'task_1' },
          skip: 0,
          take: 10,
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });
});

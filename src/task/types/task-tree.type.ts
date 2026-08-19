import { Prisma } from '@prisma/client';

export type TaskTreeRow = {
  id: string;
  projectId: string;
  parentTaskId: string | null;

  title: string;
  taskStatusId: string;

  description: string | null;
  comment: string | null;

  priorityId: string;

  startDate: Date | null;
  dueDate: Date | null;
  completedAt: Date | null;

  estimatedHours: Prisma.Decimal | null;
  actualHours: Prisma.Decimal | null;

  order: number;

  createdById: string;

  createdAt: Date;
  updatedAt: Date;

  deletedAt: Date | null;

  depth: number;
};

export type TaskNode = TaskTreeRow & {
  subTasks: TaskNode[];
};

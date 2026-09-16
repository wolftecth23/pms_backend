import {
  TaskActivityEntity,
  TaskActivityEvent,
} from '../constants/task-activity-event.enum';

export interface CreateTaskActivityDto {
  taskId: string;
  userId: string;
  eventType: TaskActivityEvent | string;
  entityType: TaskActivityEntity | string;
  entityId?: string | null;
  fieldName?: string | null;
  oldValue?: any;
  newValue?: any;
  message?: string | null;
}

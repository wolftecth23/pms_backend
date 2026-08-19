export const DEFAULT_TASK_STATUSES = [
  {
    name: 'Backlog',
    color: '#64748B', // Slate
    order: 1,
    isDefault: false,
    isClosed: false,
  },
  {
    name: 'Todo',
    color: '#2563EB', // Blue
    order: 2,
    isDefault: true,
    isClosed: false,
  },
  {
    name: 'In Progress',
    color: '#8B5CF6', // Violet
    order: 3,
    isDefault: false,
    isClosed: false,
  },
  {
    name: 'In Preview',
    color: '#06B6D4', // Cyan
    order: 4,
    isDefault: false,
    isClosed: false,
  },
  {
    name: 'Blocked',
    color: '#F59E0B', // Amber
    order: 5,
    isDefault: false,
    isClosed: false,
  },
  {
    name: 'Done',
    color: '#22C55E', // Green
    order: 6,
    isDefault: false,
    isClosed: true,
  },
  {
    name: 'Cancelled',
    color: '#EF4444', // Red
    order: 7,
    isDefault: false,
    isClosed: true,
  },
] as const;

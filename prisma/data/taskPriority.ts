export const DEFAULT_TASK_PRIORITIES = [
  {
    name: 'Low',
    color: '#22C55E', // Green
    order: 1,
    isDefault: false,
  },
  {
    name: 'Medium',
    color: '#3B82F6', // Blue
    order: 2,
    isDefault: true,
  },
  {
    name: 'High',
    color: '#F59E0B', // Amber
    order: 3,
    isDefault: false,
  },
  {
    name: 'Urgent',
    color: '#EF4444', // Red
    order: 4,
    isDefault: false,
  },
] as const;

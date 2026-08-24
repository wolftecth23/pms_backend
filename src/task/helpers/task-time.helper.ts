export interface TaskTimeEffortCalculated {
  estimatedRemainingMinutes: number | null;
  purchaseRemainingMinutes: number | null;
  estimatedProgress: number | null;
  overEstimated: boolean;
  overPurchased: boolean;
  estimateExceedsPurchase: boolean;
}

export function computeTaskTimeEffort(task: {
  purchaseMinutes?: number | null;
  estimatedMinutes?: number | null;
  spentMinutes?: number | null;
}): TaskTimeEffortCalculated {
  const purchase =
    task.purchaseMinutes !== undefined && task.purchaseMinutes !== null
      ? task.purchaseMinutes
      : null;

  const estimated =
    task.estimatedMinutes !== undefined && task.estimatedMinutes !== null
      ? task.estimatedMinutes
      : null;

  const spent =
    task.spentMinutes !== undefined && task.spentMinutes !== null
      ? task.spentMinutes
      : null;

  const estimatedRemainingMinutes =
    estimated !== null && spent !== null
      ? Math.max(0, estimated - spent)
      : null;

  const purchaseRemainingMinutes =
    purchase !== null && spent !== null ? Math.max(0, purchase - spent) : null;

  const estimatedProgress =
    estimated !== null && estimated > 0 && spent !== null
      ? Math.min(100, Math.round((spent / estimated) * 100))
      : null;

  const overEstimated =
    estimated !== null && spent !== null ? spent > estimated : false;

  const overPurchased =
    purchase !== null && spent !== null ? spent > purchase : false;

  const estimateExceedsPurchase =
    estimated !== null && purchase !== null ? estimated > purchase : false;

  return {
    estimatedRemainingMinutes,
    purchaseRemainingMinutes,
    estimatedProgress,
    overEstimated,
    overPurchased,
    estimateExceedsPurchase,
  };
}

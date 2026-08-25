export function formatComment(comment: any, currentUserId: string) {
  return {
    id: comment.id,
    taskId: comment.taskId,
    text: comment.text,
    isEdited: comment.isEdited,
    createdAt: comment.createdAt,
    sentAt: comment.sentAt,
    updatedAt: comment.updatedAt,

    user: {
      id: comment.user.id,
      name: `${comment.user.firstName} ${comment.user.lastName ?? ''}`.trim(),
      initials:
        `${comment.user.firstName[0]}${comment.user.lastName?.[0] ?? ''}`.toUpperCase(),
      email: comment.user.email,
      avatar: comment.user.avatar ?? null,
    },

    replyTo: comment.replyTo
      ? {
          id: comment.replyTo.id,
          text: comment.replyTo.text,
          user: {
            id: comment.replyTo.user.id,
            name: `${comment.replyTo.user.firstName} ${comment.replyTo.user.lastName ?? ''}`.trim(),
          },
        }
      : null,

    mentions:
      comment.mentions?.map((m: any) => ({
        userId: m.userId,
        name: `${m.user.firstName} ${m.user.lastName ?? ''}`.trim(),
      })) ?? [],

    attachments:
      comment.attachments?.map((a: any) => ({
        id: a.id,
        name: a.name,
        size: a.size,
        mimeType: a.mimeType,
        url: a.url,
      })) ?? [],

    reactions: formatReactions(comment.reactions ?? [], currentUserId),

    scheduledComment: comment.scheduledFor
      ? {
          scheduledFor: comment.scheduledFor,
          status: comment.scheduleStatus,
        }
      : undefined,
  };
}

function formatReactions(reactions: any[], currentUserId: string) {
  const grouped = reactions.reduce(
    (acc, r) => {
      if (!acc[r.emoji]) acc[r.emoji] = { emoji: r.emoji, users: [] };
      const userObj = r.user
        ? {
            name: `${r.user.firstName} ${r.user.lastName ?? ''}`.trim(),
            initials:
              `${r.user.firstName[0]}${r.user.lastName?.[0] ?? ''}`.toUpperCase(),
          }
        : {
            name: '',
            initials: '',
          };
      acc[r.emoji].users.push(userObj);
      return acc;
    },
    {} as Record<string, { emoji: string; users: any[] }>,
  );

  return Object.values(grouped).map((g: any) => ({
    emoji: g.emoji,
    count: g.users.length,
    users: g.users,
    hasReacted: g.users.some((u: any) => u.id === currentUserId),
  }));
}

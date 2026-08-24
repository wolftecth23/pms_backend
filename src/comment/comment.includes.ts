export const COMMENT_INCLUDE = {
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatar: true,
    },
  },
  replyTo: {
    select: {
      id: true,
      text: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  },
  attachments: true,
  reactions: {
    select: {
      userId: true,
      emoji: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  },
  mentions: {
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  },
};

export interface CommentMentionEmailData {
  recipientName: string;
  recipientEmail: string;
  commenterName: string;
  commentText: string;
  taskName: string;
  taskId: string;
  commentId: string;
  projectName: string;
  workspaceName: string;
  commentCreatedAt: Date;
  commentUrl: string;
}

export function renderCommentMentionTemplate(data: CommentMentionEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `You were mentioned in a comment on "${data.taskName}"`;

  const formattedDate = new Date(data.commentCreatedAt).toLocaleString(
    'en-US',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  );

  const text = `Hi ${data.recipientName},

${data.commenterName} mentioned you in a comment on the task "${data.taskName}".

Comment:
"${data.commentText}"

Project: ${data.projectName}
Workspace: ${data.workspaceName}
Date: ${formattedDate}

View Comment: ${data.commentUrl}

Thanks,
STL-PMS Team`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f4f5f7;
      margin: 0;
      padding: 0;
      color: #172b4d;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 600px;
      margin: 30px auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      border: 1px solid #e2e8f0;
    }
    .header {
      background-color: #0f172a;
      padding: 24px 32px;
      text-align: left;
    }
    .header h1 {
      color: #ffffff;
      font-size: 20px;
      margin: 0;
      font-weight: 600;
      letter-spacing: -0.5px;
    }
    .content {
      padding: 32px;
    }
    .greeting {
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 12px;
    }
    .message-lead {
      font-size: 15px;
      line-height: 1.6;
      color: #334155;
      margin-bottom: 20px;
    }
    .comment-box {
      background-color: #f8fafc;
      border-left: 4px solid #3b82f6;
      border-radius: 4px;
      padding: 16px 20px;
      margin: 20px 0;
    }
    .commenter-name {
      font-weight: 600;
      font-size: 14px;
      color: #1e293b;
      margin-bottom: 6px;
    }
    .comment-text {
      font-size: 14px;
      line-height: 1.5;
      color: #475569;
      white-space: pre-wrap;
    }
    .meta-table {
      width: 100%;
      margin: 24px 0 28px 0;
      border-collapse: collapse;
    }
    .meta-table td {
      padding: 8px 0;
      font-size: 14px;
      vertical-align: top;
    }
    .meta-label {
      color: #64748b;
      width: 100px;
      font-weight: 500;
    }
    .meta-value {
      color: #1e293b;
      font-weight: 600;
    }
    .btn-container {
      margin: 28px 0 20px 0;
    }
    .btn {
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 28px;
      font-size: 14px;
      font-weight: 600;
      border-radius: 6px;
      box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
    }
    .btn:hover {
      background-color: #1d4ed8;
    }
    .footer {
      background-color: #f8fafc;
      padding: 20px 32px;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #94a3b8;
      text-align: center;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>STL-PMS</h1>
    </div>
    <div class="content">
      <div class="greeting">Hi ${data.recipientName},</div>
      <div class="message-lead">
        <strong>${data.commenterName}</strong> mentioned you in a comment on the task <strong>"${data.taskName}"</strong>.
      </div>

      <div class="comment-box">
        <div class="commenter-name">${data.commenterName} wrote:</div>
        <div class="comment-text">"${data.commentText}"</div>
      </div>

      <table class="meta-table">
        <tr>
          <td class="meta-label">Task:</td>
          <td class="meta-value">${data.taskName}</td>
        </tr>
        <tr>
          <td class="meta-label">Project:</td>
          <td class="meta-value">${data.projectName}</td>
        </tr>
        <tr>
          <td class="meta-label">Workspace:</td>
          <td class="meta-value">${data.workspaceName}</td>
        </tr>
        <tr>
          <td class="meta-label">Date:</td>
          <td class="meta-value">${formattedDate}</td>
        </tr>
      </table>

      <div class="btn-container">
        <a href="${data.commentUrl}" target="_blank" class="btn">View Comment</a>
      </div>
    </div>
    <div class="footer">
      You are receiving this email because you were tagged in a task comment on STL-PMS.<br>
      &copy; ${new Date().getFullYear()} STL-PMS. All rights reserved.
    </div>
  </div>
</body>
</html>`;

  return { subject, html, text };
}

export interface OtpEmailData {
  recipientName: string;
  recipientEmail: string;
  otp: string;
  purpose: string; // e.g. "Password Reset", "Change Password", "Email Verification"
  expiresInMinutes?: number;
}

export function renderOtpEmailTemplate(data: OtpEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const expiresIn = data.expiresInMinutes ?? 10;
  const subject = `Your ${data.purpose} Verification Code: ${data.otp}`;

  const text = `Hi ${data.recipientName},

We received a request to verify your identity for ${data.purpose}.

Your verification code is: ${data.otp}

This code will expire in ${expiresIn} minutes.

Security Note:
Never share this code with anyone. STL-PMS team members will never ask for your verification code. If you did not make this request, you can safely ignore this email.

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
    .otp-box {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #3b82f6;
      border-radius: 4px;
      padding: 24px 20px;
      margin: 24px 0;
      text-align: center;
    }
    .otp-label {
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      margin-bottom: 8px;
    }
    .otp-code {
      font-size: 36px;
      font-weight: 700;
      letter-spacing: 8px;
      color: #0f172a;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
      margin: 8px 0;
      padding-left: 8px;
    }
    .otp-expiry {
      font-size: 13px;
      color: #d97706;
      font-weight: 600;
      margin-top: 10px;
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
      width: 130px;
      font-weight: 500;
    }
    .meta-value {
      color: #1e293b;
      font-weight: 600;
    }
    .security-note {
      background-color: #f8fafc;
      border-left: 4px solid #64748b;
      border-radius: 4px;
      padding: 14px 18px;
      font-size: 13px;
      line-height: 1.5;
      color: #475569;
      margin-top: 24px;
    }
    .security-note strong {
      color: #1e293b;
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
        We received a request to verify your identity for <strong>${data.purpose}</strong>. Please use the verification code below to proceed:
      </div>

      <div class="otp-box">
        <div class="otp-label">Verification Code</div>
        <div class="otp-code">${data.otp}</div>
        <div class="otp-expiry">⏱ Code expires in ${expiresIn} minutes</div>
      </div>

      <table class="meta-table">
        <tr>
          <td class="meta-label">Purpose:</td>
          <td class="meta-value">${data.purpose}</td>
        </tr>
        <tr>
          <td class="meta-label">Requested For:</td>
          <td class="meta-value">${data.recipientEmail}</td>
        </tr>
        <tr>
          <td class="meta-label">Valid Duration:</td>
          <td class="meta-value">${expiresIn} minutes</td>
        </tr>
      </table>

      <div class="security-note">
        <strong>Security Notice:</strong> Never share this code with anyone. STL-PMS team members will never ask for your verification code. If you did not make this request, you can safely ignore this email.
      </div>
    </div>
    <div class="footer">
      You are receiving this email because a verification request was made on STL-PMS.<br>
      &copy; ${new Date().getFullYear()} STL-PMS. All rights reserved.
    </div>
  </div>
</body>
</html>`;

  return { subject, html, text };
}

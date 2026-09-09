import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';
import {
  CommentMentionEmailData,
  renderCommentMentionTemplate,
} from './templates/comment-mention.template';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initTransporter();
  }

  private initTransporter() {
    const host = this.configService.get<string>('MAIL_HOST');
    const port = this.configService.get<number>('MAIL_PORT');
    const user = this.configService.get<string>('MAIL_USER');
    const pass = this.configService.get<string>('MAIL_PASS');

    if (!host) {
      this.logger.warn(
        'MAIL_HOST is not set. Email notifications will be logged to console in dev mode.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: Number(port) || 587,
      secure: Number(port) === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async sendCommentMentionEmail(
    data: CommentMentionEmailData,
  ): Promise<boolean> {
    try {
      const from =
        this.configService.get<string>('MAIL_FROM') ||
        '"STL-PMS" <noreply@stl-pms.com>';

      const { subject, html, text } = renderCommentMentionTemplate(data);

      if (process.env.NODE_ENV === 'development') {
        const resend = new Resend(process.env.RESEND_EMAIL_API_KEY);
        await resend.emails.send({
          from: 'Acme <onboarding@resend.dev>',
          to: data.recipientEmail,
          subject,
          html,
        });
      } else {
        if (!this.transporter) {
          this.logger.log(
            `[MOCK EMAIL SENT] To: ${data.recipientEmail} (${data.recipientName}) | Subject: "${subject}" | URL: ${data.commentUrl}`,
          );
          return true;
        }

        await this.transporter.sendMail({
          from,
          to: data.recipientEmail,
          subject,
          text,
          html,
        });
      }

      this.logger.log(
        `Mention email sent successfully to ${data.recipientEmail} for task "${data.taskName}"`,
      );
      return true;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `Failed to send mention email to user: ${data.recipientEmail} (ID: ${data.recipientName}), comment ID: ${data.commentId}, task ID: ${data.taskId}. Error: ${err?.message || String(error)}`,
        err?.stack,
      );
      return false;
    }
  }
}

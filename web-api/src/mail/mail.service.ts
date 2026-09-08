import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { MailConfig } from '../config/mail.config';

@Injectable()
export class MailService {
  private readonly config: MailConfig | null;
  private readonly transporter: Transporter | null;

  constructor(config: ConfigService) {
    this.config =
      config.get<{ config: MailConfig | null }>('mail')?.config ?? null;
    this.transporter = this.config
      ? createTransport({
          host: this.config.host,
          port: this.config.port,
          secure: this.config.secure,
          ...(this.config.user && this.config.password
            ? { auth: { user: this.config.user, pass: this.config.password } }
            : {}),
        })
      : null;
  }

  async sendInvitation({
    to,
    recipientName,
    token,
    expiresAt,
  }: {
    to: string;
    recipientName: string;
    token: string;
    expiresAt: Date;
  }): Promise<boolean> {
    if (!this.config || !this.transporter) return false;
    const invitationUrl = new URL(
      '/accept-invitation',
      this.config.invitationBaseUrl,
    );
    invitationUrl.hash = `token=${encodeURIComponent(token)}`;
    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to,
        subject: 'Complete your Task Manager account',
        text: `Hello ${recipientName},\n\nUse this one-time link to complete your account setup: ${invitationUrl}\n\nThis invitation expires on ${expiresAt.toUTCString()}.`,
      });
      return true;
    } catch {
      return false;
    }
  }
}

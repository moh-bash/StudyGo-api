import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Minimal transactional mail helper. When SMTP is not configured the service is
 * disabled: password-reset still succeeds and the token is logged at warn level
 * so a developer can complete the flow locally. Push/other delivery is not
 * implemented here.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string | undefined;

  constructor(config: ConfigService) {
    const host = config.get<string>('mail.host');
    const user = config.get<string>('mail.user');
    const pass = config.get<string>('mail.pass');
    this.from = config.get<string>('mail.from');

    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: config.get<number>('mail.port') ?? 587,
        secure: false,
        auth: user && pass ? { user, pass } : undefined,
      });
    } else {
      this.transporter = null;
    }
  }

  get enabled(): boolean {
    return this.transporter !== null;
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    const resetUrl = process.env.PASSWORD_RESET_URL
      ? `${process.env.PASSWORD_RESET_URL}?token=${encodeURIComponent(token)}`
      : undefined;

    if (!this.transporter) {
      this.logger.warn(
        `SMTP is not configured; password reset token for ${to}: ${token}` +
          (resetUrl ? ` (link: ${resetUrl})` : ''),
      );
      return;
    }

    const text = resetUrl
      ? `Use the following link to reset your StudyGO password: ${resetUrl}`
      : `Use this token to reset your StudyGO password: ${token}`;

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'StudyGO password reset',
      text,
    });
  }
}

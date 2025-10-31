import nodemailer, { type Transporter } from "nodemailer";

import { getConfig } from "../config/index.js";
import { getLogger } from "../lib/logger.js";

export interface EmailService {
  sendVerificationEmail(to: string, token: string): Promise<void>;
  sendPasswordResetEmail(to: string, token: string): Promise<void>;
}

class ConsoleEmailService implements EmailService {
  private logger = getLogger();

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    this.logger.info(
      {
        emailType: "verification",
        recipient: to,
        tokenLength: token.length,
      },
      "Email (console): Verification email",
    );
    this.logger.info(
      {
        exampleLink: `https://yourapp.com/verify-email?token=${token}`,
      },
      "Verification token ready",
    );
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    this.logger.info(
      {
        emailType: "password-reset",
        recipient: to,
        tokenLength: token.length,
      },
      "Email (console): Password reset email",
    );
    this.logger.info(
      {
        exampleLink: `https://yourapp.com/reset-password?token=${token}`,
      },
      "Password reset token ready",
    );
  }
}

class SmtpEmailService implements EmailService {
  private transporter: Transporter;
  private fromAddress: string;
  private logger = getLogger();

  constructor(transporter: Transporter, fromAddress: string) {
    this.transporter = transporter;
    this.fromAddress = fromAddress;
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const subject = "Verify your email address";
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(to right, #4F46E5, #7C3AED); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Verify Your Email</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hello!</p>
            <p style="font-size: 16px; margin-bottom: 20px;">
              Thank you for signing up. Please verify your email address by using the verification code below:
            </p>
            <div style="background: white; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
              <code style="font-size: 24px; font-weight: bold; color: #4F46E5; letter-spacing: 2px;">${token}</code>
            </div>
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              This verification code will expire in 1 hour.
            </p>
            <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
              If you didn't create an account, you can safely ignore this email.
            </p>
          </div>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
            <p>This is an automated email, please do not reply.</p>
          </div>
        </body>
      </html>
    `;

    const text = `
Verify Your Email

Hello!

Thank you for signing up. Please verify your email address by using the verification code below:

${token}

This verification code will expire in 1 hour.

If you didn't create an account, you can safely ignore this email.
    `.trim();

    const info = await this.transporter.sendMail({
      from: this.fromAddress,
      to,
      subject,
      text,
      html,
    });

    this.logger.info(
      {
        emailType: "verification",
        recipient: to,
        messageId: info.messageId,
      },
      "Verification email sent via SMTP",
    );
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const subject = "Reset your password";
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(to right, #DC2626, #EA580C); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Password Reset</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hello!</p>
            <p style="font-size: 16px; margin-bottom: 20px;">
              You requested to reset your password. Use the reset code below to set a new password:
            </p>
            <div style="background: white; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
              <code style="font-size: 24px; font-weight: bold; color: #DC2626; letter-spacing: 2px;">${token}</code>
            </div>
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              This reset code will expire in 30 minutes.
            </p>
            <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
              If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
            </p>
          </div>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
            <p>This is an automated email, please do not reply.</p>
          </div>
        </body>
      </html>
    `;

    const text = `
Password Reset

Hello!

You requested to reset your password. Use the reset code below to set a new password:

${token}

This reset code will expire in 30 minutes.

If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
    `.trim();

    const info = await this.transporter.sendMail({
      from: this.fromAddress,
      to,
      subject,
      text,
      html,
    });

    this.logger.info(
      {
        emailType: "password-reset",
        recipient: to,
        messageId: info.messageId,
      },
      "Password reset email sent via SMTP",
    );
  }
}

let emailServiceInstance: EmailService | null = null;

export function getEmailService(): EmailService {
  if (emailServiceInstance) {
    return emailServiceInstance;
  }

  const config = getConfig();

  // Use SMTP if all required config is present
  if (config.smtp.host && config.smtp.port && config.smtp.from) {
    const transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth:
        config.smtp.user && config.smtp.pass
          ? {
              user: config.smtp.user,
              pass: config.smtp.pass,
            }
          : undefined,
    });

    emailServiceInstance = new SmtpEmailService(transporter, config.smtp.from);
  } else {
    // Fallback to console logging for development
    emailServiceInstance = new ConsoleEmailService();
  }

  return emailServiceInstance;
}

export function resetEmailService(): void {
  emailServiceInstance = null;
}

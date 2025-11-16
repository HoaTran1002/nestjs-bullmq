import { Global, Logger, Module, OnModuleInit } from '@nestjs/common';
import {
  MailerModule as NestMailerModule,
  MailerService as NestMailerService,
} from '@nestjs-modules/mailer';
import * as nodemailer from 'nodemailer';
import * as tls from 'tls';
import { CoreConfigModule } from '@/core/config/config.module';
import { ConfigService } from '@/core/config/config.service';
import { MailerService } from './mailer.service';

@Global()
@Module({
  imports: [
    CoreConfigModule,
    NestMailerModule.forRootAsync({
      imports: [CoreConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.mailerHost,
          port: configService.mailerPort,
          secure: configService.mailerSecure === 'true',
          pool: true,
          auth: {
            user: configService.mailerUsername,
            pass: configService.mailerPassword,
          },
          tls: {
            servername: configService.mailerHost,
            rejectUnauthorized: false,
            // Custom checkServerIdentity to handle null certificate issue with Office365
            checkServerIdentity: (hostname: string, cert: any) => {
              // Handle null/undefined certificate gracefully
              if (!cert) {
                // Return undefined to accept the connection without certificate validation
                // This is acceptable since rejectUnauthorized is false
                return undefined;
              }

              // If we have a certificate, use Node.js default validation
              return tls.checkServerIdentity(hostname, cert);
            },
          },
          requireTLS: configService.mailerPort === 587,
        },
        defaults: {
          from: configService.mailerDefaultFromEmail,
        },
      }),
    }),
  ],
  providers: [MailerService],
  exports: [MailerService],
})
export class MailerModule implements OnModuleInit {
  constructor(private readonly nestMailer: NestMailerService) {}
  private readonly logger = new Logger(MailerModule.name);

  async onModuleInit() {
    try {
      const transporter = (
        this.nestMailer as unknown as { transporter: nodemailer.Transporter }
      ).transporter;

      this.logger.log(
        `Verifying SMTP connection to ${transporter.options.host}:${transporter.options.port}...`,
      );
      this.logger.log(
        `Using secure: ${transporter.options.secure}, requireTLS: ${transporter.options.requireTLS}`,
      );

      await transporter.verify();
      this.logger.log(
        `✓ SMTP verified: ${transporter.options.host}:${transporter.options.port}`,
      );
    } catch (e) {
      this.logger.error(`✗ SMTP verification failed`);
      this.logger.error(
        `Host: ${(this.nestMailer as any).transporter.options.host}`,
      );
      this.logger.error(
        `Port: ${(this.nestMailer as any).transporter.options.port}`,
      );
      this.logger.error(
        `Secure: ${(this.nestMailer as any).transporter.options.secure}`,
      );
      this.logger.error(`Error: ${e.message}`);
      this.logger.error(`Stack: ${e.stack}`);

      // Don't throw in development - let the app start anyway
      if (process.env.NODE_ENV === 'production') {
        throw e;
      } else {
        this.logger.warn('Continuing despite SMTP failure in development mode');
      }
    }
  }
}

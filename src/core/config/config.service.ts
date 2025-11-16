import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EnvironmentVariables } from './env.validation';

// Local typed wrapper to satisfy strict lint rules when calling underlying methods
type InferOption = { infer?: boolean };
interface StrictConfigService {
  get<T = unknown>(key: string, options?: InferOption): T | undefined;
  getOrThrow<T = unknown>(key: string, options?: InferOption): T;
}

// Injectable service to provide typed access to configuration values
@Injectable()
export class ConfigService {
  // Inject the base ConfigService from @nestjs/config
  constructor(
    private readonly nestConfigService: NestConfigService<
      EnvironmentVariables,
      true
    >,
  ) {
    // Cast once to a strictly typed interface to avoid unsafe-member-access lint errors
    this.cfg = this.nestConfigService as unknown as StrictConfigService;
  }

  private readonly cfg: StrictConfigService;

  // Implement typed getters for your variables
  // The 'true' in NestConfigService<..., true> infers types automatically based on schema if possible

  // Application Settings
  get nodeEnv(): EnvironmentVariables['NODE_ENV'] {
    const value = this.cfg.getOrThrow<EnvironmentVariables['NODE_ENV']>(
      'NODE_ENV',
      { infer: true },
    );
    return value;
  }

  get baseUrl(): string {
    return (
      this.cfg.get<string>('BASE_URL', { infer: true }) ||
      `http://${this.host}:${this.port}`
    );
  }

  get port(): number {
    return this.cfg.get<number>('PORT', { infer: true }) || 3000;
  }

  get host(): string {
    return this.cfg.get<string>('HOST', { infer: true }) || '0.0.0.0';
  }

  // Database
  get databaseUrl(): string {
    return this.cfg.getOrThrow<string>('DATABASE_URL', { infer: true });
  }

  // Redis
  get redisUrl(): string {
    return this.cfg.getOrThrow<string>('REDIS_URL', { infer: true });
  }

  // Authentication
  get jwtSecret(): string {
    return this.cfg.getOrThrow<string>('JWT_SECRET', { infer: true });
  }

  get jwtExpiration(): string {
    return this.cfg.getOrThrow<string>('JWT_EXPIRATION', { infer: true });
  }

  get jwtRefreshExpiration(): string {
    return this.cfg.getOrThrow<string>('JWT_REFRESH_EXPIRATION', {
      infer: true,
    });
  }

  // Example of getting a group of related variables (optional structure)
  get jwtConfig() {
    return {
      secret: this.jwtSecret,
      expiration: this.jwtExpiration,
      refreshExpiration: this.jwtRefreshExpiration,
    };
  }

  // Better Auth
  get betterAuthSecret(): string {
    return this.cfg.getOrThrow<string>('BETTER_AUTH_SECRET', {
      infer: true,
    });
  }

  get betterAuthUrl(): string {
    return (
      this.cfg.get<string>('BETTER_AUTH_URL', { infer: true }) ||
      'http://localhost:3000'
    );
  }

  // Better Auth configuration group
  get betterAuthConfig() {
    return {
      secret: this.betterAuthSecret,
      baseURL: this.betterAuthUrl,
    };
  }

  // CORS
  get corsOrigin(): string | undefined {
    return this.cfg.get<string>('CORS_ORIGIN', { infer: true });
  }

  // Rate Limiting
  get rateLimitTtl(): number {
    return this.cfg.get<number>('RATE_LIMIT_TTL', { infer: true }) || 60;
  }

  get rateLimitMax(): number {
    return this.cfg.get<number>('RATE_LIMIT_MAX', { infer: true }) || 100;
  }

  // Logging
  get logLevel(): string {
    return this.cfg.get<string>('LOG_LEVEL', { infer: true }) || 'info';
  }

  get logPretty(): boolean {
    return this.cfg.get<boolean>('LOG_PRETTY', { infer: true }) || false;
  }

  get logRedact(): string[] {
    const redact = this.cfg.get<string[]>('LOG_REDACT', { infer: true });
    return redact && redact.length
      ? redact
      : [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          'req.body.password',
          'req.body.refresh_token',
        ];
  }

  // BullMQ
  get bullmqDefaultJobAttempts(): number {
    return (
      this.cfg.get<number>('BULLMQ_DEFAULT_JOB_ATTEMPTS', {
        infer: true,
      }) || 3
    );
  }

  get bullmqDefaultBackoffDelay(): number {
    return (
      this.cfg.get<number>('BULLMQ_DEFAULT_BACKOFF_DELAY', {
        infer: true,
      }) || 1000
    );
  }

  // Health Check
  get healthCheckTimeout(): number {
    return (
      this.cfg.get<number>('HEALTH_CHECK_TIMEOUT', {
        infer: true,
      }) || 5000
    );
  }

  get healthCheckInterval(): number {
    return (
      this.cfg.get<number>('HEALTH_CHECK_INTERVAL', {
        infer: true,
      }) || 30000
    );
  }

  // WebSocket
  get wsPort(): number {
    return this.cfg.get<number>('WS_PORT', { infer: true }) || 3001;
  }

  get wsPath(): string {
    return this.cfg.get<string>('WS_PATH', { infer: true }) || '/ws';
  }

  // Security Features
  get enableRateLimiting(): boolean {
    return (
      this.cfg.get<boolean>('ENABLE_RATE_LIMITING', {
        infer: true,
      }) ?? true
    );
  }

  get enableCors(): boolean {
    return this.cfg.get<boolean>('ENABLE_CORS', { infer: true }) ?? true;
  }

  get enableHelmet(): boolean {
    return this.cfg.get<boolean>('ENABLE_HELMET', { infer: true }) ?? true;
  }

  // Monitoring
  get enableMetrics(): boolean {
    return this.cfg.get<boolean>('ENABLE_METRICS', { infer: true }) ?? true;
  }

  get metricsPort(): number {
    return this.cfg.get<number>('METRICS_PORT', { infer: true }) || 9090;
  }

  // Cache
  get cacheTtl(): number {
    return this.cfg.get<number>('CACHE_TTL', { infer: true }) || 3600;
  }

  get cacheMax(): number {
    return this.cfg.get<number>('CACHE_MAX', { infer: true }) || 1000;
  }
  get cacheDB(): {
    appDB: number;
    bullDB: number;
  } {
    return {
      appDB: this.cfg.get<number>('REDIS_CACHE_DB', { infer: true }) || 0,
      bullDB: this.cfg.get<number>('REDIS_BULL_DB', { infer: true }) || 1,
    };
  }

  // MQTT Configuration
  get mqttHost(): string {
    return this.cfg.get<string>('MQTT_HOST', { infer: true }) || 'localhost';
  }

  get mqttPort(): number {
    return this.cfg.get<number>('MQTT_PORT', { infer: true }) || 1883;
  }

  get mqttUsername(): string | undefined {
    return this.cfg.get<string>('MQTT_USERNAME', { infer: true });
  }

  get mqttPassword(): string | undefined {
    return this.cfg.get<string>('MQTT_PASSWORD', { infer: true });
  }

  get mqttUseSsl(): boolean {
    return this.cfg.get<boolean>('MQTT_USE_SSL', { infer: true }) || false;
  }

  get mqttCaCertPath(): string | undefined {
    return this.cfg.get<string>('MQTT_CA_CERT_PATH', {
      infer: true,
    });
  }

  get mqttClientCertPath(): string | undefined {
    return this.cfg.get<string>('MQTT_CLIENT_CERT_PATH', {
      infer: true,
    });
  }

  get mqttClientKeyPath(): string | undefined {
    return this.cfg.get<string>('MQTT_CLIENT_KEY_PATH', {
      infer: true,
    });
  }

  get mqttTopicPrefix(): string {
    return (
      this.cfg.get<string>('MQTT_TOPIC_PREFIX', {
        infer: true,
      }) || 'kocham'
    );
  }

  // MQTT Configuration Group
  get mqttConfig() {
    return {
      host: this.mqttHost,
      port: this.mqttPort,
      username: this.mqttUsername,
      password: this.mqttPassword,
      useSsl: this.mqttUseSsl,
      caCertPath: this.mqttCaCertPath,
      clientCertPath: this.mqttClientCertPath,
      clientKeyPath: this.mqttClientKeyPath,
      topicPrefix: this.mqttTopicPrefix,
    };
  }

  // AWS Configuration
  get awsRegion(): string {
    return this.cfg.get<string>('AWS_REGION', { infer: true }) || 'us-east-1';
  }

  get awsAccessKeyId(): string {
    return this.cfg.getOrThrow<string>('AWS_ACCESS_KEY_ID', {
      infer: true,
    });
  }

  get awsSecretAccessKey(): string {
    return this.cfg.getOrThrow<string>('AWS_SECRET_ACCESS_KEY', {
      infer: true,
    });
  }

  get s3BucketName(): string {
    return this.cfg.getOrThrow<string>('S3_BUCKET_NAME', { infer: true });
  }

  // AWS SNS Configuration
  get snsIosPlatformApplicationArn(): string | undefined {
    return this.cfg.get<string>('AWS_SNS_IOS_PLATFORM_APPLICATION_ARN', {
      infer: true,
    });
  }

  get snsAndroidPlatformApplicationArn(): string | undefined {
    return this.cfg.get<string>('AWS_SNS_ANDROID_PLATFORM_APPLICATION_ARN', {
      infer: true,
    });
  }

  // AWS SNS SMS Configuration
  get snsSmsSenderId(): string {
    return (
      this.cfg.get<string>('AWS_SNS_SMS_SENDER_ID', {
        infer: true,
      }) || 'KochamOTP'
    );
  }

  get snsTestPhoneNumber(): string | undefined {
    return this.cfg.get<string>('AWS_SNS_TEST_PHONE_NUMBER', {
      infer: true,
    });
  }

  // AWS Pinpoint Configuration (Legacy - for migration)
  get pinpointApplicationArn(): string | undefined {
    return this.cfg.get<string>('AWS_PINPOINT_APPLICATION_ARN', {
      infer: true,
    });
  }

  get pinpointApplicationId(): string {
    const configuredId = this.cfg.get<string>('AWS_PINPOINT_APPLICATION_ID', {
      infer: true,
    });

    if (configuredId) {
      return configuredId;
    }

    const applicationArn = this.pinpointApplicationArn;
    if (applicationArn) {
      const derivedId = this.extractPinpointApplicationId(applicationArn);
      if (derivedId) {
        return derivedId;
      }
    }

    throw new Error(
      'AWS Pinpoint application ID is not configured. Set AWS_PINPOINT_APPLICATION_ID or AWS_PINPOINT_APPLICATION_ARN.',
    );
  }

  get pinpointApnsChannelType(): 'APNS' | 'APNS_SANDBOX' {
    const configured = this.cfg.get<'APNS' | 'APNS_SANDBOX'>(
      'AWS_PINPOINT_APNS_CHANNEL',
      { infer: true },
    );

    if (configured === 'APNS' || configured === 'APNS_SANDBOX') {
      return configured;
    }

    return this.nodeEnv === 'production' ? 'APNS' : 'APNS_SANDBOX';
  }

  // AWS Configuration Group
  get awsConfig() {
    return {
      region: this.awsRegion,
      accessKeyId: this.awsAccessKeyId,
      secretAccessKey: this.awsSecretAccessKey,
      s3BucketName: this.s3BucketName,
    };
  }

  get socialCredentials(): {
    google: {
      clientId: string;
      clientSecret: string;
    };
    kakao: {
      clientId: string;
      clientSecret: string;
    };
    naver: {
      clientId: string;
      clientSecret: string;
    };
  } {
    return {
      google: {
        clientId: this.cfg.getOrThrow<string>('GOOGLE_CLIENT_ID', {
          infer: true,
        }),
        clientSecret: this.cfg.getOrThrow<string>('GOOGLE_CLIENT_SECRET', {
          infer: true,
        }),
      },
      kakao: {
        clientId: this.cfg.getOrThrow<string>('KAKAO_CLIENT_ID', {
          infer: true,
        }),
        clientSecret: this.cfg.getOrThrow<string>('KAKAO_CLIENT_SECRET', {
          infer: true,
        }),
      },
      naver: {
        clientId: this.cfg.getOrThrow<string>('NAVER_CLIENT_ID', {
          infer: true,
        }),
        clientSecret: this.cfg.getOrThrow<string>('NAVER_CLIENT_SECRET', {
          infer: true,
        }),
      },
    };
  }

  // Mailer Configuration
  get mailerHost(): string {
    return this.cfg.getOrThrow<string>('MAILER_SMTP_HOST', {
      infer: true,
    });
  }

  get mailerPort(): number {
    return this.cfg.getOrThrow<number>('MAILER_SMTP_PORT', {
      infer: true,
    });
  }

  get mailerSecure(): boolean {
    // MAILER_SMTP_SECURE is defined as a boolean in env.validation.ts
    return this.cfg.getOrThrow<boolean>('MAILER_SMTP_SECURE', {
      infer: true,
    });
  }

  get mailerUsername(): string {
    return this.cfg.getOrThrow<string>('MAILER_SMTP_USERNAME', {
      infer: true,
    });
  }

  get mailerPassword(): string {
    return this.cfg.getOrThrow<string>('MAILER_SMTP_PASSWORD', {
      infer: true,
    });
  }

  get mailerDefaultFromEmail(): string {
    return this.cfg.getOrThrow<string>('MAILER_DEFAULT_FROM_EMAIL', {
      infer: true,
    });
  }

  get mailerDefaultFromName(): string {
    return this.cfg.getOrThrow<string>('MAILER_DEFAULT_FROM_NAME', {
      infer: true,
    });
  }

  get mailerTlsMinVersion(): string {
    return (
      this.cfg.get<string>('MAILER_TLS_MIN_VERSION', {
        infer: true,
      }) || 'TLSv1.2'
    );
  }

  get mailerTlsCiphers(): string {
    return (
      this.cfg.get<string>('MAILER_TLS_CIPHERS', {
        infer: true,
      }) ||
      'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384'
    );
  }

  get mailerTlsRejectUnauthorized(): boolean {
    return (
      this.cfg.get<boolean>('MAILER_TLS_REJECT_UNAUTHORIZED', {
        infer: true,
      }) ?? true
    );
  }

  // Grouped config getter
  get mailerConfig() {
    return {
      host: this.mailerHost,
      port: this.mailerPort,
      secure: this.mailerSecure,
      auth: {
        user: this.mailerUsername,
        pass: this.mailerPassword,
      },
      tls: {
        rejectUnauthorized: this.mailerTlsRejectUnauthorized,
        minVersion: this.mailerTlsMinVersion,
        ciphers: this.mailerTlsCiphers,
      },
      defaults: {
        from: {
          address: this.mailerDefaultFromEmail,
          name: this.mailerDefaultFromName,
        },
      },
    } as const;
  }

  get maxFileSize(): number {
    return this.cfg.getOrThrow<number>('MAX_FILE_SIZE', { infer: true });
  }

  get googleApiKey(): string {
    return this.cfg.getOrThrow<string>('GOOGLE_API_KEY', { infer: true });
  }

  private extractPinpointApplicationId(arn: string): string | undefined {
    const match = arn.match(/:apps\/([a-zA-Z0-9_-]+)$/);
    return match?.[1];
  }
}

import * as z from 'zod';

// Define the schema for your environment variables
export const EnvironmentSchema = z
  .object({
    // Application Settings
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    BASE_URL: z.string().url().optional(),
    PORT: z.coerce.number().min(1).max(65535).default(3000),
    HOST: z.string().default('0.0.0.0'),

    // Database
    DATABASE_URL: z.string().url().min(1),

    // Redis
    REDIS_URL: z.string().url().min(1),
    REDIS_CACHE_DB: z.coerce.number().min(0).default(0),
    REDIS_BULL_DB: z.coerce.number().min(0).default(1),

    // Authentication
    JWT_SECRET: z
      .string()
      .min(32, 'JWT secret must be at least 32 characters long'),
    JWT_EXPIRATION: z.string().default('60m'),
    JWT_REFRESH_EXPIRATION: z.string().default('7d'),

    // Better Auth
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, 'Better Auth secret must be at least 32 characters long'),
    BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),

    // CORS
    CORS_ORIGIN: z.string().optional(),

    // Rate Limiting
    RATE_LIMIT_TTL: z.coerce.number().min(1).optional().default(60),
    RATE_LIMIT_MAX: z.coerce.number().min(1).optional().default(100),

    // Logging
    LOG_LEVEL: z
      .enum(['error', 'warn', 'info', 'debug', 'trace'])
      .default('info'),
    LOG_PRETTY: z.coerce.boolean().default(false),
    LOG_REDACT: z
      .preprocess(
        (val) =>
          typeof val === 'string'
            ? val
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : val,
        z.array(z.string()),
      )
      .optional(),

    // BullMQ
    BULLMQ_DEFAULT_JOB_ATTEMPTS: z.coerce.number().min(1).default(3),
    BULLMQ_DEFAULT_BACKOFF_DELAY: z.coerce.number().min(0).default(1000),

    // Health Check
    HEALTH_CHECK_TIMEOUT: z.coerce.number().min(0).default(5000),
    HEALTH_CHECK_INTERVAL: z.coerce.number().min(0).default(30000),

    // WebSocket
    WS_PORT: z.coerce.number().min(1).max(65535).default(3001),
    WS_PATH: z.string().default('/ws'),

    // Security Features
    ENABLE_RATE_LIMITING: z.coerce.boolean().default(true),
    ENABLE_CORS: z.coerce.boolean().default(true),
    ENABLE_HELMET: z.coerce.boolean().default(true),

    // Monitoring
    METRICS_PORT: z.coerce.number().min(1).max(65535).default(9090),

    // Cache
    CACHE_TTL: z.coerce.number().min(1).optional().default(3600),
    CACHE_MAX: z.coerce.number().min(1).optional().default(1000),

    // MQTT Configuration
    MQTT_HOST: z.string().default('localhost'),
    MQTT_PORT: z.coerce.number().min(1).max(65535).default(1883),
    MQTT_USERNAME: z.string().optional(),
    MQTT_PASSWORD: z.string().optional(),
    MQTT_USE_SSL: z.coerce.boolean().default(false),
    MQTT_CA_CERT_PATH: z.string().optional(),
    MQTT_CLIENT_CERT_PATH: z.string().optional(),
    MQTT_CLIENT_KEY_PATH: z.string().optional(),
    MQTT_TOPIC_PREFIX: z.string().default('kocham'),

    // AWS Configuration
    AWS_REGION: z.string().default('us-east-1'),
    AWS_ACCESS_KEY_ID: z.string().min(1),
    AWS_SECRET_ACCESS_KEY: z.string().min(1),
    S3_BUCKET_NAME: z.string().min(1),

    // AWS SNS Push Notification Configuration
    AWS_SNS_IOS_PLATFORM_APPLICATION_ARN: z.string().optional(),
    AWS_SNS_ANDROID_PLATFORM_APPLICATION_ARN: z.string().optional(),

    // AWS SNS SMS Configuration
    AWS_SNS_SMS_SENDER_ID: z.string().optional(),
    AWS_SNS_TEST_PHONE_NUMBER: z.string().optional(),

    // AWS Pinpoint Push Notification Configuration (Legacy)
    AWS_PINPOINT_APPLICATION_ID: z.string().optional(),
    AWS_PINPOINT_APPLICATION_ARN: z.string().optional(),
    AWS_PINPOINT_APNS_CHANNEL: z.enum(['APNS', 'APNS_SANDBOX']).optional(),

    // Google Configuration
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),

    // Kakao Configuration
    KAKAO_CLIENT_ID: z.string().min(1),
    KAKAO_CLIENT_SECRET: z.string().min(1),

    // Naver Configuration
    NAVER_CLIENT_ID: z.string().min(1),
    NAVER_CLIENT_SECRET: z.string().min(1),

    // Mailer Configuration
    MAILER_SMTP_HOST: z.string().min(1),
    MAILER_SMTP_PORT: z.coerce.number().min(1).max(65535).default(587),
    MAILER_SMTP_SECURE: z.coerce.boolean(),
    MAILER_SMTP_USERNAME: z.string().min(1),
    MAILER_SMTP_PASSWORD: z.string().min(8),
    MAILER_DEFAULT_FROM_EMAIL: z.string().min(1),
    MAILER_DEFAULT_FROM_NAME: z.string().min(1),

    // File Upload Configuration
    MAX_FILE_SIZE: z.coerce.number().optional().default(10_485_760),

    // Google API Key
    GOOGLE_API_KEY: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    // Require SNS platform application ARNs for push notifications
    if (
      !data.AWS_SNS_IOS_PLATFORM_APPLICATION_ARN &&
      !data.AWS_SNS_ANDROID_PLATFORM_APPLICATION_ARN
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AWS_SNS_IOS_PLATFORM_APPLICATION_ARN'],
        message:
          'Provide at least one of AWS_SNS_IOS_PLATFORM_APPLICATION_ARN or AWS_SNS_ANDROID_PLATFORM_APPLICATION_ARN for SNS push notifications.',
      });
    }
  });

// Infer the TypeScript type from the schema
export type EnvironmentVariables = z.infer<typeof EnvironmentSchema>;

// Validation function used in AppModule
export function validate(config: Record<string, unknown>) {
  try {
    const validatedConfig = EnvironmentSchema.parse(config);
    return validatedConfig;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Environment variable validation failed:', error.format());
    } else {
      console.error('Environment variable validation failed:', error);
    }
    throw new Error(
      `Environment variable validation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

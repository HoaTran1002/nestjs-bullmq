import { randomUUID } from 'node:crypto';

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

import { LoggerService } from '@/core/logging/logger.service';
import { EmailOtpPayload, OtpMetadata, PhoneOtpPayload } from '@/lib/otp';

import {
  EmailOtpQueueJob,
  OTP_QUEUE_NAME,
  OtpQueueJob,
  OtpRequestContext,
  PhoneOtpQueueJob,
  SmsOtpQueueJob,
} from './otp-queue.types';

@Injectable()
export class OtpQueueService {
  constructor(
    @InjectQueue(OTP_QUEUE_NAME)
    private readonly queue: Queue<OtpQueueJob>,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(OtpQueueService.name);
  }

  async enqueueEmailOtp(
    payload: EmailOtpPayload,
    request?: unknown,
  ): Promise<void> {
    const job: EmailOtpQueueJob = {
      channel: 'email',
      payload,
      requestedAt: new Date().toISOString(),
      requestContext: this.buildRequestContext(request),
      correlationId: this.extractCorrelationId(payload.metadata),
    };
    await this.addJob(job);
    this.logger.log(
      `Queued email OTP job ${job.channel} for ${job.payload.email} [type=${job.payload.type}]`,
    );
  }

  async enqueuePhoneOtp(
    payload: PhoneOtpPayload,
    request?: unknown,
  ): Promise<void> {
    const job: PhoneOtpQueueJob = {
      channel: 'phone',
      payload,
      requestedAt: new Date().toISOString(),
      requestContext: this.buildRequestContext(request),
      correlationId: this.extractCorrelationId(payload.metadata),
    };

    await this.addJob(job);
  }

  async enqueueSmsOtp(
    payload: PhoneOtpPayload,
    request?: unknown,
  ): Promise<void> {
    const job: SmsOtpQueueJob = {
      channel: 'sms',
      payload,
      requestedAt: new Date().toISOString(),
      requestContext: this.buildRequestContext(request),
      correlationId: this.extractCorrelationId(payload.metadata),
    };

    await this.addJob(job);
  }

  private async addJob(job: OtpQueueJob): Promise<void> {
    const jobId = this.buildJobId(job);

    await this.queue.add(job.channel, job, {
      jobId,
    });

    this.logger.debug(
      `Queued ${job.channel} OTP job ${jobId} for correlation ${job.correlationId}`,
    );
  }

  private buildJobId(job: OtpQueueJob): string {
    const scope =
      job.channel === 'email' ? job.payload.type : job.payload.purpose;

    return `otp-${job.channel}-${scope}-${job.correlationId}`;
  }

  private buildRequestContext(
    request?: unknown,
  ): OtpRequestContext | undefined {
    if (!request || typeof request !== 'object') {
      return undefined;
    }

    const requestLike = request as {
      headers?: {
        get?: (name: string) => string | null;
        [key: string]: unknown;
      };
    };

    if (!requestLike.headers) {
      return undefined;
    }

    const getHeader = (name: string): string | undefined => {
      const headers = requestLike.headers;

      if (typeof headers?.get === 'function') {
        return headers.get(name) ?? undefined;
      }

      const lowerName = name.toLowerCase();
      const headerValue =
        headers?.[lowerName] ??
        headers?.[name] ??
        headers?.[lowerName.replace(/-/g, '_')];

      if (!headerValue) {
        return undefined;
      }

      if (Array.isArray(headerValue)) {
        return headerValue[0];
      }

      if (typeof headerValue === 'string') {
        return headerValue;
      }

      return undefined;
    };

    const context: OtpRequestContext = {
      ip: getHeader('x-forwarded-for') ?? getHeader('x-real-ip'),
      userAgent: getHeader('user-agent'),
      acceptLanguage: getHeader('x-language') ?? getHeader('accept-language'),
      requestId: getHeader('x-request-id') ?? getHeader('x-correlation-id'),
    };

    const deviceEndpointId =
      getHeader('x-device-endpoint-id') ?? getHeader('x-device-endpointid');
    if (deviceEndpointId) {
      context.deviceEndpointId = deviceEndpointId;
    }

    if (Object.values(context).every((value) => value === undefined)) {
      return undefined;
    }

    return context;
  }

  private extractCorrelationId(metadata?: OtpMetadata): string {
    if (metadata?.correlationId) {
      return metadata.correlationId;
    }

    return randomUUID();
  }
}

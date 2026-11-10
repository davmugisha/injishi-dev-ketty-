import {
  type ApplicationCodeSent,
  type ApplicationSession,
  type ApplicationView,
  RespondToOfferRequest,
  VerifyApplicationCodeRequest,
} from '@injishi/contracts';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { ApplicationsService } from '../../../modules/hr/application/applications.service';
import { MAX_HR_FILE_BYTES } from '../../../modules/storage/application/storage.service';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import { ApplicationThrottlerGuard } from './application-throttler.guard';

/** The slice of the Fastify request the upload route touches (see `uploads.controller.ts`). */
interface MultipartRequest {
  isMultipart?: () => boolean;
  parts?: (options?: { limits?: { fileSize?: number } }) => AsyncIterableIterator<MultipartPart>;
}

type MultipartPart =
  | { type: 'file'; fieldname: string; filename?: string; file?: { truncated?: boolean }; toBuffer: () => Promise<Buffer> }
  | { type: 'field'; fieldname: string; value: unknown };

const TOKEN = /^[A-Za-z0-9_-]{24,128}$/;

function token(raw: string): string {
  if (!TOKEN.test(raw)) throw new BadRequestException('That link is not right.');
  return raw;
}

/**
 * An applicant's own progress page -> /api/v1/applications (058-talent). Nobody is signed in: the
 * link in their emails names the application, a code mailed to its address opens it, and the
 * session that code gives travels as `x-application-session`. Every route is rate limited per
 * address.
 */
@Controller({ path: 'applications', version: '1' })
@UseGuards(ApplicationThrottlerGuard)
@SkipThrottle({ money: true })
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Post(':token/code')
  @HttpCode(200)
  sendCode(@Param('token') raw: string): Promise<ApplicationCodeSent> {
    return this.applications.sendCode(token(raw));
  }

  @Post(':token/verify')
  @HttpCode(200)
  verify(
    @Param('token') raw: string,
    @Body(new ZodValidationPipe(VerifyApplicationCodeRequest)) body: VerifyApplicationCodeRequest,
  ): Promise<ApplicationSession> {
    return this.applications.verify(token(raw), body.code);
  }

  @Get(':token')
  view(@Param('token') raw: string, @Headers('x-application-session') session?: string): Promise<ApplicationView> {
    return this.applications.view(token(raw), session);
  }

  /** One file, with the document it is in the `name` field beside it. */
  @Post(':token/documents')
  async upload(
    @Param('token') raw: string,
    @Req() request: MultipartRequest,
    @Headers('x-application-session') session?: string,
  ): Promise<ApplicationView> {
    if (typeof request.isMultipart !== 'function' || !request.isMultipart() || typeof request.parts !== 'function') {
      throw new BadRequestException('Send the file as multipart/form-data.');
    }
    let body: Buffer | null = null;
    let filename = 'file';
    let truncated = false;
    const fields: Record<string, string> = {};
    for await (const part of request.parts({ limits: { fileSize: MAX_HR_FILE_BYTES } })) {
      if (part.type === 'file') {
        const bytes = await part.toBuffer();
        if (body === null) {
          body = bytes;
          filename = part.filename || 'file';
          truncated = part.file?.truncated ?? false;
        }
        continue;
      }
      if (typeof part.value === 'string') fields[part.fieldname] = part.value.trim();
    }
    if (body === null) throw new BadRequestException('No file was sent.');
    if (truncated) throw new BadRequestException('A file must be 10 MB or smaller.');
    if (!fields.name) throw new BadRequestException('Say which document this is.');
    return this.applications.upload(token(raw), session, { name: fields.name, body, filename });
  }

  @Post(':token/offer')
  @HttpCode(200)
  respond(
    @Param('token') raw: string,
    @Body(new ZodValidationPipe(RespondToOfferRequest)) body: RespondToOfferRequest,
    @Headers('x-application-session') session?: string,
  ): Promise<ApplicationView> {
    return this.applications.respond(token(raw), session, body);
  }
}

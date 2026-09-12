import {
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { ZodError, ZodType } from 'zod';

/**
 * Validates request input against a Zod contract from @injishi/contracts.
 *
 * The global class-validator ValidationPipe covers class DTOs; this pipe lets a
 * handler validate against the SAME Zod schema the clients use, so the wire
 * contract is enforced from one definition on both ends of the boundary.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  // The `metadata` argument Nest passes second is not read. It is omitted
  // rather than named and ignored: a shorter signature still satisfies
  // PipeTransform, and it leaves no unused binding to suppress.
  transform(value: unknown): T {
    try {
      return this.schema.parse(value);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException({
          message: 'Validation failed',
          issues: err.issues,
        });
      }
      throw err;
    }
  }
}

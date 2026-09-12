import { RoomAvailability } from '@injishi/contracts';
import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';

import { AvailabilityService } from '../../../modules/booking/application/availability.service';

/**
 * What is left to sell → `GET /api/v1/room-types/:roomTypeId/availability`
 * (ADR-047 wave E).
 *
 * Public browse, no auth, like the rest of the read path: a guest picks dates
 * long before they sign in, and a calendar that needed a session would put the
 * gate in front of the shop window.
 *
 * `from` and `to` are a half-open range of NIGHTS — `from` is the first night
 * asked about and `to` is the morning after the last, which is the same shape
 * as a check-in and a check-out, so a caller does not have to convert between
 * two date conventions inside one booking flow.
 *
 * The service caps the window; there is no unbounded read here. This endpoint
 * runs a `generate_series` join per call and is reachable by anyone.
 */
@Controller({ path: 'room-types', version: '1' })
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get(':roomTypeId/availability')
  get(
    @Param('roomTypeId', new ParseUUIDPipe()) roomTypeId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ): Promise<RoomAvailability> {
    return this.availability.forRoomType(roomTypeId, from, to);
  }
}

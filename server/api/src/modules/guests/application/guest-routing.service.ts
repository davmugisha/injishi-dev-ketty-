import { Injectable, Logger } from '@nestjs/common';
import { type LeaderRole, RWANDA_CODE, kigaliToday } from '@injishi/contracts';

import { changedGuestMail, handOverMail, newGuestMail } from '../domain/guest-mail';
import { type Area, type PlannedRoute, planRoutes, postKey, routeArea } from '../domain/guest-routing';
import { placeWords } from '../domain/guest-words';
import { GuestNotifier } from '../infrastructure/guest-notifier';
import { type DbOrTx, GuestRegistryRepository, type Tx } from '../infrastructure/guest-registry.repository';

/** A planned step with the post it is delivered to, or none (waiting). */
export type RoutedStep = PlannedRoute & { assignmentId: string | null };

function sameArea(a: Area, b: Area): boolean {
  return a.villageId === b.villageId && a.cellId === b.cellId && a.sectorId === b.sectorId && a.districtId === b.districtId;
}

/**
 * Where guests go and who is told (P5).
 *
 * At filing every step of the chain is delivered to the first person holding
 * that post in the home's area; a step nobody holds waits. Every person
 * holding a delivered post gets one email per registration. Waiting steps are
 * handed over when a leader is appointed for the area (one summary email) or
 * when the building's village is set (the hourly sweep, or the location
 * change itself through `sweep(propertyId)`), and those leaders get the
 * guest's email then.
 */
@Injectable()
export class GuestRoutingService {
  private readonly log = new Logger(GuestRoutingService.name);

  constructor(
    private readonly guests: GuestRegistryRepository,
    private readonly notifier: GuestNotifier,
  ) {}

  /** The clock, as a method so a test can pin it. */
  protected now(): Date {
    return new Date();
  }

  /** The chain for a guest of this nationality from this home, each step with its post. */
  async plan(home: Area, nationality: string, db?: DbOrTx): Promise<RoutedStep[]> {
    const routed: RoutedStep[] = [];
    // One after the other: inside a transaction they share one connection.
    for (const s of planRoutes(home, nationality)) {
      const [first] = await this.guests.holders(s.role, postKey(s.role, s.area), db);
      routed.push({ ...s, assignmentId: first?.assignmentId ?? null });
    }
    return routed;
  }

  /**
   * Email every leader holding a delivered post, once each, for one
   * registration. `changed` words it as a change. Never throws.
   */
  async notify(registrationId: string, changed: boolean, onlyRouteIds?: readonly string[]): Promise<number> {
    try {
      const row = await this.guests.find(registrationId);
      if (!row || row.status !== 'submitted') return 0;
      const routes = (await this.guests.routesFor([registrationId])).filter(
        (r) => r.assignmentId && (!onlyRouteIds || onlyRouteIds.includes(r.id)),
      );
      const area = placeWords(row);
      const fromCountry = row.nationality === RWANDA_CODE ? null : row.nationalityName;
      const told = new Set<string>();
      const sentRoutes: string[] = [];
      for (const r of routes) {
        const holders = await this.guests.holders(r.role, postKey(r.role, r));
        for (const h of holders) {
          const email = h.email.toLowerCase();
          if (told.has(email)) continue;
          told.add(email);
          const input = {
            appUrl: this.notifier.appUrl,
            registrationId,
            guestName: row.fullName,
            fromCountry,
            arrivalOn: row.arrivalOn,
            departureOn: row.departureOn,
            hostKind: row.hostKind,
            area,
            role: r.role,
          };
          await this.notifier.send(h.email, changed ? changedGuestMail(input) : newGuestMail(input), changed ? 'guest changed' : 'new guest');
        }
        sentRoutes.push(r.id);
      }
      await this.guests.markNotified(sentRoutes, this.now());
      return told.size;
    } catch (cause) {
      this.log.error(`Guest ${registrationId}: leaders were not emailed: ${cause instanceof Error ? cause.message : 'failed'}.`);
      return 0;
    }
  }

  /**
   * A post was appointed: hand it what waited for one in its area, inside the
   * appointment's transaction. The summary email goes after commit
   * (`tellHandOver`).
   */
  async handOverOnAppointment(tx: Tx, post: { assignmentId: string; role: LeaderRole; area: Area }): Promise<string[]> {
    const key = postKey(post.role, post.area);
    if (key === null) return [];
    return this.guests.handOverWaiting(tx, post.role, key, post.assignmentId, kigaliToday(this.now()), this.now());
  }

  /** One summary email to the new leader about what was handed over. Never throws. */
  async tellHandOver(post: { email: string; role: LeaderRole; area: Area }, registrationIds: readonly string[]): Promise<void> {
    if (registrationIds.length === 0) return;
    try {
      const names = await this.guests.areaNames(post.area);
      await this.notifier.send(
        post.email,
        handOverMail({ appUrl: this.notifier.appUrl, role: post.role, area: placeWords(names) || 'your area', count: registrationIds.length }),
        'hand-over',
      );
    } catch (cause) {
      this.log.error(`Hand-over mail to ${post.email} failed: ${cause instanceof Error ? cause.message : 'failed'}.`);
    }
  }

  /**
   * An appointment ended: current guests delivered to it go to the next
   * holder of the same post, or wait again.
   */
  async releaseOnEnd(tx: Tx, post: { assignmentId: string; role: LeaderRole; area: Area }): Promise<number> {
    return this.guests.releaseEnded(tx, post.assignmentId, post.role, postKey(post.role, post.area), kigaliToday(this.now()), this.now());
  }

  /**
   * Deliver what is waiting and can now be delivered: a building whose
   * village was set moves its current guests there, and every waiting step
   * whose area has someone in the post is delivered and its leaders emailed.
   * Safe to repeat. `propertyId` narrows it to one building.
   */
  async sweep(propertyId?: string): Promise<{ relocated: number; delivered: number }> {
    const today = kigaliToday(this.now());
    const waiting = await this.guests.waitingRoutes(today, propertyId);
    const relocated = new Set<string>();
    const delivered = new Map<string, string[]>();
    for (const w of waiting) {
      const now = this.now();
      const area = routeArea(w.role, w.current);
      const [first] = await this.guests.holders(w.role, postKey(w.role, area));
      // The registration still names the old place: every one of its waiting steps takes the new one.
      const stale = !sameArea(w.stored, w.current);
      // Nothing to do when the home is where it was and nobody holds the post yet.
      if (!stale && !first) continue;
      const handed = await this.guests.transaction(async (tx) => {
        if (stale && !relocated.has(w.registrationId)) {
          await this.guests.relocate(tx, w.registrationId, w.current, now);
          relocated.add(w.registrationId);
        }
        return this.guests.deliverWaiting(tx, w.routeId, area, first?.assignmentId ?? null, now);
      });
      if (handed) delivered.set(w.registrationId, [...(delivered.get(w.registrationId) ?? []), w.routeId]);
    }
    for (const [registrationId, routeIds] of delivered) await this.notify(registrationId, false, routeIds);
    const count = [...delivered.values()].reduce((n, ids) => n + ids.length, 0);
    if (count || relocated.size) {
      this.log.log(`Guest routing: ${count} step(s) delivered, ${relocated.size} guest(s) moved to their home's place.`);
    }
    return { relocated: relocated.size, delivered: count };
  }
}


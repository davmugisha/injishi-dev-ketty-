import { Permission } from '@injishi/contracts';
import { z } from 'zod';

/**
 * Task guides and the tutorial catalogue (ADR-061 D-h, slice D).
 *
 * Every step names the screen and the label EXACTLY as the product renders
 * it, and `source` cites the file it was read from on `lastVerified`. When a
 * screen changes, mark the guide `needs_review` in the same change, or the
 * assistant will walk people through a screen that no longer exists.
 *
 * `permissions` lists what the task needs, any one of them; empty means
 * anyone may do it. The assistant compares it with the grant of the workspace
 * in view, never with a role name.
 *
 * A tutorial is offered only when `videoUrl` is set. None is recorded yet,
 * so the catalogue describes what each tutorial will cover and the assistant
 * says plainly that no video exists.
 */
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Status = z.enum(['current', 'needs_review', 'retired']);

export const Tutorial = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().min(3),
    feature: z.string().min(3),
    description: z.string().min(10),
    permissions: z.array(Permission),
    /** Where the recorded video lives, or null while none is recorded. */
    videoUrl: z.string().url().nullable(),
    screenshots: z.array(z.string().url()),
    lastVerified: Day,
    status: Status,
  })
  .strict();
export type Tutorial = z.infer<typeof Tutorial>;

export const TaskGuide = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().min(3),
    description: z.string().min(10),
    tags: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1),
    surface: z.enum(['web', 'app']),
    permissions: z.array(Permission),
    requirements: z.array(z.string().min(3)),
    steps: z.array(z.string().min(3)).min(2),
    commonProblems: z.array(z.object({ problem: z.string().min(3), fix: z.string().min(3) }).strict()),
    tutorialId: z.string().nullable(),
    lastVerified: Day,
    status: Status,
    source: z.string().min(3),
  })
  .strict();
export type TaskGuide = z.infer<typeof TaskGuide>;

const TUTORIAL_ENTRIES: Tutorial[] = [
  {
    id: 'tutorial-publish-a-property',
    title: 'Publishing your property',
    feature: 'Inventory: listing',
    description: 'From a finished setup to a live listing: the Listing panel, what each refusal means, and unpublishing.',
    permissions: ['listing.manage'],
    videoUrl: null,
    screenshots: [],
    lastVerified: '2026-09-30',
    status: 'current',
  },
  {
    id: 'tutorial-check-in-a-guest',
    title: 'Checking a guest in',
    feature: 'Front desk: check in',
    description: 'Checking in a guest with a reservation, and a walk-in without one.',
    permissions: ['stay.checkin'],
    videoUrl: null,
    screenshots: [],
    lastVerified: '2026-09-30',
    status: 'current',
  },
];

const GUIDE_ENTRIES: TaskGuide[] = [
  {
    id: 'register-a-business',
    title: 'Register a business on Injishi',
    description: 'Register a hotel, guest house, lodge or other accommodation business so it can list and run its property on Injishi.',
    tags: ['register', 'business', 'hotel', 'sign-up', 'start', 'host', 'list', 'property', 'add'],
    surface: 'web',
    permissions: [],
    requirements: [
      'An Injishi account: sign in at /sign-in with your email.',
      "The business's legal name and TIN.",
      'The documents the Documents step asks for, which prove the business.',
    ],
    steps: [
      'Go to /register.',
      'Place: choose what you are registering.',
      'You: give your own details.',
      'Business: the legal name, TIN and the other business details it asks for.',
      'Branches: add any other locations under the same TIN (hotels only; a residence has no Branches step).',
      'Documents: add the certificates that prove the business.',
      'Pay: review and settle the registration.',
    ],
    commonProblems: [
      {
        problem: 'I registered but cannot list anything yet.',
        fix: 'A business can act only once it is approved. The operator app shows the registration stage until then.',
      },
    ],
    tutorialId: null,
    lastVerified: '2026-09-30',
    status: 'current',
    source: 'apps/web/src/components/shared/registration-step-rail.tsx REGISTRATION_STEPS',
  },
  {
    id: 'publish-a-property',
    title: 'Publish your property',
    description: 'Put a property on the marketplace so guests can find and book it.',
    tags: ['publish', 'listing', 'live', 'property', 'marketplace', 'go-live'],
    surface: 'app',
    permissions: ['listing.manage'],
    requirements: [
      'The sector the property is in.',
      'At least one active room type.',
      'A price on at least one room type.',
      'At least one photograph of the property.',
    ],
    steps: [
      'In the operator app, open Inventory in the sidebar.',
      'Check the Listing panel at the top: it shows the room types and sellable rooms.',
      'Press Publish.',
      'If it refuses, it lists every reason; fix each one and press Publish again.',
    ],
    commonProblems: [
      { problem: 'Choose the sector the property is in.', fix: "Set the property's location down to its sector." },
      { problem: 'Add at least one room type.', fix: 'Add a room type in Inventory.' },
      { problem: 'At least one room type needs a price.', fix: 'Edit a room type and fill in its price.' },
      { problem: 'Add at least one photograph of the property.', fix: 'Upload a photograph of the property.' },
    ],
    tutorialId: 'tutorial-publish-a-property',
    lastVerified: '2026-09-30',
    status: 'current',
    source: 'apps/app/src/pms/screens/listing-panel.tsx; apps/app/src/pms/lib/nav.ts; packages/contracts/src/inventory.ts PUBLISH_BLOCKER_LABEL',
  },
  {
    id: 'check-in-a-guest',
    title: 'Check a guest in',
    description: 'Check in a guest arriving with a reservation, or a walk-in without one.',
    tags: ['check-in', 'checkin', 'arrival', 'walk-in', 'guest', 'front-desk'],
    surface: 'app',
    permissions: ['stay.checkin'],
    requirements: ["The guest's name.", 'A room to put them in.'],
    steps: [
      'For a reservation: press Check in on it, from Reservations or Today.',
      'For a walk-in: press New walk-in in the sidebar.',
      'Fill in Guest name. National ID or passport, Phone and Email are optional.',
      'Choose the Room and the number of Nights.',
      'For a walk-in, enter the Rate per night in RWF.',
      'Confirm the check in.',
    ],
    commonProblems: [
      {
        problem: 'There is no Check in button.',
        fix: 'Checking in needs the stay.checkin permission in this business. Ask the owner to grant it.',
      },
    ],
    tutorialId: 'tutorial-check-in-a-guest',
    lastVerified: '2026-09-30',
    status: 'current',
    source: 'apps/app/src/pms/components/check-in-drawer.tsx; apps/app/src/pms/components/sidebar.tsx',
  },
  {
    id: 'change-a-room-rate',
    title: "Change a room type's price",
    description: 'Change the base nightly price a room type sells at.',
    tags: ['price', 'rate', 'room-type', 'change', 'nightly', 'edit'],
    surface: 'app',
    permissions: ['listing.manage'],
    requirements: ['The room type already exists.'],
    steps: [
      'In the operator app, open Inventory in the sidebar.',
      'In the room types, press Edit on the one to change.',
      'Change Price per night (RWF).',
      'Press Save room type.',
    ],
    commonProblems: [
      {
        problem: 'I want a different price on some dates.',
        fix: 'Prices per date are not available yet; the price you set applies to every night.',
      },
    ],
    tutorialId: null,
    lastVerified: '2026-09-30',
    status: 'current',
    source: 'apps/app/src/pms/screens/room-types-section.tsx',
  },
];

export const TUTORIALS: readonly Tutorial[] = Object.freeze(z.array(Tutorial).parse(TUTORIAL_ENTRIES));
export const TASK_GUIDES: readonly TaskGuide[] = Object.freeze(z.array(TaskGuide).parse(GUIDE_ENTRIES));

for (const list of [TUTORIALS, TASK_GUIDES] as const) {
  const ids = new Set<string>();
  for (const entry of list) {
    if (ids.has(entry.id)) throw new Error(`Duplicate id: ${entry.id}`);
    ids.add(entry.id);
  }
}
for (const guide of TASK_GUIDES) {
  if (guide.tutorialId && !TUTORIALS.some((t) => t.id === guide.tutorialId)) {
    throw new Error(`Guide ${guide.id} names a missing tutorial ${guide.tutorialId}`);
  }
}

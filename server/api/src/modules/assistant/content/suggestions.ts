import type { AssistantSurface } from '@injishi/contracts';

/**
 * The questions the assistant offers with one tap (ADR-061 D-q): at the start
 * of a conversation, and after each answer.
 *
 * Every suggestion is a question the router answers WITHOUT the model, from
 * Injishi's own data or content, so a tap costs nothing and never gets a
 * guessed answer (pinned by suggestions.spec.ts). Each names the tool it
 * needs: a caller is offered a suggestion only when they are offered that
 * tool (D-f), so a guest is never invited to check operator rooms. `route` is
 * the answer's route, which is how "asked most" is counted.
 */
export interface SuggestionEntry {
  id: string;
  label: string;
  message: string;
  /** The tool the answer needs; the suggestion is hidden when it is not offered. */
  needs: string;
  /** The route the router answers it with (D-q), counted for popularity. */
  route: string;
  /** Surfaces it is offered first on; elsewhere it still appears, after these. */
  firstOn: AssistantSurface[];
  /**
   * A tool that answers the same question better for this caller: when it is
   * offered, this suggestion is not (an operator gets the live publish check,
   * not the general article).
   */
  unless?: string;
  /**
   * A task done inside a business (checking a guest in, changing a price):
   * offered only to a caller working in one, whatever the guide's own reach.
   */
  operatorOnly?: true;
}

export const SUGGESTIONS: SuggestionEntry[] = [
  // Operator first on the operator app.
  { id: 'rooms-today', label: 'Rooms free today', message: 'Which rooms are free today?', needs: 'rooms_on_dates', route: 'direct:rooms', firstOn: ['app'] },
  { id: 'rooms-tomorrow', label: 'Rooms free tomorrow', message: 'Which rooms are free tomorrow?', needs: 'rooms_on_dates', route: 'direct:rooms', firstOn: ['app'] },
  { id: 'why-cannot-publish', label: "Why can't I publish?", message: "Why can't I publish my property?", needs: 'publish_blockers', route: 'direct:publish_blockers', firstOn: ['app'] },
  { id: 'check-in-guide', label: 'Check a guest in', message: 'How do I check a guest in?', needs: 'get_task_guide', operatorOnly: true, route: 'direct:task_guide', firstOn: ['app'] },
  { id: 'publish-guide', label: 'Publish my property', message: 'How do I publish my property?', needs: 'get_task_guide', operatorOnly: true, route: 'direct:task_guide', firstOn: ['app'] },
  // Visitors and guests first on the marketplace and the phone.
  { id: 'stays-budget', label: 'Stays under 100,000 RWF', message: 'Places to stay under 100,000 RWF a night', needs: 'search_listings', route: 'direct:listings', firstOn: ['web', 'mobile'] },
  { id: 'stays-group', label: 'Stays for 4 guests', message: 'Places to stay for 4 guests', needs: 'search_listings', route: 'direct:listings', firstOn: ['web', 'mobile'] },
  { id: 'my-trips', label: 'My trips', message: 'Show my trips', needs: 'my_trips', route: 'direct:trips', firstOn: ['web', 'mobile'] },
  // How Injishi works, for everyone.
  { id: 'what-can-list', label: 'What can I list?', message: 'What kind of accommodation can be listed?', needs: 'search_help', route: 'direct:knowledge', firstOn: ['web', 'admin'] },
  { id: 'host-charges', label: 'What Injishi charges', message: 'What does Injishi charge a host?', needs: 'search_help', route: 'direct:knowledge', firstOn: ['web', 'admin'] },
  { id: 'host-paid', label: 'When hosts are paid', message: 'When is a host paid?', needs: 'search_help', route: 'direct:knowledge', firstOn: ['admin'] },
  { id: 'go-live', label: 'How long to go live', message: 'How long until a listing is live?', needs: 'search_help', route: 'direct:knowledge', firstOn: ['admin'] },
  { id: 'sign-in', label: "I can't sign in", message: 'The sign in code does not arrive', needs: 'search_help', route: 'direct:knowledge', firstOn: [] },
  { id: 'person', label: 'Talk to a person', message: 'I want to talk to a person', needs: 'suggest_human_support', route: 'direct:escalation', firstOn: [] },
];

/**
 * What to offer after an answer, by the answer's route: the natural next
 * questions first, then the most asked starters fill the rest.
 */
export const FOLLOW_UPS: Record<string, string[]> = {
  'direct:listings': ['stays-cheaper', 'stays-group', 'how-bookings-work'],
  'direct:trips': ['person', 'stays-budget'],
  'direct:rooms': ['rooms-tomorrow', 'check-in-guide', 'why-cannot-publish'],
  'direct:publish_blockers': ['publish-guide', 'person'],
  'direct:task_guide': ['person'],
  'direct:tutorial': ['person'],
  'direct:knowledge': ['person'],
  'direct:clarify_price': ['stays-budget', 'host-charges', 'price-guide'],
  'direct:clarify_booking': ['stays-budget', 'my-trips', 'how-bookings-work'],
  'direct:clarify_payment': ['host-paid', 'host-charges'],
  'direct:clarify_account': ['sign-in', 'person'],
  'direct:clarify_listing': ['what-can-list', 'go-live', 'why-cannot-publish-article'],
  'direct:video_ask': ['check-in-guide', 'publish-guide', 'price-guide'],
};

/** Follow up only suggestions: offered after an answer, never as a starter. */
export const FOLLOW_UP_ONLY: SuggestionEntry[] = [
  { id: 'stays-cheaper', label: 'Cheaper: under 50,000 RWF', message: 'Places to stay under 50,000 RWF a night', needs: 'search_listings', route: 'direct:listings', firstOn: [] },
  { id: 'how-bookings-work', label: 'Must hosts accept bookings?', message: 'Do hosts have to accept every booking?', needs: 'search_help', route: 'direct:knowledge', firstOn: [] },
  { id: 'price-guide', label: 'Change a room price', message: "How do I change a room type's price?", needs: 'get_task_guide', operatorOnly: true, route: 'direct:task_guide', firstOn: [] },
  { id: 'why-cannot-publish-article', label: 'What publishing needs', message: 'What does a property need before it can be published?', needs: 'search_help', unless: 'publish_blockers', route: 'direct:knowledge', firstOn: [] },
];

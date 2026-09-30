/** What the running process decided about the assistant at boot (ADR-061 D-b). */
export const ASSISTANT_SETTINGS = Symbol('ASSISTANT_SETTINGS');

export type AssistantMode = 'off' | 'mock' | 'live';

export interface AssistantSettings {
  mode: AssistantMode;
  /** The model requested from the provider in `live` mode. */
  model: string;
}

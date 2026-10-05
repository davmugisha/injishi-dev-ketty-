import { SupportTopic } from '@injishi/contracts';
import { z } from 'zod';

import type { AssistantTool } from './tool-types';

/**
 * Offering human support (ADR-061 D-l, slice F).
 *
 * The model can OFFER it and nothing more. This tool writes no ticket: it
 * marks the answer, and the surface shows a "Send to Injishi support" button.
 * The ticket is written only when the PERSON presses it, by their own request
 * to `POST /api/v1/assistant/escalations`, with a reply address they type
 * themselves when signed out. So no wording of a question can make the
 * assistant open tickets, and no address ever passes through the model.
 */
const Input = z.object({ topic: SupportTopic }).strict();

export function createSupportTools(): AssistantTool[] {
  const suggestHumanSupport: AssistantTool = {
    requires: 'public',
    spec: {
      name: 'suggest_human_support',
      description:
        'Offer to pass this conversation to a person at Injishi support, when the guides and tools could not solve the problem or the person asks for a human. It sends nothing: the person gets a button to send it themselves. Choose the topic that fits.',
      inputSchema: {
        type: 'object',
        properties: {
          topic: { type: 'string', enum: [...SupportTopic.options], description: 'What the problem is about.' },
        },
        required: ['topic'],
        additionalProperties: false,
      },
    },
    run(input) {
      const parsed = Input.safeParse(input);
      if (!parsed.success) {
        return Promise.resolve({
          content: JSON.stringify({ error: `topic must be one of ${SupportTopic.options.join(', ')}.` }),
          isError: true,
          sources: [],
        });
      }
      return Promise.resolve({
        content: JSON.stringify({
          offered: true,
          note: 'Nothing has been sent. Tell the person they can press "Send to Injishi support" to pass this conversation to a person, who replies by email.',
        }),
        isError: false,
        sources: [],
        escalation: { topic: parsed.data.topic },
      });
    },
  };
  return [suggestHumanSupport];
}

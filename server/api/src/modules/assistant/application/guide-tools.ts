import { z } from 'zod';

import { TASK_GUIDES, TUTORIALS, type TaskGuide } from '../content/tasks';
import { redact } from '../domain/redaction';
import { tokens } from './knowledge-search';
import type { AssistantTool, ToolCaller, ToolOutcome } from './tool-types';

/**
 * Task guidance and tutorials (ADR-061 slice D, C4 and C5).
 *
 * A guide is given as steps first. A tutorial is a second step for someone
 * still stuck, and it is offered only when its video is actually recorded:
 * the request says the assistant must not push a video before the steps, and
 * nothing may point at a video that does not exist.
 *
 * Whether the person may do the task comes from the grant of the workspace in
 * view (`caller.workspace.permissions`), never from a role name. Without a
 * workspace the answer is "unknown", and the guide says which permission the
 * task needs.
 */
const GuideInput = z.object({ query: z.string().trim().min(1).max(200) }).strict();
const TutorialInput = z.object({ guideId: z.string().trim().min(1).max(80) }).strict();

export function createGuideTools(): AssistantTool[] {
  const getTaskGuide: AssistantTool = {
    requires: 'public',
    spec: {
      name: 'get_task_guide',
      description:
        'Step by step instructions for doing a task on Injishi (registering a business, publishing a property, checking a guest in, changing a price, and more): requirements, steps with the exact screen labels, common problems, and whether this person may do it. Use for any "how do I" question, before offering a tutorial.',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'The task, in the person\'s words.' } },
        required: ['query'],
        additionalProperties: false,
      },
    },
    run(input, caller) {
      const parsed = GuideInput.safeParse(input);
      if (!parsed.success) return Promise.resolve(errorOutcome('Give the task as a query of at most 200 characters.'));
      const guide = bestGuide(parsed.data.query);
      if (!guide) {
        return Promise.resolve(
          outcome({ guide: null, note: 'No verified guide for that task. Say so, and suggest /support; do not invent steps.' }),
        );
      }
      const tutorial = TUTORIALS.find((t) => t.id === guide.tutorialId && t.status === 'current');
      return Promise.resolve(
        outcome({
          guide: {
            id: guide.id,
            title: guide.title,
            where: guide.surface === 'app' ? 'the operator app' : 'the Injishi website',
            requirements: guide.requirements,
            steps: guide.steps,
            commonProblems: guide.commonProblems,
            needsOneOf: guide.permissions,
            youCanDoThis: mayDo(guide, caller),
            tutorialRecorded: Boolean(tutorial?.videoUrl),
            lastVerified: guide.lastVerified,
          },
          note: 'Give the steps first. Offer a tutorial only if the person is still stuck and tutorialRecorded is true.',
        }),
      );
    },
  };

  const findTutorial: AssistantTool = {
    requires: 'public',
    spec: {
      name: 'find_tutorial',
      description:
        'The recorded tutorial video for a task guide, when one exists. Call only after giving the steps, when the person is still stuck. Takes the guide id from get_task_guide.',
      inputSchema: {
        type: 'object',
        properties: { guideId: { type: 'string', description: 'The guide id from get_task_guide.' } },
        required: ['guideId'],
        additionalProperties: false,
      },
    },
    run(input) {
      const parsed = TutorialInput.safeParse(input);
      if (!parsed.success) return Promise.resolve(errorOutcome('Give the guideId from get_task_guide.'));
      const guide = TASK_GUIDES.find((g) => g.id === parsed.data.guideId);
      const tutorial = guide && TUTORIALS.find((t) => t.id === guide.tutorialId && t.status === 'current');
      if (!tutorial || !tutorial.videoUrl) {
        return Promise.resolve(
          outcome({ tutorial: null, note: 'No tutorial is recorded for this task yet. Say so plainly; do not describe a video.' }),
        );
      }
      return Promise.resolve({
        content: redact(
          JSON.stringify({
            tutorial: {
              id: tutorial.id,
              title: tutorial.title,
              description: tutorial.description,
              videoUrl: tutorial.videoUrl,
              lastVerified: tutorial.lastVerified,
            },
          }),
        ),
        isError: false,
        sources: [{ kind: 'tutorial', id: tutorial.id, title: tutorial.title, href: tutorial.videoUrl }],
      });
    },
  };

  return [getTaskGuide, findTutorial];
}

function bestGuide(query: string): TaskGuide | null {
  return matchGuide(query)?.guide ?? null;
}

/**
 * The best matching current guide and how strongly it matched: 3 per title
 * word, 2 per tag, 1 per description word. The request router answers from a
 * guide only above its threshold (ADR-061 D-q); weaker matches go to the model.
 */
export function matchGuide(query: string): { guide: TaskGuide; score: number } | null {
  // "Injishi" names the platform, not a task: "how do I reach Injishi
  // support" is not "Register a business on Injishi". Help search keeps the
  // word, because "what is Injishi" is exactly its article.
  const wanted = new Set(tokens(query).filter((word) => word !== 'injishi'));
  let best: { guide: TaskGuide; score: number } | null = null;
  for (const guide of TASK_GUIDES) {
    if (guide.status !== 'current') continue;
    const title = new Set(tokens(guide.title));
    const tags = new Set(guide.tags.flatMap((t) => tokens(t)));
    const text = new Set(tokens(guide.description));
    let score = 0;
    for (const word of wanted) {
      if (title.has(word)) score += 3;
      if (tags.has(word)) score += 2;
      if (text.has(word)) score += 1;
    }
    if (score > 0 && (!best || score > best.score || (score === best.score && guide.id < best.guide.id))) {
      best = { guide, score };
    }
  }
  return best;
}

/** true or false from the grant in view; 'unknown' without a workspace. */
function mayDo(guide: TaskGuide, caller: ToolCaller): boolean | 'unknown' {
  if (guide.permissions.length === 0) return caller.userId !== null ? true : 'unknown';
  if (!caller.workspace) return 'unknown';
  const held = caller.workspace.permissions;
  return guide.permissions.some((p) => held.includes(p));
}

function outcome(payload: unknown): ToolOutcome {
  return { content: redact(JSON.stringify(payload)), isError: false, sources: [] };
}

function errorOutcome(message: string): ToolOutcome {
  return { content: JSON.stringify({ error: message }), isError: true, sources: [] };
}

/**
 * The web preview frame (ADR-038).
 *
 * Two things are worth a test here, and they are the two that are invisible
 * from a screenshot.
 *
 * The first is that NATIVE IS UNTOUCHED. The frame is a runtime
 * `Platform.OS === 'web'` branch inside a shared file, so it ships in the
 * native bundle whether it runs there or not, and a regression that let it draw
 * a view on a phone would show up as a layout change nobody could trace back to
 * a web preview. So this asserts the tree, not the appearance: on native the
 * wrapper returns its children and adds no node at all.
 *
 * The second is that THE PAGE CANNOT SCROLL. A screen taller than the frame has
 * to scroll inside the box and be clipped by its rounded corners; if it scrolls
 * the browser page instead, the frame slides off the top of the window and the
 * preview is worse than no preview. That is two separate writes — `overflow`
 * on the frame view and `overflow` on the document — so both are checked.
 *
 * It lives under `src/` rather than beside `_layout.tsx` for the same reason
 * `bootstrap.test.tsx` does: everything in `app/` is a route, and Expo Router
 * has an opinion about a test file sitting there.
 *
 * `Platform.OS` is redefined rather than mocked at the module level. The value
 * is a getter on React Native's own `Platform` object, the wrapper reads it at
 * render time, and swapping the whole module would pull the rest of React
 * Native's internals through a mock for the sake of one string.
 */
import { render } from '@testing-library/react-native';
import { Platform, View } from 'react-native';

import { Providers } from '@/test-utils';

// Runs at import of `app/_layout.tsx`, and the native module behind it does not
// exist here. Nothing in this file is about the splash.
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => undefined),
  hideAsync: jest.fn(async () => undefined),
}));

// A desktop window. The wrapper reads this on every render, which is what makes
// the 640px rule live on resize rather than fixed at mount.
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 1440, height: 900, scale: 2, fontScale: 1 })),
}));

import { WebPreviewFrame } from '../app/_layout';

/** The two elements the wrapper writes the ground and the reset onto. */
interface FakeElement {
  style: Record<string, string>;
}

const page: { documentElement: FakeElement; body: FakeElement } = {
  documentElement: { style: {} },
  body: { style: {} },
};

/**
 * The test environment is node, so there is no `document` and the web branch
 * would throw on the first line of its effect. This is the smallest stand-in
 * that answers what the effect actually asks for.
 */
beforeAll(() => {
  Object.defineProperty(globalThis, 'document', {
    value: page,
    configurable: true,
    writable: true,
  });
});

const realOS = Platform.OS;

function setOS(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
}

beforeEach(() => {
  page.documentElement.style = {};
  page.body.style = {};
});

afterEach(() => setOS(realOS));

/** What the frame wraps: one node, findable, with a height of its own. */
const Content = () => <View testID="content" style={{ height: 4000 }} />;

/** A rendered node, as `toJSON()` hands it back. */
interface Node {
  type: string;
  props: { testID?: string; style?: unknown };
  children: Node[] | null;
}

/**
 * Rendered bare, with no providers around it.
 *
 * That is the point of the native cases: whatever `toJSON()` returns is the
 * wrapper's whole output, so "adds no view" is readable directly off the root
 * instead of being inferred through somebody else's tree.
 */
function renderBare() {
  return render(
    <WebPreviewFrame>
      <Content />
    </WebPreviewFrame>,
  ).toJSON() as unknown as Node;
}

/** The web branch reads the palette through `useTheme()`, so it needs those. */
function renderThemed() {
  return render(
    <WebPreviewFrame>
      <Content />
    </WebPreviewFrame>,
    { wrapper: ({ children }) => <Providers>{children}</Providers> },
  ).toJSON() as unknown as Node;
}

/** Every node from the root down to the content, content last. */
function pathToContent(root: Node): Node[] {
  const queue: Node[][] = [[root]];
  while (queue.length) {
    const path = queue.shift() as Node[];
    const node = path[path.length - 1];
    if (node.props?.testID === 'content') return path;
    for (const child of node.children ?? []) queue.push([...path, child]);
  }
  throw new Error('the content never rendered');
}

/** A React Native `style` prop, flattened to the one object it resolves to. */
function styleOf(node: Node): Record<string, unknown> {
  const style = node.props.style;
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>((all, one) => ({ ...all, ...one }), {});
  }
  return (style ?? {}) as Record<string, unknown>;
}

describe('on native', () => {
  beforeEach(() => setOS('ios'));

  it('renders its children and adds no view to the tree', () => {
    const tree = renderBare();

    // The root IS the child. Not a stage around it, not a frame around that.
    expect(tree.props.testID).toBe('content');
  });

  it('never reaches for the document', () => {
    renderBare();

    expect(page.documentElement.style).toEqual({});
    expect(page.body.style).toEqual({});
  });
});

describe('on web, at a desktop width', () => {
  beforeEach(() => setOS('web'));

  it('clips a screen taller than the frame instead of scrolling the page', () => {
    const path = pathToContent(renderThemed());
    const frame = path[path.length - 2];

    // The content is 4000px tall inside a box that is at most 824. It scrolls
    // inside the box, and the box cuts it off at its rounded corners.
    expect(styleOf(frame).overflow).toBe('hidden');
    expect(styleOf(frame).borderRadius).toBe(36);
    expect(styleOf(frame).width).toBe(384);

    // And the page behind it does not move, in either direction.
    expect(page.documentElement.style.overflow).toBe('hidden');
    expect(page.body.style.overflow).toBe('hidden');
  });
});

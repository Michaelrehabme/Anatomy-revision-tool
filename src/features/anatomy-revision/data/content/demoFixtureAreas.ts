import type { Area } from '../../types/region';

/**
 * The areas whose facts the PUBLIC DEMO carries when it is built from the
 * reduced fixture rather than the whole seed
 * (docs/DESIGN-CONTENT-BEHIND-SERVER.md: "ship it a reduced two-area fixture,
 * since the demo is public").
 *
 * The demo has no accounts and no server to ask, so whatever facts it shows
 * are in its bundle, and whatever is in its bundle is public. Two areas is
 * enough to show every question type working; nine is the product, given
 * away from a URL that needs no sign-in.
 *
 * WHICH TWO: the two the demo's generated class has answered most. Counted
 * over both demo cohorts on 5 Oct 2026 (16,863 generated attempts): hip 3,473,
 * wrist & hand 3,191, then ankle & foot 2,524, shoulder 2,193, and the rest
 * below 1,700. So the dashboards a course leader looks at — weakness tables,
 * confusion pairs — are densest exactly where the facts are present.
 *
 * THE OWNER HAS NOT CHOSEN (docs/CONTENT-SERVER-STATUS.md, decision 11), and
 * there is a cost to this pair: two of the demo's three set assignments are
 * on the shoulder (rotator cuff) and the ankle & foot, and a visitor who
 * tries to SIT one of those as the demo student will be told the area is not
 * part of the demo. If that matters more than dashboard density, 'hip' and
 * 'shoulder' is the pair to pick. Changing it is this one line.
 */
export const DEMO_FIXTURE_AREAS: readonly Area[] = ['hip', 'wrist-hand'];

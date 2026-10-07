import { lazy, Suspense, useEffect, useRef, useState, type ReactElement } from 'react';
import { MarketingHome } from './features/site/components/MarketingHome';
import { cachedSiteSettings, fetchSiteSettings } from './features/site/data/siteSettings';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useRepository } from './features/anatomy-revision/hooks/useRepository';
import { AUTH_ENABLED, useAuth } from './features/anatomy-revision/context/AuthProvider';
import { freeAreaIsOnTheAccount, useEntitlement, type UseEntitlement } from './features/anatomy-revision/hooks/useEntitlement';
import { useOfflineAutoUpdate } from './features/pwa/offline/useOfflineAutoUpdate';
import { useAnatomyContent, type AnatomyContent } from './features/anatomy-revision/hooks/useAnatomyContent';
import { useRevisionSession } from './features/anatomy-revision/hooks/useRevisionSession';
import { useIsDesktop } from './features/anatomy-revision/hooks/useIsDesktop';
import { generateRevisionSet } from './features/anatomy-revision/lib/questionGenerators/generateSet';
import { getLearnCardAttempts, getPreferredAreas, setPreferredAreas } from './features/anatomy-revision/lib/preferences';
import { useMastery } from './features/anatomy-revision/hooks/useMastery';
import { computeStreak } from './features/anatomy-revision/lib/streak';
import type { Area } from './features/anatomy-revision/types/region';
import type { QuestionType } from './features/anatomy-revision/types/question';
import type { AnatomyRepository } from './features/anatomy-revision/data/repository';
// The legal gate list. Static, and never LegalRoutes itself, which is lazy
// below — six strings cost the entry chunk nothing, the legal bundle would not.
import { LEGAL_PATHS } from './features/legal/legalPaths';
import { Onboarding } from './features/anatomy-revision/components/Onboarding/Onboarding';
import { Today } from './features/anatomy-revision/components/Today/Today';
import { RegionPicker } from './features/anatomy-revision/components/RegionPicker/RegionPicker';
import { RevisionSetup } from './features/anatomy-revision/components/RevisionSetup/RevisionSetup';
import { StudySession } from './features/anatomy-revision/components/StudySession/StudySession';
import { RevisionResults } from './features/anatomy-revision/components/RevisionResults/RevisionResults';
import { MuscleCard } from './features/anatomy-revision/components/MuscleCard/MuscleCard';
import { Atlas } from './features/anatomy-revision/components/Atlas/Atlas';
import { MobileAtlas } from './features/anatomy-revision/components/mobile/MobileAtlas';
import { Progress } from './features/anatomy-revision/components/Progress/Progress';
import { AreaFactsNotice } from './features/anatomy-revision/components/shared/AreaFactsNotice';
import { focusHeadingIfLost } from './features/anatomy-revision/components/shared/useRouteFocus';
import type { NavSection } from './features/anatomy-revision/components/shell/NavSidebar';
import { Account } from './features/anatomy-revision/components/Account/Account';
import { MobileAccount } from './features/anatomy-revision/components/mobile/MobileAccount';
import { MobileOnboarding } from './features/anatomy-revision/components/mobile/MobileOnboarding';
import { MobileToday } from './features/anatomy-revision/components/mobile/MobileToday';
import { MobileRegionPicker } from './features/anatomy-revision/components/mobile/MobileRegionPicker';
import { MobileRevisionSetup } from './features/anatomy-revision/components/mobile/MobileRevisionSetup';
import { MobileStudySession } from './features/anatomy-revision/components/mobile/MobileStudySession';
import { MobileResults } from './features/anatomy-revision/components/mobile/MobileResults';
import { MobileMuscleCard } from './features/anatomy-revision/components/mobile/MobileMuscleCard';
import { MobileProgress } from './features/anatomy-revision/components/mobile/MobileProgress';
import type { MobileTab } from './features/anatomy-revision/components/mobile/MobileTabBar';

/**
 * True only in the public demo build (npm run build:demo). The demo aliases
 * the admin guard to one that always says yes, so the deployed demo must not
 * carry /admin at all — this ternary folds at build time and leaves the
 * import() in a dead branch for Rollup to drop, exactly as DevRoutes does.
 */
const PUBLIC_DEMO = import.meta.env.VITE_PUBLIC_DEMO === '1';

/** Code-split so students never download the admin bundle — see src/features/admin/AdminApp.tsx. */
const AdminApp = PUBLIC_DEMO ? null : lazy(() => import('./features/admin/AdminApp'));

/**
 * "This is sample data" notice, public demo build only. Lazy so the ternary
 * folding to null in a real build leaves the import() dead for Rollup to
 * drop, the same way AdminApp above and DevRoutes below are handled.
 */
const DemoBanner = PUBLIC_DEMO ? lazy(() => import('./features/educator/demo/DemoBanner')) : null;
/**
 * Pricing and checkout (CR-033 item 11). Lazy because it pulls Paddle.js. The
 * public demo carries it too, as a sandbox-only test bench: readPaddleConfig
 * refuses a live checkout in that build.
 */
const PricingPage = lazy(() => import('./features/billing/PricingPage'));
/**
 * Three screens almost no page view needs, loaded when they are opened: the
 * diagnostic (sat twice a term, by a member of a class) and the two
 * achievements screens. Moved out on 7 Oct 2026 to win back what the
 * confirmed-address step added to the entry chunk, which must stay under the
 * 2 MiB a service worker will precache. Each is its own precached file, so
 * nothing is lost offline.
 */
const DiagnosticRoute = lazy(() =>
  import('./features/anatomy-revision/components/Diagnostic/DiagnosticRoute').then((m) => ({ default: m.DiagnosticRoute })),
);
const Achievements = lazy(() =>
  import('./features/anatomy-revision/components/Achievements/Achievements').then((m) => ({ default: m.Achievements })),
);
const MobileAchievements = lazy(() =>
  import('./features/anatomy-revision/components/mobile/MobileAchievements').then((m) => ({ default: m.MobileAchievements })),
);
/** Code-split so students never download the educator bundle — see src/features/educator/EducatorApp.tsx. */
const EducatorApp = lazy(() => import('./features/educator/EducatorApp'));
/**
 * Public legal pages (CR-025). Lazy because they are rarely visited and must
 * not sit in the chunk every student downloads to answer a question.
 */
const LegalRoutes = lazy(() => import('./features/legal/LegalRoutes'));
/**
 * The competitor comparison (CR-033 item 17). A DRAFT: reachable only by typed
 * URL, linked from nowhere and marked noindex until the owner approves it.
 * Lazy for the same reason as the legal pages.
 */
const ComparisonPage = lazy(() => import('./features/site/components/ComparisonPage'));
const COMPARISON_PATH = '/compare';

/**
 * What a guest sees in place of every screen that revises (the free area and
 * every session need a real account). Lazy: only a guest who has already been
 * through onboarding ever loads it, and the entry chunk is within a few per
 * cent of the size the offline precache allows.
 */
const AccountGate = lazy(() => import('./features/anatomy-revision/components/Auth/AccountGate'));
/**
 * "Check your inbox": what an account that has not confirmed its email
 * address sees in place of every screen that revises (owner's decision,
 * 7 Oct 2026). Lazy for the same reason as the guest's screen.
 */
const EmailConfirmGate = lazy(() => import('./features/anatomy-revision/components/Auth/EmailConfirmGate'));

/** Dev-only hotspot authoring tool (CR-007) — route only registered in dev, see the /dev/hotspots Route below. */
const HotspotEditorApp = lazy(() => import('./features/hotspotEditor/HotspotEditorApp'));

/**
 * Hotspot authoring tooling. The ternary folds to `null` at build time, which
 * leaves the import() in a dead branch for Rollup to drop entirely — students
 * never receive this and it cannot be reached in production.
 */
const DevRoutes = import.meta.env.DEV ? lazy(() => import('./features/dev/DevRoutes')) : null;

const ONBOARDED_KEY = 'anatomy-revision:v1:onboarded';

const SECTION_PATH: Record<NavSection, string> = {
  today: '/',
  study: '/study',
  atlas: '/atlas',
  progress: '/progress',
  account: '/account',
};

const MOBILE_TAB_PATH: Record<MobileTab, string> = {
  today: '/',
  atlas: '/atlas',
  progress: '/progress',
  account: '/account',
};

interface StructureRouteProps {
  access: UseEntitlement;
  content: AnatomyContent;
  repository: AnatomyRepository | null;
  userId: string | null;
  isDesktop: boolean;
  onNavigateSection: (section: NavSection) => void;
  onDrill: (structureId: string) => void;
}

/**
 * Reads :id / contextIds itself since useParams/useLocation only resolve
 * inside a matched Route's subtree, not in the App component that renders
 * the <Routes> table.
 */
function StructureRoute({ access, content, repository, userId, isDesktop, onNavigateSection, onDrill }: StructureRouteProps) {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const contextIds = (location.state as { contextIds?: string[] } | null)?.contextIds ?? [];
  // react-router marks the initial history entry (cold load / typed-in URL) with key "default".
  const isDirectLoad = location.key === 'default';
  const handleBack = () => (isDirectLoad ? navigate('/atlas') : navigate(-1));

  if (!id) return <Navigate to="/atlas" replace />;

  if (isDesktop) {
    return (
      <MuscleCard
        access={access}
        structureId={id}
        content={content}
        repository={repository}
        userId={userId}
        contextIds={contextIds}
        onNavigateStructure={(next) => navigate(`/structure/${next}`, { state: { contextIds } })}
        onBack={handleBack}
        onDrill={onDrill}
        onNavigate={onNavigateSection}
      />
    );
  }

  return (
    <MobileMuscleCard
      access={access}
      structureId={id}
      content={content}
      repository={repository}
      userId={userId}
      onBack={handleBack}
      onDrill={onDrill}
    />
  );
}

/**
 * Top-level view state now lives in the URL (see the router CR that
 * superseded the project's original "no router in v1" decision).
 * `session.phase` (in-progress/results) still takes over the whole screen
 * regardless of section, matching both mockups' "chrome becomes session
 * context" behavior — a ref-tracked effect below syncs the route to phase
 * transitions so useRevisionSession's state machine doesn't need to know
 * about routing.
 *
 * `useIsDesktop()` (not CSS) decides which of the two full render trees
 * mounts — see the mobile-UI plan's "Architecture" section: CSS-only
 * hidden/lg:block would mount both trees regardless of viewport, double-
 * firing every screen's data-fetching effects once mobile screens also
 * fetch their own data (desktop-only did not have this problem, since the
 * old lg:hidden branch was static placeholder text).
 */
function App() {
  const { repository, loading: repoLoading, error: repoError, retry: retryRepository } = useRepository();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.uid ?? null;
  /**
   * A GUEST: a build with accounts, and no real account signed in — the
   * anonymous sign-in every visitor is given, or no sign-in at all (a first
   * visit with no network). A guest may look at what is public and nothing
   * else: the free area, every card's facts and every session need an account
   * (owner's decision, 6 Oct 2026). Never true in a local-persistence build
   * or the demo, which have no accounts and work as they always did.
   */
  const isGuest = AUTH_ENABLED && (!user || user.isAnonymous);
  /**
   * What this account may reach (CR-027). Read once here and passed down, so
   * every screen gates on the same answer and the entitlement is read once per
   * session rather than once per screen.
   *
   * Above the content on purpose: in a build that fetches facts per area
   * (data/content/contentSource.ts) the entitlement is what says WHICH areas
   * to fetch, and nothing is asked for until it has settled.
   */
  const entitlement = useEntitlement(userId, { guest: isGuest, emailVerified: user?.emailVerified ?? true });
  const content = useAnatomyContent(repository, {
    uid: userId,
    areas: entitlement.areas,
    // Sign-in still settling counts as not knowing yet, so a load is not
    // started (and abandoned) for an account that is about to change. So does
    // a free area that has been picked on this device and has not reached the
    // account: the content function reads the account, and asked before the
    // write lands it refuses the very area the student has just chosen.
    loading: authLoading || entitlement.loading || (entitlement.freeAreaSaving ?? false),
    known: entitlement.known ?? false,
    revision: entitlement.freeAreaSaves ?? 0,
  });
  const session = useRevisionSession(repository, userId);
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const location = useLocation();

  // Once per signed-in app open: rebuild this student's summary on their
  // class dashboard, if they are in a class. A finished session does the same;
  // this catches the student who opens the app and does not finish one, and
  // backfills anyone whose summary predates the mastery levels.
  useEffect(() => {
    if (repository && userId) void repository.syncCohortRollup?.(userId);
  }, [repository, userId]);

  const [onboarded, setOnboarded] = useState(() => localStorage.getItem(ONBOARDED_KEY) === 'true');
  /*
   * The marketing home page, and whether an admin has switched it on.
   *
   * Only a visitor who has not been through onboarding ever sees it, so a
   * returning student is never bounced to a sales page. The setting starts
   * from the cached value for an instant first paint and is refreshed from
   * Firestore behind it; both default to off, so an unreachable database
   * shows the app rather than an advert.
   */
  const [siteSettings, setSiteSettings] = useState(cachedSiteSettings);
  const [siteSettingsLoaded, setSiteSettingsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchSiteSettings()
      .then((settings) => {
        if (cancelled) return;
        setSiteSettings(settings);
      })
      .finally(() => {
        if (!cancelled) setSiteSettingsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  // Small updates to areas downloaded for offline use are applied once the
  // entitlement above has settled; larger ones wait behind a button.
  useOfflineAutoUpdate(entitlement);
  const entitledAreas = entitlement.areas;

  // Seeded from onboarding's choice, and written back whenever the picker
  // changes it — the areas a student said they are studying are the default
  // scope of every session, not a per-visit setting.
  const [selectedAreas, setSelectedAreas] = useState<Set<Area>>(() => new Set(getPreferredAreas()));
  const chooseAreas = (next: Set<Area>) => {
    // Clamped to what they may reach. A locked area cannot arrive from a
    // picker, which locks its own chips, but it can arrive from a stale
    // preference written while a subscription was live — and an expired
    // subscriber must not keep a silent filter over the whole body.
    const allowed = new Set([...next].filter((a) => entitledAreas.includes(a)));
    setSelectedAreas(allowed);
    setPreferredAreas([...allowed]);
  };
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!repository || !userId) return;
    let cancelled = false;
    repository.listSessionSummaries(userId, 60).then((summaries) => {
      if (!cancelled) setStreak(computeStreak(summaries));
    });
    return () => {
      cancelled = true;
    };
  }, [repository, userId, session.phase]);

  const mastery = useMastery(repository, userId);

  const prevPhaseRef = useRef(session.phase);
  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = session.phase;
    if (prevPhase === session.phase) return;
    if (session.phase === 'in-progress') navigate('/session');
    else if (session.phase === 'results') navigate('/session/results');
  }, [session.phase, navigate]);

  // When what stood in for a screen gives way to it — the guest has made an
  // account, the account has chosen its area — the button that was pressed is
  // gone and the address has not changed, so the route-focus hook does not
  // run. The new screen's heading takes the focus that was lost.
  //
  // The same when one stand-in gives way to the other: a guest with no free
  // area on the device makes an account and is asked to choose one. And a
  // screen with no heading of its own (Today) takes it on its main region.
  /**
   * Said once, above whatever screen follows: a guest who "created" an
   * account with a sign-in that already had one was signed in to THAT
   * account, and what they did on this device as a guest stayed behind. The
   * form says so itself, but the screen it is on is replaced the moment they
   * are an account.
   */
  const [accountNotice, setAccountNotice] = useState<string | null>(null);
  /**
   * THE WAY BACK FROM THE CONFIRMATION EMAIL. The link in it is Firebase's;
   * once the address is confirmed their page offers "Continue" to this app
   * with `?emailConfirmed=1` (data/firebase.ts confirmationContinueUrl). It
   * may open in the browser the account was made in — in which case the
   * account is already confirmed here and the app simply carries on — or
   * somewhere it was not: a phone's mail app, another browser, where nobody
   * is signed in. Either way they are told the confirmation worked, and in
   * the second case where to go next, rather than left on a sign-up form
   * wondering whether it did.
   */
  // Only where accounts are real: the demo presents a pretend account, and
  // has no address to have confirmed.
  const [confirmedNotice, setConfirmedNotice] = useState(
    () => freeAreaIsOnTheAccount() && new URLSearchParams(window.location.search).has('emailConfirmed'),
  );
  useEffect(() => {
    if (!new URLSearchParams(location.search).has('emailConfirmed')) return;
    navigate({ pathname: location.pathname, search: '' }, { replace: true });
  }, [location.pathname, location.search, navigate]);
  const standingIn = isGuest ? 'account' : entitlement.needsEmailConfirmation ? 'confirm' : entitlement.needsFreeArea ? 'area' : null;
  const stoodIn = useRef(standingIn);
  useEffect(() => {
    const was = stoodIn.current;
    stoodIn.current = standingIn;
    if (was === null || was === standingIn) return;
    const id = requestAnimationFrame(() =>
      focusHeadingIfLost(document.querySelector<HTMLElement>('main h1, h1') ?? document.querySelector<HTMLElement>('main')),
    );
    return () => cancelAnimationFrame(id);
  }, [standingIn]);

  // Above every other gate, for the same reason as /dev below but with a
  // compliance edge: a legal notice nobody can reach without an account is not
  // a published notice. These pages read seed content directly and need no
  // repository, auth, or completed onboarding.
  if (LEGAL_PATHS.some((path) => location.pathname.startsWith(path))) {
    return (
      <Suspense fallback={null}>
        <LegalRoutes />
      </Suspense>
    );
  }

  // Public like the legal pages, and for the same reason: it reads no account
  // and must not bounce a cold visitor into onboarding.
  if (location.pathname === COMPARISON_PATH) {
    return (
      <Suspense fallback={null}>
        <ComparisonPage />
      </Suspense>
    );
  }

  // Above every other gate on purpose: the dev tools read seed content
  // directly and need no repository, auth, or completed onboarding.
  if (DevRoutes && location.pathname.startsWith('/dev')) {
    return (
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center text-sm" style={{ color: 'var(--ink3)' }}>
            Loading dev tools…
          </div>
        }
      >
        <DevRoutes />
      </Suspense>
    );
  }

  if (repoError || content.error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center text-sm" style={{ color: 'var(--ink3)' }}>
        <div>{repoError ?? content.error}</div>
        <button
          type="button"
          onClick={content.error ? content.retry : retryRepository}
          className="rounded-[3px] px-4 py-2"
          style={{ font: '500 13px/1 var(--font-ui)', background: 'var(--accs)', color: 'var(--accd)' }}
        >
          Retry
        </button>
      </div>
    );
  }

  // Sign-in is waited for too, in a build with accounts: whether this is a
  // guest decides which screens exist, and onboarding decides its steps as it
  // opens. Shown a moment early, a guest would be walked past the account
  // step and on to a choice the rules refuse.
  if (repoLoading || content.loading || (AUTH_ENABLED && authLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm" style={{ color: 'var(--ink3)' }}>
        Loading anatomy content…
      </div>
    );
  }

  // A new visitor at the root sees the marketing page when it is on. Held
  // until the setting resolves rather than rendering onboarding and swapping
  // it out — a flash of the wrong page is worse than a beat of nothing, and
  // this only ever delays someone who has never used the app.
  if (!onboarded && location.pathname === '/') {
    if (!siteSettingsLoaded && !siteSettings.marketingHomeEnabled) return null;
    if (siteSettings.marketingHomeEnabled) return <MarketingHome />;
  }

  // /pricing is exempt: someone following a link to the prices (Paddle's
  // account reviewer among them) should see them, not a subject picker.
  if (!onboarded && location.pathname !== '/onboarding' && location.pathname !== '/pricing') {
    return <Navigate to="/onboarding" replace />;
  }

  /**
   * Records what was chosen: the free area, for an account on the free tier,
   * and the areas every session starts from.
   *
   * The preference is saved from what was CHOSEN, not clamped through
   * `chooseAreas`: that clamps to the areas this render believes the account
   * holds, which until the choice below lands is none — so the area just
   * picked was filtered out of the student's own preferences (paywall trace
   * finding 14, "onboarding saves preferred areas against the old default").
   */
  const recordChoice = (areas: Area[]) => {
    const free = entitlement.tier === 'free';
    // One free area, so one area: a free account's sessions can draw on nothing else.
    const chosen = free ? areas.slice(0, 1) : areas;
    // Only a FIRST choice is made here. An account that already has a free
    // area keeps it: choosing again from onboarding would be its one change.
    if (free && chosen.length > 0 && !entitlement.freeArea) entitlement.chooseFreeArea(chosen[0]);
    setSelectedAreas(new Set(chosen));
    setPreferredAreas(chosen);
  };

  const handleOnboardingDone = (areas: Area[] | null) => {
    // null: they signed in, at the account step, to an account that is
    // already set up. Nothing to choose; straight in.
    if (areas !== null) recordChoice(areas);
    localStorage.setItem(ONBOARDED_KEY, 'true');
    setOnboarded(true);
    navigate('/', { replace: true });
  };

  /**
   * A session whose filter produced no questions sends the student back to
   * the setup screen, choices intact. reset() and navigate() batch into one
   * render, so the /session route never sees the 'setup' phase and bounces
   * to Today first.
   */
  const backToSetup = () => {
    session.reset();
    navigate('/study/setup');
  };

  const onNavigateSection = (next: NavSection) => {
    if (session.phase === 'in-progress') void session.abandon();
    else if (session.phase !== 'setup') session.reset();
    navigate(SECTION_PATH[next]);
  };

  const mobileNavigate = (tab: MobileTab) => {
    if (session.phase === 'in-progress') void session.abandon();
    else if (session.phase !== 'setup') session.reset();
    navigate(MOBILE_TAB_PATH[tab]);
  };

  const endSession = () => {
    if (session.phase === 'in-progress') void session.abandon();
    else session.reset();
    navigate('/');
  };

  const openMuscle = (structureId: string, contextIds: string[]) =>
    navigate(`/structure/${structureId}`, { state: { contextIds } });

  /**
   * "Drill this muscle" from a muscle card. OINA is in the mix because the four
   * facts are the point of drilling one muscle.
   *
   * No `mastery` on purpose: a one-structure drill gives the weighting nothing
   * to choose between — every question would carry the same weight. Fact
   * mastery is still needed, since it decides the format of each fact and
   * whether it gets a learn card, and generateSet stays repository-free (CR-009).
   */
  const drillStructure = async (structureId: string) => {
    const types: QuestionType[] = ['oina', 'mcq'];
    const factMastery = repository && userId ? await repository.listFactMastery(userId) : undefined;
    // This path bypasses the setup screen, so it reads the student's saved
    // learn-card preference directly rather than defaulting to 3.
    const learnCardAttempts = getLearnCardAttempts();
    const questions = generateRevisionSet(content.structures, content.images, {
      types,
      mode: 'practice',
      structureIds: [structureId],
      entitledAreas,
      factMastery,
      learnCardAttempts,
    }, content.sources);
    session.start(questions, { types, mode: 'practice', learnCardAttempts });
  };

  /**
   * OINA session over an explicit set of muscles — the Atlas' "Drill these
   * facts", scoped to whatever the list is currently filtered to.
   */
  const drillOina = async (structureIds: string[]) => {
    const types: QuestionType[] = ['oina'];
    const factMastery = repository && userId ? await repository.listFactMastery(userId) : undefined;
    const learnCardAttempts = getLearnCardAttempts();
    const questions = generateRevisionSet(content.structures, content.images, {
      types,
      mode: 'practice',
      structureIds,
      entitledAreas,
      // No cap: drilling from the Atlas covers every fact of every muscle
      // currently listed, the same as an OINA session from setup.
      factMastery,
      learnCardAttempts,
    }, content.sources);
    session.start(questions, { types, mode: 'practice', learnCardAttempts });
  };

  /**
   * A mixed quiz over an explicit set of structures of any kind — the Atlas'
   * "Quiz these", scoped to whatever the list is currently filtered to. OINA
   * only covers muscles; bones, landmarks, joints and ligaments are asked
   * through the formats that exist for them.
   */
  const quizStructures = async (structureIds: string[]) => {
    const types: QuestionType[] = ['mcq', 'locate', 'identify-typed'];
    const mastery = repository && userId ? await repository.listMastery(userId) : undefined;
    const questions = generateRevisionSet(content.structures, content.images, {
      types,
      mode: 'practice',
      structureIds,
      entitledAreas,
      count: 20,
      mastery,
      now: new Date(),
      learnCardAttempts: 0,
    }, content.sources);
    session.start(questions, { types, mode: 'practice', learnCardAttempts: 0 });
  };

  /**
   * A screen that revises, or what stands in for it.
   *
   * A GUEST gets the way to an account (AccountGate): the free area, a
   * card's facts and every session need one. Their progress and their choice
   * of free area are untouched, and are the account's the moment it exists —
   * creating one links it to the guest they already are, the app sees the
   * same user as an account, and this renders the screen that was asked for.
   *
   * AN ACCOUNT WITH NO FREE AREA YET is asked to choose it first: there is no
   * default any more, so until it chooses it holds no area and every screen
   * below would be empty. (Onboarding asks a new student this already; this
   * is for an account that got past it when skipping still gave the shoulder.)
   *
   * The account screen, the prices, the legal pages and the educator and
   * admin areas are not wrapped: a guest must be able to reach all of them.
   */
  const gated = (section: NavSection, screen: ReactElement): ReactElement => {
    if (isGuest) {
      return (
        <Suspense fallback={null}>
          <AccountGate
            isDesktop={isDesktop}
            active={section}
            onNavigate={onNavigateSection}
            onNavigateTab={mobileNavigate}
            freeArea={entitlement.freeArea?.area ?? null}
            onRecovered={setAccountNotice}
          />
        </Suspense>
      );
    }
    // AN ACCOUNT THAT HAS NOT CONFIRMED ITS EMAIL ADDRESS is asked to: the
    // free area needs it (lib/emailVerification.ts). Never an account with
    // full access, and never one that was here before the rule — the hook
    // says which. Their progress, and a free area waiting on this device,
    // are untouched and are theirs the moment the address is confirmed.
    if (entitlement.needsEmailConfirmation) {
      return (
        <Suspense fallback={null}>
          <EmailConfirmGate
            isDesktop={isDesktop}
            active={section}
            onNavigate={onNavigateSection}
            onNavigateTab={mobileNavigate}
            freeArea={entitlement.freeArea?.area ?? null}
          />
        </Suspense>
      );
    }
    if (entitlement.needsFreeArea) {
      const choose = (areas: Area[] | null) => { if (areas) recordChoice(areas); };
      return isDesktop
        ? <Onboarding content={content} access={entitlement} only={['areas']} onDone={choose} />
        : <MobileOnboarding content={content} access={entitlement} only={['areas']} onDone={choose} />;
    }
    return screen;
  };

  return (
    <>
      {DemoBanner && (
        <Suspense fallback={null}>
          <DemoBanner />
        </Suspense>
      )}
      {/* An area the account may have that is not on the device: said once,
          here, above every screen — so no screen has to leave a student to
          guess why a region is missing. Never rendered with the seed bundled. */}
      {!entitlement.loading && <AreaFactsNotice facts={content.facts} entitled={entitledAreas} />}
      {confirmedNotice && !authLoading && (
        <div
          role="status"
          className="flex items-start justify-between gap-4 px-5 py-3"
          style={{ background: 'var(--accs)', color: 'var(--accd)', font: '400 14px/1.5 var(--font-ui)' }}
        >
          <span>
            {user && !isGuest && user.emailVerified
              ? 'Your email address is confirmed.'
              : 'Your email address is confirmed. Go back to the app or the tab where you created your account and choose “I’ve confirmed — continue”, or sign in here.'}
          </span>
          <button
            type="button"
            onClick={() => setConfirmedNotice(false)}
            className="min-h-[32px] flex-none"
            style={{ font: '500 13.5px/1 var(--font-ui)', color: 'var(--accd)', textDecoration: 'underline' }}
          >
            Dismiss
          </button>
        </div>
      )}
      {accountNotice && !isGuest && (
        <div
          role="status"
          className="flex items-start justify-between gap-4 px-5 py-3"
          style={{ background: 'var(--acc2s)', color: 'var(--acc2d)', font: '400 14px/1.5 var(--font-ui)' }}
        >
          <span>{accountNotice}</span>
          <button
            type="button"
            onClick={() => setAccountNotice(null)}
            className="min-h-[32px] flex-none"
            style={{ font: '500 13.5px/1 var(--font-ui)', color: 'var(--acc2d)', textDecoration: 'underline' }}
          >
            Dismiss
          </button>
        </div>
      )}
      <Routes>
        <Route
          path="/onboarding"
          element={
            onboarded ? (
              <Navigate to="/" replace />
            ) : isDesktop ? (
              <Onboarding content={content} initialAreas={[...selectedAreas]} access={entitlement} onDone={handleOnboardingDone} />
            ) : (
              <MobileOnboarding content={content} initialAreas={[...selectedAreas]} access={entitlement} onDone={handleOnboardingDone} />
            )
          }
        />
        <Route
          path="/"
          element={
            gated('today',
            isDesktop ? (
              <Today
                access={entitlement}
                repository={repository}
                userId={userId}
                content={content}
                onStart={session.start}
                onCustomSession={() => onNavigateSection('study')}
                onOpenMuscle={(id) => openMuscle(id, [])}
                onNavigate={onNavigateSection}
              />
            ) : (
              <MobileToday
                access={entitlement}
                repository={repository}
                userId={userId}
                content={content}
                onStart={session.start}
                onCustomSession={() => navigate('/study')}
                onOpenMuscle={(id) => openMuscle(id, [])}
                onNavigateTab={mobileNavigate}
              />
            ),
            )
          }
        />
        <Route
          path="/study"
          element={
            gated('study',
            isDesktop ? (
              <RegionPicker
                access={entitlement}
                content={content}
                selected={selectedAreas}
                onChange={chooseAreas}
                onContinue={() => navigate('/study/setup')}
                onNavigate={onNavigateSection}
              />
            ) : (
              <MobileRegionPicker
                access={entitlement}
                content={content}
                selected={selectedAreas}
                onChange={chooseAreas}
                onContinue={() => navigate('/study/setup')}
                onBack={() => mobileNavigate('today')}
              />
            ),
            )
          }
        />
        <Route
          path="/study/setup"
          element={
            gated('study',
            isDesktop ? (
              <RevisionSetup
                access={entitlement}
                content={content}
                repository={repository}
                userId={userId}
                areas={selectedAreas}
                onStart={session.start}
                onBack={() => navigate('/study')}
                onNavigate={onNavigateSection}
              />
            ) : (
              <MobileRevisionSetup
                access={entitlement}
                content={content}
                repository={repository}
                userId={userId}
                areas={selectedAreas}
                onStart={session.start}
                onBack={() => navigate('/study')}
              />
            ),
            )
          }
        />
        <Route
          path="/session"
          element={
            gated('today',
            session.phase !== 'in-progress' ? (
              <Navigate to="/" replace />
            ) : isDesktop ? (
              <StudySession session={session} content={content} onEnd={endSession} onBackToSetup={backToSetup} />
            ) : (
              <MobileStudySession
                session={session}
                content={content}
                onEnd={endSession}
                onBackToSetup={backToSetup}
                onOpenMuscle={openMuscle}
              />
            ),
            )
          }
        />
        <Route
          path="/session/results"
          element={
            gated('today',
            session.phase !== 'results' || !session.summary ? (
              <Navigate to="/" replace />
            ) : isDesktop ? (
              <RevisionResults
                summary={session.summary}
                structuresById={content.structuresById}
                streak={streak}
                gamification={session.gamification}
                levelChanges={session.levelChanges}
                sessionMode={session.setupParams?.mode}
                assignment={session.setupParams?.assignment}
                onRestart={endSession}
                onOpenMuscle={(id) => openMuscle(id, session.summary!.missedStructureIds)}
                onNavigate={onNavigateSection}
                onRetryIncorrect={async () => {
                  // Never an assignment attempt: scored over only the questions
                  // just missed, it would clear any pass mark.
                  const params = {
                    ...(session.setupParams ?? { types: ['oina', 'mcq'] as QuestionType[], mode: 'practice' as const }),
                    assignment: undefined,
                  };
                  // Without the OINA fields a retry of an origin-only session would come
                  // back asking all four facts, every one of them back on multiple choice.
                  const factMastery =
                    params.types.includes('oina') && repository && userId
                      ? await repository.listFactMastery(userId)
                      : undefined;
                  const retryQuestions = generateRevisionSet(content.structures, content.images, {
                    types: params.types,
                    oinaPromptKinds: params.oinaPromptKinds,
                    groups: params.groups,
                    learnCardAttempts: params.learnCardAttempts,
                    mode: 'practice',
                    // Deliberately still a hard restriction — "retry the N missed" means
                    // those N. Mastery only orders them, worst-known first.
                    structureIds: session.summary!.missedStructureIds,
                    entitledAreas,
                    factMastery,
                    mastery,
                  }, content.sources);
                  session.start(retryQuestions, params);
                }}
              />
            ) : (
              <MobileResults
                summary={session.summary}
                answers={session.answers}
                levelChanges={session.levelChanges}
                structuresById={content.structuresById}
                gamification={session.gamification}
                sessionMode={session.setupParams?.mode}
                assignment={session.setupParams?.assignment}
                onDone={endSession}
                onRetry={async () => {
                  // Mobile's "Another N" re-runs the same setup fresh (not missed-only) — the
                  // mockup's startSession/`this.go('session')` resets and starts over, unlike
                  // desktop's "Retry the N missed" which is deliberately missed-scoped.
                  const params = session.setupParams ?? { types: ['oina', 'mcq'] as QuestionType[], mode: 'practice' as const };
                  const factMastery =
                    params.types.includes('oina') && repository && userId
                      ? await repository.listFactMastery(userId)
                      : undefined;
                  const nextQuestions = generateRevisionSet(content.structures, content.images, {
                    ...params,
                    count: session.summary!.totalQuestions,
                    entitledAreas,
                    factMastery,
                    mastery,
                  }, content.sources);
                  session.start(nextQuestions, params);
                }}
              />
            ),
            )
          }
        />
        <Route
          path="/atlas"
          element={
            gated('atlas',
            isDesktop ? (
              <Atlas
                access={entitlement}
                content={content}
                repository={repository}
                userId={userId}
                onOpenMuscle={openMuscle}
                onDrillOina={drillOina}
                onQuizStructures={quizStructures}
                onNavigate={onNavigateSection}
              />
            ) : (
              <MobileAtlas
                access={entitlement}
                content={content}
                repository={repository}
                userId={userId}
                onOpenMuscle={openMuscle}
                onDrillOina={drillOina}
                onQuizStructures={quizStructures}
                onBack={() => mobileNavigate('today')}
                onNavigateTab={mobileNavigate}
              />
            ),
            )
          }
        />
        <Route
          path="/structure/:id"
          element={
            gated('atlas',
            <StructureRoute
              access={entitlement}
              content={content}
              repository={repository}
              userId={userId}
              isDesktop={isDesktop}
              onNavigateSection={onNavigateSection}
              onDrill={drillStructure}
            />,
            )
          }
        />
        <Route
          path="/progress"
          element={
            gated('progress',
            isDesktop ? (
              <Progress
                access={entitlement}
                content={content}
                repository={repository}
                userId={userId}
                onStart={session.start}
                onNavigate={onNavigateSection}
                onOpenAchievements={() => navigate('/achievements')}
              />
            ) : (
              <MobileProgress
                content={content}
                repository={repository}
                userId={userId}
                onNavigateTab={mobileNavigate}
                onOpenAchievements={() => navigate('/achievements')}
              />
            ),
            )
          }
        />
        <Route
          path="/account"
          element={
            isDesktop ? (
              <Account content={content} repository={repository} userId={userId} access={entitlement} onNavigate={onNavigateSection} />
            ) : (
              <MobileAccount content={content} repository={repository} userId={userId} access={entitlement} onNavigateTab={mobileNavigate} />
            )
          }
        />
        <Route
          path="/pricing"
          element={
            <Suspense fallback={null}>
              <PricingPage />
            </Suspense>
          }
        />
        <Route
          path="/diagnostic"
          element={
            gated('account',
            <Suspense fallback={null}>
              <DiagnosticRoute
                repository={repository}
                userId={userId}
                content={content}
                sitterAreas={entitledAreas}
              />
            </Suspense>,
            )
          }
        />
        <Route
          path="/achievements"
          element={
            gated('progress',
            <Suspense fallback={null}>
              {isDesktop ? (
                <Achievements repository={repository} userId={userId} onNavigate={onNavigateSection} />
              ) : (
                <MobileAchievements repository={repository} userId={userId} onBack={() => navigate('/progress')} />
              )}
            </Suspense>,
            )
          }
        />
        {AdminApp && (
          <Route
            path="/admin/*"
            element={
              <Suspense
                fallback={
                  <div className="flex min-h-screen items-center justify-center text-sm" style={{ color: 'var(--ink3)' }}>
                    Loading admin…
                  </div>
                }
              >
                <AdminApp />
              </Suspense>
            }
          />
        )}
        <Route
          path="/educator/*"
          element={
            <Suspense
              fallback={
                <div className="flex min-h-screen items-center justify-center text-sm" style={{ color: 'var(--ink3)' }}>
                  Loading educator dashboard…
                </div>
              }
            >
              <EducatorApp />
            </Suspense>
          }
        />
        {import.meta.env.DEV && (
          <Route
            path="/dev/hotspots"
            element={
              <Suspense
                fallback={
                  <div className="flex min-h-screen items-center justify-center text-sm" style={{ color: 'var(--ink3)' }}>
                    Loading hotspot editor…
                  </div>
                }
              >
                <HotspotEditorApp />
              </Suspense>
            }
          />
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;

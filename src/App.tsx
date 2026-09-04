import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useRepository } from './features/anatomy-revision/hooks/useRepository';
import { useAuth } from './features/anatomy-revision/context/AuthProvider';
import { useAnatomyContent, type AnatomyContent } from './features/anatomy-revision/hooks/useAnatomyContent';
import { useRevisionSession } from './features/anatomy-revision/hooks/useRevisionSession';
import { useIsDesktop } from './features/anatomy-revision/hooks/useIsDesktop';
import { generateRevisionSet } from './features/anatomy-revision/lib/questionGenerators/generateSet';
import { getLearnCardAttempts } from './features/anatomy-revision/lib/preferences';
import { computeStreak } from './features/anatomy-revision/lib/streak';
import type { Area } from './features/anatomy-revision/types/region';
import type { QuestionType } from './features/anatomy-revision/types/question';
import type { AnatomyRepository } from './features/anatomy-revision/data/repository';
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
import { Achievements } from './features/anatomy-revision/components/Achievements/Achievements';
import { MobileAchievements } from './features/anatomy-revision/components/mobile/MobileAchievements';
import type { NavSection } from './features/anatomy-revision/components/shell/NavSidebar';
import { MobileOnboarding } from './features/anatomy-revision/components/mobile/MobileOnboarding';
import { MobileToday } from './features/anatomy-revision/components/mobile/MobileToday';
import { MobileRegionPicker } from './features/anatomy-revision/components/mobile/MobileRegionPicker';
import { MobileRevisionSetup } from './features/anatomy-revision/components/mobile/MobileRevisionSetup';
import { MobileStudySession } from './features/anatomy-revision/components/mobile/MobileStudySession';
import { MobileResults } from './features/anatomy-revision/components/mobile/MobileResults';
import { MobileMuscleCard } from './features/anatomy-revision/components/mobile/MobileMuscleCard';
import { MobileProgress } from './features/anatomy-revision/components/mobile/MobileProgress';
import type { MobileTab } from './features/anatomy-revision/components/mobile/MobileTabBar';

/** Code-split so students never download the admin bundle — see src/features/admin/AdminApp.tsx. */
const AdminApp = lazy(() => import('./features/admin/AdminApp'));
/** Code-split so students never download the educator bundle — see src/features/educator/EducatorApp.tsx. */
const EducatorApp = lazy(() => import('./features/educator/EducatorApp'));
/** Dev-only hotspot authoring tool (CR-007) — route only registered in dev, see the /dev/hotspots Route below. */
const HotspotEditorApp = lazy(() => import('./features/hotspotEditor/HotspotEditorApp'));

const ONBOARDED_KEY = 'anatomy-revision:v1:onboarded';

const SECTION_PATH: Record<NavSection, string> = {
  today: '/',
  study: '/study',
  atlas: '/atlas',
  progress: '/progress',
};

const MOBILE_TAB_PATH: Record<MobileTab, string> = {
  today: '/',
  atlas: '/atlas',
  progress: '/progress',
};

interface StructureRouteProps {
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
function StructureRoute({ content, repository, userId, isDesktop, onNavigateSection, onDrill }: StructureRouteProps) {
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
  const { user } = useAuth();
  const userId = user?.uid ?? null;
  const content = useAnatomyContent(repository);
  const session = useRevisionSession(repository, userId);
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const location = useLocation();

  const [onboarded, setOnboarded] = useState(() => localStorage.getItem(ONBOARDED_KEY) === 'true');
  const [selectedAreas, setSelectedAreas] = useState<Set<Area>>(new Set());
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

  const prevPhaseRef = useRef(session.phase);
  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = session.phase;
    if (prevPhase === session.phase) return;
    if (session.phase === 'in-progress') navigate('/session');
    else if (session.phase === 'results') navigate('/session/results');
  }, [session.phase, navigate]);

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

  if (repoLoading || content.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm" style={{ color: 'var(--ink3)' }}>
        Loading anatomy content…
      </div>
    );
  }

  if (!onboarded && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  const handleOnboardingDone = () => {
    localStorage.setItem(ONBOARDED_KEY, 'true');
    setOnboarded(true);
    navigate('/', { replace: true });
  };

  const onNavigateSection = (next: NavSection) => {
    if (session.phase !== 'setup') session.reset();
    navigate(SECTION_PATH[next]);
  };

  const mobileNavigate = (tab: MobileTab) => {
    if (session.phase !== 'setup') session.reset();
    navigate(MOBILE_TAB_PATH[tab]);
  };

  const endSession = () => {
    session.reset();
    navigate('/');
  };

  const openMuscle = (structureId: string, contextIds: string[]) =>
    navigate(`/structure/${structureId}`, { state: { contextIds } });

  /**
   * "Drill this muscle" from a muscle card. OINA is in the mix because the
   * four facts are the point of drilling one muscle — which means fetching
   * fact mastery first, since generateSet stays repository-free (CR-009).
   */
  const drillStructure = async (structureId: string) => {
    const types: QuestionType[] = ['oina', 'mcq'];
    const factMastery = repository && userId ? await repository.listFactMastery(userId) : undefined;
    // These paths bypass the setup screen, so they read the student's saved
    // learn-card preference directly rather than defaulting to 3.
    const learnCardAttempts = getLearnCardAttempts();
    const questions = generateRevisionSet(content.structures, content.images, {
      types,
      mode: 'practice',
      structureIds: [structureId],
      factMastery,
      learnCardAttempts,
    });
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
      // No cap: drilling from the Atlas covers every fact of every muscle
      // currently listed, the same as an OINA session from setup.
      factMastery,
      learnCardAttempts,
    });
    session.start(questions, { types, mode: 'practice', learnCardAttempts });
  };

  return (
    <Routes>
      <Route
        path="/onboarding"
        element={
          onboarded ? (
            <Navigate to="/" replace />
          ) : isDesktop ? (
            <Onboarding onDone={handleOnboardingDone} />
          ) : (
            <MobileOnboarding onDone={handleOnboardingDone} />
          )
        }
      />
      <Route
        path="/"
        element={
          isDesktop ? (
            <Today
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
              repository={repository}
              userId={userId}
              content={content}
              onStart={session.start}
              onCustomSession={() => navigate('/study')}
              onOpenMuscle={(id) => openMuscle(id, [])}
              onNavigateTab={mobileNavigate}
            />
          )
        }
      />
      <Route
        path="/study"
        element={
          isDesktop ? (
            <RegionPicker
              content={content}
              selected={selectedAreas}
              onChange={setSelectedAreas}
              onContinue={() => navigate('/study/setup')}
              onNavigate={onNavigateSection}
            />
          ) : (
            <MobileRegionPicker
              content={content}
              selected={selectedAreas}
              onChange={setSelectedAreas}
              onContinue={() => navigate('/study/setup')}
              onBack={() => mobileNavigate('today')}
            />
          )
        }
      />
      <Route
        path="/study/setup"
        element={
          isDesktop ? (
            <RevisionSetup
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
              content={content}
              repository={repository}
              userId={userId}
              areas={selectedAreas}
              onStart={session.start}
              onBack={() => navigate('/study')}
            />
          )
        }
      />
      <Route
        path="/session"
        element={
          session.phase !== 'in-progress' ? (
            <Navigate to="/" replace />
          ) : isDesktop ? (
            <StudySession session={session} content={content} onEnd={endSession} />
          ) : (
            <MobileStudySession session={session} content={content} onEnd={endSession} onOpenMuscle={openMuscle} />
          )
        }
      />
      <Route
        path="/session/results"
        element={
          session.phase !== 'results' || !session.summary ? (
            <Navigate to="/" replace />
          ) : isDesktop ? (
            <RevisionResults
              summary={session.summary}
              structuresById={content.structuresById}
              streak={streak}
              gamification={session.gamification}
              sessionMode={session.setupParams?.mode}
              onRestart={endSession}
              onOpenMuscle={(id) => openMuscle(id, session.summary!.missedStructureIds)}
              onNavigate={onNavigateSection}
              onRetryIncorrect={async () => {
                const params = session.setupParams ?? { types: ['oina', 'mcq'] as QuestionType[], mode: 'practice' as const };
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
                  structureIds: session.summary!.missedStructureIds,
                  factMastery,
                });
                session.start(retryQuestions, params);
              }}
            />
          ) : (
            <MobileResults
              summary={session.summary}
              answers={session.answers}
              structuresById={content.structuresById}
              gamification={session.gamification}
              sessionMode={session.setupParams?.mode}
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
                  factMastery,
                });
                session.start(nextQuestions, params);
              }}
            />
          )
        }
      />
      <Route
        path="/atlas"
        element={
          isDesktop ? (
            <Atlas
              content={content}
              repository={repository}
              userId={userId}
              onOpenMuscle={openMuscle}
              onDrillOina={drillOina}
              onNavigate={onNavigateSection}
            />
          ) : (
            <MobileAtlas
              content={content}
              repository={repository}
              userId={userId}
              onOpenMuscle={openMuscle}
              onDrillOina={drillOina}
              onBack={() => mobileNavigate('today')}
              onNavigateTab={mobileNavigate}
            />
          )
        }
      />
      <Route
        path="/structure/:id"
        element={
          <StructureRoute
            content={content}
            repository={repository}
            userId={userId}
            isDesktop={isDesktop}
            onNavigateSection={onNavigateSection}
            onDrill={drillStructure}
          />
        }
      />
      <Route
        path="/progress"
        element={
          isDesktop ? (
            <Progress
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
          )
        }
      />
      <Route
        path="/achievements"
        element={
          isDesktop ? (
            <Achievements repository={repository} userId={userId} onNavigate={onNavigateSection} />
          ) : (
            <MobileAchievements repository={repository} userId={userId} onBack={() => navigate('/progress')} />
          )
        }
      />
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
  );
}

export default App;

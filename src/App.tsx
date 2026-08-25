import { useEffect, useState, type ReactNode } from 'react';
import { useRepository } from './features/anatomy-revision/hooks/useRepository';
import { useAnonymousUser } from './features/anatomy-revision/context/AnonymousUserProvider';
import { useAnatomyContent } from './features/anatomy-revision/hooks/useAnatomyContent';
import { useRevisionSession } from './features/anatomy-revision/hooks/useRevisionSession';
import { generateRevisionSet } from './features/anatomy-revision/lib/questionGenerators/generateSet';
import { computeStreak } from './features/anatomy-revision/lib/streak';
import type { Region } from './features/anatomy-revision/types/region';
import { Onboarding } from './features/anatomy-revision/components/Onboarding/Onboarding';
import { Today } from './features/anatomy-revision/components/Today/Today';
import { RegionPicker } from './features/anatomy-revision/components/RegionPicker/RegionPicker';
import { RevisionSetup } from './features/anatomy-revision/components/RevisionSetup/RevisionSetup';
import { StudySession } from './features/anatomy-revision/components/StudySession/StudySession';
import { RevisionResults } from './features/anatomy-revision/components/RevisionResults/RevisionResults';
import { MuscleCard } from './features/anatomy-revision/components/MuscleCard/MuscleCard';
import { Atlas } from './features/anatomy-revision/components/Atlas/Atlas';
import { Progress } from './features/anatomy-revision/components/Progress/Progress';
import type { NavSection } from './features/anatomy-revision/components/shell/NavSidebar';

const ONBOARDED_KEY = 'anatomy-revision:v1:onboarded';

type StudySetupStep = 'regions' | 'setup';

interface ViewingMuscle {
  structureId: string;
  contextIds: string[];
}

/**
 * Top-level view state (no router — see the project's "no router in v1"
 * decision, preserved here). `section` picks the persistent-nav page;
 * `session.phase` (in-progress/results) takes over the whole screen
 * regardless of `section` while a study session is running, matching the
 * mockup's "sidebar becomes session context" behavior. Below 1024px this
 * whole desktop experience is hidden in favor of a simple notice — see the
 * plan's scope boundary (pixel-matching the separate mobile spec is a
 * later pass).
 */
function App() {
  const { repository, loading: repoLoading } = useRepository();
  const { userId } = useAnonymousUser();
  const content = useAnatomyContent(repository);
  const session = useRevisionSession(repository, userId);

  const [onboarded, setOnboarded] = useState(() => localStorage.getItem(ONBOARDED_KEY) === 'true');
  const [section, setSection] = useState<NavSection>('today');
  const [studySetupStep, setStudySetupStep] = useState<StudySetupStep>('regions');
  const [selectedRegions, setSelectedRegions] = useState<Set<Region>>(new Set());
  const [viewingMuscle, setViewingMuscle] = useState<ViewingMuscle | null>(null);
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

  if (repoLoading || content.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm" style={{ color: 'var(--ink3)' }}>
        Loading anatomy content…
      </div>
    );
  }

  const handleOnboardingDone = () => {
    localStorage.setItem(ONBOARDED_KEY, 'true');
    setOnboarded(true);
  };

  const navigate = (next: NavSection) => {
    if (session.phase !== 'setup') session.reset();
    setViewingMuscle(null);
    setSection(next);
    if (next === 'study') setStudySetupStep('regions');
  };

  const endSession = () => {
    session.reset();
    setSection('today');
  };

  const openMuscle = (structureId: string, contextIds: string[]) => setViewingMuscle({ structureId, contextIds });

  const drillStructure = (structureId: string) => {
    const questions = generateRevisionSet(content.structures, content.images, {
      types: ['flashcard', 'mcq'],
      mode: 'practice',
      structureIds: [structureId],
    });
    setViewingMuscle(null);
    session.start(questions, { types: ['flashcard', 'mcq'], mode: 'practice' });
  };

  let body: ReactNode;

  if (!onboarded) {
    body = <Onboarding onDone={handleOnboardingDone} />;
  } else if (viewingMuscle) {
    body = (
      <MuscleCard
        structureId={viewingMuscle.structureId}
        content={content}
        repository={repository}
        userId={userId}
        contextIds={viewingMuscle.contextIds}
        onNavigateStructure={(id) => setViewingMuscle({ structureId: id, contextIds: viewingMuscle.contextIds })}
        onBack={() => setViewingMuscle(null)}
        onDrill={drillStructure}
        onNavigate={navigate}
      />
    );
  } else if (session.phase === 'in-progress') {
    body = <StudySession session={session} content={content} onEnd={endSession} />;
  } else if (session.phase === 'results' && session.summary) {
    body = (
      <RevisionResults
        summary={session.summary}
        structuresById={content.structuresById}
        streak={streak}
        onRestart={endSession}
        onOpenMuscle={(id) => openMuscle(id, session.summary!.missedStructureIds)}
        onNavigate={navigate}
        onRetryIncorrect={() => {
          const retryQuestions = generateRevisionSet(content.structures, content.images, {
            types: session.setupParams?.types ?? ['flashcard', 'mcq'],
            mode: 'practice',
            structureIds: session.summary!.missedStructureIds,
          });
          session.start(retryQuestions, session.setupParams ?? { types: ['flashcard', 'mcq'], mode: 'practice' });
        }}
      />
    );
  } else if (section === 'today') {
    body = (
      <Today
        repository={repository}
        userId={userId}
        content={content}
        onStart={session.start}
        onCustomSession={() => navigate('study')}
        onOpenMuscle={(id) => openMuscle(id, [])}
        onNavigate={navigate}
      />
    );
  } else if (section === 'atlas') {
    body = <Atlas content={content} repository={repository} userId={userId} onOpenMuscle={openMuscle} onNavigate={navigate} />;
  } else if (section === 'progress') {
    body = <Progress content={content} repository={repository} userId={userId} onStart={session.start} onNavigate={navigate} />;
  } else if (studySetupStep === 'regions') {
    body = (
      <RegionPicker
        content={content}
        selected={selectedRegions}
        onChange={setSelectedRegions}
        onContinue={() => setStudySetupStep('setup')}
        onNavigate={navigate}
      />
    );
  } else {
    body = (
      <RevisionSetup
        content={content}
        repository={repository}
        userId={userId}
        regions={selectedRegions}
        onStart={session.start}
        onBack={() => setStudySetupStep('regions')}
        onNavigate={navigate}
      />
    );
  }

  return (
    <>
      <div className="hidden lg:block">{body}</div>
      <div className="flex min-h-screen items-center justify-center p-8 text-center lg:hidden" style={{ background: 'var(--pg)', color: 'var(--ink2)' }}>
        <p className="max-w-sm">
          This experience is designed for wider screens (1024px and up) for now. Try a laptop or a wider window.
        </p>
      </div>
    </>
  );
}

export default App;

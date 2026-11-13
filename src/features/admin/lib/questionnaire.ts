import {
  asStudyProfile,
  COURSE_LABELS,
  STUDY_LENGTH_LABELS,
  STUDY_LEVEL_LABELS,
  type Course,
  type StudyLength,
  type StudyLevel,
} from '../../anatomy-revision/lib/studyProfile';

/**
 * What the admin screens show of a user's onboarding questionnaire
 * (users/{uid}.studyProfile, lib/studyProfile.ts): whether they answered it,
 * and the three answers that say who they are — level, course and how long
 * they have studied. The rest of the profile (confidence, formats, exam date)
 * steers their sessions and is not who-is-using-the-app information.
 */
export interface QuestionnaireSummary {
  /** answered: at least one of level/course/length given. skipped: tapped Skip. none: never saw it, or left every question blank. */
  status: 'answered' | 'skipped' | 'none';
  level?: StudyLevel;
  course?: Course;
  studyLength?: StudyLength;
}

export function summariseQuestionnaire(raw: unknown): QuestionnaireSummary {
  const profile = asStudyProfile(raw);
  if (!profile) return { status: 'none' };
  const { level, course, studyLength } = profile;
  if (level || course || studyLength) {
    return {
      status: 'answered',
      ...(level ? { level } : {}),
      ...(course ? { course } : {}),
      ...(studyLength ? { studyLength } : {}),
    };
  }
  return { status: profile.skipped ? 'skipped' : 'none' };
}

/**
 * QUALIFIED vs IN TRAINING, from the level question. "Qualified, keeping up"
 * is the only qualified answer; school, degree and postgraduate are all still
 * training. "Something else" stays its own group rather than being guessed.
 */
export type TrainingGroup = 'qualified' | 'training' | 'other' | 'skipped' | 'none';

export const TRAINING_GROUP_LABELS: Record<TrainingGroup, string> = {
  qualified: 'Qualified',
  training: 'In training',
  other: 'Something else',
  skipped: 'Skipped',
  none: 'Not answered',
};

export function trainingGroup(q: QuestionnaireSummary): TrainingGroup {
  if (q.level === 'qualified') return 'qualified';
  if (q.level === 'other') return 'other';
  if (q.level) return 'training';
  return q.status === 'skipped' ? 'skipped' : 'none';
}

export interface Tally<K extends string> {
  key: K;
  label: string;
  count: number;
}

function tally<K extends string>(keys: readonly K[], labels: Record<K, string>, values: (K | undefined)[]): Tally<K>[] {
  return keys.map((key) => ({ key, label: labels[key], count: values.filter((v) => v === key).length }));
}

export interface QuestionnaireBreakdown {
  total: number;
  groups: Tally<TrainingGroup>[];
  /** Every level answer, in the questionnaire's order; zero counts kept, so the list reads the same each time. */
  levels: Tally<StudyLevel>[];
  courses: Tally<Course>[];
  lengths: Tally<StudyLength>[];
}

export function questionnaireBreakdown(summaries: readonly QuestionnaireSummary[]): QuestionnaireBreakdown {
  const groupKeys = Object.keys(TRAINING_GROUP_LABELS) as TrainingGroup[];
  return {
    total: summaries.length,
    groups: tally(groupKeys, TRAINING_GROUP_LABELS, summaries.map(trainingGroup)),
    levels: tally(Object.keys(STUDY_LEVEL_LABELS) as StudyLevel[], STUDY_LEVEL_LABELS, summaries.map((s) => s.level)),
    courses: tally(Object.keys(COURSE_LABELS) as Course[], COURSE_LABELS, summaries.map((s) => s.course)),
    lengths: tally(Object.keys(STUDY_LENGTH_LABELS) as StudyLength[], STUDY_LENGTH_LABELS, summaries.map((s) => s.studyLength)),
  };
}

export function levelLabel(q: QuestionnaireSummary): string {
  if (q.level) return STUDY_LEVEL_LABELS[q.level];
  return q.status === 'skipped' ? 'Skipped' : '—';
}

export { COURSE_LABELS, STUDY_LENGTH_LABELS, STUDY_LEVEL_LABELS };

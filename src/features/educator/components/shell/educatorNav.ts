export interface EducatorNavItem {
  path: string;
  label: string;
  /** Overview is the index route, so its NavLink needs `end` or every child path marks it active. */
  end?: boolean;
}

/**
 * The educator section's nav, in one place because two shells render it —
 * EducatorSidebar on desktop and EducatorMobileShell below 1024px. Keeping
 * the list here is what stops a section being added to one and not the other.
 *
 * Empty without a cohortId: every screen except the class list and the create
 * form is scoped to one class, so there is nothing to navigate to yet.
 */
export function educatorNavItems(cohortId: string | undefined): EducatorNavItem[] {
  if (!cohortId) return [];

  return [
    { path: `/educator/${cohortId}`, label: 'Overview', end: true },
    { path: `/educator/${cohortId}/weakness`, label: 'Structure weakness' },
    { path: `/educator/${cohortId}/confusion`, label: 'Confusion pairs' },
    { path: `/educator/${cohortId}/students`, label: 'Students' },
    { path: `/educator/${cohortId}/assignments`, label: 'Assignments' },
  ];
}

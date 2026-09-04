/**
 * roles/{uid} — admin grants, and nothing else.
 *
 * Teaching is NOT granted here: anyone can create a class and thereby own it
 * (see firestore.rules), so there is no educator role to hold. Admin is still
 * granted, because it reaches every user's data and the platform-wide
 * screens, which is not something to hand out by self-service.
 */
export interface UserRole {
  uid: string;
  admin: boolean;
  /**
   * Denormalised from users/{uid} when the role is written, so the People
   * screen can name a row without joining, and so a revoked role still says
   * who it belonged to.
   */
  email: string | null;
  displayName: string | null;
  updatedAt: string;
  /** uid of the admin who last changed this, so a grant is always attributable. */
  updatedBy: string;
}

/** The editable part of a role — what /admin/people submits. */
export interface RoleGrant {
  admin: boolean;
  email: string | null;
  displayName: string | null;
}

/** What the app knows about the signed-in user's own access. */
export interface CurrentRole {
  uid: string | null;
  isAdmin: boolean;
  /** True while auth state or the role document is still resolving — never treat as denied. */
  loading: boolean;
}

export const NO_ROLE: CurrentRole = { uid: null, isAdmin: false, loading: false };

import MembersPageClient from './MembersPageClient';

/**
 * Members — App Workspace design. The heading (with live record count),
 * search, actions and table all live in the client so the count reflects the
 * current query.
 */
export default function MembersPage() {
  return <MembersPageClient />;
}

import { canAccess, homeFor } from "@/lib/nav";
import type { AuthStatus } from "@/lib/auth";
import type { User } from "@/lib/types";

/**
 * Where an authenticated area must send the visitor, or null to render.
 * - no session -> /login?next=<current path>
 * - temporary password -> /change-password
 * - role not allowed for this route -> the role's home page
 */
export function guardRedirect(status: AuthStatus, user: User | null, pathname: string): string | null {
  if (status === "anonymous") return `/login?next=${encodeURIComponent(pathname)}`;
  if (status !== "authenticated" || !user) return null;
  if (user.must_change_password && pathname !== "/change-password") return "/change-password";
  if (!canAccess(user, pathname)) return homeFor(user.role);
  return null;
}

import { Link } from '@tanstack/react-router';
import type { AuthSession } from '@/clients/authClient';
import NavContainer from '@/routes/-components/layout/nav/nav-container';
import UserAvatar from '@/routes/-components/layout/nav/user-avatar';
// Assuming posts will remain for now, or could be removed if not used in fin-cast
import { postsLinkOptions } from '@/validations/posts-link-options';

const activeClassName = 'underline decoration-2 opacity-70';

export function Navbar({ session }: Readonly<{ session: AuthSession }>) {
  return (
    <NavContainer>
      <div className="flex gap-x-4 items-center">
        {/* Optional: Add Logo/Title */}
        <Link to="/" className="text-xl font-bold text-white">FinCast</Link>
        <Link
          to="/"
          activeProps={{ className: activeClassName }}
          activeOptions={{ exact: true }}
        >
          Dashboard
        </Link>
        {session?.user ? (
          <>
            {/* Example 'Posts' link from rt-stack, keep or remove as needed */}
            {/* <Link
              {...postsLinkOptions}
              activeProps={{ className: activeClassName }}
            >
              Posts
            </Link> */}
            <Link
              to="/podcasts" // Link to the new protected podcasts route
              activeProps={{ className: activeClassName }}
            >
              Podcasts
            </Link>
            {/* Add '/accounts' and '/settings' links here if needed */}
          </>
        ) : null}
      </div>
      {session?.user ? (
        <UserAvatar user={session.user} />
      ) : (
        <div className="flex gap-x-2 justify-between">
          <Link
            to="/login"
            activeProps={{ className: activeClassName }}
            activeOptions={{ exact: true }}
          >
            Login
          </Link>
          <span>|</span>
          <Link
            to="/register"
            activeProps={{ className: activeClassName }}
            activeOptions={{ exact: true }}
          >
            Register
          </Link>
        </div>
      )}
    </NavContainer>
  );
}
import { Link } from '@tanstack/react-router';
import type { AuthSession } from '@/clients/authClient';
import NavContainer from '@/routes/-components/layout/nav/nav-container';
import UserAvatar from '@/routes/-components/layout/nav/user-avatar';
import { postsLinkOptions } from '@/validations/posts-link-options';

const activeClassName = 'text-[#14B8A6] font-semibold';

export function Navbar({ session }: Readonly<{ session: AuthSession }>) {
  return (
    <NavContainer>
      <div className="flex gap-x-4">
        <Link
          to="/"
          activeProps={{ className: activeClassName }}
          activeOptions={{ exact: true }}
        >
          Home
        </Link>
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
          <span className="text-gray-300">|</span>
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

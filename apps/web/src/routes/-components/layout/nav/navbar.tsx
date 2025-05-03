import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import type { AuthSession } from '@/clients/authClient';
import { LeaveAppReviewModal } from '@/routes/-components/layout/nav/leave-app-review-modal';
import NavContainer from '@/routes/-components/layout/nav/nav-container';
import UserAvatar from '@/routes/-components/layout/nav/user-avatar';

const activeClassName = 'underline decoration-2 opacity-70';

export function Navbar({ session }: Readonly<{ session: AuthSession }>) {
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

    return (
        <NavContainer>
            <div className="flex gap-x-4 items-center">
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
                        <Link
                            to="/podcasts"
                            activeProps={{ className: activeClassName }}
                        >
                            Podcasts
                        </Link>
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
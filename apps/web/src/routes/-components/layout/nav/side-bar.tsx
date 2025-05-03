import { Button } from '@repo/ui/components/button';
import { cn } from '@repo/ui/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
    LayoutDashboard,
    Podcast,
    Minus,
    Newspaper,
    Star,
    type LucideIcon,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import type { AuthSession } from '@/clients/authClient';
import { trpc } from '@/router';
import { LeaveAppReviewModal } from '@/routes/-components/layout/nav/leave-app-review-modal';
import UserAvatar from '@/routes/-components/layout/nav/user-avatar';

const APP_ENTITY_ID = '00000000-0000-0000-0000-000000000000';
interface NavItemBase {
    type?: 'link' | 'separator';
}

interface NavLinkItem extends NavItemBase {
    type?: 'link';
    to: string;
    label: string;
    icon: LucideIcon;
}

interface NavSeparatorItem extends NavItemBase {
    type: 'separator';
}

type NavItem = NavLinkItem | NavSeparatorItem;

const navItems: NavItem[] = [
    { to: '/home', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/podcasts', label: 'My Podcasts', icon: Podcast },
    { to: '/news-feed', label: 'News Feed', icon: Newspaper },
    { type: 'separator' },
];

interface SidebarProps {
    session: AuthSession;
    onLinkClick?: () => void;
}

export function Sidebar({ session, onLinkClick }: SidebarProps) {
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

    const appReviewsQuery = trpc.reviews.byEntityId.queryOptions(
        { entityId: APP_ENTITY_ID, contentType: 'app' },
        { enabled: !!session?.user?.id }
    );

    const { data: reviews, isLoading: isLoadingReviews } = useQuery(appReviewsQuery);

    const currentUserHasReviewedApp = useMemo(() => {
        if (!session?.user?.id || !reviews) {
            return false;
        }
        return reviews.some(review => review.userId === session.user.id);
    }, [session?.user?.id, reviews]);

    const activeLinkClass = 'bg-sidebar-accent text-primary border-l-4 border-primary';
    const defaultLinkClass =
        'flex items-center px-4 py-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors duration-200 border-l-4 border-transparent';
    const iconClass = 'mr-3 h-5 w-5';

    if (!session || !session.user) {
        console.error('Sidebar rendered without a valid session.');
        return null;
    }

    const user = session.user;

    return (
        <>
            <aside className="w-64 flex-shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col h-full">
                <div>
                    <div className="p-4 h-16 flex items-center gap-2 border-b border-sidebar-border">
                        <h1 className="text-2xl font-bold text-sidebar-foreground">FinCast</h1>
                    </div>
                    <nav className="mt-2">
                        <ul>
                            {session?.user && !currentUserHasReviewedApp && !isLoadingReviews && (
                                <li>
                                    <Button
                                        variant="ghost"
                                        className={cn(defaultLinkClass, 'w-full justify-start text-sidebar-foreground hover:text-sidebar-foreground')}
                                        onClick={() => setIsReviewModalOpen(true)}
                                    >
                                        <Star className={iconClass} aria-hidden="true" />
                                        Leave Feedback
                                    </Button>
                                </li>
                            )}
                            {navItems.map((item, index) =>
                                item.type === 'separator' ? (
                                    <li key={`sep-${index}`} className="px-4 py-2">
                                        <Minus className="h-2 w-full text-muted-foreground" strokeWidth={1} />
                                    </li>
                                ) : (
                                    <li key={item.to}>
                                        <Link
                                            to={item.to}
                                            className={defaultLinkClass}
                                            activeOptions={{ exact: item.to === '/' }}
                                            activeProps={{
                                                className: cn(defaultLinkClass, activeLinkClass),
                                            }}
                                            onClick={onLinkClick}
                                        >
                                            <item.icon className={iconClass} aria-hidden="true" />
                                            {item.label}
                                        </Link>
                                    </li>
                                ),
                            )}
                        </ul>
                    </nav>
                </div>
                <div className="mt-auto p-4 border-t border-sidebar-border">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-sidebar-foreground truncate mr-2" title={user.name ?? user.email ?? ''}>
                            Welcome, {user.name?.split(' ')[0] ?? 'User'}
                        </span>
                        <UserAvatar user={user} onLinkClick={onLinkClick} />
                    </div>
                </div>
            </aside>
            {session?.user && (
                <LeaveAppReviewModal
                   open={isReviewModalOpen}
                   setOpen={setIsReviewModalOpen}
                />
             )}
        </>
    );
}
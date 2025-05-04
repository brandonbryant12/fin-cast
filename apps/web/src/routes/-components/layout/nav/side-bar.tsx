import { Button } from '@repo/ui/components/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@repo/ui/components/collapsible';
import { cn } from '@repo/ui/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
    LayoutDashboard,
    Podcast,
    Minus,
    Newspaper,
    Star,
    ShieldCheck,
    Users,
    MessageSquareText,
    Settings,
    FileText,
    ChevronsUpDown,
    type LucideIcon,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import type { AuthSession } from '@/clients/authClient';
import UserAvatar from './user-avatar';
import { trpc } from '@/router';
import { LeaveAppReviewModal } from '@/routes/-components/layout/nav/leave-app-review-modal';


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
    const [isAdminOpen, setIsAdminOpen] = useState(false);

    const { data: adminStatusData } = useQuery(
     trpc.auth.isAdminStatus.queryOptions(undefined, {
      enabled: !!session?.user?.id,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
     })
    );
    const isAdmin = adminStatusData?.isAdmin ?? false;

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

                            {isAdmin && (
                                <li className="pt-2">
                                    <Collapsible open={isAdminOpen} onOpenChange={setIsAdminOpen}>
                                        <CollapsibleTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                className={cn(defaultLinkClass, 'w-full justify-between hover:bg-sidebar-accent')}
                                            >
                                                <span className="flex items-center">
                                                    <ShieldCheck className={iconClass} />
                                                    Admin
                                                </span>
                                                <ChevronsUpDown className="h-4 w-4 opacity-50" />
                                            </Button>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="pl-8 pt-1 space-y-0.5 border-l border-muted ml-[calc(1rem+4px)] mr-4">
                                            <Link
                                                to="/admin/podcasts"
                                                className={cn(defaultLinkClass, 'text-sm h-9 border-l-0 pl-2')}
                                                activeProps={{ className: cn(defaultLinkClass, activeLinkClass, 'text-sm h-9 border-l-0 pl-2') }}
                                                onClick={onLinkClick}
                                            >
                                                <Settings className={cn(iconClass, 'h-4 w-4')} /> Podcasts
                                            </Link>
                                            <Link
                                                to="/admin/users"
                                                className={cn(defaultLinkClass, 'text-sm h-9 border-l-0 pl-2')}
                                                activeProps={{ className: cn(defaultLinkClass, activeLinkClass, 'text-sm h-9 border-l-0 pl-2') }}
                                                onClick={onLinkClick}
                                            >
                                                <Users className={cn(iconClass, 'h-4 w-4')} /> Users
                                            </Link>
                                            <Link
                                                to="/admin/reviews"
                                                className={cn(defaultLinkClass, 'text-sm h-9 border-l-0 pl-2')}
                                                activeProps={{ className: cn(defaultLinkClass, activeLinkClass, 'text-sm h-9 border-l-0 pl-2') }}
                                                onClick={onLinkClick}
                                            >
                                                <MessageSquareText className={cn(iconClass, 'h-4 w-4')} /> Reviews
                                            </Link>
                                            <Link
                                                to="/admin/prompts"
                                                className={cn(defaultLinkClass, 'text-sm h-9 border-l-0 pl-2')}
                                                activeProps={{ className: cn(defaultLinkClass, activeLinkClass, 'text-sm h-9 border-l-0 pl-2') }}
                                                onClick={onLinkClick}
                                            >
                                                <FileText className={cn(iconClass, 'h-4 w-4')} /> Prompts
                                            </Link>
                                        </CollapsibleContent>
                                    </Collapsible>
                                </li>
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
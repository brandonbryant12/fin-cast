import { cn } from '@repo/ui/lib/utils';
import { Link } from '@tanstack/react-router';
import {
    LayoutDashboard,
    Podcast,
    Link as LinkIcon,
    Settings,
    Minus,
    type LucideIcon,
} from 'lucide-react';
import type { AuthSession } from '@/clients/authClient';
import UserAvatar from '@/routes/-components/layout/nav/user-avatar';

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
    { type: 'separator' },
    // Links to /accounts and /settings can be added back here if needed
    // { to: '/accounts', label: 'Connected Accounts', icon: LinkIcon },
    // { to: '/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
    session: AuthSession;
}

export function Sidebar({ session }: SidebarProps) {
    const activeLinkClass = 'bg-slate-700 text-teal-400 border-l-4 border-teal-500'; // Adjusted active style slightly
    const defaultLinkClass =
        'flex items-center px-4 py-3 text-gray-300 hover:bg-slate-700 hover:text-white transition-colors duration-200 border-l-4 border-transparent';
    const iconClass = 'mr-3 h-5 w-5';

    if (!session || !session.user) {
        console.error('Sidebar rendered without a valid session.');
        return null;
    }

    const user = session.user;

    return (
        <aside className="w-64 flex-shrink-0 border-r border-slate-700 bg-slate-800 flex flex-col">
            <div>
                <div className="p-4 h-16 flex items-center gap-2 border-b border-slate-700"> {/* Added border */}
                    {/* <img src='/logo.png' alt="FinCast Logo" className="h-8 w-auto" /> */}
                    <h1 className="text-2xl font-bold text-white">FinCast</h1>
                </div>
                <nav className="mt-2">
                    <ul>
                        {navItems.map((item, index) =>
                            item.type === 'separator' ? (
                                <li key={`sep-${index}`} className="px-4 py-2">
                                    <Minus className="h-2 w-full text-slate-600" strokeWidth={1} />
                                </li>
                            ) : (
                                <li key={item.to}>
                                    <Link
                                        to={item.to}
                                        className={defaultLinkClass}
                                            activeOptions={{ exact: item.to === '/' }} // Exact match only for dashboard
                                        activeProps={{
                                            className: cn(defaultLinkClass, activeLinkClass),
                                        }}
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

            <div className="mt-auto p-4 border-t border-slate-700">
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300 truncate mr-2" title={user.name ?? user.email ?? ''}>
                        Welcome, {user.name?.split(' ')[0] ?? 'User'}
                    </span>
                    <UserAvatar user={user} />
                </div>
            </div>
        </aside>
    );
}
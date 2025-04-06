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
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/podcasts', label: 'My Podcasts', icon: Podcast },
    { type: 'separator' },
    { to: '/accounts', label: 'Connected Accounts', icon: LinkIcon },
    { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
    const activeLinkClass = 'bg-slate-800 text-teal-400 border-l-4 border-teal-500';
    const defaultLinkClass =
        'flex items-center px-4 py-3 text-gray-300 hover:bg-slate-700 hover:text-white transition-colors duration-200 border-l-4 border-transparent';
    const iconClass = 'mr-3 h-5 w-5';

    return (
        <aside className="w-64 flex-shrink-0 border-r border-slate-700 bg-slate-900">
            <div className="p-4">
                <h1 className="text-2xl font-bold text-white">FinCast</h1>
                {/* Placeholder for Logo if available */}
            </div>
            <nav className="mt-6">
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
        </aside>
    );
}

// Note: You might need to create dummy routes for /accounts and /settings
// or adjust the Link 'to' props if they don't exist yet. 
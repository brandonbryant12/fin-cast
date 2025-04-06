import { Outlet } from '@tanstack/react-router';
import { Sidebar } from './Sidebar';

export function MainLayout() {
    return (
        <div className="flex h-screen bg-slate-900 text-white">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-6 md:p-10">
                {/* Content for the selected route will be rendered here */}
                <Outlet />
            </main>
        </div>
    );
} 
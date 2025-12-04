import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { logout, getCurrentUser } from '../services/authService';
import {
    ChartBarIcon,
    ChatBubbleIcon,
    UserGroupIcon,
    DocumentTextIcon,
    ExclamationCircleIcon,
    BuildingOfficeIcon,
    Cog6ToothIcon,
    CpuChipIcon,
    WrenchScrewdriverIcon
} from './icons';

interface AdminLayoutProps {
    children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const user = getCurrentUser();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navLinks = [
        { path: '/admin/dashboard', label: 'Dashboard', icon: ChartBarIcon },
        { path: '/admin/chats', label: 'Chat Management', icon: ChatBubbleIcon },
        { path: '/admin/escalations', label: 'Escalations', icon: ExclamationCircleIcon },
        { path: '/admin/agents', label: 'Agents', icon: CpuChipIcon },
        { path: '/admin/tools', label: 'Tools', icon: WrenchScrewdriverIcon },
        { path: '/admin/knowledge', label: 'Knowledge Base', icon: DocumentTextIcon },
        { path: '/admin/users', label: 'User Management', icon: UserGroupIcon },
        { path: '/admin/tenants', label: 'Tenants', icon: BuildingOfficeIcon },
    ];

    const isActive = (path: string) => {
        return location.pathname.startsWith(path);
    };

    return (
        <div className="h-screen bg-gray-100 flex overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-gray-900 text-white flex flex-col fixed h-full z-30 overflow-y-auto">
                <div className="h-16 flex items-center px-6 bg-gray-800 border-b border-gray-700">
                    <h1 className="text-xl font-bold tracking-wider">ITL Admin</h1>
                </div>

                <div className="flex-1 overflow-y-auto py-4">
                    <nav className="px-3 space-y-1">
                        {navLinks.map((link) => (
                            <Link
                                key={link.path}
                                to={link.path}
                                className={`
                  group flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors
                  ${isActive(link.path)
                                        ? 'bg-indigo-600 text-white'
                                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                    }
                `}
                            >
                                <link.icon className={`mr-3 h-5 w-5 flex-shrink-0 ${isActive(link.path) ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                </div>

                <div className="p-4 border-t border-gray-800 bg-gray-900">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center text-sm font-bold">
                            {user?.username?.charAt(0).toUpperCase() || 'A'}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium text-white truncate">{user?.display_name || user?.username}</p>
                            <p className="text-xs text-gray-400 truncate capitalize">{user?.role}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-red-500"
                    >
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content Wrapper */}
            <div className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">
                {/* Top Header (Optional, for global search or tenant switcher) */}
                <header className="bg-white shadow-sm h-16 flex items-center justify-between px-8 sticky top-0 z-20">
                    <h2 className="text-lg font-semibold text-gray-800">
                        {navLinks.find(l => isActive(l.path))?.label || 'Dashboard'}
                    </h2>
                    <div className="flex items-center gap-4">
                        {/* Placeholder for Tenant Switcher or Global Search */}
                        <span className="text-sm text-gray-500">Global Admin View</span>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 p-8 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;

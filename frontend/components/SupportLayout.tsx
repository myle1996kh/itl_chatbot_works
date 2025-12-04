import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { logout, getCurrentUser } from '../services/authService';

interface SupportLayoutProps {
    children: React.ReactNode;
}

const SupportLayout: React.FC<SupportLayoutProps> = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const user = getCurrentUser();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navLinks = [
        { path: '/support', label: 'My Chats', icon: '💬' },
        { path: '/support/history', label: 'History', icon: '📋' },
        { path: '/support/knowledge', label: 'Knowledge Base', icon: '📚' },
    ];

    const isActive = (path: string) => {
        if (path === '/support') {
            return location.pathname === '/support';
        }
        return location.pathname.startsWith(path);
    };

    return (
        <div className="h-screen bg-gray-50 flex overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-white shadow-sm border-r border-gray-200 flex flex-col h-full overflow-y-auto">
                <div className="h-16 flex items-center px-4 border-b border-gray-200">
                    <h1 className="text-lg font-bold text-gray-900">ITL Support</h1>
                </div>
                <div className="flex-1 overflow-y-auto py-4">
                    <nav className="px-2 space-y-1">
                        {navLinks.map((link) => (
                            <Link
                                key={link.path}
                                to={link.path}
                                className={`
                  group flex items-center px-3 py-2 text-sm font-medium rounded-md
                  ${isActive(link.path)
                                        ? 'bg-indigo-100 text-indigo-700 border-l-4 border-indigo-500'
                                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                                    }
                `}
                            >
                                <span className="mr-3 text-lg">{link.icon}</span>
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                </div>
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="h-9 w-9 rounded-full bg-indigo-500 flex items-center justify-center text-sm font-bold text-white">
                            {user?.username?.charAt(0).toUpperCase() || 'S'}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium text-gray-900 truncate">{user?.display_name || user?.username}</p>
                            <p className="text-xs text-gray-500 truncate capitalize">{user?.role}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none"
                    >
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-6 overflow-y-auto">
                {children}
            </main>
        </div>
    );
};

export default SupportLayout;

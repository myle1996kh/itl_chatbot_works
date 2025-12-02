import React from 'react';
import { Navigate } from 'react-router-dom';
import { isAuthenticated, getUserRole } from '../services/authService';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredRole?: 'admin' | 'supporter';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
    if (!isAuthenticated()) {
        return <Navigate to="/login" replace />;
    }

    if (requiredRole) {
        const userRole = getUserRole();

        // Allow 'staff' to access 'supporter' routes (they're the same)
        if (requiredRole === 'supporter' && (userRole === 'supporter' || userRole === 'staff')) {
            return <>{children}</>;
        }

        if (userRole !== requiredRole) {
            // Redirect to appropriate dashboard based on role
            if (userRole === 'admin') {
                return <Navigate to="/admin/dashboard" replace />;
            } else if (userRole === 'supporter') {
                return <Navigate to="/support" replace />;
            }
            return <Navigate to="/login" replace />;
        }
    }

    return <>{children}</>;
};

export default ProtectedRoute;

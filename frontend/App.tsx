import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated, getUserRole } from './services/authService';
import LoginPage from './pages/LoginPage';
import AdminOverviewPage from './pages/admin/AdminOverviewPage';
import TenantManagementPage from './pages/admin/TenantManagementPage';
import TenantSetupWizard from './pages/admin/TenantSetupWizard';
import TenantSettingsPage from './pages/admin/TenantSettingsPage';
import UserManagement from './pages/admin/UserManagement';
import ChatManagementPage from './pages/admin/ChatManagementPage';
import KnowledgeBasePage from './pages/admin/KnowledgeBasePage';
import EscalationQueuePage from './pages/admin/EscalationQueuePage';
import AgentManagementPage from './pages/admin/AgentManagementPage';
import ToolManagementPage from './pages/admin/ToolManagementPage';
import SupportDashboard from './pages/SupportDashboard';
import ChatRoomPage from './pages/ChatRoomPage';
import HistoryPage from './pages/HistoryPage';
import SupportKnowledgePage from './pages/support/SupportKnowledgePage';
import ProtectedRoute from './components/ProtectedRoute';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />

        {/* Root - redirect based on auth status */}
        <Route
          path="/"
          element={
            isAuthenticated() ? (
              getUserRole() === 'admin' ? (
                <Navigate to="/admin/dashboard" replace />
              ) : (
                <Navigate to="/support" replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminOverviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/tenants"
          element={
            <ProtectedRoute requiredRole="admin">
              <TenantManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/tenants/new"
          element={
            <ProtectedRoute requiredRole="admin">
              <TenantSetupWizard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/tenants/:tenantId/settings"
          element={
            <ProtectedRoute requiredRole="admin">
              <TenantSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute requiredRole="admin">
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/chats"
          element={
            <ProtectedRoute requiredRole="admin">
              <ChatManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/knowledge"
          element={
            <ProtectedRoute requiredRole="admin">
              <KnowledgeBasePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/escalations"
          element={
            <ProtectedRoute requiredRole="admin">
              <EscalationQueuePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/agents"
          element={
            <ProtectedRoute requiredRole="admin">
              <AgentManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/tools"
          element={
            <ProtectedRoute requiredRole="admin">
              <ToolManagementPage />
            </ProtectedRoute>
          }
        />

        {/* Supporter Routes */}
        <Route
          path="/support"
          element={
            <ProtectedRoute requiredRole="supporter">
              <SupportDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/support/chat/:sessionId"
          element={
            <ProtectedRoute requiredRole="supporter">
              <ChatRoomPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/support/history"
          element={
            <ProtectedRoute requiredRole="supporter">
              <HistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/support/knowledge"
          element={
            <ProtectedRoute requiredRole="supporter">
              <SupportKnowledgePage />
            </ProtectedRoute>
          }
        />

        {/* Catch all - redirect to root */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;

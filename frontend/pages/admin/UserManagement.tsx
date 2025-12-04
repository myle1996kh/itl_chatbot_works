import React, { useState, useEffect } from 'react';
import { PencilIcon, TrashIcon, PlusIcon, UserGroupIcon } from '../../components/icons';
import AdminLayout from '../../components/AdminLayout';
import { getCurrentUser } from '../../services/authService';
import { getTenants } from '../../services/tenantService';
import {
    listUsers,
    createUser,
    updateUser,
    deleteUser,
    User,
    CreateUserRequest,
    UpdateUserRequest,
} from '../../services/userService';

const UserManagement: React.FC = () => {
    const currentUser = getCurrentUser();
    const [users, setUsers] = useState<User[]>([]);
    const [tenants, setTenants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [roleFilter, setRoleFilter] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [tenantFilter, setTenantFilter] = useState<string>('');

    // Create/Edit Modal
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [formData, setFormData] = useState({
        email: '',
        username: '',
        password: '',
        display_name: '',
        role: 'tenant_user',
        tenant_id: '',
        status: 'active',
    });
    const [submitting, setSubmitting] = useState(false);

    // Delete Confirmation
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        loadData();
    }, [roleFilter, statusFilter, tenantFilter]);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Load tenants for dropdown
            const tenantsData = await getTenants();
            setTenants(tenantsData || []);

            // Load users with filters
            const params: any = {};
            if (roleFilter) params.role = roleFilter;
            if (statusFilter) params.status_filter = statusFilter;
            if (tenantFilter) params.tenant_id = tenantFilter;

            const usersData = await listUsers(params);
            setUsers(usersData.users || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = () => {
        setModalMode('create');
        setSelectedUser(null);
        setFormData({
            email: '',
            username: '',
            password: '',
            display_name: '',
            role: 'tenant_user',
            tenant_id: currentUser?.tenant_id || '',
            status: 'active',
        });
        setShowModal(true);
    };

    const openEditModal = (user: User) => {
        setModalMode('edit');
        setSelectedUser(user);
        setFormData({
            email: user.email,
            username: user.username,
            password: '', // Don't show password
            display_name: user.display_name || '',
            role: user.role,
            tenant_id: user.tenant_id,
            status: user.status,
        });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (submitting) return;

        try {
            setSubmitting(true);
            setError(null);

            if (modalMode === 'create') {
                // Create new user
                const request: CreateUserRequest = {
                    email: formData.email,
                    username: formData.username,
                    password: formData.password,
                    display_name: formData.display_name || undefined,
                    role: formData.role,
                    tenant_id: formData.tenant_id,
                };
                await createUser(request);
            } else {
                // Update existing user
                if (!selectedUser) return;

                const request: UpdateUserRequest = {
                    email: formData.email !== selectedUser.email ? formData.email : undefined,
                    username: formData.username !== selectedUser.username ? formData.username : undefined,
                    display_name: formData.display_name || undefined,
                    status: formData.status !== selectedUser.status ? formData.status : undefined,
                };
                await updateUser(selectedUser.user_id, request);
            }

            setShowModal(false);
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save user');
        } finally {
            setSubmitting(false);
        }
    };

    const openDeleteDialog = (user: User) => {
        setUserToDelete(user);
        setShowDeleteDialog(true);
    };

    const handleDelete = async () => {
        if (!userToDelete || deleting) return;

        try {
            setDeleting(true);
            setError(null);

            await deleteUser(userToDelete.user_id);

            // Only close dialog on success
            setShowDeleteDialog(false);
            setUserToDelete(null);
            await loadData();
        } catch (err) {
            // Check if it's a 403 Forbidden error
            const errorMessage = err instanceof Error ? err.message : 'Failed to delete user';
            if (errorMessage.includes('403') || errorMessage.toLowerCase().includes('forbidden')) {
                setError('❌ Access Denied: You do not have permission to delete this user.');
            } else {
                setError(errorMessage);
            }
            // Keep dialog open to show error
        } finally {
            setDeleting(false);
        }
    };

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'admin':
                return 'bg-purple-100 text-purple-800';
            case 'supporter':
            case 'staff':
                return 'bg-blue-100 text-blue-800';
            case 'tenant_user':
                return 'bg-gray-100 text-gray-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusBadgeColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-800';
            case 'inactive':
                return 'bg-gray-100 text-gray-800';
            case 'suspended':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <AdminLayout>
            <div className="max-w-7xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                        <p className="text-gray-600 mt-1">Manage system users and their permissions</p>
                    </div>
                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 font-medium"
                    >
                        <PlusIcon className="h-5 w-5" />
                        Create User
                    </button>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                        {error}
                    </div>
                )}

                {/* Filters */}
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                            <select
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">All Roles</option>
                                <option value="admin">Admin</option>
                                <option value="supporter">Supporter</option>
                                <option value="staff">Staff</option>
                                <option value="tenant_user">Tenant User</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">All Statuses</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="suspended">Suspended</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tenant</label>
                            <select
                                value={tenantFilter}
                                onChange={(e) => setTenantFilter(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">All Tenants</option>
                                {tenants.map((tenant) => (
                                    <option key={tenant.tenant_id} value={tenant.tenant_id}>
                                        {tenant.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* User Table */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    User
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Email
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Role
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Tenant
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Last Login
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        Loading users...
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        No users found
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.user_id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10">
                                                    <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                                                        <UserGroupIcon className="h-6 w-6 text-indigo-600" />
                                                    </div>
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {user.display_name || user.username}
                                                    </div>
                                                    <div className="text-sm text-gray-500">{user.username}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">{user.email}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}
                                            >
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(user.status)}`}
                                            >
                                                {user.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {tenants.find((t) => t.tenant_id === user.tenant_id)?.name || user.tenant_id}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => openDeleteDialog(user)}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">
                            {modalMode === 'create' ? 'Create New User' : 'Edit User'}
                        </h3>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Email <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Username <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                            </div>

                            {modalMode === 'create' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Password <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        required={modalMode === 'create'}
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                                <input
                                    type="text"
                                    value={formData.display_name}
                                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Role <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                    disabled={modalMode === 'edit'}
                                >
                                    <option value="tenant_user">Tenant User</option>
                                    <option value="supporter">Supporter</option>
                                    <option value="staff">Staff</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>

                            {modalMode === 'create' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Tenant <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formData.tenant_id}
                                        onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        required
                                    >
                                        <option value="">Select Tenant</option>
                                        {tenants.map((tenant) => (
                                            <option key={tenant.tenant_id} value={tenant.tenant_id}>
                                                {tenant.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {modalMode === 'edit' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                        <option value="suspended">Suspended</option>
                                    </select>
                                </div>
                            )}

                            <div className="flex gap-2 justify-end mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-md font-medium disabled:opacity-50"
                                >
                                    {submitting
                                        ? modalMode === 'create'
                                            ? 'Creating...'
                                            : 'Saving...'
                                        : modalMode === 'create'
                                            ? 'Create User'
                                            : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            {showDeleteDialog && userToDelete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Delete User</h3>
                        <p className="text-gray-600 mb-6">
                            Are you sure you want to delete user <strong>{userToDelete.username}</strong> (
                            {userToDelete.email})? This action cannot be undone.
                        </p>

                        {/* Error Display in Dialog */}
                        {error && (
                            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                                {error}
                            </div>
                        )}

                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => {
                                    setShowDeleteDialog(false);
                                    setError(null); // Clear error when closing
                                }}
                                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-md font-medium disabled:opacity-50"
                            >
                                {deleting ? 'Deleting...' : 'Delete User'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default UserManagement;

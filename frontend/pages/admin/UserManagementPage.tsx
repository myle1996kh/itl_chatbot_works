import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import {
    getUsers,
    createUser,
    updateUser,
    deleteUser,
    UserResponse,
    CreateUserRequest,
    UpdateUserRequest
} from '../../services/authService';
import { getTenants, TenantResponse } from '../../services/tenantService';
import {
    PlusIcon,
    PencilIcon,
    TrashIcon,
    UserGroupIcon
} from '../../components/icons';
import { getJWTToken } from '../../services/authService';

const UserManagementPage: React.FC = () => {
    const [users, setUsers] = useState<UserResponse[]>([]);
    const [tenants, setTenants] = useState<TenantResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UserResponse | null>(null);
    const [formData, setFormData] = useState<CreateUserRequest>({
        email: '',
        username: '',
        password: '',
        display_name: '',
        role: 'tenant_user',
        tenant_id: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const token = getJWTToken();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (token) {
                const [usersResponse, tenantsData] = await Promise.all([
                    getUsers(token),
                    getTenants()
                ]);

                if (usersResponse.success && usersResponse.data) {
                    setUsers(usersResponse.data.users);
                } else {
                    setError(usersResponse.error || 'Failed to load users');
                }
                setTenants(tenantsData);
            }
        } catch (err) {
            setError('Failed to load data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (user?: UserResponse) => {
        if (user) {
            setEditingUser(user);
            setFormData({
                email: user.email,
                username: user.username,
                password: '', // Password not shown for editing
                display_name: user.display_name || '',
                role: user.role,
                tenant_id: user.tenant_id || ''
            });
        } else {
            setEditingUser(null);
            setFormData({
                email: '',
                username: '',
                password: '',
                display_name: '',
                role: 'tenant_user',
                tenant_id: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingUser(null);
        setFormData({
            email: '',
            username: '',
            password: '',
            display_name: '',
            role: 'tenant_user',
            tenant_id: ''
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return;

        setSubmitting(true);
        try {
            if (editingUser) {
                const updateData: UpdateUserRequest = {
                    email: formData.email,
                    display_name: formData.display_name,
                    role: formData.role,
                    tenant_id: formData.tenant_id
                };
                // Only include password if provided
                if (formData.password) {
                    updateData.password = formData.password;
                }

                const response = await updateUser(editingUser.user_id, updateData, token);
                if (!response.success) throw new Error(response.error);
            } else {
                const response = await createUser(formData, token);
                if (!response.success) throw new Error(response.error);
            }
            await fetchData();
            handleCloseModal();
        } catch (err) {
            console.error('Failed to save user:', err);
            alert('Failed to save user. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (userId: string) => {
        if (!token || !window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

        try {
            const response = await deleteUser(userId, token);
            if (!response.success) throw new Error(response.error);
            await fetchData();
        } catch (err) {
            console.error('Failed to delete user:', err);
            alert('Failed to delete user.');
        }
    };

    const getTenantName = (tenantId?: string) => {
        if (!tenantId) return '-';
        const tenant = tenants.find(t => t.tenant_id === tenantId);
        return tenant ? tenant.name : tenantId;
    };

    return (
        <AdminLayout>
            <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                        <p className="text-sm text-gray-500 mt-1">Manage users, roles, and tenant assignments</p>
                    </div>
                    <button
                        onClick={() => handleOpenModal()}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                        New User
                    </button>
                </div>

                {error && (
                    <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
                        <div className="flex">
                            <div className="ml-3">
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                    {loading ? (
                        <div className="p-6 text-center text-gray-500">Loading users...</div>
                    ) : users.length === 0 ? (
                        <div className="p-6 text-center text-gray-500">No users found. Create one to get started.</div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        User
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Role
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Tenant
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Created At
                                    </th>
                                    <th scope="col" className="relative px-6 py-3">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {users.map((user) => (
                                    <tr key={user.user_id}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10">
                                                    <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                                        <UserGroupIcon className="h-6 w-6" />
                                                    </div>
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900">{user.display_name || user.username}</div>
                                                    <div className="text-sm text-gray-500">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                                                user.role === 'supporter' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-green-100 text-green-800'
                                                }`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {getTenantName(user.tenant_id)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleOpenModal(user)}
                                                className="text-indigo-600 hover:text-indigo-900 mr-4"
                                            >
                                                <PencilIcon className="h-5 w-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(user.user_id)}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={handleCloseModal}></div>

                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <div className="sm:flex sm:items-start">
                                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                        <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                            {editingUser ? 'Edit User' : 'Create New User'}
                                        </h3>
                                        <div className="mt-4">
                                            <form onSubmit={handleSubmit} className="space-y-4">
                                                <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
                                                    <div className="sm:col-span-2">
                                                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                                                        <input
                                                            type="email"
                                                            name="email"
                                                            id="email"
                                                            required
                                                            className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                                            value={formData.email}
                                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                        />
                                                    </div>

                                                    {!editingUser && (
                                                        <div className="sm:col-span-2">
                                                            <label htmlFor="username" className="block text-sm font-medium text-gray-700">Username</label>
                                                            <input
                                                                type="text"
                                                                name="username"
                                                                id="username"
                                                                required
                                                                className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                                                value={formData.username}
                                                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                                            />
                                                        </div>
                                                    )}

                                                    <div className="sm:col-span-2">
                                                        <label htmlFor="display_name" className="block text-sm font-medium text-gray-700">Display Name</label>
                                                        <input
                                                            type="text"
                                                            name="display_name"
                                                            id="display_name"
                                                            className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                                            value={formData.display_name}
                                                            onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                                                        />
                                                    </div>

                                                    <div className="sm:col-span-2">
                                                        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                                            {editingUser ? 'New Password (leave blank to keep current)' : 'Password'}
                                                        </label>
                                                        <input
                                                            type="password"
                                                            name="password"
                                                            id="password"
                                                            required={!editingUser}
                                                            className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                                            value={formData.password}
                                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                        />
                                                    </div>

                                                    <div>
                                                        <label htmlFor="role" className="block text-sm font-medium text-gray-700">Role</label>
                                                        <select
                                                            id="role"
                                                            name="role"
                                                            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                            value={formData.role}
                                                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                                        >
                                                            <option value="tenant_user">User</option>
                                                            <option value="supporter">Supporter</option>
                                                            <option value="admin">Admin</option>
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label htmlFor="tenant_id" className="block text-sm font-medium text-gray-700">Tenant</label>
                                                        <select
                                                            id="tenant_id"
                                                            name="tenant_id"
                                                            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                            value={formData.tenant_id}
                                                            onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
                                                        >
                                                            <option value="">Select Tenant...</option>
                                                            {tenants.map((tenant) => (
                                                                <option key={tenant.tenant_id} value={tenant.tenant_id}>
                                                                    {tenant.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                                                    <button
                                                        type="submit"
                                                        disabled={submitting}
                                                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm"
                                                    >
                                                        {submitting ? 'Saving...' : 'Save'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                                                        onClick={handleCloseModal}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default UserManagementPage;

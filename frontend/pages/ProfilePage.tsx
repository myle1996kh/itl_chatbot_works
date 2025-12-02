import React, { useState } from 'react';
import { getCurrentUser } from '../services/authService';
import SupportLayout from '../components/SupportLayout';

const ProfilePage: React.FC = () => {
    const user = getCurrentUser();
    const [displayName, setDisplayName] = useState(user?.display_name || user?.username || '');
    const [email, setEmail] = useState(user?.email || '');
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState<'online' | 'offline' | 'busy'>('online');
    const [notifications, setNotifications] = useState({
        emailNotifications: true,
        soundAlerts: true,
        desktopNotifications: false,
    });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            // TODO: Replace with actual API call
            // await fetch(`http://localhost:8000/api/users/${user?.user_id}`, {
            //   method: 'PUT',
            //   headers: {
            //     'Content-Type': 'application/json',
            //     'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
            //   },
            //   body: JSON.stringify({
            //     display_name: displayName,
            //     email: email
            //   })
            // });

            setMessage({ type: 'success', text: 'Profile updated successfully!' });
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to update profile' });
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match' });
            return;
        }

        if (newPassword.length < 8) {
            setMessage({ type: 'error', text: 'Password must be at least 8 characters' });
            return;
        }

        setSaving(true);
        setMessage(null);

        try {
            // TODO: Replace with actual API call
            // await fetch(`http://localhost:8000/api/auth/change-password`, {
            //   method: 'POST',
            //   headers: {
            //     'Content-Type': 'application/json',
            //     'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
            //   },
            //   body: JSON.stringify({
            //     old_password: oldPassword,
            //     new_password: newPassword
            //   })
            // });

            setMessage({ type: 'success', text: 'Password changed successfully!' });
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to change password' });
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateStatus = async (newStatus: 'online' | 'offline' | 'busy') => {
        setStatus(newStatus);

        try {
            // TODO: Replace with actual API call
            // await fetch(
            //   `http://localhost:8000/api/tenants/${user?.tenant_id}/supporters/${user?.user_id}`,
            //   {
            //     method: 'PUT',
            //     headers: {
            //       'Content-Type': 'application/json',
            //       'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
            //     },
            //     body: JSON.stringify({ status: newStatus })
            //   }
            // );

            setMessage({ type: 'success', text: `Status updated to ${newStatus}` });
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to update status' });
        }
    };

    const handleUpdateNotifications = async () => {
        setSaving(true);
        setMessage(null);

        try {
            // TODO: Save to backend or localStorage
            localStorage.setItem('notificationPreferences', JSON.stringify(notifications));
            setMessage({ type: 'success', text: 'Notification preferences saved!' });
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to save preferences' });
        } finally {
            setSaving(false);
        }
    };

    const getStatusColor = (s: string) => {
        switch (s) {
            case 'online':
                return 'bg-green-500';
            case 'busy':
                return 'bg-yellow-500';
            case 'offline':
                return 'bg-gray-500';
            default:
                return 'bg-gray-500';
        }
    };

    return (
        <SupportLayout>
            <div className="max-w-4xl">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
                    <p className="text-gray-600 mt-1">Manage your account settings and preferences</p>
                </div>

                {/* Message Alert */}
                {message && (
                    <div
                        className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                            }`}
                    >
                        {message.text}
                    </div>
                )}

                <div className="space-y-6">
                    {/* Profile Information */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Information</h2>
                        <form onSubmit={handleUpdateProfile} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                                <input
                                    type="text"
                                    value={user?.role || 'supporter'}
                                    disabled
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={saving}
                                className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </form>
                    </div>

                    {/* Change Password */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h2>
                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                                <input
                                    type="password"
                                    value={oldPassword}
                                    onChange={(e) => setOldPassword(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={saving}
                                className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {saving ? 'Changing...' : 'Change Password'}
                            </button>
                        </form>
                    </div>

                    {/* Availability Status */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Availability Status</h2>
                        <div className="flex gap-4">
                            {(['online', 'busy', 'offline'] as const).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => handleUpdateStatus(s)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-md border-2 transition-colors ${status === s
                                            ? 'border-indigo-600 bg-indigo-50'
                                            : 'border-gray-300 hover:border-gray-400'
                                        }`}
                                >
                                    <span className={`h-3 w-3 rounded-full ${getStatusColor(s)}`}></span>
                                    <span className="capitalize font-medium">{s}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Notification Preferences */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Notification Preferences</h2>
                        <div className="space-y-4">
                            <label className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={notifications.emailNotifications}
                                    onChange={(e) =>
                                        setNotifications({ ...notifications, emailNotifications: e.target.checked })
                                    }
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                />
                                <span className="text-sm text-gray-700">Email notifications for new messages</span>
                            </label>
                            <label className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={notifications.soundAlerts}
                                    onChange={(e) => setNotifications({ ...notifications, soundAlerts: e.target.checked })}
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                />
                                <span className="text-sm text-gray-700">Sound alerts for new messages</span>
                            </label>
                            <label className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={notifications.desktopNotifications}
                                    onChange={(e) =>
                                        setNotifications({ ...notifications, desktopNotifications: e.target.checked })
                                    }
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                />
                                <span className="text-sm text-gray-700">Desktop notifications</span>
                            </label>
                        </div>
                        <button
                            onClick={handleUpdateNotifications}
                            disabled={saving}
                            className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save Preferences'}
                        </button>
                    </div>
                </div>
            </div>
        </SupportLayout>
    );
};

export default ProfilePage;

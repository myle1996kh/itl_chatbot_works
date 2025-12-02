import React, { useState, useEffect } from 'react';
import { getApiBaseUrl, getCurrentUser, getJWTToken } from '../services/authService';
import SupportLayout from '../components/SupportLayout';

interface SupporterStats {
    sessions_today: number;
    sessions_this_week: number;
    sessions_this_month: number;
    total_sessions: number;
    avg_response_time_minutes: number;
    resolution_rate: number;
    customer_satisfaction: number;
    categories: {
        [key: string]: number;
    };
}

const StatisticsPage: React.FC = () => {
    const user = getCurrentUser();
    const [stats, setStats] = useState<SupporterStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('week');

    useEffect(() => {
        loadStats();
    }, [timeRange]);

    const loadStats = async () => {
        if (!user) return;

        try {
            setLoading(true);

            const token = getJWTToken();
            if (!token) {
                throw new Error('Not authenticated');
            }

            const response = await fetch(
                `${getApiBaseUrl()}/api/tenants/${user.tenant_id}/supporters/${user.user_id}/stats?range=${timeRange}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Failed to load stats: ${response.status}`);
            }

            const data = await response.json();
            setStats(data);
        } catch (err) {
            console.error('Failed to load stats:', err);
            setStats(null);
        } finally {
            setLoading(false);
        }
    };

    if (loading || !stats) {
        return (
            <SupportLayout>
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Loading statistics...</p>
                    </div>
                </div>
            </SupportLayout>
        );
    }

    const categoryData = Object.entries(stats.categories).sort((a, b) => b[1] - a[1]);
    const maxCategoryValue = Math.max(...Object.values(stats.categories));

    return (
        <SupportLayout>
            <div className="max-w-6xl">
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Statistics</h1>
                        <p className="text-gray-600 mt-1">Your performance metrics and insights</p>
                    </div>
                    <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value as 'week' | 'month' | 'all')}
                        className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="all">All Time</option>
                    </select>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Sessions Today</p>
                                <p className="text-3xl font-bold text-indigo-600 mt-2">{stats.sessions_today}</p>
                            </div>
                            <div className="bg-indigo-100 p-3 rounded-full">
                                <svg className="h-8 w-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                    />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">This Week</p>
                                <p className="text-3xl font-bold text-green-600 mt-2">{stats.sessions_this_week}</p>
                            </div>
                            <div className="bg-green-100 p-3 rounded-full">
                                <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                                    />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Avg Response Time</p>
                                <p className="text-3xl font-bold text-purple-600 mt-2">
                                    {stats.avg_response_time_minutes.toFixed(1)}
                                    <span className="text-lg text-gray-500 ml-1">min</span>
                                </p>
                            </div>
                            <div className="bg-purple-100 p-3 rounded-full">
                                <svg className="h-8 w-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Resolution Rate</p>
                                <p className="text-3xl font-bold text-blue-600 mt-2">
                                    {stats.resolution_rate.toFixed(1)}
                                    <span className="text-lg text-gray-500 ml-1">%</span>
                                </p>
                            </div>
                            <div className="bg-blue-100 p-3 rounded-full">
                                <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Additional Stats */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Customer Satisfaction */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Satisfaction</h2>
                        <div className="flex items-center gap-4">
                            <div className="text-5xl font-bold text-yellow-500">{stats.customer_satisfaction.toFixed(1)}</div>
                            <div className="flex-1">
                                <div className="flex items-center gap-1 mb-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <svg
                                            key={star}
                                            className={`h-6 w-6 ${star <= Math.round(stats.customer_satisfaction) ? 'text-yellow-400' : 'text-gray-300'
                                                }`}
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                        >
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                        </svg>
                                    ))}
                                </div>
                                <p className="text-sm text-gray-500">Based on customer feedback</p>
                            </div>
                        </div>
                    </div>

                    {/* Session Summary */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Session Summary</h2>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">This Month</span>
                                <span className="text-lg font-semibold text-gray-900">{stats.sessions_this_month}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Total Sessions</span>
                                <span className="text-lg font-semibold text-gray-900">{stats.total_sessions}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Daily Average</span>
                                <span className="text-lg font-semibold text-gray-900">
                                    {(stats.sessions_this_month / 30).toFixed(1)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Category Breakdown */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Sessions by Category</h2>
                    <div className="space-y-4">
                        {categoryData.map(([category, count]) => (
                            <div key={category}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-sm font-medium text-gray-700">{category}</span>
                                    <span className="text-sm font-semibold text-gray-900">{count}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${(count / maxCategoryValue) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </SupportLayout>
    );
};

export default StatisticsPage;

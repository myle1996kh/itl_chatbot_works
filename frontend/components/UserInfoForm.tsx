import React, { useState } from 'react';
import { Tenant } from '../types';
import { UserCircleIcon } from './icons';

interface UserInfoFormProps {
  tenant: Tenant;
  onSubmit: (userInfo: { username: string; email: string; department?: string }) => Promise<void>;
  loading: boolean;
  onClose?: () => void;
  isStandalone?: boolean;
}

const UserInfoForm: React.FC<UserInfoFormProps> = ({ tenant, onSubmit, loading, onClose, isStandalone }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('General');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && email.trim()) {
      onSubmit({ username, email, department });
    }
  };

  const primaryColor = tenant.theme.primaryColor;

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-xl overflow-hidden font-sans">
      <header
        className="p-6 text-white text-center relative"
        style={{ backgroundColor: primaryColor }}
      >
        {isStandalone && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:opacity-80 transition-opacity"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        <h2 className="font-bold text-xl mb-2">{tenant.theme.headerText}</h2>
        <p className="text-sm opacity-90">{tenant.theme.welcomeMessage}</p>
      </header>

      <div className="flex-1 p-6 flex flex-col justify-center">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4 text-gray-400">
            <UserCircleIcon className="w-10 h-10" />
          </div>
          <h3 className="text-gray-800 font-semibold text-lg">Chào bạn!</h3>
          <p className="text-gray-500 text-sm">Để bắt đầu trò chuyện, vui lòng điền thêm thông tin.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Họ và tên <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:outline-none transition-colors"
              style={{ borderColor: 'transparent' }}
              placeholder="Nguyễn Văn A"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:outline-none transition-colors"
              style={{ borderColor: 'transparent' }}
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">
              Phòng ban
            </label>
            <select
              id="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:outline-none transition-colors"
            >
              <option value="General">Hỗ trợ chung</option>
              <option value="Sales">Kinh doanh</option>
              <option value="Technical">Hỗ trợ kỹ thuật</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-lg text-white font-semibold shadow-md hover:opacity-90 transition-opacity disabled:opacity-70 mt-4"
            style={{ backgroundColor: primaryColor }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Đang khởi tạo...
              </span>
            ) : (
              'Bắt đầu trò chuyện'
            )}
          </button>
        </form>
      </div>

      <div className="p-4 text-center text-xs text-gray-400 border-t">
        ITL Chatbot
      </div>
    </div>
  );
};

export default UserInfoForm;
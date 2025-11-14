import React, { useState } from 'react';
import { UserInfo, Tenant, Topic } from '../types';
import { createOrGetChatUser, createSession } from '../services/chatUserService';

interface UserInfoFormProps {
  tenant: Tenant;
  onComplete: (userInfo: UserInfo, selectedTopicId: string, userId: string, sessionId: string) => void;
}

interface ExtendedUserInfo extends UserInfo {
  user_id?: string;
  session_id?: string;
}

const UserInfoForm: React.FC<UserInfoFormProps> = ({ tenant, onComplete }) => {
  const [userInfo, setUserInfo] = useState<UserInfo>({
    username: '',
    email: '',
    department: '',
  });
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setUserInfo((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInfo.username || !userInfo.email) {
      setError('Please fill in name and email');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Create or get chat user
      const userResponse = await createOrGetChatUser(
        tenant.id,
        userInfo.email,
        userInfo.username,
        userInfo.department
      );

      if (!userResponse.success || !userResponse.data) {
        setError(userResponse.error || 'Failed to create user account');
        setIsLoading(false);
        return;
      }

      const chatUser = userResponse.data;
      console.log('✅ Chat user ready:', chatUser.user_id);

      // Step 2: Create a new session
      const sessionResponse = await createSession(
        tenant.id,
        chatUser.user_id
      );

      if (!sessionResponse.success || !sessionResponse.data) {
        setError(sessionResponse.error || 'Failed to create session');
        setIsLoading(false);
        return;
      }

      const session = sessionResponse.data;
      console.log('✅ Chat session ready:', session.session_id);

      // Store user_id and session_id in state for handleTopicSelect
      setUserId(chatUser.user_id);
      setSessionId(session.session_id);
      setFormSubmitted(true);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsLoading(false);
    }
  };

  const handleTopicSelect = (topicId: string) => {
    // Use user_id and session_id from state (set during form submission)
    if (!userId || !sessionId) {
      setError('Missing user or session information. Please try again.');
      return;
    }

    console.log('✅ Calling onComplete with:', { userId, sessionId, topicId });
    onComplete(userInfo, topicId, userId, sessionId);
  };

  const primaryColor = tenant.theme.primaryColor;
  const buttonBgClass = `bg-${primaryColor}`;
  const buttonHoverBgClass = `hover:bg-${primaryColor.slice(0, -3)}700`;
  const ringFocusClass = `focus:ring-${primaryColor}`;
  const borderFocusClass = `focus:border-${primaryColor}`;

  return (
    <div className="p-6 bg-white rounded-lg shadow-md w-full max-w-sm">
      {!formSubmitted ? (
        <>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Welcome to {tenant.name}</h2>
          <p className="text-gray-600 mb-6">Please fill in your details to start chatting.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={userInfo.username}
                onChange={handleChange}
                required
                disabled={isLoading}
                className={`mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-1 ${ringFocusClass} ${borderFocusClass} sm:text-sm disabled:bg-gray-100`}
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={userInfo.email}
                onChange={handleChange}
                required
                disabled={isLoading}
                className={`mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-1 ${ringFocusClass} ${borderFocusClass} sm:text-sm disabled:bg-gray-100`}
              />
            </div>
            <div>
              <label htmlFor="department" className="block text-sm font-medium text-gray-700">
                Department (Optional)
              </label>
              <input
                type="text"
                id="department"
                name="department"
                value={userInfo.department}
                onChange={handleChange}
                disabled={isLoading}
                className={`mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-1 ${ringFocusClass} ${borderFocusClass} sm:text-sm disabled:bg-gray-100`}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${buttonBgClass} ${buttonHoverBgClass} focus:outline-none focus:ring-2 focus:ring-offset-2 ${ringFocusClass} transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isLoading ? 'Creating account...' : 'Continue'}
            </button>
          </form>
        </>
      ) : (
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Hello, {userInfo.username.split(' ')[0]}!</h2>
          <p className="text-gray-600 mb-6">What can we help you with today? Select a starting topic.</p>
          <div className="space-y-3">
            {tenant.topics.map((topic) => (
              <button
                key={topic.id}
                onClick={() => handleTopicSelect(topic.id)}
                className={`w-full text-left p-4 border rounded-lg hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 ${ringFocusClass} border-gray-200 hover:border-${primaryColor}`}
              >
                <h3 className="font-semibold text-gray-800">{topic.name}</h3>
                <p className="text-sm text-gray-500">{topic.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserInfoForm;
import React from 'react';
import { Message } from '../../types';
import { SparklesIcon, UserCircleIcon } from '../icons';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MessageListProps {
    messages: Message[];
    primaryColor: string;
    isTyping: boolean;
    messagesEndRef: React.RefObject<HTMLDivElement>;
}

const MessageList: React.FC<MessageListProps> = ({
    messages,
    primaryColor,
    isTyping,
    messagesEndRef
}) => {
    return (
        <div className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-4">
            {messages.map((msg) => (
                <div
                    key={msg.id}
                    className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                    {msg.sender !== 'user' && (
                        <div
                            className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: msg.sender === 'ai' ? primaryColor : '#9CA3AF' }}
                        >
                            <SparklesIcon className="h-5 w-5 text-white" />
                        </div>
                    )}

                    <div
                        className={`rounded-lg px-3 py-2 max-w-xs shadow-sm ${msg.sender === 'user' ? 'text-white' : 'bg-white text-gray-800'
                            }`}
                        style={msg.sender === 'user' ? { backgroundColor: primaryColor, color: 'white' } : {}}
                    >
                        {msg.sender === 'supporter' && (
                            <div className="font-bold text-xs mb-1 text-green-600">
                                {msg.supporterName}
                            </div>
                        )}

                        {msg.fileInfo && (
                            <div className="text-xs font-mono p-2 bg-black/10 rounded-md mb-2">
                                Attached: {msg.fileInfo.name}
                            </div>
                        )}

                        <div
                            className="prose prose-sm max-w-none"
                            style={{ whiteSpace: 'pre-wrap' }}
                        >
                            {/* <Markdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    // ... components ...
                                }}
                            >
                                {msg.text}
                            </Markdown> */}
                            <div className="whitespace-pre-wrap">{msg.text}</div>
                        </div>
                    </div>

                    {msg.sender === 'user' && (
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                            <UserCircleIcon className="h-6 w-6 text-gray-600" />
                        </div>
                    )}
                </div>
            ))}

            {isTyping && (
                <div className="flex items-end gap-2 justify-start">
                    <div
                        className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: primaryColor }}
                    >
                        <SparklesIcon className="h-5 w-5 text-white" />
                    </div>
                    <div className="rounded-lg px-3 py-2 max-w-xs shadow-sm bg-white text-gray-800">
                        <div className="flex items-center gap-1">
                            <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                            <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></span>
                            <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></span>
                        </div>
                    </div>
                </div>
            )}

            <div ref={messagesEndRef} />
        </div>
    );
};

export default MessageList;

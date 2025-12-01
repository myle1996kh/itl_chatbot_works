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
                            <Markdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    p: ({ node, children, ...props }) => {
                                        const text = String(children);
                                        const isStep = /^(Bước|Step)\s+\d+:/i.test(text);

                                        if (isStep) {
                                            return (
                                                <p
                                                    className="mb-0 leading-snug pl-4 relative font-bold"
                                                    style={{ paddingLeft: '1rem' }}
                                                    {...props}
                                                >
                                                    <span
                                                        className="absolute left-0 font-bold"
                                                        style={{ color: 'black' }}
                                                    >
                                                        •
                                                    </span>
                                                    {children}
                                                </p>
                                            );
                                        }
                                        return <p className="mb-0 leading-snug" {...props}>{children}</p>;
                                    },
                                    ul: ({ node, children, ...props }) => (
                                        <ul className="list-disc list-inside mb-0 space-y-0" {...props}>
                                            {children}
                                        </ul>
                                    ),
                                    ol: ({ node, children, ...props }) => (
                                        <ol className="list-decimal list-inside mb-0 space-y-0" {...props}>
                                            {children}
                                        </ol>
                                    ),
                                    li: ({ node, children, ...props }) => (
                                        <li className="ml-0 leading-snug" {...props}>{children}</li>
                                    ),
                                    h1: ({ node, children, ...props }) => (
                                        <h1 className="font-bold text-sm mb-0 mt-1 text-black" {...props}>{children}</h1>
                                    ),
                                    h2: ({ node, children, ...props }) => (
                                        <h2 className="font-bold text-sm mb-0 mt-1 text-black" {...props}>{children}</h2>
                                    ),
                                    h3: ({ node, children, ...props }) => (
                                        <h3 className="font-semibold text-xs mb-0 mt-0.5 text-black" {...props}>{children}</h3>
                                    ),
                                    strong: ({ node, children, ...props }) => (
                                        <strong className="font-bold text-black" {...props}>{children}</strong>
                                    ),
                                    em: ({ node, children, ...props }) => (
                                        <em className="italic text-gray-600" {...props}>{children}</em>
                                    ),
                                    code: ({ node, children, ...props }) => (
                                        <code
                                            className="bg-gray-200 px-1.5 py-0.5 rounded text-xs font-mono"
                                            style={{ backgroundColor: 'rgba(0,0,0,0.1)' }}
                                            {...props}
                                        >
                                            {children}
                                        </code>
                                    ),
                                    blockquote: ({ node, children, ...props }) => (
                                        <blockquote
                                            className="border-l-4 pl-3 py-1 my-1 italic text-gray-600"
                                            style={{ borderColor: primaryColor }}
                                            {...props}
                                        >
                                            {children}
                                        </blockquote>
                                    ),
                                }}
                            >
                                {msg.text}
                            </Markdown>
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

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
                            className="prose prose-sm max-w-none markdown-content"
                            style={{ whiteSpace: 'pre-wrap' }}
                        >
                            <style>{`
                                .markdown-content p { margin: 0.3em 0; }
                                .markdown-content p.nguon { font-style: italic; }
                                .markdown-content h1, .markdown-content h2, .markdown-content h3, .markdown-content h4 { margin: 0.2em 0; font-weight: bold; }
                                .markdown-content h1 { font-size: 1.8em; }
                                .markdown-content h2 { font-size: 1.4em; }
                                .markdown-content h3 { font-size: 1.15em; }
                                .markdown-content ul, .markdown-content ol { margin: 0.3em 0; padding-left: 1.5em; }
                                .markdown-content ul { list-style-type: disc; }
                                .markdown-content ol { list-style-type: decimal; }
                                .markdown-content li { margin: 0.1em 0; }
                                .markdown-content code { background-color: rgba(0,0,0,0.05); padding: 0.2em 0.4em; border-radius: 3px; font-family: monospace; }
                                .markdown-content pre { background-color: #f6f8fa; padding: 1em; border-radius: 6px; overflow-x: auto; font-family: monospace; }
                                .markdown-content blockquote { margin: 1em 0; padding-left: 1em; border-left: 4px solid ${primaryColor}; color: #666; font-style: italic; }
                                .markdown-content a { color: ${primaryColor}; text-decoration: underline; }
                            `}</style>
                            <Markdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    p: (props) => {
                                        const content = Array.isArray(props.children) ? props.children.join('') : String(props.children || '');
                                        return content.includes('Nguồn:')
                                            ? <p className="nguon" {...props} />
                                            : <p {...props} />;
                                    }
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

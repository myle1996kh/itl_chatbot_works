import React, { useRef } from 'react';
import { SendIcon, PaperclipIcon, XMarkIcon } from '../icons';

interface MessageInputProps {
    input: string;
    setInput: (value: string) => void;
    onSend: () => void;
    isTyping: boolean;
    attachedFile: File | null;
    onFileAttach: (file: File | null) => void;
    primaryColor: string;
    placeholder?: string;
}

const MessageInput: React.FC<MessageInputProps> = ({
    input,
    setInput,
    onSend,
    isTyping,
    attachedFile,
    onFileAttach,
    primaryColor,
    placeholder = 'Đặt câu hỏi...',
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onFileAttach(e.target.files[0]);
        }
    };

    const handleRemoveFile = () => {
        onFileAttach(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !isTyping && (input.trim() || attachedFile)) {
            onSend();
        }
    };

    return (
        <div className="p-3 border-t bg-white rounded-b-lg">
            {attachedFile && (
                <div className="flex items-center justify-between bg-gray-100 p-2 rounded-md mb-2 text-sm">
                    <span className="truncate">{attachedFile.name}</span>
                    <button
                        onClick={handleRemoveFile}
                        className="p-1 text-gray-500 hover:text-gray-800"
                    >
                        <XMarkIcon className="h-4 w-4" />
                    </button>
                </div>
            )}

            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={placeholder}
                    className="flex-1 w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-1"
                    disabled={isTyping}
                />

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload-chat"
                />

                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-gray-500 hover:text-gray-800"
                >
                    <PaperclipIcon className="h-6 w-6" />
                </button>

                <button
                    onClick={onSend}
                    disabled={isTyping || (!input.trim() && !attachedFile)}
                    className="p-2 rounded-full text-white transition-colors"
                    style={
                        isTyping || (!input.trim() && !attachedFile)
                            ? { backgroundColor: '#D1D5DB', cursor: 'not-allowed' }
                            : { backgroundColor: primaryColor }
                    }
                >
                    <SendIcon className="h-6 w-6" />
                </button>
            </div>
        </div>
    );
};

export default MessageInput;

import React from 'react';

interface EscalationDialogProps {
    show: boolean;
    reason: string;
    onReasonChange: (value: string) => void;
    onSubmit: () => void;
    onCancel: () => void;
}

const EscalationDialog: React.FC<EscalationDialogProps> = ({
    show,
    reason,
    onReasonChange,
    onSubmit,
    onCancel,
}) => {
    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 rounded-lg">
            <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-bold mb-4 text-gray-800">
                    Request Human Support
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                    Why do you need human support? Please describe the issue or your reason for escalation.
                </p>
                <textarea
                    value={reason}
                    onChange={(e) => onReasonChange(e.target.value)}
                    placeholder="Describe your issue or reason for escalation..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 mb-4 resize-none"
                    rows={4}
                />
                <div className="flex gap-2 justify-end">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSubmit}
                        className="px-4 py-2 text-white bg-orange-500 hover:bg-orange-600 rounded-lg font-medium"
                    >
                        Escalate
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EscalationDialog;

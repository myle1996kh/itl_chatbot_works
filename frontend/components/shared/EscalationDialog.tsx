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
                    Yêu cầu hỗ trợ từ nhân viên
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                    Vì sao bạn cần hỗ trợ từ nhân viên? Vui lòng mô tả vấn đề hoặc lý do yêu cầu hỗ trợ.
                </p>
                <textarea
                    value={reason}
                    onChange={(e) => onReasonChange(e.target.value)}
                    placeholder="Mô tả vấn đề hoặc lý do cần hỗ trợ..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 mb-4 resize-none"
                    rows={4}
                />
                <div className="flex gap-2 justify-end">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={onSubmit}
                        className="px-4 py-2 text-white bg-orange-500 hover:bg-orange-600 rounded-lg font-medium"
                    >
                        Gửi yêu cầu
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EscalationDialog;

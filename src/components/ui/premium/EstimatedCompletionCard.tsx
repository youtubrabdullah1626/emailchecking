import React from 'react';

export interface EstimatedCompletionCardProps {
  estimatedDate: Date | null;
  totalEmails: number;
}

export const EstimatedCompletionCard: React.FC<EstimatedCompletionCardProps> = ({ estimatedDate, totalEmails }) => {
  return (
    <div className="bg-gradient-to-br from-indigo-50 to-white rounded-xl shadow-sm border border-indigo-100 p-5">
      <h3 className="text-sm font-semibold text-indigo-900 mb-1">Estimated Completion</h3>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-indigo-700">
          {estimatedDate ? estimatedDate.toLocaleDateString() : 'Calculating...'}
        </span>
        {estimatedDate && (
          <span className="text-sm font-medium text-indigo-500">
            {estimatedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
      <p className="text-sm text-indigo-600 mt-2">
        Based on warm-up capacity and {totalEmails} queued emails.
      </p>
    </div>
  );
};

import React, { useState } from 'react';

export interface ExplanationPanelProps {
  title?: string;
  reasons: ReadonlyArray<{ code: string; message: string }>;
}

export const ExplanationPanel: React.FC<ExplanationPanelProps> = ({ title = 'Why did the system do this?', reasons }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!reasons || reasons.length === 0) return null;

  return (
    <div className="mt-4 border-t border-gray-100 pt-3">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors"
        aria-expanded={isExpanded}
      >
        <span>{title}</span>
        <svg 
          className={`w-3 h-3 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="mt-2 text-sm text-gray-600 bg-gray-50 rounded-md p-3 space-y-2">
          {reasons.map((reason, idx) => (
            <div key={idx} className="flex flex-col">
              <span className="font-medium text-gray-900">{reason.code}</span>
              <span className="text-gray-600">{reason.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

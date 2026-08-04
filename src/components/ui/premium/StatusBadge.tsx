import React from 'react';

export type BadgeStatus = 'ACTIVE' | 'PAUSED' | 'WARNING' | 'NEUTRAL';

export interface StatusBadgeProps {
  status: BadgeStatus;
  label: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const getStyles = () => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800 border-green-200';
      case 'PAUSED': return 'bg-red-100 text-red-800 border-red-200';
      case 'WARNING': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'NEUTRAL': default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getIndicatorStyles = () => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-500 animate-pulse';
      case 'PAUSED': return 'bg-red-500';
      case 'WARNING': return 'bg-yellow-500';
      case 'NEUTRAL': default: return 'bg-gray-400';
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStyles()}`}>
      <span className={`w-1.5 h-1.5 mr-1.5 rounded-full ${getIndicatorStyles()}`} aria-hidden="true" />
      {label}
    </span>
  );
};

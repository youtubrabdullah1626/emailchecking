import React from 'react';
import { StatusBadge } from './StatusBadge';

export interface SmartDeliverabilityCardProps {
  isActive: boolean;
}

export const SmartDeliverabilityCard: React.FC<SmartDeliverabilityCardProps> = ({ isActive }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900">Smart Deliverability</h3>
        <StatusBadge status={isActive ? 'ACTIVE' : 'NEUTRAL'} label={isActive ? 'Protected' : 'Disabled'} />
      </div>
      <p className="text-sm text-gray-500">
        {isActive 
          ? 'Optimizing delivery for maximum inbox placement automatically.'
          : 'Deliverability protection is currently inactive.'}
      </p>
    </div>
  );
};

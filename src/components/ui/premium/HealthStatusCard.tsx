import React from 'react';
import { StatusBadge } from './StatusBadge';

export interface HealthStatusCardProps {
  isHealthy: boolean;
}

export const HealthStatusCard: React.FC<HealthStatusCardProps> = ({ isHealthy }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow flex items-center justify-between">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">System Health</h3>
        <p className="text-sm text-gray-500">All backend engines operational</p>
      </div>
      <StatusBadge status={isHealthy ? 'ACTIVE' : 'WARNING'} label={isHealthy ? 'Healthy' : 'Degraded'} />
    </div>
  );
};

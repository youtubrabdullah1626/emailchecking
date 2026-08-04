import React from 'react';
import { StatusBadge } from './StatusBadge';
import { ExplanationPanel } from './ExplanationPanel';
import { OptimizationDecision, ActivityScore } from '@/lib/optimization/types';

export interface OptimizationCardProps {
  decision: OptimizationDecision;
}

export const OptimizationCard: React.FC<OptimizationCardProps> = ({ decision }) => {
  const { score, deliveryWindows, reasons } = decision;

  const getScoreConfig = () => {
    switch (score) {
      case ActivityScore.VERY_HIGH:
      case ActivityScore.HIGH:
        return { label: 'High Engagement', status: 'ACTIVE' as const };
      case ActivityScore.MEDIUM:
        return { label: 'Moderate Engagement', status: 'NEUTRAL' as const };
      case ActivityScore.LOW:
        return { label: 'Low Engagement', status: 'WARNING' as const };
      default:
        return { label: 'Analyzing', status: 'NEUTRAL' as const };
    }
  };

  const config = getScoreConfig();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900">Activity Optimization</h3>
        <StatusBadge status={config.status} label={config.label} />
      </div>

      <div className="space-y-3 mt-3">
        {deliveryWindows.length > 0 ? (
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Advisory Windows</p>
            <div className="flex flex-wrap gap-2">
              {deliveryWindows.map((w, idx) => (
                <span key={idx} className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-md border border-blue-100">
                  {w.startHour}:00 - {w.endHour}:00 ({w.timezone})
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No specific delivery windows recommended.</p>
        )}
      </div>

      <ExplanationPanel reasons={reasons} title="View Optimization Reasoning" />
    </div>
  );
};

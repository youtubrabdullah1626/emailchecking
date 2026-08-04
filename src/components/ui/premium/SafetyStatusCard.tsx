import React from 'react';
import { StatusBadge } from './StatusBadge';
import { ExplanationPanel } from './ExplanationPanel';
import { SafetyDecision, RecommendationType } from '@/lib/reputation/types';

export interface SafetyStatusCardProps {
  decision: SafetyDecision;
}

export const SafetyStatusCard: React.FC<SafetyStatusCardProps> = ({ decision }) => {
  const { recommendation, reasons } = decision;

  const getStatusConfig = () => {
    switch (recommendation) {
      case RecommendationType.SAFE:
      case RecommendationType.AUTO_RESUME_ALLOWED:
        return { label: 'Protected', status: 'ACTIVE' as const, title: 'Sender Reputation Safe' };
      case RecommendationType.THROTTLE:
        return { label: 'Throttled', status: 'WARNING' as const, title: 'Delivery Throttled' };
      case RecommendationType.PAUSE:
      case RecommendationType.REMAIN_PAUSED:
        return { label: 'Paused', status: 'PAUSED' as const, title: 'Campaign Paused' };
      case RecommendationType.MANUAL_REVIEW:
        return { label: 'Review Required', status: 'WARNING' as const, title: 'Manual Review Needed' };
      default:
        return { label: 'Unknown', status: 'NEUTRAL' as const, title: 'Safety Monitoring' };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900">{config.title}</h3>
        <StatusBadge status={config.status} label={config.label} />
      </div>
      
      <p className="text-sm text-gray-500">
        The Safety Engine is actively monitoring deliverability health to protect your domain reputation.
      </p>

      <ExplanationPanel reasons={reasons} />
    </div>
  );
};

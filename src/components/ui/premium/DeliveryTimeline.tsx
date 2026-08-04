import React from 'react';

export interface TimelineEvent {
  id: string;
  time: string;
  title: string;
  description: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING';
}

export interface DeliveryTimelineProps {
  events: ReadonlyArray<TimelineEvent>;
}

export const DeliveryTimeline: React.FC<DeliveryTimelineProps> = ({ events }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Delivery Timeline</h3>
      <div className="relative border-l border-gray-200 ml-3 space-y-6">
        {events.map((event) => (
          <div key={event.id} className="relative pl-6">
            <span 
              className={`absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white ${
                event.status === 'COMPLETED' ? 'bg-green-500' :
                event.status === 'IN_PROGRESS' ? 'bg-blue-500 animate-pulse' :
                'bg-gray-300'
              }`} 
              aria-hidden="true" 
            />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{event.time}</span>
              <span className="text-sm font-medium text-gray-900 mt-0.5">{event.title}</span>
              <span className="text-sm text-gray-500 mt-1">{event.description}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

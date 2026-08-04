import React from "react";
import { SectionContainer } from "@/components/admin/ui/SectionContainer";
import { MetricCard } from "@/components/admin/ui/MetricCard";
import { DollarSign, TrendingUp, Users, UserCheck } from "lucide-react";

interface RevenuePlaceholderProps {
  isLoading?: boolean;
}

export function RevenuePlaceholder({ isLoading }: RevenuePlaceholderProps) {
  return (
    <SectionContainer 
      title="Revenue & Growth (Preview)" 
      description="Architectural placeholder for future billing and subscription analytics integration."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 opacity-75 grayscale hover:grayscale-0 transition-all">
        <MetricCard
          title="Monthly Recurring Revenue"
          value="$0.00"
          secondaryValue="Awaiting Stripe Integration"
          icon={<DollarSign className="h-5 w-5" />}
          isLoading={isLoading}
        />
        <MetricCard
          title="Annual Run Rate"
          value="$0.00"
          secondaryValue="Awaiting Stripe Integration"
          icon={<TrendingUp className="h-5 w-5" />}
          isLoading={isLoading}
        />
        <MetricCard
          title="Trial Users"
          value="0"
          icon={<Users className="h-5 w-5" />}
          isLoading={isLoading}
        />
        <MetricCard
          title="Pro Users"
          value="0"
          icon={<UserCheck className="h-5 w-5" />}
          isLoading={isLoading}
        />
      </div>
    </SectionContainer>
  );
}

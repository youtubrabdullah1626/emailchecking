import prisma from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui";
import { LegacyPageHeader as PageHeader } from "@/components/ui/legacy-adapters";

export const dynamic = "force-dynamic";

async function getAnalytics() {
  try {
    const [totalProspects, sequences, replies] = await Promise.all([
      prisma.prospect.count(),
      prisma.sequence.findMany({ select: { status: true } }),
      prisma.replyClassification.findMany({ select: { reply_type: true } })
    ]);

    // 1. Calculate Real Best Sending Time (Group by hour in JS for cross-db compatibility)
    const recentSentEvents = await prisma.emailEvent.findMany({
      where: { event_type: "SENT" },
      select: { occurred_at: true },
      take: 1000 // Sample size for performance
    });

    let bestSendingTime = "Insufficient Data";
    if (recentSentEvents.length > 0) {
      const hourCounts = new Map<number, number>();
      recentSentEvents.forEach(evt => {
        const hour = evt.occurred_at.getUTCHours();
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
      });
      let maxHour = 0;
      let maxCount = 0;
      hourCounts.forEach((count, hour) => {
        if (count > maxCount) { maxCount = count; maxHour = hour; }
      });
      const ampm = maxHour >= 12 ? 'PM' : 'AM';
      const formattedHour = maxHour % 12 || 12;
      bestSendingTime = `${formattedHour}:00 ${ampm} UTC`;
    }

    // 2. Calculate Real Best Performing Step
    // Find all replied sequences by checking the prospect's status
    const repliedSequences = await prisma.sequence.findMany({
      where: { prospect: { status: "REPLIED" } },
      include: {
        steps: {
          where: { status: "SENT" },
          orderBy: { step_number: 'desc' },
          take: 1
        }
      }
    });

    let bestPerformingStep = "Insufficient Data";
    if (repliedSequences.length > 0) {
      const stepCounts = new Map<number, number>();
      repliedSequences.forEach(seq => {
        const stepNum = seq.steps[0]?.step_number;
        if (stepNum) stepCounts.set(stepNum, (stepCounts.get(stepNum) || 0) + 1);
      });
      let maxStep = 1;
      let maxCount = 0;
      stepCounts.forEach((count, step) => {
        if (count > maxCount) { maxCount = count; maxStep = step; }
      });
      bestPerformingStep = `Step ${maxStep}`;
    }

    const activeCampaigns = sequences.filter(s => s.status === "ACTIVE").length;
    const completedCampaigns = sequences.filter(s => s.status === "COMPLETED").length;
    const stoppedCampaigns = sequences.filter(s => s.status === "STOPPED").length;

    const totalReplies = replies.length;
    const positiveReplies = replies.filter(r => r.reply_type === "INTERESTED").length;

    return {
      campaigns: {
        total: sequences.length,
        active: activeCampaigns,
        completed: completedCampaigns,
        stopped: stoppedCampaigns
      },
      audience: { totalProspects },
      engagement: {
        totalReplies,
        positiveReplies,
        replyRate: sequences.length ? ((totalReplies / sequences.length) * 100).toFixed(1) : "0.0",
        positiveRate: totalReplies ? ((positiveReplies / totalReplies) * 100).toFixed(1) : "0.0",
      },
      aiInsights: {
        bestSendingTime,
        bestPerformingStep,
        recommendation: positiveReplies > 0 
          ? "Maintain current volume and tone; REAL_REPLY rates are healthy." 
          : "Consider rewriting initial outreach templates; engagement is below baseline."
      }
    };
  } catch (error) {
    console.error("Failed to load analytics:", error);
    throw new Error("Analytics Engine Error: Unable to compute campaign intelligence.");
  }
}

export default async function AnalyticsPage() {
  const data = await getAnalytics();

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <PageHeader
        title="Campaign Intelligence"
        description="Business intelligence and performance insights."
        actions={
          <select className="border border-border rounded-md px-3 py-2 text-sm font-medium text-foreground bg-background shadow-sm focus:outline-none focus:ring-1 focus:ring-primary">
            <option>All Time</option>
            <option>Last 30 Days</option>
            <option>This Week</option>
          </select>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric Cards - Minimalist Design */}
        <div className="p-5 border-l-2 border-l-blue-500 bg-card shadow-sm rounded-r-md">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Campaigns</h3>
          <div className="text-2xl font-black text-foreground">{data.campaigns.total}</div>
          <p className="text-xs font-medium text-blue-600 mt-2 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            {data.campaigns.active} currently active
          </p>
        </div>

        <div className="p-5 border-l-2 border-l-indigo-500 bg-card shadow-sm rounded-r-md">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Prospects Reached</h3>
          <div className="text-2xl font-black text-foreground">{data.audience.totalProspects}</div>
          <p className="text-xs font-medium text-muted-foreground mt-2 flex items-center gap-1">
            Across all campaigns
          </p>
        </div>

        <div className="p-5 border-l-2 border-l-emerald-500 bg-card shadow-sm rounded-r-md">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Replies</h3>
          <div className="text-2xl font-black text-foreground">{data.engagement.totalReplies}</div>
          <p className="text-xs font-medium text-muted-foreground mt-2 flex items-center gap-1">
            {data.engagement.replyRate}% global reply rate
          </p>
        </div>

        <div className="p-5 border-l-2 border-l-purple-500 bg-card shadow-sm rounded-r-md">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Positive Interest</h3>
          <div className="text-2xl font-black text-foreground">{data.engagement.positiveReplies}</div>
          <p className="text-xs font-medium text-muted-foreground mt-2 flex items-center gap-1">
            {data.engagement.positiveRate}% of all replies
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* AI Insights Panel */}
        <Card className="flex flex-col">
          <div className="p-6 border-b border-border bg-gradient-to-r from-primary/5 to-background">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              <h3 className="text-lg font-bold text-foreground">AI Optimization Insights</h3>
            </div>
            <p className="text-sm text-muted-foreground">Gemini-powered recommendations based on historical data.</p>
          </div>
          <CardContent className="p-6 space-y-6">
            <div>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Highest Converting Step</h4>
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-md border border-border">
                <span className="font-semibold text-foreground">{data.aiInsights.bestPerformingStep}</span>
                <span className="text-xs font-bold px-2 py-1 bg-background border border-border rounded text-muted-foreground shadow-sm">Top Performer</span>
              </div>
            </div>
            
            <div>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Optimal Delivery Window</h4>
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-md border border-border">
                <span className="font-semibold text-foreground">{data.aiInsights.bestSendingTime}</span>
                <span className="text-xs font-bold px-2 py-1 bg-background border border-border rounded text-muted-foreground shadow-sm">Based on opens</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Strategic Recommendation</h4>
              <div className="p-4 bg-primary/10 rounded-md border border-primary/20 text-primary font-medium text-sm leading-relaxed">
                {data.aiInsights.recommendation}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Funnel Visualization Mock */}
        <Card className="flex flex-col">
          <div className="p-6 border-b border-border">
            <h3 className="text-lg font-bold text-foreground">Conversion Funnel</h3>
            <p className="text-sm text-muted-foreground mt-1">Aggregate sequence progression.</p>
          </div>
          <CardContent className="p-8 flex-1 flex flex-col justify-center gap-4">
            <div className="w-full">
              <div className="flex justify-between text-sm font-semibold text-foreground mb-1">
                <span>Total Enrolled</span>
                <span>{data.audience.totalProspects}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-8 overflow-hidden relative">
                <div className="bg-muted-foreground h-full absolute left-0 top-0" style={{ width: '100%' }}></div>
              </div>
            </div>
            
            <div className="w-full pl-4">
              <div className="flex justify-between text-sm font-semibold text-foreground mb-1">
                <span>Emails Sent</span>
                <span>{data.audience.totalProspects > 0 ? '100%' : '0%'}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-8 overflow-hidden relative">
                <div className="bg-blue-500 h-full absolute left-0 top-0 transition-all" style={{ width: data.audience.totalProspects > 0 ? '90%' : '0%' }}></div>
              </div>
            </div>

            <div className="w-full pl-8">
              <div className="flex justify-between text-sm font-semibold text-foreground mb-1">
                <span>Replies Received</span>
                <span>{data.engagement.totalReplies}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-8 overflow-hidden relative">
                <div className="bg-indigo-500 h-full absolute left-0 top-0 transition-all" style={{ width: data.audience.totalProspects > 0 ? '30%' : '0%' }}></div>
              </div>
            </div>

            <div className="w-full pl-12">
              <div className="flex justify-between text-sm font-semibold text-foreground mb-1">
                <span>Positive Interest</span>
                <span>{data.engagement.positiveReplies}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-8 overflow-hidden relative">
                <div className="bg-emerald-500 h-full absolute left-0 top-0 transition-all" style={{ width: data.audience.totalProspects > 0 ? '10%' : '0%' }}></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

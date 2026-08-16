"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { 
  Star, 
  MessageSquareHeart, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Filter, 
  Search, 
  Mail, 
  AlertCircle, 
  TrendingUp, 
  ShieldCheck, 
  Trash2, 
  Edit3, 
  Rocket, 
  Layout, 
  Lightbulb, 
  Bug, 
  Heart,
  Globe
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AnimatedPage } from "@/components/ui/animated";

interface FeedbackUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  timezone: string;
  createdAt: string;
}

interface FeedbackItem {
  id: string;
  user_id: string;
  rating: number;
  sentiment: string;
  category: string | null;
  comment: string | null;
  page_url: string | null;
  status: string;
  founder_notes: string | null;
  created_at: string;
  users: FeedbackUser;
}

interface FeedbackMetrics {
  totalFeedbacks: number;
  averageRating: number;
  csatPercentage: number;
  newCount: number;
  reviewedCount: number;
  actionedCount: number;
  starDistribution: Record<number, number>;
  categoryDistribution: Record<string, number>;
}

export default function AdminFeedbackPage() {
  const [ratingFilter, setRatingFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesText, setNotesText] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const queryParams = new URLSearchParams();
  if (ratingFilter !== "ALL") queryParams.set("rating", ratingFilter);
  if (statusFilter !== "ALL") queryParams.set("status", statusFilter);
  if (searchQuery.trim()) queryParams.set("search", searchQuery.trim());

  const { data, mutate, isLoading } = useSWR<{
    metrics: FeedbackMetrics;
    feedbacks: FeedbackItem[];
    pagination: { total: number; page: number; totalPages: number };
  }>(`/api/admin/feedback?${queryParams.toString()}`, (url: string) => apiClient<any>(url));

  const metrics = data?.metrics;
  const feedbacks = data?.feedbacks || [];

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast.success(`Feedback marked as ${newStatus.toLowerCase()}`);
      mutate();
    } catch (err) {
      toast.error("Failed to update status");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveNotes = async (id: string) => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ founder_notes: notesText }),
      });
      if (!res.ok) throw new Error("Failed to save founder note");
      toast.success("Founder notes updated");
      setEditingNotesId(null);
      mutate();
    } catch (err) {
      toast.error("Failed to save notes");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteFeedback = async (id: string) => {
    if (!confirm("Are you sure you want to delete this feedback?")) return;
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Feedback deleted");
      mutate();
    } catch (err) {
      toast.error("Failed to delete feedback");
    }
  };

  const renderCategoryIcon = (category: string | null) => {
    switch (category) {
      case "DELIVERABILITY": return <Rocket className="h-3.5 w-3.5 text-blue-500" />;
      case "UI_UX": return <Layout className="h-3.5 w-3.5 text-purple-500" />;
      case "SCHEDULER": return <Clock className="h-3.5 w-3.5 text-emerald-500" />;
      case "FEATURE_REQUEST": return <Lightbulb className="h-3.5 w-3.5 text-amber-500" />;
      case "BUG": return <Bug className="h-3.5 w-3.5 text-red-500" />;
      default: return <Heart className="h-3.5 w-3.5 text-pink-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Signature Silaer Dynamic Header Banner */}
      <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-card border border-primary/20 rounded-2xl p-5 md:p-6 shadow-xs relative overflow-hidden transition-colors duration-300">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0 border border-primary/25 shadow-xs">
              <MessageSquareHeart className="h-5 w-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Customer Feedback & CSAT Intelligence
                </h1>
              </div>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                Real-time user satisfaction metrics, ratings, feature suggestions, and feedback responses.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
            <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-card border border-border text-foreground shadow-2xs flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> CSAT Live Analytics
            </span>
          </div>
        </div>
      </div>

        {/* 4 Executive Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Average Rating Card */}
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider">Average CSAT Rating</CardDescription>
              <CardTitle className="text-3xl font-extrabold flex items-center gap-2">
                {metrics ? metrics.averageRating.toFixed(1) : "5.0"}
                <span className="text-amber-400 text-2xl">★</span>
                <span className="text-xs text-muted-foreground font-normal">/ 5.0</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground flex items-center justify-between">
                <span>Positive Sentiment:</span>
                <strong className="text-emerald-600 font-bold">{metrics ? metrics.csatPercentage : 100}%</strong>
              </div>
            </CardContent>
          </Card>

          {/* Total Reviews Card */}
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider">Total Submissions</CardDescription>
              <CardTitle className="text-3xl font-extrabold text-foreground">
                {metrics ? metrics.totalFeedbacks : 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground flex items-center justify-between">
                <span>5-Star Feedbacks:</span>
                <strong className="text-foreground font-bold">{metrics?.starDistribution[5] || 0}</strong>
              </div>
            </CardContent>
          </Card>

          {/* New / Pending Action Card */}
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider">New Feedbacks</CardDescription>
              <CardTitle className="text-3xl font-extrabold text-blue-600">
                {metrics ? metrics.newCount : 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground flex items-center justify-between">
                <span>Awaiting review:</span>
                <strong className="text-blue-600 font-bold">{metrics?.newCount || 0} unread</strong>
              </div>
            </CardContent>
          </Card>

          {/* Actioned / Resolved Card */}
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider">Actioned / Resolved</CardDescription>
              <CardTitle className="text-3xl font-extrabold text-emerald-600">
                {metrics ? metrics.actionedCount : 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground flex items-center justify-between">
                <span>Reviewed:</span>
                <strong className="text-foreground font-bold">{metrics?.reviewedCount || 0}</strong>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Star Rating Breakdown Bar Chart */}
        {metrics && metrics.totalFeedbacks > 0 && (
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500 fill-amber-400" /> Star Rating Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = metrics.starDistribution[stars] || 0;
                const percentage = metrics.totalFeedbacks > 0 ? Math.round((count / metrics.totalFeedbacks) * 100) : 0;
                return (
                  <div key={stars} className="flex items-center gap-3 text-xs">
                    <span className="w-12 font-semibold flex items-center gap-1 text-muted-foreground">
                      {stars} <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    </span>
                    <Progress value={percentage} className="h-2 flex-1 [&>div]:bg-amber-400 bg-muted" />
                    <span className="w-16 text-right text-muted-foreground font-mono">
                      {count} ({percentage}%)
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Feedbacks Stream & Filter Bar */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card p-4 rounded-xl border border-border">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by user email, name, or comment..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs bg-background"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
                className="text-xs bg-background border border-border rounded-lg px-2.5 py-2 font-medium"
              >
                <option value="ALL">All Ratings</option>
                <option value="5">5 Stars ★</option>
                <option value="4">4 Stars ★</option>
                <option value="3">3 Stars ★</option>
                <option value="2">2 Stars ★</option>
                <option value="1">1 Star ★</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-background border border-border rounded-lg px-2.5 py-2 font-medium"
              >
                <option value="ALL">All Statuses</option>
                <option value="NEW">New (Unreviewed)</option>
                <option value="REVIEWED">Reviewed</option>
                <option value="ACTIONED">Actioned / Done</option>
              </select>
            </div>
          </div>

          {/* Feedback Items List */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />
              ))}
            </div>
          ) : feedbacks.length === 0 ? (
            <div className="p-12 text-center bg-card rounded-xl border border-border space-y-3">
              <MessageSquareHeart className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <h3 className="text-base font-bold text-foreground">No feedbacks found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No user feedback matching your current filters. Users can submit ratings anytime using the feedback button.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {feedbacks.map((item) => (
                <Card key={item.id} className="shadow-xs border-border overflow-hidden transition-all hover:shadow-sm">
                  <CardContent className="p-5 space-y-4">
                    {/* Top Row: User details & Stars */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-border">
                          {item.users.image && <AvatarImage src={item.users.image} alt={item.users.name || "User"} />}
                          <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                            {item.users.name ? item.users.name.slice(0, 2).toUpperCase() : item.users.email.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">{item.users.name || "Anonymous User"}</span>
                            <span className="text-xs text-muted-foreground">({item.users.email})</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-1">
                              <Globe className="h-3 w-3" /> {item.users.timezone || "UTC"}
                            </span>
                            <span>•</span>
                            <span>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
                            {item.page_url && (
                              <>
                                <span>•</span>
                                <span className="bg-muted px-1.5 py-0.2 rounded font-mono text-[10px]">
                                  {item.page_url}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Stars & Category Tag */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-md">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={cn(
                                "h-3.5 w-3.5",
                                s <= item.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30 fill-transparent"
                              )}
                            />
                          ))}
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 ml-1">{item.rating}.0</span>
                        </div>

                        {item.category && (
                          <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-muted text-foreground border border-border flex items-center gap-1.5">
                            {renderCategoryIcon(item.category)}
                            {item.category.replace("_", " ")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Feedback Comment Text */}
                    {item.comment ? (
                      <div className="p-3.5 rounded-lg bg-muted/40 border border-border/50 text-sm text-foreground leading-relaxed">
                        &ldquo;{item.comment}&rdquo;
                      </div>
                    ) : (
                      <div className="text-xs italic text-muted-foreground">
                        User rated {item.rating} stars without written comments.
                      </div>
                    )}

                    {/* Founder Notes Section */}
                    {editingNotesId === item.id ? (
                      <div className="space-y-2 p-3 bg-muted/30 rounded-lg border border-border">
                        <label className="text-xs font-semibold text-muted-foreground">Internal Founder Notes</label>
                        <Input
                          placeholder="Add internal notes about this user or action taken..."
                          value={notesText}
                          onChange={(e) => setNotesText(e.target.value)}
                          className="text-xs bg-background"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setEditingNotesId(null)} className="text-xs">
                            Cancel
                          </Button>
                          <Button size="sm" onClick={() => handleSaveNotes(item.id)} disabled={isUpdating} className="text-xs">
                            Save Note
                          </Button>
                        </div>
                      </div>
                    ) : item.founder_notes ? (
                      <div className="flex items-center justify-between p-2.5 bg-primary/5 rounded-lg border border-primary/10 text-xs text-foreground">
                        <span><strong>Founder Note:</strong> {item.founder_notes}</span>
                        <button
                          onClick={() => {
                            setEditingNotesId(item.id);
                            setNotesText(item.founder_notes || "");
                          }}
                          className="text-primary hover:underline text-[11px] font-semibold"
                        >
                          Edit
                        </button>
                      </div>
                    ) : null}

                    {/* Actions Row */}
                    <div className="pt-2 border-t border-border/40 flex flex-wrap items-center justify-between gap-2 text-xs">
                      {/* Status Badges & Quick Action */}
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[11px] font-bold border",
                          item.status === "NEW" ? "bg-blue-500/10 text-blue-600 border-blue-500/20" :
                          item.status === "REVIEWED" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                          "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        )}>
                          {item.status}
                        </span>

                        {item.status === "NEW" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateStatus(item.id, "REVIEWED")}
                            disabled={isUpdating}
                            className="h-7 text-xs"
                          >
                            Mark Reviewed
                          </Button>
                        )}

                        {item.status !== "ACTIONED" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateStatus(item.id, "ACTIONED")}
                            disabled={isUpdating}
                            className="h-7 text-xs text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Actioned
                          </Button>
                        )}
                      </div>

                      {/* Founder Direct Shortcuts */}
                      <div className="flex items-center gap-2">
                        {!item.founder_notes && editingNotesId !== item.id && (
                          <button
                            onClick={() => {
                              setEditingNotesId(item.id);
                              setNotesText("");
                            }}
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium transition-colors"
                          >
                            <Edit3 className="h-3 w-3" /> Add Note
                          </button>
                        )}

                        <a
                          href={`mailto:${item.users.email}?subject=Thank%20you%20for%20your%20feedback%20on%20Silaer&body=Hi%20${encodeURIComponent(item.users.name || "there")},%0A%0AThank%20you%20so%20much%20for%20your%20${item.rating}-star%20review%20and%20helpful%20feedback!`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-xs transition-colors"
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Mail className="h-3 w-3" /> Reply via Email
                        </a>

                        <button
                          onClick={() => handleDeleteFeedback(item.id)}
                          className="p-1 text-muted-foreground hover:text-red-600 transition-colors"
                          title="Delete feedback"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
    </div>
  );
}

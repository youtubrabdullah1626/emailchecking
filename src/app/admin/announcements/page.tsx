"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { AnimatedPage } from "@/components/ui/animated";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Megaphone, Trash2, Rocket, AlertTriangle, Info, Send, Clock, EyeOff, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export default function AnnouncementsAdminPage() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("INFO");
  const [link, setLink] = useState("");

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch("/api/admin/announcements");
      const data = await res.json();
      setAnnouncements(data.announcements || []);
    } catch (e) {
      toast.error("Failed to load announcements");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handlePublish = async () => {
    if (!title || !message) {
      toast.error("Title and message are required.");
      return;
    }
    
    setIsPublishing(true);
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message, type, link })
      });

      if (!res.ok) throw new Error("Failed to publish");
      
      toast.success("Announcement published instantly to all users! 🚀");
      setTitle("");
      setMessage("");
      setLink("");
      fetchAnnouncements();
    } catch (e) {
      toast.error("Error publishing announcement.");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    // Optimistic UI Update
    setAnnouncements(prev => prev.map(ann => ann.id === id ? { ...ann, isActive: !currentStatus } : ann));
    
    try {
      const res = await fetch(`/api/admin/announcements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus })
      });
      if (!res.ok) throw new Error();
      toast.success(currentStatus ? "Announcement hidden from users." : "Announcement is now live.");
    } catch (e) {
      // Revert on failure
      setAnnouncements(prev => prev.map(ann => ann.id === id ? { ...ann, isActive: currentStatus } : ann));
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this announcement?")) return;
    
    // Store previous state for rollback
    const previousAnnouncements = [...announcements];
    
    // Optimistic UI Update
    setAnnouncements(prev => prev.filter(ann => ann.id !== id));
    
    try {
      const res = await fetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Announcement deleted.");
    } catch (e) {
      // Revert on failure
      setAnnouncements(previousAnnouncements);
      toast.error("Failed to delete");
    }
  };

  const getTypeIcon = (t: string) => {
    switch (t.toUpperCase()) {
      case 'FEATURE': return <Rocket className="h-4 w-4 text-purple-500" />;
      case 'WARNING': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <div className="flex-1 p-8 pt-6">
      <AnimatedPage className="space-y-8">
        <PageHeader 
          title="Broadcasting Studio" 
          description="Create and publish global announcements directly to the user notification tray."
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT: Composer */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="border-border shadow-md overflow-hidden bg-gradient-to-b from-card to-background">
              <div className="bg-primary/5 p-4 border-b border-border flex items-center gap-3">
                <div className="bg-primary/20 p-2 rounded-md text-primary">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Draft Announcement</h3>
                  <p className="text-xs text-muted-foreground">It will go live instantly when published.</p>
                </div>
              </div>
              <CardContent className="p-6 space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Announcement Type</label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FEATURE"><div className="flex items-center gap-2"><Rocket className="h-4 w-4 text-purple-500" /> Feature Launch</div></SelectItem>
                      <SelectItem value="INFO"><div className="flex items-center gap-2"><Info className="h-4 w-4 text-blue-500" /> General Info</div></SelectItem>
                      <SelectItem value="WARNING"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-orange-500" /> Maintenance / Warning</div></SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Headline / Title</label>
                  <Input 
                    placeholder="e.g. 🚀 The new Analytics Engine is here!" 
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                    className="font-medium"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Message Body</label>
                  <Textarea 
                    placeholder="Briefly explain the update or news to your users..." 
                    className="min-h-[120px] resize-none"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Call to Action Link (Optional)</label>
                  <Input 
                    placeholder="https://..." 
                    value={link} 
                    onChange={e => setLink(e.target.value)} 
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">If provided, the entire notification will be clickable.</p>
                </div>

                <Button 
                  onClick={handlePublish} 
                  disabled={isPublishing || !title || !message} 
                  className="w-full h-11 text-base font-semibold shadow-sm transition-all hover:scale-[1.02]"
                >
                  {isPublishing ? "Publishing..." : <><Send className="mr-2 h-4 w-4" /> Publish Now</>}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: History */}
          <div className="lg:col-span-7">
            <Card className="border-border shadow-sm h-full">
              <CardHeader className="border-b border-border bg-muted/20 pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-muted-foreground" /> 
                  Broadcast History
                </CardTitle>
                <CardDescription>Manage your active and past announcements here.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-8 text-center text-muted-foreground animate-pulse">Loading broadcast history...</div>
                ) : announcements.length === 0 ? (
                  <div className="p-12 text-center flex flex-col items-center justify-center border-dashed border-2 border-border/50 mx-6 my-6 rounded-lg">
                    <Megaphone className="h-10 w-10 text-muted-foreground mb-3 opacity-20" />
                    <h3 className="text-lg font-medium text-muted-foreground">No announcements yet</h3>
                    <p className="text-sm text-muted-foreground mt-1">Your published announcements will appear here.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {announcements.map((ann) => (
                      <div key={ann.id} className={cn("p-5 flex items-start justify-between gap-4 transition-colors hover:bg-muted/10", !ann.isActive && "opacity-60 grayscale-[50%]")}>
                        <div className="flex gap-4 flex-1">
                          <div className="mt-1 bg-background border border-border shadow-sm h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0">
                            {getTypeIcon(ann.type)}
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground text-base leading-snug mb-1">{ann.title}</h4>
                            <p className="text-sm text-muted-foreground leading-relaxed max-w-[90%]">{ann.message}</p>
                            
                            <div className="flex items-center gap-3 mt-3 text-xs font-medium text-muted-foreground">
                              <span>Published {formatDistanceToNow(new Date(ann.createdAt), { addSuffix: true })}</span>
                              <span className="w-1 h-1 rounded-full bg-border"></span>
                              <span className={cn(ann.isActive ? "text-emerald-500" : "text-muted-foreground")}>
                                {ann.isActive ? 'Live' : 'Hidden'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-3 flex-shrink-0">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {ann.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                            <Switch 
                              checked={ann.isActive} 
                              onCheckedChange={() => handleToggleStatus(ann.id, ann.isActive)} 
                            />
                          </div>
                          
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDelete(ann.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2"
                          >
                            <Trash2 className="h-4 w-4 mr-1" /> Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
        </div>
      </AnimatedPage>
    </div>
  );
}

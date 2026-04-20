import { format, formatDistance } from "date-fns";
import {
  AlertTriangle,
  Building2,
  Calendar,
  MapPin,
  Tag,
  User,
  MessageSquare,
  Send,
  Bot,
  ShieldCheck,
  UserCircle,
  StickyNote,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useDataProvider } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Report, ReportComment } from "./report";
import {
  findPriorityColor,
  findStatusColor,
  findStatusLabel,
  findCategoryLabel,
  REPORT_STATUSES,
  REPORT_PRIORITIES,
} from "./report";
import { supabase } from "../providers/supabase/supabase";

export const ReportShow = ({
  report,
  open,
  onClose,
  onStatusChange,
}: {
  report: Report | null;
  open: boolean;
  onClose: () => void;
  onStatusChange?: (reportId: string, newStatus: string) => void;
}) => {
  const dataProvider = useDataProvider();
  const [comments, setComments] = useState<ReportComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [changingPriority, setChangingPriority] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(report?.workflow_status ?? "new");
  const [currentPriority, setCurrentPriority] = useState(report?.priority ?? "medium");
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Sync local state when a different report is opened
  useEffect(() => {
    if (report && open) {
      loadComments(String(report.id));
      setAdminNotes(report.admin_notes || "");
      setCurrentStatus(report.workflow_status);
      setCurrentPriority(report.priority || "medium");
    }
  }, [report, open]);

  // Scroll to bottom of comments when new ones are loaded
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  const loadComments = async (reportId: string) => {
    setLoadingComments(true);
    try {
      const { data, error } = await supabase
        .from("comments")
        .select(
          "*, user:users!comments_user_id_fkey(id, username, full_name, avatar_url)",
        )
        .eq("report_id", reportId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading comments:", error);
      } else {
        setComments(data || []);
      }
    } catch (err) {
      console.error("Error loading comments:", err);
    } finally {
      setLoadingComments(false);
    }
  };

  const submitComment = async () => {
    if (!report || !newComment.trim()) return;
    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("comments").insert({
        report_id: report.id,
        user_id: user.id,
        content: newComment.trim(),
        is_system: false,
        is_admin: true,
        author_role: "admin",
      });

      if (error) throw error;

      setNewComment("");
      loadComments(String(report.id));
    } catch (err) {
      console.error("Error submitting comment:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!report || changingStatus) return;
    setChangingStatus(true);
    setCurrentStatus(newStatus);
    try {
      await dataProvider.update("reports", {
        id: report.id,
        data: {
          admin_status: newStatus,
          updated_at: new Date().toISOString(),
        },
        previousData: report,
      });
      onStatusChange?.(String(report.id), newStatus);
    } catch (err) {
      console.error("Error changing status:", err);
      setCurrentStatus(report.workflow_status);
    } finally {
      setChangingStatus(false);
    }
  };

  const handlePriorityChange = async (newPriority: string) => {
    if (!report || changingPriority) return;
    setChangingPriority(true);
    setCurrentPriority(newPriority);
    try {
      await dataProvider.update("reports", {
        id: report.id,
        data: {
          priority: newPriority,
          updated_at: new Date().toISOString(),
        },
        previousData: report,
      });
    } catch (err) {
      console.error("Error changing priority:", err);
      setCurrentPriority(report.priority || "medium");
    } finally {
      setChangingPriority(false);
    }
  };

  const saveAdminNotes = async () => {
    if (!report) return;
    setSavingNotes(true);
    try {
      await dataProvider.update("reports", {
        id: report.id,
        data: {
          admin_notes: adminNotes,
          updated_at: new Date().toISOString(),
        },
        previousData: report,
      });
    } catch (err) {
      console.error("Error saving admin notes:", err);
    } finally {
      setSavingNotes(false);
    }
  };

  if (!report) return null;

  const statusColor = findStatusColor(currentStatus);
  const priorityColor = findPriorityColor(currentPriority);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:w-auto lg:max-w-3xl p-4 sm:p-6 overflow-y-auto max-h-[90dvh]">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">{report.title}</DialogTitle>
        </DialogHeader>

        {/* On mobile: admin actions first as compact inline row, then details below */}
        <div className="flex flex-wrap items-center gap-2 lg:hidden mb-2">
          <Select
            value={currentStatus}
            onValueChange={handleStatusChange}
            disabled={changingStatus}
          >
            <SelectTrigger className="w-auto min-w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORT_STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: status.color }}
                    />
                    {status.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={currentPriority}
            onValueChange={handlePriorityChange}
            disabled={changingPriority}
          >
            <SelectTrigger className="w-auto min-w-[120px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORT_PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    {p.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left column: Report details */}
          <div className="lg:col-span-2 space-y-4">
            {/* Status and Priority badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                style={{
                  backgroundColor: `${statusColor}20`,
                  color: statusColor,
                  borderColor: statusColor,
                }}
                variant="outline"
              >
                {findStatusLabel(currentStatus)}
              </Badge>
              {report.priority && (
                <Badge
                  style={{
                    backgroundColor: `${priorityColor}20`,
                    color: priorityColor,
                    borderColor: priorityColor,
                  }}
                  variant="outline"
                >
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {report.priority.charAt(0).toUpperCase() +
                    report.priority.slice(1)}
                </Badge>
              )}
              {report.report_type && (
                <Badge variant="secondary">
                  {report.report_type === "indoor" ? (
                    <Building2 className="w-3 h-3 mr-1" />
                  ) : (
                    <MapPin className="w-3 h-3 mr-1" />
                  )}
                  {report.report_type.charAt(0).toUpperCase() +
                    report.report_type.slice(1)}
                </Badge>
              )}
            </div>

            <Separator />

            {/* Details grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {report.category && (
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground tracking-wide flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Category
                  </span>
                  <span className="text-sm font-medium">
                    {findCategoryLabel(report.category)}
                  </span>
                </div>
              )}

              {report.reporter_name && (
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground tracking-wide flex items-center gap-1">
                    <User className="w-3 h-3" /> Reporter
                  </span>
                  <span className="text-sm font-medium">
                    {report.reporter_name}
                  </span>
                </div>
              )}

              {report.created_at && (
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground tracking-wide flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Reported
                  </span>
                  <span className="text-sm">
                    {format(new Date(report.created_at), "PPp")}
                  </span>
                </div>
              )}

              {report.location_description && (
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground tracking-wide flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Address
                  </span>
                  <span className="text-sm">
                    {report.location_description}
                  </span>
                </div>
              )}
            </div>

            {/* Description */}
            {report.description && (
              <>
                <Separator />
                <div>
                  <span className="text-xs text-muted-foreground tracking-wide">
                    Description
                  </span>
                  <p className="text-sm leading-6 mt-1 whitespace-pre-line">
                    {report.description}
                  </p>
                </div>
              </>
            )}

            {/* AI Classification */}
            {report.ai_suggested_category && (
              <>
                <Separator />
                <div>
                  <span className="text-xs text-muted-foreground tracking-wide">
                    AI Classification
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-blue-600">
                      {findCategoryLabel(report.ai_suggested_category)}
                    </Badge>
                    {report.ai_category_confidence != null && (
                      <span className="text-xs text-muted-foreground">
                        Confidence:{" "}
                        {Math.round(report.ai_category_confidence * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Images */}
            {report.images && report.images.length > 0 && (
              <>
                <Separator />
                <div>
                  <span className="text-xs text-muted-foreground tracking-wide">
                    Attachments
                  </span>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {report.images.map((img, idx) => (
                      <a
                        key={idx}
                        href={img}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <img
                          src={img}
                          alt={`Attachment ${idx + 1}`}
                          className="w-24 h-24 object-cover rounded border hover:opacity-80 transition-opacity"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Comments Section */}
            <Separator />
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Comments ({comments.length})
                </span>
              </div>

              {/* Comments list */}
              <div className="space-y-3 max-h-[40dvh] sm:max-h-[300px] overflow-y-auto pr-1 -mx-1 px-1">
                {loadingComments ? (
                  <p className="text-sm text-muted-foreground">
                    Loading comments...
                  </p>
                ) : comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    No comments yet. Be the first to respond.
                  </p>
                ) : (
                  comments.map((comment) => (
                    <CommentBubble key={comment.id} comment={comment} />
                  ))
                )}
                <div ref={commentsEndRef} />
              </div>

              {/* New comment input */}
              <div className="flex gap-2 mt-3">
                <Textarea
                  placeholder="Write a response to the reporter..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[48px] sm:min-h-[60px] text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      submitComment();
                    }
                  }}
                />
                <Button
                  size="icon"
                  onClick={submitComment}
                  disabled={submitting || !newComment.trim()}
                  className="self-end h-10 w-10 shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 hidden sm:block">
                Press Ctrl+Enter to send. The reporter will be notified.
              </p>
            </div>

            {/* Mobile-only admin notes (below comments) */}
            <div className="lg:hidden">
              <Separator />
              <div className="pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <StickyNote className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground tracking-wide">
                    Internal Notes
                  </span>
                </div>
                <Textarea
                  placeholder="Internal notes (not visible to reporter)..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="min-h-[60px] text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={saveAdminNotes}
                  disabled={savingNotes || adminNotes === (report.admin_notes || "")}
                  className="mt-2 w-full h-10"
                >
                  {savingNotes ? "Saving..." : "Save Notes"}
                </Button>
              </div>
            </div>
          </div>

          {/* Right column: Admin actions — hidden on mobile (status/priority shown inline above) */}
          <div className="hidden lg:block space-y-4">
            {/* Status selector */}
            <div>
              <span className="text-xs text-muted-foreground tracking-wide block mb-2">
                Workflow Status
              </span>
              <Select
                value={currentStatus}
                onValueChange={handleStatusChange}
                disabled={changingStatus}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: status.color }}
                        />
                        {status.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority selector */}
            <div>
              <span className="text-xs text-muted-foreground tracking-wide block mb-2">
                Priority
              </span>
              <Select
                value={currentPriority}
                onValueChange={handlePriorityChange}
                disabled={changingPriority}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        {p.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assigned to */}
            <div>
              <span className="text-xs text-muted-foreground tracking-wide block mb-2">
                Assigned To
              </span>
              <span className="text-sm">
                {report.assigned_to || "Unassigned"}
              </span>
            </div>

            {/* Admin Notes */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <StickyNote className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground tracking-wide">
                  Internal Notes
                </span>
              </div>
              <Textarea
                placeholder="Internal notes (not visible to reporter)..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="min-h-[80px] text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={saveAdminNotes}
                disabled={savingNotes || adminNotes === (report.admin_notes || "")}
                className="mt-2 w-full"
              >
                {savingNotes ? "Saving..." : "Save Notes"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/**
 * A single comment bubble with role-based styling.
 */
const CommentBubble = ({ comment }: { comment: ReportComment }) => {
  const isAdmin = comment.is_admin || comment.author_role === "admin";
  const isSystem = comment.is_system || comment.author_role === "system";
  const authorName = isSystem
    ? "Civisto AI"
    : isAdmin
      ? comment.user?.full_name || comment.user?.username || "Admin"
      : comment.user?.full_name || comment.user?.username || "Reporter";

  const RoleIcon = isSystem ? Bot : isAdmin ? ShieldCheck : UserCircle;
  const roleColor = isSystem
    ? "text-blue-500 dark:text-blue-400"
    : isAdmin
      ? "text-green-600 dark:text-green-400"
      : "text-gray-500 dark:text-gray-400";
  const bgColor = isSystem
    ? "bg-blue-50 border-blue-100 dark:bg-blue-950/40 dark:border-blue-900"
    : isAdmin
      ? "bg-green-50 border-green-100 dark:bg-green-950/40 dark:border-green-900"
      : "bg-gray-50 border-gray-100 dark:bg-gray-800/50 dark:border-gray-700";

  return (
    <div className={`rounded-lg border p-3 ${bgColor}`}>
      <div className="flex items-center gap-2 mb-1">
        <RoleIcon className={`w-3.5 h-3.5 ${roleColor}`} />
        <span className={`text-xs font-medium ${roleColor}`}>{authorName}</span>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {comment.created_at
            ? formatDistance(new Date(comment.created_at), new Date(), {
                addSuffix: true,
              })
            : ""}
        </span>
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-line text-foreground">
        {comment.content}
      </p>
    </div>
  );
};

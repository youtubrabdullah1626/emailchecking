import jsPDF from "jspdf";
import { ClientReportData } from "./types";

function formatTitleCase(str?: string): string {
  if (!str) return "Campaign Report";
  return str
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Generates and downloads a clean vector executive PDF report complete with
 * the full Lead Activity & Telemetry Audit Table.
 */
export function generateDirectClientReportPdf(report: ClientReportData) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Top Silaer Logo Badge
  doc.setFillColor(16, 185, 129); // #10b981
  doc.roundedRect(margin, 14, 7, 7, 1.2, 1.2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("S", margin + 2.2, 19);

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Silaer", margin + 9.5, 18.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Client Campaign Report", margin + 9.5, 22);

  // Top Right: Date Range & Status
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(report.dateRange, pageWidth - margin, 18, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 185, 129);
  doc.text(
    report.status === "ACTIVE" ? "Active Campaign" : "Campaign Finalized",
    pageWidth - margin,
    22,
    { align: "right" }
  );

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.line(margin, 25.5, pageWidth - margin, 25.5);

  // Campaign Title
  let y = 33;
  const formattedTitle = formatTitleCase(report.campaignName);
  const formattedAgency = formatTitleCase(report.agencyName);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(formattedTitle, margin, y);

  // Subtitle
  y += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Campaign managed by ${formattedAgency}`, margin, y);

  // 4 Hero KPI Cards
  y += 6.5;
  const cardWidth = (contentWidth - 9) / 4;
  const cardHeight = 20;

  const kpis = [
    {
      title: "CONTACTED LEADS",
      value: `${report.metrics.totalContacted}`,
      sub: `${report.metrics.deliveryRate}% Delivered`,
    },
    {
      title: "OPENED EMAILS",
      value: `${report.metrics.totalOpened}`,
      sub: `${report.metrics.openRate}% Open Rate`,
    },
    {
      title: "CONFIRMED REPLIES",
      value: `${report.metrics.realReplies}`,
      sub: `${report.metrics.replyRate}% Reply Rate`,
    },
    {
      title: "DOMAIN HEALTH",
      value: `${report.metrics.domainHealth}%`,
      sub: report.metrics.bounces === 0 ? "0 Bounces" : `${report.metrics.bounces} Bounces`,
    },
  ];

  kpis.forEach((kpi, i) => {
    const x = margin + i * (cardWidth + 3);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, cardWidth, cardHeight, 1.5, 1.5, "F");
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, cardWidth, cardHeight, 1.5, 1.5, "S");

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.title, x + 3, y + 5);

    // Big Metric
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(kpi.value, x + 3, y + 11.5);

    // Sub text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(16, 185, 129);
    doc.text(kpi.sub, x + 3, y + 16.5);
  });

  // Outbound Activity & Lead Journey Audit Table Header
  y += cardHeight + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text("Outbound Activity & Lead Journey Audit", margin, y);

  y += 3.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Real-time telemetry recorded across all connected rotating inboxes", margin, y);

  // Table Columns Setup
  y += 3;
  const colX = {
    recipient: margin + 3,
    sender: margin + 48,
    tz: margin + 86,
    dispatched: margin + 118,
    opened: margin + 144,
    status: pageWidth - margin - 3,
  };

  // Table Header Box
  const tableHeaderHeight = 6.5;
  doc.setFillColor(241, 245, 249); // #f1f5f9
  doc.rect(margin, y, contentWidth, tableHeaderHeight, "F");
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y, contentWidth, tableHeaderHeight, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text("RECIPIENT", colX.recipient, y + 4.5);
  doc.text("SENDING INBOX", colX.sender, y + 4.5);
  doc.text("TIMEZONE", colX.tz, y + 4.5);
  doc.text("DISPATCHED", colX.dispatched, y + 4.5);
  doc.text("OPENED", colX.opened, y + 4.5);
  doc.text("STATUS", colX.status, y + 4.5, { align: "right" });

  y += tableHeaderHeight;

  // Table Rows
  const activities = report.leadActivities || [];
  const rowHeight = 7.5;

  activities.forEach((act, idx) => {
    // Alternating row background
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, rowHeight, "F");
    }
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);

    // Recipient
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(act.recipientEmail, colX.recipient, y + 5);

    // Sender
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(act.senderInbox, colX.sender, y + 5);

    // Timezone
    doc.text(act.leadTimezone.replace("_", " "), colX.tz, y + 5);

    // Dispatched
    doc.setTextColor(51, 65, 85);
    doc.text(act.dispatchedAt || "—", colX.dispatched, y + 5);

    // Opened
    doc.text(act.openedAt ? (act.openCount > 1 ? `${act.openedAt} (${act.openCount}x)` : act.openedAt) : "—", colX.opened, y + 5);

    // Status
    doc.setFont("helvetica", "bold");
    if (act.status === "REPLIED") {
      doc.setTextColor(16, 185, 129);
      doc.text("Replied", colX.status, y + 5, { align: "right" });
    } else if (act.status === "OPENED") {
      doc.setTextColor(147, 51, 234);
      doc.text("Opened", colX.status, y + 5, { align: "right" });
    } else if (act.status === "SENT") {
      doc.setTextColor(2, 132, 199);
      doc.text("Delivered", colX.status, y + 5, { align: "right" });
    } else {
      doc.setTextColor(100, 116, 139);
      doc.text("Scheduled", colX.status, y + 5, { align: "right" });
    }

    y += rowHeight;
  });

  // Outer border around table
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y - activities.length * rowHeight - tableHeaderHeight, contentWidth, activities.length * rowHeight + tableHeaderHeight, "S");

  // Summary Takeaways
  y += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text("Campaign Performance Summary", margin, y);

  y += 4;
  report.summaryPoints.forEach((point) => {
    doc.setFillColor(16, 185, 129);
    doc.circle(margin + 1.5, y - 0.8, 0.8, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const splitText = doc.splitTextToSize(point, contentWidth - 7);
    doc.text(splitText, margin + 5, y);
    y += splitText.length * 4 + 2;
  });

  // Footer Section
  const footerY = pageHeight - 14;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(16, 185, 129);
  doc.text("Powered by Silaer", margin, footerY);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 185, 129);
  doc.textWithLink("www.silaer.com", pageWidth - margin, footerY, {
    url: "https://www.silaer.com",
    align: "right",
  });

  const safeFileName = `Silaer_Report_${report.campaignName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
  doc.save(safeFileName);
}

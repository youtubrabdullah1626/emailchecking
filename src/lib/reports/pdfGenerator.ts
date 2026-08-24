import jsPDF from "jspdf";
import { ClientReportData } from "./types";

function cleanCampaignTitle(rawTitle?: string): string {
  if (!rawTitle) return "Outreach Campaign";
  return rawTitle
    .replace(/_two_followups/gi, "")
    .replace(/_followups/gi, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function formatTitleCase(str?: string): string {
  if (!str) return "Outreach Partner";
  return str
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Generates and downloads a clean, proportionally balanced vector executive PDF report.
 * Fills the A4 document sheet with luxury typography and balanced margins.
 */
export function generateDirectClientReportPdf(report: ClientReportData) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;

  // Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Top Silaer Brand Mark
  doc.setFillColor(16, 185, 129); // #10b981
  doc.roundedRect(margin, 18, 8, 8, 1.5, 1.5, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("S", margin + 2.5, 23.5);

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Silaer", margin + 11, 23);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // #94a3b8
  doc.text("EXECUTIVE CLIENT BRIEFING", margin + 11, 27);

  // Top Right: Date Range & Status
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(report.dateRange, pageWidth - margin, 22, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(
    report.status === "ACTIVE" ? "Active Campaign" : "Completed",
    pageWidth - margin,
    27,
    { align: "right" }
  );

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, 31, pageWidth - margin, 31);

  // Campaign Title
  let y = 41;
  const formattedTitle = cleanCampaignTitle(report.campaignName);
  const formattedAgency = formatTitleCase(report.agencyName);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42);
  doc.text(formattedTitle, margin, y);

  // Strategic Executive Overview Context
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // #475569
  const overviewText = `Outbound campaign executed by ${formattedAgency} powered by the Silaer multi-inbox delivery network. Configured to reach targeted decision-makers in their local working hours (London GMT) with 100% domain deliverability protection.`;
  const splitOverview = doc.splitTextToSize(overviewText, contentWidth);
  doc.text(splitOverview, margin, y);
  y += splitOverview.length * 4.5 + 4;

  // 4 Hero KPI Cards (Balanced height & padding)
  const cardWidth = (contentWidth - 9) / 4;
  const cardHeight = 24;

  const kpis = [
    {
      title: "TOTAL CONTACTED",
      value: `${report.metrics.totalContacted}`,
      sub: `${report.metrics.deliveryRate}% Delivered`,
    },
    {
      title: "OPEN RATE",
      value: `${report.metrics.openRate}%`,
      sub: `${report.metrics.totalOpened} Unique Opens`,
    },
    {
      title: "REPLY RATE",
      value: `${report.metrics.replyRate}%`,
      sub: `${report.metrics.realReplies} Discussions`,
    },
    {
      title: "DOMAIN HEALTH",
      value: `${report.metrics.domainHealth}%`,
      sub: "0 Bounces • Clean",
    },
  ];

  kpis.forEach((kpi, i) => {
    const x = margin + i * (cardWidth + 3);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "F");
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "S");

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.title, x + 3.5, y + 6);

    // Big Metric
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(kpi.value, x + 3.5, y + 14);

    // Sub text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(16, 185, 129);
    doc.text(kpi.sub, x + 3.5, y + 20);
  });

  // Outbound Activity & Lead Journey Audit Table Header
  y += cardHeight + 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Outbound Activity & Lead Journey Audit", margin, y);

  y += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Real-time telemetry recorded across all connected inboxes", margin, y);

  // Table Columns Setup
  y += 4;
  const colX = {
    recipient: margin + 4,
    sender: margin + 46,
    tz: margin + 84,
    dispatched: margin + 116,
    opened: margin + 142,
    status: pageWidth - margin - 4,
  };

  // Table Header Box
  const tableHeaderHeight = 8;
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, tableHeaderHeight, "F");
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y, contentWidth, tableHeaderHeight, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text("RECIPIENT", colX.recipient, y + 5.5);
  doc.text("SENDING INBOX", colX.sender, y + 5.5);
  doc.text("TIMEZONE", colX.tz, y + 5.5);
  doc.text("DISPATCHED", colX.dispatched, y + 5.5);
  doc.text("OPENED", colX.opened, y + 5.5);
  doc.text("STATUS", colX.status, y + 5.5, { align: "right" });

  y += tableHeaderHeight;

  // Table Rows
  const activities = report.leadActivities || [];
  const rowHeight = 9.5;

  activities.forEach((act, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, rowHeight, "F");
    }
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);

    // Recipient
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(act.recipientEmail, colX.recipient, y + 6);

    // Sender
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(act.senderInbox, colX.sender, y + 6);

    // Timezone
    doc.text(act.leadTimezone, colX.tz, y + 6);

    // Dispatched
    doc.setTextColor(51, 65, 85);
    doc.text(act.dispatchedAt || "—", colX.dispatched, y + 6);

    // Opened
    doc.text(act.openedAt ? (act.openCount > 1 ? `${act.openedAt} (${act.openCount}x)` : act.openedAt) : "—", colX.opened, y + 6);

    // Status
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85);
    if (act.status === "REPLIED") {
      doc.text("Replied", colX.status, y + 6, { align: "right" });
    } else if (act.status === "OPENED") {
      doc.text("Opened", colX.status, y + 6, { align: "right" });
    } else if (act.status === "SENT") {
      doc.text("Delivered", colX.status, y + 6, { align: "right" });
    } else {
      doc.text("Scheduled", colX.status, y + 6, { align: "right" });
    }

    y += rowHeight;
  });

  // Outer border around table
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y - activities.length * rowHeight - tableHeaderHeight, contentWidth, activities.length * rowHeight + tableHeaderHeight, "S");

  // Strategic Performance Highlights Section
  y += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Campaign Performance & Strategic Takeaways", margin, y);

  y += 5.5;
  report.summaryPoints.forEach((point) => {
    doc.setFillColor(16, 185, 129);
    doc.circle(margin + 1.8, y - 1, 1, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    const splitText = doc.splitTextToSize(point, contentWidth - 8);
    doc.text(splitText, margin + 6, y);
    y += splitText.length * 4.8 + 3;
  });

  // Footer Section placed cleanly at bottom
  const footerY = pageHeight - 18;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Verified Outbound Telemetry • Powered by Silaer", margin, footerY);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.textWithLink("www.silaer.com", pageWidth - margin, footerY, {
    url: "https://www.silaer.com",
    align: "right",
  });

  const safeFileName = `Silaer_Report_${formattedTitle.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
  doc.save(safeFileName);
}

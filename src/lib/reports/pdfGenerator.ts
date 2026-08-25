import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ClientReportData } from "./types";
import { SILAER_LOGO_BASE64 } from "./logoBase64";

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
 * Strips UTF-8 multibyte emojis and normalizes punctuation for standard PDF Helvetica font.
 * Prevents character corruption (e.g. Ø<ß, & j, Ø=Þ€) and guarantees crystal-clear typography.
 */
function cleanPdfText(text: string): string {
  if (!text) return "";
  return text
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{200D}]|[\u{FE0F}]/gu, "")
    .replace(/[\u0080-\uFFFF]/g, (ch) => {
      if (ch === "—" || ch === "–") return " - ";
      if (ch === "•") return " ";
      if (ch === "“" || ch === "”") return '"';
      if (ch === "‘" || ch === "’") return "'";
      if (ch.charCodeAt(0) > 127) return "";
      return ch;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generates and downloads a clean, proportionally balanced vector executive PDF report.
 * Uses autoTable with proportional column widths and anti-collision wrapping.
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
  const contentWidth = pageWidth - margin * 2; // 174mm

  // Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Subtle Diagonal Watermark in Center of Page
  try {
    doc.saveGraphicsState();
    doc.setTextColor(245, 247, 250);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(64);
    doc.text("SILAER", pageWidth / 2, pageHeight / 2 + 10, {
      align: "center",
      angle: 35,
    });
    doc.restoreGraphicsState();
  } catch {
    // Ignore if graphics state is not supported
  }

  // Official Silaer Brand Logo (Inlined Base64)
  try {
    if (SILAER_LOGO_BASE64) {
      doc.addImage(SILAER_LOGO_BASE64, "PNG", margin, 18, 8, 8);
    } else {
      doc.setFillColor(16, 185, 129);
      doc.roundedRect(margin, 18, 8, 8, 1.5, 1.5, "F");
    }
  } catch {
    doc.setFillColor(16, 185, 129);
    doc.roundedRect(margin, 18, 8, 8, 1.5, 1.5, "F");
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Silaer", margin + 11, 24);

  // Top Right: Date Range & Status
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(cleanPdfText(report.dateRange), pageWidth - margin, 21, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(
    report.status === "ACTIVE" ? "Active Campaign" : "Completed",
    pageWidth - margin,
    26,
    { align: "right" }
  );

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, 30, pageWidth - margin, 30);

  // Campaign Title
  let y = 40;
  const formattedTitle = cleanCampaignTitle(report.campaignName);
  const formattedAgency = formatTitleCase(report.agencyName);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42);
  doc.text(formattedTitle, margin, y);

  // Inspiring Executive Overview Context
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const overviewText = `Targeted outreach managed by ${formattedAgency} on Silaer. Scheduled directly in local London business hours to capture high-intent responses while keeping your domain reputation 100% protected.`;
  const splitOverview = doc.splitTextToSize(cleanPdfText(overviewText), contentWidth);
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
      sub: "0 Bounces - Clean",
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

  // Lead Activity & Delivery History Table Header
  y += cardHeight + 11;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Lead Activity & Delivery History", margin, y);

  y += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Verified delivery tracking across all connected inboxes", margin, y);

  y += 3;

  // AutoTable: Guaranteed ZERO Overlap with exact column widths and word wrapping
  const tableData = (report.leadActivities || []).map((act) => [
    act.recipientEmail,
    act.senderInbox,
    cleanPdfText(act.leadTimezone),
    cleanPdfText(act.dispatchedAt || "-"),
    cleanPdfText(act.openedAt ? (act.openCount > 1 ? `${act.openedAt} (${act.openCount}x)` : act.openedAt) : "-"),
    act.status === "REPLIED" ? "Replied" : act.status === "OPENED" ? "Opened" : act.status === "SENT" ? "Delivered" : "Scheduled",
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    head: [["RECIPIENT", "SENDING INBOX", "TIMEZONE", "DISPATCHED", "OPENED", "STATUS"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [71, 85, 105],
      fontStyle: "bold",
      fontSize: 7,
      cellPadding: { top: 2.5, right: 2, bottom: 2.5, left: 2 },
      lineColor: [226, 232, 240],
      lineWidth: 0.25,
    },
    bodyStyles: {
      textColor: [51, 65, 85],
      fontSize: 6.8,
      cellPadding: { top: 2.8, right: 2, bottom: 2.8, left: 2 },
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      overflow: "linebreak",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 48, fontStyle: "bold", textColor: [15, 23, 42] }, // Recipient (spacious)
      1: { cellWidth: 44, textColor: [100, 116, 139] },                 // Sending Inbox
      2: { cellWidth: 22 },                                              // Timezone
      3: { cellWidth: 23 },                                              // Dispatched
      4: { cellWidth: 22 },                                              // Opened
      5: { cellWidth: 15, halign: "right", fontStyle: "bold", textColor: [16, 185, 129] }, // Status
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || (y + 40);

  // Campaign Highlights & Key Takeaways Section
  let summaryY = finalY + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Campaign Highlights & Key Takeaways", margin, summaryY);

  summaryY += 5.5;
  report.summaryPoints.forEach((point) => {
    const cleanPoint = cleanPdfText(point);
    doc.setFillColor(16, 185, 129);
    doc.circle(margin + 1.8, summaryY - 1, 1, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    const splitText = doc.splitTextToSize(cleanPoint, contentWidth - 8);
    doc.text(splitText, margin + 6, summaryY);
    summaryY += splitText.length * 4.8 + 2.8;
  });

  // Footer Section placed cleanly at bottom
  const footerY = pageHeight - 18;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Powered by Silaer", margin, footerY);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.textWithLink("www.silaer.com", pageWidth - margin, footerY, {
    url: "https://www.silaer.com",
    align: "right",
  });

  const safeFileName = `Silaer_Report_${formattedTitle.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
  doc.save(safeFileName);
}

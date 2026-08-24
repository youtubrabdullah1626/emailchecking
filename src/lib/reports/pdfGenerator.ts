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
 * Generates and downloads a clean, single-page vector executive PDF report.
 * Guaranteed 1-click direct download with 0 browser print dialogs.
 */
export function generateDirectClientReportPdf(report: ClientReportData) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  // Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Top Silaer Logo Badge
  doc.setFillColor(16, 185, 129); // #10b981
  doc.roundedRect(margin, 16, 8, 8, 1.5, 1.5, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("S", margin + 2.5, 21.8);

  doc.setTextColor(15, 23, 42); // #0f172a
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Silaer", margin + 11, 21);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // #64748b
  doc.text("Client Campaign Report", margin + 11, 25);

  // Top Right: Date Range & Status
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(report.dateRange, pageWidth - margin, 20, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 185, 129);
  doc.text(
    report.status === "ACTIVE" ? "● Active Campaign" : "● Campaign Finalized",
    pageWidth - margin,
    25,
    { align: "right" }
  );

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, 29, pageWidth - margin, 29);

  // Co-Branding Badge
  let y = 37;
  const formattedAgency = formatTitleCase(report.agencyName);
  const formattedClient = formatTitleCase(report.clientName);
  const formattedTitle = formatTitleCase(report.campaignName);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(16, 185, 129);
  doc.text(formattedAgency, margin, y);

  const agencyWidth = doc.getTextWidth(formattedAgency);
  doc.setTextColor(148, 163, 184);
  doc.text("  ✖  ", margin + agencyWidth, y);

  const crossWidth = doc.getTextWidth("  ✖  ");
  doc.setTextColor(51, 65, 85);
  doc.text(formattedClient, margin + agencyWidth + crossWidth, y);

  // Main Campaign Title
  y += 7.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42);
  doc.text(formattedTitle, margin, y);

  // 4 Hero KPI Cards
  y += 9;
  const cardWidth = (contentWidth - 9) / 4;
  const cardHeight = 25;

  const kpis = [
    {
      title: "CONTACTED",
      value: `${report.metrics.totalContacted}`,
      sub: `${report.metrics.deliveryRate}% Delivered`,
    },
    {
      title: "OPENED",
      value: `${report.metrics.totalOpened}`,
      sub: `${report.metrics.openRate}% Open Rate`,
    },
    {
      title: "REAL REPLIES",
      value: `${report.metrics.realReplies}`,
      sub: `${report.metrics.replyRate}% Response Rate`,
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
    doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "F");
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "S");

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.title, x + 3.5, y + 5.5);

    // Big Metric
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(kpi.value, x + 3.5, y + 14);

    // Sub badge
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(16, 185, 129);
    doc.text(kpi.sub, x + 3.5, y + 20.5);
  });

  // Campaign Performance Summary
  y += cardHeight + 11;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Campaign Performance Summary", margin, y);

  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Deterministic outbound metrics recorded by Silaer Autonomous Engine", margin, y);

  y += 2.5;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageWidth - margin, y);

  // Bullets
  y += 6;
  report.summaryPoints.forEach((point) => {
    doc.setFillColor(16, 185, 129);
    doc.circle(margin + 1.5, y - 1, 1, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    const splitText = doc.splitTextToSize(point, contentWidth - 7);
    doc.text(splitText, margin + 5, y);
    y += splitText.length * 4.5 + 2.5;
  });

  // Footer Section
  const footerY = pageHeight - 16;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(16, 185, 129);
  doc.text("⚡ Powered by Silaer Enterprise Engine", margin, footerY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Autonomous multi-inbox rotation & 100% deliverability health", margin, footerY + 3.5);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 185, 129);
  doc.textWithLink("reachiq.up.railway.app", pageWidth - margin, footerY + 1.5, {
    url: report.referralUrl,
    align: "right",
  });

  const safeFileName = `Silaer_Report_${report.campaignName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
  doc.save(safeFileName);
}

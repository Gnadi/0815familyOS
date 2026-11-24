// The health-ledger PDF export. Kept out of VaccinationPage so jsPDF (~130 kB
// gzip incl. pako) is only downloaded when someone actually exports, not every
// time the health page opens. Imported dynamically from the export button.
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { formatDate } from '../utils/date';

const PDF_STATUS_COLORS = {
  done:    { r: 16,  g: 185, b: 129 },
  next_up: { r: 59,  g: 130, b: 246 },
  pending: { r: 148, g: 163, b: 184 },
};

function fmtDate(date) {
  if (!date) return '';
  return formatDate(date instanceof Date ? date : new Date(date), 'withYear');
}

// statusConfig maps a vaccine status to its { labelKey, infoKey } i18n keys
// (the page's STATUS_CONFIG), so both stay in one place.
export function buildPdf({ kidName, compliance, nextUpdateDate, kidVaccines, t, statusConfig }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const margin = 20;
  const contentW = W - 2 * margin;
  let y = 0;

  // Blue header band
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, W, 38, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(t('health.title'), margin, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(t('health.pdfRecord', { name: kidName }), margin, 27);
  doc.text(t('health.pdfGenerated', { date: formatDate(new Date(), 'withYear') }), W - margin, 27, { align: 'right' });

  y = 52;

  // Compliance row
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(t('health.pdfComplianceUpper'), margin, y);
  doc.text(t('health.nextUpdate'), W - margin, y, { align: 'right' });

  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(t('health.percentComplete', { pct: compliance }), margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(nextUpdateDate, W - margin, y, { align: 'right' });

  y += 7;

  // Progress bar
  doc.setFillColor(226, 232, 240);
  doc.roundedRect(margin, y, contentW, 4, 2, 2, 'F');
  if (compliance > 0) {
    doc.setFillColor(59, 130, 246);
    doc.roundedRect(margin, y, contentW * compliance / 100, 4, 2, 2, 'F');
  }

  y += 16;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, y, W - margin, y);

  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(t('health.historySchedule'), margin, y);

  y += 10;

  if (kidVaccines.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text(t('health.pdfNoVaccines'), margin, y);
  } else {
    kidVaccines.forEach((v, i) => {
      if (y > 268) { doc.addPage(); y = 20; }
      const c = PDF_STATUS_COLORS[v.status];
      const cfg = statusConfig[v.status];
      const label = t(cfg.labelKey);
      const infoPrefix = t(cfg.infoKey);

      if (i % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin - 4, y - 5, contentW + 8, 15, 'F');
      }
      doc.setFillColor(c.r, c.g, c.b);
      doc.circle(margin + 3, y + 2.5, 2.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(v.name, margin + 10, y + 4);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`${infoPrefix} • ${fmtDate(v.date)}`, margin + 10, y + 9);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(c.r, c.g, c.b);
      doc.text(label, W - margin, y + 4, { align: 'right' });

      y += 15;
    });
  }

  y += 8;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, W - margin, y);
  y += 10;

  // Travel advisory box
  doc.setFillColor(255, 251, 235);
  doc.roundedRect(margin, y, contentW, 18, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(146, 64, 14);
  doc.text(t('health.travelAdvisory'), margin + 5, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(
    t('health.pdfTravelText', { name: kidName }),
    margin + 5, y + 13,
  );

  // Footer
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(t('health.pdfFooter'), margin, 288);
  doc.text(format(new Date(), 'PPP'), W - margin, 288, { align: 'right' });

  doc.save(`health-ledger-${kidName.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}

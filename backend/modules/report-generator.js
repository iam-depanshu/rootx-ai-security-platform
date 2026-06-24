const PDFDocument = require('pdfkit');

function generateReportPDF(scan, res) {
  const doc = new PDFDocument({ margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="report-${scan.id}.pdf"`);
  doc.pipe(res);

  doc.fontSize(20).text('RootX Security Scan Report', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Target: ${scan.target}`);
  doc.text(`Date: ${new Date(scan.created_at).toLocaleString()}`);
  doc.text(`Risk Score: ${scan.riskScore || scan.score}/100`);
  doc.moveDown();

  doc.fontSize(14).text('Findings', { underline: true });
  doc.moveDown(0.5);

  (scan.vulnerabilities || []).forEach((v, i) => {
    doc.fontSize(12).fillColor('black').text(`${i + 1}. ${v.type || v.name} — ${(v.severity || 'LOW').toUpperCase()}`);
    doc.fontSize(10).fillColor('gray').text(v.detail || '', { indent: 20 });
    doc.moveDown(0.5);
  });

  doc.end();
}

module.exports = { generateReportPDF };

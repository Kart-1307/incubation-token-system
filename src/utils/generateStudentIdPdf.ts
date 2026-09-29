import jsPDF from 'jspdf';
import QRCode from 'qrcode';

export interface StudentBadgeData {
  id: string;
  name: string;
  department: string;
  year: number;
  status?: string;
  projects?: string[];
  projectName?: string;
}

/**
 * Generates an official, high-resolution A4 PDF document containing
 * printable Student ID Cards with scannable QR codes for mess verification.
 * 
 * Layout: 8 Cards per A4 Page (2 Columns x 4 Rows)
 */
export async function generateStudentIdBadgesPdf(
  students: StudentBadgeData[],
  collegeTitle: string = 'SRI SAIRAM ENGINEERING COLLEGE'
): Promise<jsPDF> {
  // A4 dimensions: 210mm x 297mm
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;

  // Grid dimensions
  const marginX = 12;
  const marginY = 12;
  const cardWidth = 88;
  const cardHeight = 62;
  const gutterX = 10;
  const gutterY = 7;

  const cols = 2;
  const rows = 4;
  const cardsPerPage = cols * rows; // 8 cards per page

  // Pre-generate QR Code data URLs asynchronously for all students
  const qrCodes = await Promise.all(
    students.map(async (student) => {
      try {
        return await QRCode.toDataURL(student.id.trim().toUpperCase(), {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 300,
          color: {
            dark: '#0f172a', // Deep slate for sharp contrast
            light: '#ffffff',
          },
        });
      } catch (err) {
        console.error(`Failed to generate QR code for ${student.id}:`, err);
        return null;
      }
    })
  );

  students.forEach((student, index) => {
    const pageIndex = Math.floor(index / cardsPerPage);
    const cardIndexOnPage = index % cardsPerPage;

    if (index > 0 && cardIndexOnPage === 0) {
      doc.addPage();
    }

    const col = cardIndexOnPage % cols;
    const row = Math.floor(cardIndexOnPage / cols);

    const x = marginX + col * (cardWidth + gutterX);
    const y = marginY + row * (cardHeight + gutterY);

    // 1. Outer Card Box with rounded corners and subtle shadow border
    doc.setDrawColor(203, 213, 225); // Slate 300
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, cardWidth, cardHeight, 2.5, 2.5, 'FD');

    // 2. Navy Blue Header Bar
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(x, y, cardWidth, 10, 'F');

    // Header Text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text(collegeTitle, x + cardWidth / 2, y + 4.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(203, 213, 225); // Slate 300
    doc.text('INCUBATION CENTRE · STUDENT MEAL ID', x + cardWidth / 2, y + 8, { align: 'center' });

    // 3. Student Details Block (Left Side)
    const textStartX = x + 4;
    let textY = y + 15;

    // Student Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    const displayName = student.name.length > 20 ? `${student.name.substring(0, 18)}...` : student.name;
    doc.text(displayName, textStartX, textY);

    // Roll Number / Student ID (Emphasized)
    textY += 5;
    doc.setFillColor(241, 245, 249); // Slate 100 badge background
    doc.roundedRect(textStartX, textY - 3.2, 38, 5, 1, 1, 'F');
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(79, 70, 229); // Indigo 600
    doc.text(`ID: ${student.id}`, textStartX + 2, textY);

    // Department & Year
    textY += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text('DEPARTMENT & YEAR:', textStartX, textY);

    textY += 3.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.text(`${student.department} · Year ${student.year}`, textStartX, textY);

    // Assigned Project
    textY += 5.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('ASSIGNED PROJECT:', textStartX, textY);

    textY += 3.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(30, 41, 59);
    const projectDisplay = student.projectName || student.projects?.[0] || 'Incubation Member';
    const truncatedProject = projectDisplay.length > 24 ? `${projectDisplay.substring(0, 22)}..` : projectDisplay;
    doc.text(truncatedProject, textStartX, textY);

    // 4. Scannable QR Code (Right Side)
    const qrSize = 27;
    const qrX = x + cardWidth - qrSize - 4;
    const qrY = y + 13.5;

    const qrDataUrl = qrCodes[index];
    if (qrDataUrl) {
      // White container border around QR
      doc.setDrawColor(226, 232, 240); // Slate 200
      doc.setFillColor(255, 255, 255);
      doc.rect(qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, 'FD');

      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

      // Label under QR
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(71, 85, 105);
      doc.text('SCAN FOR TOKEN', qrX + qrSize / 2, qrY + qrSize + 3.2, { align: 'center' });
    }

    // 5. Card Footer Strip
    const footerY = y + cardHeight - 4;
    doc.setDrawColor(226, 232, 240);
    doc.line(x + 3, footerY - 1.5, x + cardWidth - 3, footerY - 1.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text('Non-transferable · Official Institutional Food Verification Pass', x + cardWidth / 2, footerY + 1.5, {
      align: 'center',
    });

    // 6. Scissor Cutting Guides (Dashed line marks outside card)
    doc.setLineDashPattern([1, 2], 0);
    doc.setDrawColor(203, 213, 225);
    doc.rect(x - 0.5, y - 0.5, cardWidth + 1, cardHeight + 1);
    doc.setLineDashPattern([], 0); // Reset dash
  });

  return doc;
}

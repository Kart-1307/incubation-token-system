import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface StudentInfo {
  studentId: string;
  name: string;
}

export function generateFoodRequestLetterPdf(
  fromName: string,
  foodDate: string,
  studentsList: StudentInfo[]
) {
  // Format date as DD-MM-YYYY if YYYY-MM-DD
  let formattedDate = foodDate;
  if (/^\d{4}-\d{2}-\d{2}$/.test(foodDate)) {
    const [y, m, d] = foodDate.split('-');
    formattedDate = `${d}-${m}-${y}`;
  }

  // A4 dimensions: 210 x 297 mm
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const marginX = 25;
  let cursorY = 28;

  // ==========================================
  // PAGE 1: OFFICIAL FOOD REQUEST LETTER
  // (College letterhead header removed as requested)
  // ==========================================

  // Date (Right aligned)
  cursorY += 5;
  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  doc.text(`Date: ${formattedDate}`, 210 - marginX, cursorY, { align: 'right' });

  // FROM Section
  cursorY += 8;
  doc.setFont('times', 'bold');
  doc.text('FROM:', marginX, cursorY);

  cursorY += 6;
  doc.setFont('times', 'normal');
  doc.text(fromName || '[From Name]', marginX, cursorY);
  cursorY += 5;
  doc.text('Incubation Centre', marginX, cursorY);
  cursorY += 5;
  doc.text('Sri Sairam Engineering College', marginX, cursorY);

  // TO Section
  cursorY += 10;
  doc.setFont('times', 'bold');
  doc.text('TO:', marginX, cursorY);

  cursorY += 6;
  doc.setFont('times', 'normal');
  doc.text('The Principal', marginX, cursorY);
  cursorY += 5;
  doc.text('Sri Sairam Engineering College', marginX, cursorY);
  cursorY += 5;
  doc.text('West Tambaram, Chennai', marginX, cursorY);

  // SUBJECT
  cursorY += 12;
  doc.setFont('times', 'bold');
  doc.text('SUBJECT:', marginX, cursorY);
  const subjectText = 'Request for Food Arrangement for Night-Stay Students';
  doc.text(subjectText, marginX + 22, cursorY);

  // RESPECTED SIR
  cursorY += 12;
  doc.setFont('times', 'bold');
  doc.text('RESPECTED SIR,', marginX, cursorY);

  // Body paragraphs
  cursorY += 7;
  doc.setFont('times', 'normal');
  const para1 =
    'I kindly request you to arrange food facilities for the students who are staying at the college for night stay.';
  doc.text(para1, marginX, cursorY, { maxWidth: 210 - marginX * 2 });

  cursorY += 10;
  doc.text('The required food arrangements are requested for:', marginX, cursorY);

  cursorY += 6;
  doc.text('1.  Dinner', marginX + 8, cursorY);
  cursorY += 5;
  doc.text("2.  Next day's Breakfast", marginX + 8, cursorY);
  cursorY += 5;
  doc.text("3.  Next day's Lunch", marginX + 8, cursorY);

  cursorY += 9;
  const para2 = 'Kindly make the necessary arrangements for the above-mentioned students.';
  doc.text(para2, marginX, cursorY, { maxWidth: 210 - marginX * 2 });

  cursorY += 7;
  const para3 =
    'The list of students requiring food arrangements is provided on the following page for your reference.';
  doc.text(para3, marginX, cursorY, { maxWidth: 210 - marginX * 2 });

  cursorY += 9;
  doc.text('Thank you for your kind consideration and support.', marginX, cursorY);

  // Sign-off (Left: Incubation Centre, Right: Principal)
  cursorY += 14;
  const rightX = 210 - marginX;

  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  doc.text('Yours faithfully,', marginX, cursorY);
  doc.text('Approved by,', rightX, cursorY, { align: 'right' });

  cursorY += 16;
  doc.setFont('times', 'bold');
  doc.text(fromName || '[From Name]', marginX, cursorY);
  doc.text('Principal', rightX, cursorY, { align: 'right' });

  cursorY += 5;
  doc.setFont('times', 'normal');
  doc.text('Incubation Centre', marginX, cursorY);
  doc.text('Sri Sairam Engineering College', rightX, cursorY, { align: 'right' });

  cursorY += 5;
  doc.text('Sri Sairam Engineering College', marginX, cursorY);

  // Footer for Page 1
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Page 1 of 2', 105, 285, { align: 'center' });
  doc.setTextColor(0);

  // ==========================================
  // PAGE 2: STUDENT DETAILS TABLE
  // (College header removed as requested - only list of students alone)
  // (Compact row width and padding so 20+ names fit easily without congestion)
  // ==========================================
  doc.addPage('a4', 'portrait');

  let p2CursorY = 24;

  // Title: List of Students
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.text('List of Students Requiring Food Arrangement', 105, p2CursorY, { align: 'center' });

  p2CursorY += 6;
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.text(`Food Date: ${formattedDate}   |   Total Students: ${studentsList.length}`, 105, p2CursorY, {
    align: 'center',
  });

  p2CursorY += 8;

  // Table Data: exactly 3 columns
  const tableData = studentsList.map((st, index) => [
    String(index + 1),
    st.name,
    st.studentId,
  ]);

  // Centered compact table: 140mm wide (left margin = (210 - 140) / 2 = 35mm)
  const tableMarginX = 35;

  autoTable(doc, {
    startY: p2CursorY,
    head: [['S.No', 'Student Name', 'Student ID']],
    body: tableData,
    margin: { left: tableMarginX, right: tableMarginX },
    tableWidth: 140,
    styles: {
      font: 'times',
      fontSize: 9.5,
      textColor: [30, 41, 59],
      cellPadding: 2.2, // Low height per row so 20 names fit comfortably
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      minCellHeight: 6.5,
    },
    headStyles: {
      fillColor: [49, 46, 129], // Indigo 900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 2.8,
      fontSize: 10,
    },
    columnStyles: {
      0: { cellWidth: 16, halign: 'center' },
      1: { cellWidth: 80, halign: 'left' },
      2: { cellWidth: 44, halign: 'center', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // Footer for Page 2
  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Page 2 of 2', 105, 285, { align: 'center' });
  doc.setTextColor(0);

  // Trigger download
  const cleanDate = formattedDate.replace(/\//g, '-');
  doc.save(`Food_Request_Letter_${cleanDate}.pdf`);
}

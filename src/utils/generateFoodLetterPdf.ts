import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface StudentInfo {
  studentId: string;
  name: string;
}

export function generateFoodRequestLetterPdf(
  representativeName: string,
  representativeRollNo: string,
  projectsText: string,
  foodDate: string,
  studentsList: StudentInfo[]
) {
  // Format date as DD/MM/YY if YYYY-MM-DD
  let formattedDate = foodDate;
  if (/^\d{4}-\d{2}-\d{2}$/.test(foodDate)) {
    const [y, m, d] = foodDate.split('-');
    formattedDate = `${d}/${m}/${y.slice(2)}`;
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
  // ==========================================

  // Date (Right aligned: "DATE: DD/MM/YY")
  cursorY += 5;
  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  doc.text(`DATE: ${formattedDate}`, 210 - marginX, cursorY, { align: 'right' });

  // FROM Section
  cursorY += 8;
  doc.setFont('times', 'normal');
  doc.text('FROM,', marginX, cursorY);

  cursorY += 6;
  doc.setFont('times', 'bold');
  doc.text(representativeName || '____________________', marginX, cursorY);
  cursorY += 5;
  doc.setFont('times', 'normal');
  doc.text(representativeRollNo || (representativeName ? '' : '____________________'), marginX, cursorY);
  cursorY += 5;
  doc.text('Sri Sai Ram Engineering College', marginX, cursorY);
  cursorY += 5;
  doc.text('Chennai – 44', marginX, cursorY);

  // TO Section
  cursorY += 10;
  doc.setFont('times', 'normal');
  doc.text('TO,', marginX, cursorY);

  cursorY += 6;
  doc.text('The Principal', marginX, cursorY);
  cursorY += 5;
  doc.text('Sri Sai Ram Engineering College', marginX, cursorY);
  cursorY += 5;
  doc.text('Chennai – 44', marginX, cursorY);

  // SUBJECT
  cursorY += 12;
  doc.setFont('times', 'normal');
  const subjectLine = `sub: Request for Night stay in Incubation on ${formattedDate}`;
  doc.text(subjectLine, marginX, cursorY);

  // SALUTATION
  cursorY += 12;
  doc.setFont('times', 'normal');
  doc.text('Respected Sir,', marginX, cursorY);

  // BODY
  cursorY += 7;
  const projectsList = projectsText || '__________________________________';
  const bodyText = `Our Incubation teams has involved in ${projectsList}. So, I request you to give permission for night stay on ${formattedDate}. I also request you to provide food tokens. The student's list is attached with this letter.`;
  
  doc.text(bodyText, marginX, cursorY, {
    maxWidth: 210 - marginX * 2,
    lineHeightFactor: 1.5,
  });

  // SIGN-OFF (Right aligned: "Yours Truly,")
  cursorY += 45;
  const rightX = 210 - marginX;

  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  doc.text('Yours Truly,', rightX, cursorY, { align: 'right' });

  cursorY += 22; // Space for physical signature
  doc.setFont('times', 'bold');
  doc.text(representativeName || '____________________', rightX, cursorY, { align: 'right' });
  
  if (representativeRollNo) {
    cursorY += 5;
    doc.setFont('times', 'normal');
    doc.text(representativeRollNo, rightX, cursorY, { align: 'right' });
  }

  // Footer for Page 1
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Page 1 of 2', 105, 285, { align: 'center' });
  doc.setTextColor(0);

  // ==========================================
  // PAGE 2: STUDENT DETAILS TABLE
  // (Attachment: List of Students)
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

  // Centered compact table: 140mm wide
  const tableMarginX = 35;

  autoTable(doc, {
    startY: p2CursorY,
    head: [['S.No', 'Student Name', 'Student ID']],
    body: tableData,
    margin: { left: tableMarginX, right: tableMarginX },
    tableWidth: 140,
    styles: {
      font: 'helvetica',
      fontSize: 9.5,
      textColor: [30, 41, 59],
      cellPadding: 2.2,
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      minCellHeight: 6.5,
    },
    headStyles: {
      fillColor: [49, 46, 129], // Indigo 900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      font: 'helvetica',
      halign: 'center',
      cellPadding: 2.8,
      fontSize: 10,
    },
    columnStyles: {
      0: { cellWidth: 16, halign: 'center', font: 'helvetica' },
      1: { cellWidth: 80, halign: 'left', font: 'helvetica' },
      2: { cellWidth: 44, halign: 'center', fontStyle: 'bold', font: 'helvetica' },
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

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface StudentInfo {
  studentId: string;
  name: string;
}

export interface EditableLetterContent {
  date?: string;
  fromName?: string;
  fromRollNo?: string;
  fromCollege?: string;
  fromLocation?: string;
  recipientTitle?: string;
  recipientCollege?: string;
  recipientLocation?: string;
  subject?: string;
  salutation?: string;
  bodyText?: string;
  signOffText?: string;
  page2Title?: string;
  page2Subtitle?: string;
  studentsList?: StudentInfo[];
}

export function generateFoodRequestLetterPdf(
  representativeName: string,
  representativeRollNo: string,
  projectsText: string,
  foodDate: string,
  studentsList: StudentInfo[],
  customLetter?: EditableLetterContent
) {
  // Format date as DD/MM/YY if YYYY-MM-DD
  let formattedDate = foodDate;
  if (/^\d{4}-\d{2}-\d{2}$/.test(foodDate)) {
    const [y, m, d] = foodDate.split('-');
    formattedDate = `${d}/${m}/${y.slice(2)}`;
  }

  const finalDate = customLetter?.date?.trim() || formattedDate;
  const finalFromName = customLetter?.fromName?.trim() || representativeName?.trim() || '____________________';
  const finalFromRollNo = customLetter?.fromRollNo?.trim() || representativeRollNo?.trim() || '';
  const finalFromCollege = customLetter?.fromCollege?.trim() || 'Sri Sai Ram Engineering College';
  const finalFromLocation = customLetter?.fromLocation?.trim() || 'Chennai – 44';
  const finalRecipientTitle = customLetter?.recipientTitle?.trim() || 'The Principal';
  const finalRecipientCollege = customLetter?.recipientCollege?.trim() || 'Sri Sai Ram Engineering College';
  const finalRecipientLocation = customLetter?.recipientLocation?.trim() || 'Chennai – 44';
  const finalSubject = customLetter?.subject?.trim() || `sub: Request for Night stay in Incubation on ${finalDate}`;
  const finalSalutation = customLetter?.salutation?.trim() || 'Respected Sir,';
  const projectsList = projectsText || '__________________________________';
  const defaultBody = `Our Incubation teams has involved in ${projectsList}. So, I request you to give permission for night stay on ${finalDate}. I also request you to provide food tokens. The student's list is attached with this letter.`;
  const finalBodyText = customLetter?.bodyText?.trim() || defaultBody;
  const finalSignOff = customLetter?.signOffText?.trim() || 'Yours Truly,';
  const finalPage2Title = customLetter?.page2Title?.trim() || 'List of Students Requiring Food Arrangement';
  const finalStudents = customLetter?.studentsList && customLetter.studentsList.length > 0
    ? customLetter.studentsList
    : studentsList;
  const finalPage2Subtitle = customLetter?.page2Subtitle?.trim() || `Food Date: ${finalDate}   |   Total Students: ${finalStudents.length}`;

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
  doc.text(`DATE: ${finalDate}`, 210 - marginX, cursorY, { align: 'right' });

  // FROM Section
  cursorY += 8;
  doc.setFont('times', 'normal');
  doc.text('FROM,', marginX, cursorY);

  cursorY += 6;
  doc.setFont('times', 'bold');
  doc.text(finalFromName, marginX, cursorY);
  if (finalFromRollNo) {
    cursorY += 5;
    doc.setFont('times', 'normal');
    doc.text(finalFromRollNo, marginX, cursorY);
  }
  cursorY += 5;
  doc.setFont('times', 'normal');
  doc.text(finalFromCollege, marginX, cursorY);
  cursorY += 5;
  doc.text(finalFromLocation, marginX, cursorY);

  // TO Section
  cursorY += 10;
  doc.setFont('times', 'normal');
  doc.text('TO,', marginX, cursorY);

  cursorY += 6;
  doc.text(finalRecipientTitle, marginX, cursorY);
  cursorY += 5;
  doc.text(finalRecipientCollege, marginX, cursorY);
  cursorY += 5;
  doc.text(finalRecipientLocation, marginX, cursorY);

  // SUBJECT
  cursorY += 12;
  doc.setFont('times', 'normal');
  doc.text(finalSubject, marginX, cursorY);

  // SALUTATION
  cursorY += 12;
  doc.setFont('times', 'normal');
  doc.text(finalSalutation, marginX, cursorY);

  // BODY
  cursorY += 7;
  doc.text(finalBodyText, marginX, cursorY, {
    maxWidth: 210 - marginX * 2,
    lineHeightFactor: 1.5,
  });

  // SIGN-OFF (Right aligned: "Yours Truly,")
  cursorY += 45;
  const rightX = 210 - marginX;

  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  doc.text(finalSignOff, rightX, cursorY, { align: 'right' });

  cursorY += 22; // Space for physical signature
  doc.setFont('times', 'bold');
  doc.text(finalFromName, rightX, cursorY, { align: 'right' });
  
  if (finalFromRollNo) {
    cursorY += 5;
    doc.setFont('times', 'normal');
    doc.text(finalFromRollNo, rightX, cursorY, { align: 'right' });
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
  doc.text(finalPage2Title, 105, p2CursorY, { align: 'center' });

  p2CursorY += 6;
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.text(finalPage2Subtitle, 105, p2CursorY, {
    align: 'center',
  });

  p2CursorY += 8;

  // Table Data: exactly 3 columns
  const tableData = finalStudents.map((st, index) => [
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

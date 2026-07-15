import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const generatePayslip = (data) => {

  const doc = new jsPDF();

  // Header
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, 210, 30, "F");

  doc.setFontSize(22);
  doc.setTextColor(255,255,255);
  doc.text("OMTATVA DIGITALS",105,14,{align:"center"});

  doc.setFontSize(12);
  doc.text("Salary Payslip",105,23,{align:"center"});

  doc.setTextColor(0);

  // Employee Details
  doc.setFontSize(15);
  doc.text("Employee Information",14,42);

  autoTable(doc,{
    startY:46,
    theme:"grid",

    head:[["Field","Details"]],

    headStyles:{
      fillColor:[37,99,235],
      textColor:255,
      halign:"center",
      fontStyle:"bold"
    },

    body:[
      ["Employee Name",data.employeeName],
      ["Employee ID",data.employeeId],
      ["Month",data.month],
      ["Generated On",new Date().toLocaleDateString()]
    ]
  });

  // Get Y position after first table
  const firstTableY = doc.lastAutoTable.finalY;

  doc.setFontSize(15);
  doc.text("Salary Details",14,firstTableY+15);

  autoTable(doc,{
    startY:firstTableY+20,

    theme:"grid",

    head:[["Description","Amount (₹)"]],

    headStyles:{
      fillColor:[37,99,235],
      textColor:255,
      halign:"center",
      fontStyle:"bold"
    },

    body:[
      ["Basic Salary",data.basicSalary],
      ["Allowance",data.allowance],
      ["Gross Salary",data.grossSalary],
      ["Tax",data.tax],
      ["Leave Deduction",data.leaveDeduction],
      ["Net Salary",data.netSalary]
    ],

    bodyStyles:{
      halign:"right"
    },

    columnStyles:{
      0:{halign:"left"}
    }
  });

  const secondTableY = doc.lastAutoTable.finalY;

  doc.setFontSize(11);

  doc.text(
    "This is a computer generated payslip.",
    105,
    secondTableY+18,
    {align:"center"}
  );

  doc.text(
    "OMTATVA DIGITALS",
    105,
    secondTableY+28,
    {align:"center"}
  );

  return doc;
};
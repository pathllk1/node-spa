import ExcelJS from 'exceljs';

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export async function exportBillsToExcel(bills) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Bills');

  // Add header row
  worksheet.addRow(['Bill No', 'Date', 'Party', 'Type', 'Taxable Amount', 'Tax Amount', 'Total Amount', 'Status']);

  // Style header
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
  headerRow.eachCell(cell => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // Add data rows
  bills.forEach(bill => {
    const row = worksheet.addRow([
      bill.bno || '',
      formatDate(bill.bdate),
      bill.firm || '',
      bill.btype || 'SALES',
      (bill.gtot || 0).toFixed(2),
      ((bill.cgst || 0) + (bill.sgst || 0) + (bill.igst || 0)).toFixed(2),
      (bill.ntot || 0).toFixed(2),
      bill.status || 'ACTIVE'
    ]);

    row.eachCell(cell => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  });

  // Auto fit columns
  worksheet.columns.forEach(column => {
    column.width = 15;
  });

  return workbook.xlsx.writeBuffer();
}

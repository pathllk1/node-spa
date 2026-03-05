import ExcelJS from 'exceljs';
import { Bill, StockReg, Firm, FirmSettings, Settings } from '../../../models/index.js';

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

const formatCurrency = (amount) => {
    return '₹ ' + new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount || 0);
};

const formatQuantity = (qty) => {
    return parseFloat(qty || 0).toFixed(2);
};

const formatPercentage = (percent) => {
    return parseFloat(percent || 0).toFixed(2) + '%';
};

const numberToWords = (num) => {
    if (!num || isNaN(num)) return "Rupees Zero Only";

    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const convertHundreds = (n) => {
        let str = '';
        const numVal = Math.floor(n);
        if (numVal > 99) {
            str += ones[Math.floor(numVal / 100)] + ' Hundred ';
            return str + convertTens(numVal % 100);
        }
        return convertTens(numVal);
    };

    const convertTens = (n) => {
        let str = '';
        const numVal = Math.floor(n);
        if (numVal < 20) {
            return ones[numVal] || teens[numVal - 10] || '';
        }
        str += tens[Math.floor(numVal / 10)];
        if (numVal % 10 > 0) {
            str += ' ' + ones[numVal % 10];
        }
        return str;
    };

    const absNum = Math.abs(Number(num));
    const wholePart = Math.floor(absNum);
    const decimalPart = Math.round((absNum - wholePart) * 100);

    if (wholePart === 0 && decimalPart === 0) return "Rupees Zero Only";

    let result = "Rupees ";
    let tempWhole = wholePart;

    if (tempWhole >= 10000000) {
        const crores = Math.floor(tempWhole / 10000000);
        result += convertHundreds(crores) + ' Crore ';
        tempWhole %= 10000000;
    }

    if (tempWhole >= 100000) {
        const lakhs = Math.floor(tempWhole / 100000);
        result += convertHundreds(lakhs) + ' Lakh ';
        tempWhole %= 100000;
    }

    if (tempWhole >= 1000) {
        const thousands = Math.floor(tempWhole / 1000);
        result += convertHundreds(thousands) + ' Thousand ';
        tempWhole %= 1000;
    }

    if (tempWhole > 0) {
        result += convertHundreds(tempWhole);
    }

    if (decimalPart > 0) {
        result += " and " + convertTens(decimalPart) + " Paise ";
    }

    return result.trim() + " Only";
};

const getInvoiceTypeLabel = (bill) => {
    if (bill.type) {
        const billType = bill.type.toUpperCase();
        switch (billType) {
            case 'SALES': return 'SALES INVOICE';
            case 'PURCHASE': return 'PURCHASE INVOICE';
            case 'CREDIT NOTE': return 'CREDIT NOTE';
            case 'DEBIT NOTE': return 'DEBIT NOTE';
            case 'DELIVERY NOTE': return 'DELIVERY NOTE';
            default: return billType;
        }
    }
    return 'SALES INVOICE';
};

const getPartyLabels = (bill) => {
    const type = bill.type?.toUpperCase() || 'SALES';
    switch (type) {
        case 'SALES': return { billTo: 'Bill To (Buyer)', shipTo: 'Ship To (Consignee)' };
        case 'PURCHASE': return { billTo: 'Bill From (Supplier)', shipTo: 'Bill To (Receiver)' };
        case 'CREDIT NOTE': return { billTo: 'Bill To (Recipient)', shipTo: 'Ship To (Consignee)' };
        case 'DEBIT NOTE': return { billTo: 'Bill From (Supplier)', shipTo: 'Bill To (Recipient)' };
        case 'DELIVERY NOTE': return { billTo: 'Deliver From (Supplier)', shipTo: 'Deliver To (Recipient)' };
        default: return { billTo: 'Bill To (Buyer)', shipTo: 'Ship To (Consignee)' };
    }
};

const getBillType = (bill) => {
    const billTypeSource = (bill.type || '').toString().toLowerCase();
    if (billTypeSource.includes('intra')) return 'intra-state';
    if (billTypeSource.includes('inter')) return 'inter-state';
    const cgst = Number(bill.cgst) || 0;
    const sgst = Number(bill.sgst) || 0;
    return (cgst > 0 || sgst > 0) ? 'intra-state' : 'inter-state';
};

const buildHsnSummary = (bill, items, otherCharges, gstEnabled) => {
    const hsnMap = new Map();
    const billType = getBillType(bill);

    items.forEach(item => {
        const hsn = item.hsn || 'NA';
        const taxableValue = (item.qty || 0) * (item.rate || 0) * (1 - (item.disc || 0) / 100);
        const taxAmount = taxableValue * (item.grate || 0) / 100;

        if (!hsnMap.has(hsn)) {
            hsnMap.set(hsn, { hsn, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 });
        }

        const row = hsnMap.get(hsn);
        row.taxableValue += taxableValue;
        if (gstEnabled) {
            row.totalTax += taxAmount;
            if (billType === 'intra-state') {
                row.cgst += taxAmount / 2;
                row.sgst += taxAmount / 2;
            } else {
                row.igst += taxAmount;
            }
        }
    });

    otherCharges.forEach(charge => {
        const hsn = charge.hsnSac || '9999';
        const taxableValue = charge.amount || 0;
        const taxAmount = charge.gstAmount || 0;

        if (!hsnMap.has(hsn)) {
            hsnMap.set(hsn, { hsn, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 });
        }

        const row = hsnMap.get(hsn);
        row.taxableValue += taxableValue;
        if (gstEnabled) {
            row.totalTax += taxAmount;
            if (billType === 'intra-state') {
                row.cgst += taxAmount / 2;
                row.sgst += taxAmount / 2;
            } else {
                row.igst += taxAmount;
            }
        }
    });

    return Array.from(hsnMap.values()).sort((a, b) => a.hsn.localeCompare(b.hsn));
};

// GST setting helper for MongoDB
const isGstEnabled = async (firmId) => {
    try {
        const firmSetting = await FirmSettings.findOne({ firm_id: firmId, setting_key: 'gst_enabled' }).lean();
        if (firmSetting) return firmSetting.setting_value === 'true';
        const globalSetting = await Settings.findOne({ setting_key: 'gst_enabled' }).lean();
        return globalSetting ? globalSetting.setting_value === 'true' : true;
    } catch {
        return true; // default to enabled on error
    }
};

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

export const generateInvoiceExcel = async (req, res) => {
    try {
        const billId = req.params.id;
        console.log('Excel Request - billId:', billId, 'Type:', typeof billId);
        if (!billId) return res.status(400).json({ error: 'Bill ID is required' });

        // Get firm_id from authenticated user
        const firmId = req.user?.firm_id;
        console.log('Excel Request - firmId:', firmId, 'Type:', typeof firmId);

        console.log('Excel Request - firmId:', firmId);
        if (!firmId) return res.status(401).json({ error: 'Unauthorized - No firm associated' });

        const bill = await Bill.findOne({ _id: billId, firm_id: firmId }).lean();
        console.log('Excel Request - bill found:', !!bill, 'Bill data:', bill);
        if (!bill) return res.status(404).json({ error: 'Bill not found' });

        const items = await StockReg.find({ bill_id: billId, firm_id: firmId }).lean();
        console.log('Excel Request - items found:', items.length, 'Items:', items);

        let otherCharges = [];
        if (bill.other_charges) {
            try { otherCharges = Array.isArray(bill.other_charges) ? bill.other_charges : []; } catch (e) { otherCharges = []; }
        }

        // Check GST setting from MongoDB
        const gstEnabled = await isGstEnabled(firmId);

        // Seller info - using firm from MongoDB
        let firmAddress = '';
        let firmGstin = '';

        try {
            const firm = await Firm.findById(firmId).select('name address gst_number').lean();

            if (!firm) {
                return res.status(404).json({ error: 'Firm not found' });
            }

            firmAddress = firm.address || '';
            firmGstin = firm.gst_number || '';
        } catch (err) {
            console.error('Error fetching firm:', err.message);
            res.status(500).json({ error: 'Internal server error' });
        }

        const seller = { name: bill.firm || firm.name || 'Company Name', address: firmAddress, gstin: firmGstin || '' };

        console.log('Excel Request - seller info:', seller);
        console.log('Excel Request - bill type:', getBillType(bill));
        console.log('Excel Request - gstEnabled:', gstEnabled);

        const billType = getBillType(bill);
        const partyLabels = getPartyLabels(bill);
        const hsnSummary = buildHsnSummary(bill, items, otherCharges, gstEnabled);

        console.log('Excel Request - about to create Excel docDefinition');

        const formattedBuyerAddress = bill.addr && bill.pin ? `${bill.addr}, PIN: ${bill.pin}` : (bill.addr || `PIN: ${bill.pin}`);
        const formattedConsigneeAddress = (bill.consignee_address || bill.addr) && (bill.consignee_pin || bill.pin) ?
            `${bill.consignee_address || bill.addr}, PIN: ${bill.consignee_pin || bill.pin}` :
            ((bill.consignee_address || bill.addr) || `PIN: ${bill.consignee_pin || bill.pin}`);

        const taxableValue = bill.gtot || 0;
        const totalTax = gstEnabled ? ((bill.cgst || 0) + (bill.sgst || 0) + (bill.igst || 0)) : 0;
        // bill.ntot is already the rounded grand total (rounded in calcBillTotals before saving).
        // bill.rof is the stored round-off amount (string from .toFixed(2)) — read it directly.
        // Recalculating Math.round(bill.ntot) - bill.ntot always gives 0 because ntot is already an integer.
        const roundedGrandTotal = gstEnabled ? (bill.ntot || 0) : Math.round(taxableValue);
        const roundOff = parseFloat(bill.rof || 0);

        // ── Design Tokens ─────────────────────────────────────────────────────
        // Same as PDF
        const C = {
            primary: '1B3A6B',   // navy — text accents & borders only
            border: 'A0B4CC',   // medium grey border
            borderDark: '1B3A6B',   // navy border for outer frames & thick rules
            textDark: '1A1A2E',   // near-black body text
            textMid: '3D4D6A',   // mid-grey secondary text
            textLight: '6B7A99',   // light grey hints / labels
            red: '991B1B',   // error / reverse-charge notice
        };

        // Create workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Invoice');

        // Set column widths
        worksheet.columns = [
            { width: 5 }, // #
            { width: 40 }, // Description
            { width: 10 }, // HSN/SAC
            { width: 7 }, // Qty
            { width: 5 }, // UOM
            { width: 12 }, // Rate (₹)
            { width: 8 }, // Disc%
            { width: 8 }, // GST%
            { width: 15 }  // Amount (₹)
        ];

        // Start building the Excel content
        let currentRow = 1;

        // ── Header: company info (left) + invoice meta (right) ────────────
        worksheet.getCell(`A${currentRow}`).value = getInvoiceTypeLabel(bill);
        worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
        worksheet.getCell(`A${currentRow}`).font = { size: 17, bold: true, color: { argb: 'FF' + C.primary } };
        worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center' };

        currentRow++;
        worksheet.getCell(`A${currentRow}`).value = gstEnabled ? 'TAX INVOICE UNDER GST' : 'INVOICE (GST DISABLED)';
        worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
        worksheet.getCell(`A${currentRow}`).font = { size: 7.5, color: { argb: 'FF' + C.textLight } };
        worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center' };

        currentRow++;
        worksheet.getCell(`A${currentRow}`).value = seller.name;
        worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
        worksheet.getCell(`A${currentRow}`).font = { size: 12, bold: true, color: { argb: 'FF' + C.textDark } };

        currentRow++;
        worksheet.getCell(`A${currentRow}`).value = seller.address;
        worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
        worksheet.getCell(`A${currentRow}`).font = { size: 8, color: { argb: 'FF' + C.textMid } };

        currentRow++;
        worksheet.getCell(`A${currentRow}`).value = seller.gstin ? `GSTIN: ${seller.gstin}` : '';
        worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
        worksheet.getCell(`A${currentRow}`).font = { size: 8, bold: true, color: { argb: 'FF' + C.textDark } };

        // Right side: invoice details — table in G-I
        worksheet.getCell(`G${currentRow - 4}`).value = 'Invoice No';
        worksheet.getCell(`H${currentRow - 4}`).value = bill.bno || '';
        worksheet.getCell(`G${currentRow - 4}`).font = { size: 8, color: { argb: 'FF' + C.textLight } };
        worksheet.getCell(`H${currentRow - 4}`).font = { size: 8.5, bold: true, color: { argb: 'FF' + C.textDark } };

        worksheet.getCell(`G${currentRow - 3}`).value = 'Date';
        worksheet.getCell(`H${currentRow - 3}`).value = formatDate(bill.bdate) || '';
        worksheet.getCell(`G${currentRow - 3}`).font = { size: 8, color: { argb: 'FF' + C.textLight } };
        worksheet.getCell(`H${currentRow - 3}`).font = { size: 8.5, bold: true, color: { argb: 'FF' + C.textDark } };

        if (bill.order_no) {
            worksheet.getCell(`G${currentRow - 2}`).value = 'PO No';
            worksheet.getCell(`H${currentRow - 2}`).value = bill.order_no;
            worksheet.getCell(`G${currentRow - 2}`).font = { size: 8, color: { argb: 'FF' + C.textLight } };
            worksheet.getCell(`H${currentRow - 2}`).font = { size: 8.5, bold: true, color: { argb: 'FF' + C.textDark } };
        }

        if (bill.vehicle_no) {
            worksheet.getCell(`I${currentRow - 1}`).value = 'Vehicle No';
            worksheet.getCell(`I${currentRow - 1}`).value = bill.vehicle_no;
            worksheet.getCell(`I${currentRow - 1}`).font = { size: 8.5, bold: true, color: { argb: 'FF' + C.textDark } };
        }

        if (bill.dispatch_through) {
            worksheet.getCell(`G${currentRow}`).value = 'Dispatch Via';
            worksheet.getCell(`H${currentRow}`).value = bill.dispatch_through;
            worksheet.getCell(`G${currentRow}`).font = { size: 8, color: { argb: 'FF' + C.textLight } };
            worksheet.getCell(`H${currentRow}`).font = { size: 8.5, bold: true, color: { argb: 'FF' + C.textDark } };
        }

        // Borders for meta table
        for (let r = currentRow - 4; r <= currentRow; r++) {
            worksheet.getCell(`G${r}`).border = {
                top: { style: 'thin', color: { argb: 'FF' + C.border } },
                left: { style: 'thin', color: { argb: 'FF' + C.border } },
                bottom: { style: 'thin', color: { argb: 'FF' + C.border } },
                right: { style: 'thin', color: { argb: 'FF' + C.border } }
            };
            worksheet.getCell(`H${r}`).border = {
                top: { style: 'thin', color: { argb: 'FF' + C.border } },
                left: { style: 'thin', color: { argb: 'FF' + C.border } },
                bottom: { style: 'thin', color: { argb: 'FF' + C.border } },
                right: { style: 'thin', color: { argb: 'FF' + C.border } }
            };
            if (bill.vehicle_no && r === currentRow - 1) {
                worksheet.getCell(`I${r}`).border = {
                    top: { style: 'thin', color: { argb: 'FF' + C.border } },
                    left: { style: 'thin', color: { argb: 'FF' + C.border } },
                    bottom: { style: 'thin', color: { argb: 'FF' + C.border } },
                    right: { style: 'thin', color: { argb: 'FF' + C.border } }
                };
            }
        }

        currentRow++;

        // ── Party Details ─────────────────────────────────────────────
        let partyStartRow = currentRow;
        worksheet.getCell(`A${currentRow}`).value = partyLabels.billTo.toUpperCase();
        worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
        worksheet.getCell(`A${currentRow}`).font = { size: 7.5, bold: true, color: { argb: 'FF' + C.primary } };

        worksheet.getCell(`E${currentRow}`).value = partyLabels.shipTo.toUpperCase();
        worksheet.mergeCells(`E${currentRow}:I${currentRow}`);
        worksheet.getCell(`E${currentRow}`).font = { size: 7.5, bold: true, color: { argb: 'FF' + C.primary } };

        currentRow++;
        worksheet.getCell(`A${currentRow}`).value = bill.supply || '';
        worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
        worksheet.getCell(`A${currentRow}`).font = { size: 9.5, bold: true, color: { argb: 'FF' + C.textDark } };
        worksheet.getCell(`A${currentRow}`).alignment = { vertical: 'top' };

        worksheet.getCell(`E${currentRow}`).value = bill.consignee_name || bill.party_id || '';
        worksheet.mergeCells(`E${currentRow}:I${currentRow}`);
        worksheet.getCell(`E${currentRow}`).font = { size: 9.5, bold: true, color: { argb: 'FF' + C.textDark } };
        worksheet.getCell(`E${currentRow}`).alignment = { vertical: 'top' };

        currentRow++;
        worksheet.getCell(`A${currentRow}`).value = formattedBuyerAddress;
        worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
        worksheet.getCell(`A${currentRow}`).font = { size: 8, color: { argb: 'FF' + C.textMid } };

        worksheet.getCell(`E${currentRow}`).value = formattedConsigneeAddress;
        worksheet.mergeCells(`E${currentRow}:I${currentRow}`);
        worksheet.getCell(`E${currentRow}`).font = { size: 8, color: { argb: 'FF' + C.textMid } };

        currentRow++;
        worksheet.getCell(`A${currentRow}`).value = bill.state ? `State: ${bill.state}` : '';
        worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
        worksheet.getCell(`A${currentRow}`).font = { size: 8, color: { argb: 'FF' + C.textMid } };

        worksheet.getCell(`E${currentRow}`).value = (bill.consignee_state || bill.state) ? `State: ${bill.consignee_state || bill.state}` : '';
        worksheet.mergeCells(`E${currentRow}:I${currentRow}`);
        worksheet.getCell(`E${currentRow}`).font = { size: 8, color: { argb: 'FF' + C.textMid } };

        currentRow++;
        worksheet.getCell(`A${currentRow}`).value = bill.gstin ? `GSTIN: ${bill.gstin}` : '';
        worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
        worksheet.getCell(`A${currentRow}`).font = { size: 8, bold: true, color: { argb: 'FF' + C.textDark } };

        worksheet.getCell(`E${currentRow}`).value = (bill.consignee_gstin || bill.gstin) ? `GSTIN: ${bill.consignee_gstin || bill.gstin}` : '';
        worksheet.mergeCells(`E${currentRow}:I${currentRow}`);
        worksheet.getCell(`E${currentRow}`).font = { size: 8, bold: true, color: { argb: 'FF' + C.textDark } };

        // Borders for party boxes
        for (let r = partyStartRow; r <= currentRow; r++) {
            // Left box (Bill To): columns A-D
            for (let c = 0; c < 4; c++) {
                const col = String.fromCharCode(65 + c);
                worksheet.getCell(`${col}${r}`).border = {
                    top: r === partyStartRow ? { style: 'medium', color: { argb: 'FF' + C.borderDark } } : r === currentRow ? { style: 'medium', color: { argb: 'FF' + C.borderDark } } : { style: 'thin', color: { argb: 'FF' + C.border } },
                    left: c === 0 ? { style: 'medium', color: { argb: 'FF' + C.borderDark } } : { style: 'thin', color: { argb: 'FF' + C.border } },
                    bottom: r === currentRow ? { style: 'medium', color: { argb: 'FF' + C.borderDark } } : { style: 'thin', color: { argb: 'FF' + C.border } },
                    right: c === 3 ? { style: 'medium', color: { argb: 'FF' + C.borderDark } } : { style: 'thin', color: { argb: 'FF' + C.border } }
                };
            }
            // Right box (Ship To): columns E-I
            for (let c = 4; c < 9; c++) {
                const col = String.fromCharCode(65 + c);
                worksheet.getCell(`${col}${r}`).border = {
                    top: r === partyStartRow ? { style: 'medium', color: { argb: 'FF' + C.borderDark } } : r === currentRow ? { style: 'medium', color: { argb: 'FF' + C.borderDark } } : { style: 'thin', color: { argb: 'FF' + C.border } },
                    left: c === 4 ? { style: 'medium', color: { argb: 'FF' + C.borderDark } } : { style: 'thin', color: { argb: 'FF' + C.border } },
                    bottom: r === currentRow ? { style: 'medium', color: { argb: 'FF' + C.borderDark } } : { style: 'thin', color: { argb: 'FF' + C.border } },
                    right: c === 8 ? { style: 'medium', color: { argb: 'FF' + C.borderDark } } : { style: 'thin', color: { argb: 'FF' + C.border } }
                };
            }
        }

        currentRow += 2; // space

        // ── Items Table ───────────────────────────────────────────────
        const headerRow = currentRow;
        worksheet.getCell(`A${headerRow}`).value = '#';
        worksheet.getCell(`B${headerRow}`).value = 'Description of Goods / Services';
        worksheet.getCell(`C${headerRow}`).value = 'HSN/SAC';
        worksheet.getCell(`D${headerRow}`).value = 'Qty';
        worksheet.getCell(`E${headerRow}`).value = 'UOM';
        worksheet.getCell(`F${headerRow}`).value = 'Rate (₹)';
        worksheet.getCell(`G${headerRow}`).value = 'Disc%';
        worksheet.getCell(`H${headerRow}`).value = 'GST%';
        worksheet.getCell(`I${headerRow}`).value = 'Amount (₹)';

        for (let c = 0; c < 9; c++) {
            const col = String.fromCharCode(65 + c);
            worksheet.getCell(`${col}${headerRow}`).font = { size: 8, bold: true, color: { argb: 'FF' + C.primary } };
            worksheet.getCell(`${col}${headerRow}`).alignment = c === 0 || c === 2 || c === 3 || c === 4 ? 'center' : c === 5 || c === 6 || c === 7 || c === 8 ? 'right' : 'left';
            worksheet.getCell(`${col}${headerRow}`).border = {
                top: { style: 'medium', color: { argb: 'FF' + C.borderDark } },
                left: c === 0 ? { style: 'medium', color: { argb: 'FF' + C.borderDark } } : { style: 'thin', color: { argb: 'FF' + C.border } },
                bottom: { style: 'medium', color: { argb: 'FF' + C.borderDark } },
                right: c === 8 ? { style: 'medium', color: { argb: 'FF' + C.borderDark } } : { style: 'thin', color: { argb: 'FF' + C.border } }
            };
        }

        currentRow++;

        // Item rows
        items.forEach((it, idx) => {
            worksheet.getCell(`A${currentRow}`).value = idx + 1;
            worksheet.getCell(`A${currentRow}`).alignment = 'center';

            worksheet.getCell(`B${currentRow}`).value = it.item || '';
            worksheet.getCell(`B${currentRow}`).font = { bold: true };

            worksheet.getCell(`C${currentRow}`).value = it.hsn || '';
            worksheet.getCell(`C${currentRow}`).alignment = 'center';

            worksheet.getCell(`D${currentRow}`).value = formatQuantity(it.qty);
            worksheet.getCell(`D${currentRow}`).alignment = 'center';

            worksheet.getCell(`E${currentRow}`).value = it.uom || '';
            worksheet.getCell(`E${currentRow}`).alignment = 'center';

            worksheet.getCell(`F${currentRow}`).value = formatCurrency(it.rate);
            worksheet.getCell(`F${currentRow}`).alignment = 'right';

            worksheet.getCell(`G${currentRow}`).value = formatPercentage(it.disc);
            worksheet.getCell(`G${currentRow}`).alignment = 'right';

            worksheet.getCell(`H${currentRow}`).value = gstEnabled ? formatPercentage(it.grate) : '-';
            worksheet.getCell(`H${currentRow}`).alignment = 'right';

            worksheet.getCell(`I${currentRow}`).value = formatCurrency(it.total);
            worksheet.getCell(`I${currentRow}`).alignment = 'right';
            worksheet.getCell(`I${currentRow}`).font = { bold: true };

            for (let c = 0; c < 9; c++) {
                const col = String.fromCharCode(65 + c);
                worksheet.getCell(`${col}${currentRow}`).font = { size: 8.5 };
                worksheet.getCell(`${col}${currentRow}`).border = {
                    top: { style: 'thin', color: { argb: 'FF' + C.border } },
                    left: c === 0 ? { style: 'medium', color: { argb: 'FF' + C.borderDark } } : { style: 'thin', color: { argb: 'FF' + C.border } },
                    bottom: { style: 'thin', color: { argb: 'FF' + C.border } },
                    right: c === 8 ? { style: 'medium', color: { argb: 'FF' + C.borderDark } } : { style: 'thin', color: { argb: 'FF' + C.border } }
                };
            }

            currentRow++;
        });

        // Other charges rows
        otherCharges.forEach((ch, idx) => {
            worksheet.getCell(`A${currentRow}`).value = items.length + idx + 1;
            worksheet.getCell(`A${currentRow}`).alignment = 'center';

            worksheet.getCell(`B${currentRow}`).value = ch.name || ch.type || 'Other Charge';
            worksheet.getCell(`B${currentRow}`).font = { bold: true };

            worksheet.getCell(`C${currentRow}`).value = ch.hsnSac || '';
            worksheet.getCell(`C${currentRow}`).alignment = 'center';

            worksheet.getCell(`D${currentRow}`).value = '1';
            worksheet.getCell(`D${currentRow}`).alignment = 'center';

            worksheet.getCell(`E${currentRow}`).value = 'NOS';
            worksheet.getCell(`E${currentRow}`).alignment = 'center';

            worksheet.getCell(`F${currentRow}`).value = formatCurrency(ch.amount);
            worksheet.getCell(`F${currentRow}`).alignment = 'right';

            worksheet.getCell(`G${currentRow}`).value = '0.00%';
            worksheet.getCell(`G${currentRow}`).alignment = 'right';

            worksheet.getCell(`H${currentRow}`).value = gstEnabled ? formatPercentage(ch.gstRate) : '-';
            worksheet.getCell(`H${currentRow}`).alignment = 'right';

            worksheet.getCell(`I${currentRow}`).value = formatCurrency(ch.amount);
            worksheet.getCell(`I${currentRow}`).alignment = 'right';
            worksheet.getCell(`I${currentRow}`).font = { bold: true };

            for (let c = 0; c < 9; c++) {
                const col = String.fromCharCode(65 + c);
                worksheet.getCell(`${col}${currentRow}`).font = { size: 8.5 };
                worksheet.getCell(`${col}${currentRow}`).border = {
                    top: { style: 'thin', color: { argb: 'FF' + C.border } },
                    left: c === 0 ? { style: 'medium', color: { argb: 'FF' + C.borderDark } } : { style: 'thin', color: { argb: 'FF' + C.border } },
                    bottom: { style: 'thin', color: { argb: 'FF' + C.border } },
                    right: c === 8 ? { style: 'medium', color: { argb: 'FF' + C.borderDark } } : { style: 'thin', color: { argb: 'FF' + C.border } }
                };
            }

            currentRow++;
        });

        // ── HSN / SAC Summary ─────────────────────────────────────────
        if (hsnSummary.length > 0 && gstEnabled) {
            currentRow += 2; // space

            const hsnHeaderRow = currentRow;
            worksheet.getCell(`A${hsnHeaderRow}`).value = 'HSN/SAC';
            worksheet.getCell(`B${hsnHeaderRow}`).value = 'Taxable Value';
            worksheet.getCell(`C${hsnHeaderRow}`).value = 'CGST (₹)';
            worksheet.getCell(`D${hsnHeaderRow}`).value = 'SGST (₹)';
            worksheet.getCell(`E${hsnHeaderRow}`).value = 'IGST (₹)';
            worksheet.getCell(`F${hsnHeaderRow}`).value = 'Total Tax (₹)';

            for (let c = 0; c < 6; c++) {
                const col = String.fromCharCode(65 + c);
                worksheet.getCell(`${col}${hsnHeaderRow}`).font = { size: 7.5, bold: true, color: { argb: 'FF' + C.primary } };
                worksheet.getCell(`${col}${hsnHeaderRow}`).alignment = c === 0 ? 'center' : 'right';
                worksheet.getCell(`${col}${hsnHeaderRow}`).border = {
                    top: { style: 'medium', color: { argb: 'FF' + C.borderDark } },
                    left: c === 0 ? { style: 'medium', color: { argb: 'FF' + C.borderDark } } : { style: 'thin', color: { argb: 'FF' + C.border } },
                    bottom: { style: 'medium', color: { argb: 'FF' + C.borderDark } },
                    right: c === 5 ? { style: 'medium', color: { argb: 'FF' + C.borderDark } } : { style: 'thin', color: { argb: 'FF' + C.border } }
                };
            }

            currentRow++;

            hsnSummary.forEach((row) => {
                worksheet.getCell(`A${currentRow}`).value = row.hsn;
                worksheet.getCell(`A${currentRow}`).alignment = 'center';

                worksheet.getCell(`B${currentRow}`).value = formatCurrency(row.taxableValue);
                worksheet.getCell(`B${currentRow}`).alignment = 'right';

                worksheet.getCell(`C${currentRow}`).value = billType === 'intra-state' ? formatCurrency(row.cgst) : '—';
                worksheet.getCell(`C${currentRow}`).alignment = 'right';

                worksheet.getCell(`D${currentRow}`).value = billType === 'intra-state' ? formatCurrency(row.sgst) : '—';
                worksheet.getCell(`D${currentRow}`).alignment = 'right';

                worksheet.getCell(`E${currentRow}`).value = billType === 'inter-state' ? formatCurrency(row.igst) : '—';
                worksheet.getCell(`E${currentRow}`).alignment = 'right';

                worksheet.getCell(`F${currentRow}`).value = formatCurrency(row.totalTax);
                worksheet.getCell(`F${currentRow}`).alignment = 'right';
                worksheet.getCell(`F${currentRow}`).font = { bold: true };

                for (let c = 0; c < 6; c++) {
                    const col = String.fromCharCode(65 + c);
                    worksheet.getCell(`${col}${currentRow}`).font = { size: 8 };
                    worksheet.getCell(`${col}${currentRow}`).border = {
                        top: { style: 'thin', color: { argb: 'FF' + C.border } },
                        left: c === 0 ? { style: 'medium', color: { argb: 'FF' + C.borderDark } } : { style: 'thin', color: { argb: 'FF' + C.border } },
                        bottom: { style: 'thin', color: { argb: 'FF' + C.border } },
                        right: c === 5 ? { style: 'medium', color: { argb: 'FF' + C.borderDark } } : { style: 'thin', color: { argb: 'FF' + C.border } }
                    };
                }

                currentRow++;
            });
        }

        // ── Footer: Amount Words + Totals ─────────────────────────────
        currentRow += 2; // space

        worksheet.getCell(`A${currentRow}`).value = 'AMOUNT IN WORDS';
        worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
        worksheet.getCell(`A${currentRow}`).font = { size: 7.5, bold: true, color: { argb: 'FF' + C.primary } };

        currentRow++;
        worksheet.getCell(`A${currentRow}`).value = numberToWords(roundedGrandTotal);
        worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
        worksheet.getCell(`A${currentRow}`).font = { size: 9, bold: true };

        if (bill.narration) {
            currentRow++;
            worksheet.getCell(`A${currentRow}`).value = 'NARRATION';
            worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
            worksheet.getCell(`A${currentRow}`).font = { size: 7.5, bold: true, color: { argb: 'FF' + C.primary } };

            currentRow++;
            worksheet.getCell(`A${currentRow}`).value = bill.narration;
            worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
            worksheet.getCell(`A${currentRow}`).font = { size: 8.5, color: { argb: 'FF' + C.textMid } };
        }

        // Totals table on right
        let totalsStartRow = currentRow - (bill.narration ? 3 : 1);

        worksheet.getCell(`E${totalsStartRow}`).value = 'Taxable Value';
        worksheet.getCell(`F${totalsStartRow}`).value = formatCurrency(taxableValue);
        worksheet.getCell(`F${totalsStartRow}`).alignment = 'right';

        totalsStartRow++;
        if (gstEnabled) {
            if (billType === 'intra-state') {
                worksheet.getCell(`E${totalsStartRow}`).value = 'Add: CGST';
                worksheet.getCell(`F${totalsStartRow}`).value = formatCurrency(bill.cgst);
                worksheet.getCell(`F${totalsStartRow}`).alignment = 'right';
                totalsStartRow++;

                worksheet.getCell(`E${totalsStartRow}`).value = 'Add: SGST';
                worksheet.getCell(`F${totalsStartRow}`).value = formatCurrency(bill.sgst);
                worksheet.getCell(`F${totalsStartRow}`).alignment = 'right';
                totalsStartRow++;
            } else {
                worksheet.getCell(`E${totalsStartRow}`).value = 'Add: IGST';
                worksheet.getCell(`F${totalsStartRow}`).value = formatCurrency(bill.igst);
                worksheet.getCell(`F${totalsStartRow}`).alignment = 'right';
                totalsStartRow++;
            }
        }

        worksheet.getCell(`E${totalsStartRow}`).value = 'Total Tax';
        worksheet.getCell(`F${totalsStartRow}`).value = formatCurrency(totalTax);
        worksheet.getCell(`F${totalsStartRow}`).alignment = 'right';
        totalsStartRow++;

        worksheet.getCell(`E${totalsStartRow}`).value = 'Round Off';
        worksheet.getCell(`F${totalsStartRow}`).value = formatCurrency(roundOff);
        worksheet.getCell(`F${totalsStartRow}`).alignment = 'right';
        totalsStartRow++;

        worksheet.getCell(`E${totalsStartRow}`).value = 'GRAND TOTAL';
        worksheet.getCell(`F${totalsStartRow}`).value = formatCurrency(roundedGrandTotal);
        worksheet.getCell(`F${totalsStartRow}`).alignment = 'right';
        worksheet.getCell(`E${totalsStartRow}`).font = { size: 10, bold: true, color: { argb: 'FF' + C.primary } };
        worksheet.getCell(`F${totalsStartRow}`).font = { size: 11, bold: true, color: { argb: 'FF' + C.primary } };

        // Borders for totals table
        let totalsEndRow = totalsStartRow;
        totalsStartRow = currentRow - (bill.narration ? 3 : 1);
        for (let r = totalsStartRow; r <= totalsEndRow; r++) {
            worksheet.getCell(`E${r}`).border = {
                top: r === totalsStartRow ? { style: 'medium', color: { argb: 'FF' + C.borderDark } } : r === totalsEndRow - 1 ? { style: 'medium', color: { argb: 'FF' + C.borderDark } } : { style: 'thin', color: { argb: 'FF' + C.border } },
                left: { style: 'medium', color: { argb: 'FF' + C.borderDark } },
                bottom: r === totalsEndRow ? { style: 'medium', color: { argb: 'FF' + C.borderDark } } : { style: 'thin', color: { argb: 'FF' + C.border } },
                right: { style: 'thin', color: { argb: 'FF' + C.border } }
            };
            worksheet.getCell(`F${r}`).border = {
                top: r === totalsStartRow ? { style: 'medium', color: { argb: 'FF' + C.borderDark } } : r === totalsEndRow - 1 ? { style: 'medium', color: { argb: 'FF' + C.borderDark } } : { style: 'thin', color: { argb: 'FF' + C.border } },
                left: { style: 'thin', color: { argb: 'FF' + C.border } },
                bottom: r === totalsEndRow ? { style: 'medium', color: { argb: 'FF' + C.borderDark } } : { style: 'thin', color: { argb: 'FF' + C.border } },
                right: { style: 'medium', color: { argb: 'FF' + C.borderDark } }
            };
        }

        if (bill.reverse_charge && gstEnabled) {
            totalsEndRow++;
            worksheet.getCell(`E${totalsEndRow}`).value = '* Reverse charge applicable. Tax liability on recipient.';
            worksheet.mergeCells(`E${totalsEndRow}:F${totalsEndRow}`);
            worksheet.getCell(`E${totalsEndRow}`).font = { size: 7.5, color: { argb: 'FF' + C.red } };
            worksheet.getCell(`E${totalsEndRow}`).alignment = { horizontal: 'right' };
        }

        // ── Signatures ────────────────────────────────────────────────
        currentRow = totalsEndRow + 2;

        worksheet.getCell(`A${currentRow}`).value = 'TERMS & CONDITIONS';
        worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
        worksheet.getCell(`A${currentRow}`).font = { size: 7.5, bold: true, color: { argb: 'FF' + C.primary } };

        currentRow++;
        worksheet.getCell(`A${currentRow}`).value = '1. Goods once sold will not be taken back.';
        worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
        worksheet.getCell(`A${currentRow}`).font = { size: 7.5, color: { argb: 'FF' + C.textLight } };

        currentRow++;
        worksheet.getCell(`A${currentRow}`).value = '2. Subject to local jurisdiction only.';
        worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
        worksheet.getCell(`A${currentRow}`).font = { size: 7.5, color: { argb: 'FF' + C.textLight } };

        currentRow++;
        worksheet.getCell(`A${currentRow}`).value = '3. E. & O.E.';
        worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
        worksheet.getCell(`A${currentRow}`).font = { size: 7.5, color: { argb: 'FF' + C.textLight } };

        currentRow += 2;
        worksheet.getCell(`A${currentRow}`).value = "Receiver's Signature";
        worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
        worksheet.getCell(`A${currentRow}`).font = { size: 8, color: { argb: 'FF' + C.textMid } };

        currentRow++;
        worksheet.getCell(`A${currentRow}`).value = '(Authorised Signatory)';
        worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
        worksheet.getCell(`A${currentRow}`).font = { size: 7.5, color: { argb: 'FF' + C.textLight } };

        // Right signatures
        currentRow = totalsEndRow + 2;
        worksheet.getCell(`E${currentRow}`).value = `For ${seller.name}`;
        worksheet.mergeCells(`E${currentRow}:I${currentRow}`);
        worksheet.getCell(`E${currentRow}`).font = { size: 9, bold: true, alignment: { horizontal: 'right' } };

        currentRow++;
        worksheet.getCell(`E${currentRow}`).value = gstEnabled ? `GSTIN: ${seller.gstin}` : '';
        worksheet.mergeCells(`E${currentRow}:I${currentRow}`);
        worksheet.getCell(`E${currentRow}`).font = { size: 7.5, color: { argb: 'FF' + C.textLight }, alignment: { horizontal: 'right' } };

        currentRow += 3;
        worksheet.getCell(`E${currentRow}`).value = 'Authorised Signatory';
        worksheet.mergeCells(`E${currentRow}:I${currentRow}`);
        worksheet.getCell(`E${currentRow}`).font = { size: 8, color: { argb: 'FF' + C.textMid }, alignment: { horizontal: 'right' } };

        currentRow++;
        worksheet.getCell(`E${currentRow}`).value = 'This is a computer generated invoice';
        worksheet.mergeCells(`E${currentRow}:I${currentRow}`);
        worksheet.getCell(`E${currentRow}`).font = { size: 7, color: { argb: 'FF' + C.textLight }, alignment: { horizontal: 'right' }, italic: true };

        // Add borders for signatures
        // This is simplified, as Excel borders are not as complex as PDF canvas

        const safeBillNo = String(bill.bno || `BILL-${bill._id}`).replace(/[^a-zA-Z0-9._-]/g, '_');
        const filename = `Invoice_${safeBillNo}.xlsx`;
        console.log('Excel filename:', filename);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        workbook.xlsx.writeBuffer().then(buffer => {
            res.send(buffer);
            console.log('Excel generation completed');
        }).catch(err => {
            console.error('Excel generation error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: err.message });
            } else {
                res.end();
            }
        });

        console.log('Excel sent to client');

    } catch (err) {
        console.error('Excel export error:', err);
        console.error('Error stack:', err.stack);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        } else {
            res.end();
        }
    }
};

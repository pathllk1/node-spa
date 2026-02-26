import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Bill, StockReg, Firm, FirmSettings, Settings } from '../../../models/index.js';
import PrinterModule from 'pdfmake/js/Printer.js';

const PdfPrinter = PrinterModule.default;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to resolve font paths properly on different platforms
const getFontPath = (fileName) => {
    // Use absolute path from project root to client/public/fonts
    return path.join(process.cwd(), 'client', 'public', 'fonts', fileName);
};

// Verify font files exist before initializing printer
const fontFiles = [
    'DejaVuSans.ttf',
    'DejaVuSans-Bold.ttf',
    'DejaVuSans-Oblique.ttf',
    'DejaVuSans-BoldOblique.ttf'
];

// Check if font files exist
fontFiles.forEach(fontFile => {
    const fontPath = getFontPath(fontFile);
    if (!fs.existsSync(fontPath)) {
        console.warn(`Warning: Font file does not exist: ${fontPath}`);
    }
});

// Font definitions
const fonts = {
    DejaVuSans: {
        normal: getFontPath('DejaVuSans.ttf'),
        bold: getFontPath('DejaVuSans-Bold.ttf'),
        italics: getFontPath('DejaVuSans-Oblique.ttf'),
        bolditalics: getFontPath('DejaVuSans-BoldOblique.ttf')
    }
};

const printer = new PdfPrinter(fonts);

// Helper functions
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

const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    } catch (e) {
        return dateString;
    }
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

export const generateInvoicePDF = async (req, res) => {
    try {
        const billId = req.params.id;
        console.log('PDF Request - billId:', billId, 'Type:', typeof billId);
        if (!billId) return res.status(400).json({ error: 'Bill ID is required' });

        // Get firm_id from authenticated user
        const firmId = req.user?.firm_id;
        console.log('PDF Request - firmId:', firmId, 'Type:', typeof firmId);

        console.log('PDF Request - firmId:', firmId);
        if (!firmId) return res.status(401).json({ error: 'Unauthorized - No firm associated' });

        const bill = await Bill.findOne({ _id: billId, firm_id: firmId }).lean();
        console.log('PDF Request - bill found:', !!bill, 'Bill data:', bill);
        if (!bill) return res.status(404).json({ error: 'Bill not found' });

        const items = await StockReg.find({ bill_id: billId, firm_id: firmId }).lean();
        console.log('PDF Request - items found:', items.length, 'Items:', items);

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

        console.log('PDF Request - seller info:', seller);
        console.log('PDF Request - bill type:', getBillType(bill));
        console.log('PDF Request - gstEnabled:', gstEnabled);

        const billType = getBillType(bill);
        const partyLabels = getPartyLabels(bill);
        const hsnSummary = buildHsnSummary(bill, items, otherCharges, gstEnabled);

        console.log('PDF Request - about to create PDF docDefinition');

        const formattedBuyerAddress = bill.addr && bill.pin ? `${bill.addr}, PIN: ${bill.pin}` : (bill.addr || `PIN: ${bill.pin}`);
        const formattedConsigneeAddress = (bill.consignee_address || bill.addr) && (bill.consignee_pin || bill.pin) ?
            `${bill.consignee_address || bill.addr}, PIN: ${bill.consignee_pin || bill.pin}` :
            ((bill.consignee_address || bill.addr) || `PIN: ${bill.consignee_pin || bill.pin}`);

        const taxableValue = bill.gtot || 0;
        const totalTax = gstEnabled ? ((bill.cgst || 0) + (bill.sgst || 0) + (bill.igst || 0)) : 0;
        const grandTotal = gstEnabled ? (bill.ntot || 0) : taxableValue;
        const roundedGrandTotal = Math.round(grandTotal);
        const roundOff = roundedGrandTotal - grandTotal;

        // ── Design Tokens ─────────────────────────────────────────────────────
        const C = {
            primary:      '#1B3A6B',   // deep navy
            primaryLight: '#2A5298',   // medium navy/blue
            accent:       '#1B3A6B',   // header bar colour
            accentBg:     '#EBF0FA',   // very light blue tint
            headerText:   '#FFFFFF',   // white text on coloured headers
            border:       '#C8D4E8',   // cool grey border
            borderDark:   '#1B3A6B',   // navy border
            rowAlt:       '#F4F7FC',   // alternate row tint
            textDark:     '#1A1A2E',
            textMid:      '#3D4D6A',
            textLight:    '#6B7A99',
            green:        '#166534',
            red:          '#991B1B',
        };

        // Build Doc Definition
        const docDefinition = {
            defaultStyle: {
                font: 'DejaVuSans',
                fontSize: 8.5,
                color: C.textDark,
                lineHeight: 1.2
            },
            content: [
                // ── Top colour bar + company + invoice meta ────────────────────
                {
                    table: {
                        widths: ['*', 185],
                        body: [[
                            // LEFT: company block on coloured bar
                            {
                                fillColor: C.primary,
                                stack: [
                                    { text: getInvoiceTypeLabel(bill), style: 'invoiceTypeLabel' },
                                    { text: gstEnabled ? 'TAX INVOICE UNDER GST' : 'INVOICE (GST DISABLED)', style: 'invoiceSubTag' },
                                    {
                                        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 340, y2: 0, lineWidth: 0.5, lineColor: '#4A6FA5' }],
                                        margin: [0, 5, 0, 5]
                                    },
                                    { text: seller.name, style: 'companyName' },
                                    { text: seller.address, style: 'companyMeta' },
                                    {
                                        columns: [
                                            { text: seller.gstin ? `GSTIN: ${seller.gstin}` : '', style: 'companyMeta', width: '*' },
                                        ]
                                    }
                                ],
                                margin: [10, 10, 8, 10]
                            },
                            // RIGHT: invoice details table on coloured bar
                            {
                                fillColor: C.primaryLight,
                                stack: [
                                    {
                                        table: {
                                            widths: ['auto', '*'],
                                            body: [
                                                [
                                                    { text: 'Invoice No', style: 'metaLabel' },
                                                    { text: bill.bno || '', style: 'metaValue' }
                                                ],
                                                [
                                                    { text: 'Date', style: 'metaLabel' },
                                                    { text: formatDate(bill.bdate) || '', style: 'metaValue' }
                                                ],
                                                ...(bill.order_no ? [[
                                                    { text: 'PO No', style: 'metaLabel' },
                                                    { text: bill.order_no, style: 'metaValue' }
                                                ]] : []),
                                                ...(bill.vehicle_no ? [[
                                                    { text: 'Vehicle No', style: 'metaLabel' },
                                                    { text: bill.vehicle_no, style: 'metaValue' }
                                                ]] : []),
                                                ...(bill.dispatch_through ? [[
                                                    { text: 'Dispatch Via', style: 'metaLabel' },
                                                    { text: bill.dispatch_through, style: 'metaValue' }
                                                ]] : [])
                                            ]
                                        },
                                        layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 6, paddingTop: () => 2, paddingBottom: () => 2 }
                                    }
                                ],
                                margin: [8, 10, 10, 10]
                            }
                        ]]
                    },
                    layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
                    margin: [0, 0, 0, 0]
                },

                // ── Party Details ─────────────────────────────────────────────
                {
                    table: {
                        widths: ['*', '*'],
                        body: [[
                            // Bill To
                            {
                                stack: [
                                    { text: partyLabels.billTo.toUpperCase(), style: 'partyBoxTitle' },
                                    { text: bill.supply || '', style: 'partyName', margin: [0, 3, 0, 1] },
                                    { text: formattedBuyerAddress, style: 'partyMeta' },
                                    { text: bill.state ? `State: ${bill.state}` : '', style: 'partyMeta' },
                                    { text: bill.gstin ? `GSTIN: ${bill.gstin}` : '', style: 'partyGstin' },
                                ],
                                fillColor: C.accentBg,
                                margin: [8, 7, 8, 7]
                            },
                            // Ship To
                            {
                                stack: [
                                    { text: partyLabels.shipTo.toUpperCase(), style: 'partyBoxTitle' },
                                    { text: bill.consignee_name || bill.party_id || '', style: 'partyName', margin: [0, 3, 0, 1] },
                                    { text: formattedConsigneeAddress, style: 'partyMeta' },
                                    { text: (bill.consignee_state || bill.state) ? `State: ${bill.consignee_state || bill.state}` : '', style: 'partyMeta' },
                                    { text: (bill.consignee_gstin || bill.gstin) ? `GSTIN: ${bill.consignee_gstin || bill.gstin}` : '', style: 'partyGstin' },
                                ],
                                fillColor: '#FFFFFF',
                                margin: [8, 7, 8, 7]
                            }
                        ]]
                    },
                    layout: {
                        hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 1.5 : 0,
                        vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length) ? 1.5 : 1,
                        hLineColor: () => C.borderDark,
                        vLineColor: (i) => i === 1 ? C.border : C.borderDark,
                        paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0
                    },
                    margin: [0, 8, 0, 8]
                },

                // ── Items Table ───────────────────────────────────────────────
                {
                    table: {
                        headerRows: 1,
                        widths: [15, '*', 52, 33, 26, 55, 38, 40, 70],
                        body: [
                            // Header row
                            [
                                { text: '#', style: 'tblHdr', alignment: 'center' },
                                { text: 'Description of Goods / Services', style: 'tblHdr' },
                                { text: 'HSN/SAC', style: 'tblHdr', alignment: 'center' },
                                { text: 'Qty', style: 'tblHdr', alignment: 'center' },
                                { text: 'UOM', style: 'tblHdr', alignment: 'center' },
                                { text: 'Rate (₹)', style: 'tblHdr', alignment: 'right' },
                                { text: 'Disc%', style: 'tblHdr', alignment: 'right' },
                                { text: 'GST%', style: 'tblHdr', alignment: 'right' },
                                { text: 'Amount (₹)', style: 'tblHdr', alignment: 'right' }
                            ],
                            // Item rows
                            ...items.map((it, idx) => [
                                { text: idx + 1, alignment: 'center', style: 'tblCell', fillColor: idx % 2 === 1 ? C.rowAlt : null },
                                {
                                    stack: [
                                        { text: it.item || '', bold: true, fontSize: 8.5 },
                                        ...(it.batch ? [{ text: `Batch: ${it.batch}`, fontSize: 7.5, color: C.textLight }] : []),
                                        ...(it.item_narration ? [{ text: it.item_narration, fontSize: 7.5, color: C.textLight }] : [])
                                    ],
                                    style: 'tblCell', fillColor: idx % 2 === 1 ? C.rowAlt : null
                                },
                                { text: it.hsn || '', alignment: 'center', style: 'tblCell', fillColor: idx % 2 === 1 ? C.rowAlt : null },
                                { text: formatQuantity(it.qty), alignment: 'center', style: 'tblCell', fillColor: idx % 2 === 1 ? C.rowAlt : null },
                                { text: it.uom || '', alignment: 'center', style: 'tblCell', fillColor: idx % 2 === 1 ? C.rowAlt : null },
                                { text: formatCurrency(it.rate), alignment: 'right', style: 'tblCell', fillColor: idx % 2 === 1 ? C.rowAlt : null },
                                { text: formatPercentage(it.disc), alignment: 'right', style: 'tblCell', fillColor: idx % 2 === 1 ? C.rowAlt : null },
                                { text: gstEnabled ? formatPercentage(it.grate) : '-', alignment: 'right', style: 'tblCell', fillColor: idx % 2 === 1 ? C.rowAlt : null },
                                { text: formatCurrency(it.total), alignment: 'right', bold: true, style: 'tblCell', color: C.primary, fillColor: idx % 2 === 1 ? C.rowAlt : null }
                            ]),
                            // Other charges rows
                            ...otherCharges.map((ch, idx) => [
                                { text: items.length + idx + 1, alignment: 'center', style: 'tblCell', fillColor: (items.length + idx) % 2 === 1 ? C.rowAlt : null },
                                {
                                    stack: [
                                        { text: ch.name || ch.type || 'Other Charge', bold: true, fontSize: 8.5 },
                                        { text: `HSN/SAC: ${ch.hsnSac || ''}`, fontSize: 7.5, color: C.textLight }
                                    ],
                                    style: 'tblCell', fillColor: (items.length + idx) % 2 === 1 ? C.rowAlt : null
                                },
                                { text: ch.hsnSac || '', alignment: 'center', style: 'tblCell', fillColor: (items.length + idx) % 2 === 1 ? C.rowAlt : null },
                                { text: '1', alignment: 'center', style: 'tblCell', fillColor: (items.length + idx) % 2 === 1 ? C.rowAlt : null },
                                { text: 'NOS', alignment: 'center', style: 'tblCell', fillColor: (items.length + idx) % 2 === 1 ? C.rowAlt : null },
                                { text: formatCurrency(ch.amount), alignment: 'right', style: 'tblCell', fillColor: (items.length + idx) % 2 === 1 ? C.rowAlt : null },
                                { text: '0.00%', alignment: 'right', style: 'tableCell' },
                                { text: gstEnabled ? formatPercentage(ch.gstRate) : '-', alignment: 'right', style: 'tableCell' },
                                { text: formatCurrency(ch.amount), alignment: 'right', bold: true, style: 'tableCell' }
                            ])
                        ]
                    },
                    layout: {
                        hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 1.5 : 0.5,
                        vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length) ? 1.5 : 0.5,
                        hLineColor: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? C.borderDark : C.border,
                        vLineColor: () => C.border,
                        paddingLeft: () => 5,
                        paddingRight: () => 5,
                        paddingTop: () => 4,
                        paddingBottom: () => 4
                    }
                },

                // ── HSN / SAC Summary ─────────────────────────────────────────
                ...(hsnSummary.length > 0 && gstEnabled ? [
                    {
                        stack: [
                            {
                                table: {
                                    headerRows: 1,
                                    widths: [60, '*', 72, 72, 72, 85],
                                    body: [
                                        [
                                            { text: 'HSN/SAC', style: 'hsnHdr', alignment: 'center' },
                                            { text: 'Taxable Value', style: 'hsnHdr', alignment: 'right' },
                                            { text: 'CGST (₹)', style: 'hsnHdr', alignment: 'right' },
                                            { text: 'SGST (₹)', style: 'hsnHdr', alignment: 'right' },
                                            { text: 'IGST (₹)', style: 'hsnHdr', alignment: 'right' },
                                            { text: 'Total Tax (₹)', style: 'hsnHdr', alignment: 'right' }
                                        ],
                                        ...hsnSummary.map((row, idx) => [
                                            { text: row.hsn, alignment: 'center', style: 'hsnCell', fillColor: idx % 2 === 1 ? C.rowAlt : null },
                                            { text: formatCurrency(row.taxableValue), alignment: 'right', style: 'hsnCell', fillColor: idx % 2 === 1 ? C.rowAlt : null },
                                            { text: billType === 'intra-state' ? formatCurrency(row.cgst) : '—', alignment: 'right', style: 'hsnCell', fillColor: idx % 2 === 1 ? C.rowAlt : null },
                                            { text: billType === 'intra-state' ? formatCurrency(row.sgst) : '—', alignment: 'right', style: 'hsnCell', fillColor: idx % 2 === 1 ? C.rowAlt : null },
                                            { text: billType === 'inter-state' ? formatCurrency(row.igst) : '—', alignment: 'right', style: 'hsnCell', fillColor: idx % 2 === 1 ? C.rowAlt : null },
                                            { text: formatCurrency(row.totalTax), alignment: 'right', style: 'hsnCell', bold: true, color: C.primary, fillColor: idx % 2 === 1 ? C.rowAlt : null }
                                        ])
                                    ]
                                },
                                layout: {
                                    hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 1.5 : 0.5,
                                    vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length) ? 1.5 : 0.5,
                                    hLineColor: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? C.borderDark : C.border,
                                    vLineColor: () => C.border,
                                    paddingLeft: () => 5,
                                    paddingRight: () => 5,
                                    paddingTop: () => 3,
                                    paddingBottom: () => 3
                                }
                            }
                        ],
                        margin: [0, 8, 0, 0]
                    }
                ] : []),

                // ── Footer: Amount Words + Totals ─────────────────────────────
                {
                    table: {
                        widths: ['*', 200],
                        body: [[
                            // LEFT: amount in words + narration
                            {
                                stack: [
                                    { text: 'AMOUNT IN WORDS', style: 'footerSectionTitle' },
                                    { text: numberToWords(roundedGrandTotal), bold: true, fontSize: 9, color: C.primary, margin: [0, 3, 0, 0] },
                                    ...(bill.narration ? [
                                        { text: 'NARRATION', style: 'footerSectionTitle', margin: [0, 8, 0, 2] },
                                        { text: bill.narration, fontSize: 8.5, color: C.textMid }
                                    ] : [])
                                ],
                                margin: [8, 8, 8, 8]
                            },
                            // RIGHT: tax summary
                            {
                                stack: [
                                    {
                                        table: {
                                            widths: ['*', 80],
                                            body: [
                                                [
                                                    { text: 'Taxable Value', style: 'totLabel' },
                                                    { text: formatCurrency(taxableValue), alignment: 'right', style: 'totValue' }
                                                ],
                                                ...(gstEnabled ? (
                                                    billType === 'intra-state' ? [
                                                        [{ text: 'Add: CGST', style: 'totLabel' }, { text: formatCurrency(bill.cgst), alignment: 'right', style: 'totValue' }],
                                                        [{ text: 'Add: SGST', style: 'totLabel' }, { text: formatCurrency(bill.sgst), alignment: 'right', style: 'totValue' }]
                                                    ] : [
                                                        [{ text: 'Add: IGST', style: 'totLabel' }, { text: formatCurrency(bill.igst), alignment: 'right', style: 'totValue' }]
                                                    ]
                                                ) : []),
                                                [{ text: 'Total Tax', style: 'totLabel' }, { text: formatCurrency(totalTax), alignment: 'right', style: 'totValue' }],
                                                [{ text: 'Round Off', style: 'totLabel' }, { text: formatCurrency(roundOff), alignment: 'right', style: 'totValue' }],
                                                [
                                                    { text: 'GRAND TOTAL', style: 'grandTotLabel', fillColor: C.primary },
                                                    { text: formatCurrency(roundedGrandTotal), alignment: 'right', style: 'grandTotValue', fillColor: C.primary }
                                                ]
                                            ]
                                        },
                                        layout: {
                                            hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 1 : 0.5,
                                            vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length) ? 1 : 0,
                                            hLineColor: (i, node) => (i === 0 || i === node.table.body.length) ? C.borderDark : C.border,
                                            vLineColor: () => C.border,
                                            paddingLeft: () => 6,
                                            paddingRight: () => 6,
                                            paddingTop: () => 3,
                                            paddingBottom: () => 3
                                        }
                                    },
                                    ...(bill.reverse_charge && gstEnabled ? [
                                        { text: '* Reverse charge applicable. Tax liability on recipient.', fontSize: 7.5, color: C.red, margin: [0, 5, 0, 0], alignment: 'right' }
                                    ] : [])
                                ],
                                margin: [0, 0, 0, 0]
                            }
                        ]]
                    },
                    layout: {
                        hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 1.5 : 0,
                        vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length) ? 1.5 : 1,
                        hLineColor: () => C.borderDark,
                        vLineColor: (i) => i === 1 ? C.border : C.borderDark,
                        paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0
                    },
                    margin: [0, 10, 0, 0]
                },

                // ── Signatures ────────────────────────────────────────────────
                {
                    table: {
                        widths: ['*', '*'],
                        body: [[
                            {
                                stack: [
                                    { text: 'TERMS & CONDITIONS', style: 'footerSectionTitle', margin: [0, 0, 0, 4] },
                                    { text: '1. Goods once sold will not be taken back.', fontSize: 7.5, color: C.textLight },
                                    { text: '2. Subject to local jurisdiction only.', fontSize: 7.5, color: C.textLight },
                                    { text: '3. E. & O.E.', fontSize: 7.5, color: C.textLight },
                                    {
                                        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 130, y2: 0, lineWidth: 0.75, lineColor: C.border }],
                                        margin: [0, 28, 0, 4]
                                    },
                                    { text: "Receiver's Signature", style: 'sigLabel' },
                                    { text: '(Authorised Signatory)', fontSize: 7.5, color: C.textLight }
                                ],
                                margin: [8, 8, 8, 8]
                            },
                            {
                                stack: [
                                    { text: `For ${seller.name}`, bold: true, fontSize: 9, color: C.primary, alignment: 'right', margin: [0, 0, 0, 4] },
                                    { text: gstEnabled ? `GSTIN: ${seller.gstin}` : '', fontSize: 7.5, color: C.textLight, alignment: 'right' },
                                    {
                                        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 130, y2: 0, lineWidth: 0.75, lineColor: C.border }],
                                        margin: [85, 30, 0, 4]
                                    },
                                    { text: 'Authorised Signatory', style: 'sigLabel', alignment: 'right' },
                                    { text: 'This is a computer generated invoice', fontSize: 7, color: C.textLight, alignment: 'right', margin: [0, 10, 0, 0], italics: true }
                                ],
                                margin: [8, 8, 8, 8]
                            }
                        ]]
                    },
                    layout: {
                        hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 1.5 : 0,
                        vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length) ? 1.5 : 1,
                        hLineColor: () => C.borderDark,
                        vLineColor: (i) => i === 1 ? C.border : C.borderDark,
                        paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0
                    },
                    margin: [0, 8, 0, 0]
                }
            ],
            styles: {
                // Header bar
                invoiceTypeLabel:  { fontSize: 17, bold: true, color: '#FFFFFF', margin: [0, 0, 0, 2] },
                invoiceSubTag:     { fontSize: 7.5, color: '#BFD0F0', letterSpacing: 1 },
                companyName:       { fontSize: 12, bold: true, color: '#FFFFFF' },
                companyMeta:       { fontSize: 8, color: '#BFD0F0', margin: [0, 1, 0, 0] },
                metaLabel:         { fontSize: 8, color: '#BFD0F0', bold: false },
                metaValue:         { fontSize: 8.5, bold: true, color: '#FFFFFF' },
                // Party boxes
                partyBoxTitle:     { fontSize: 7.5, bold: true, color: C.primary, letterSpacing: 0.5 },
                partyName:         { fontSize: 9.5, bold: true, color: C.textDark },
                partyMeta:         { fontSize: 8, color: C.textMid, margin: [0, 1, 0, 0] },
                partyGstin:        { fontSize: 8, bold: true, color: C.primary, margin: [0, 2, 0, 0] },
                // Items table
                tblHdr:            { fontSize: 8, bold: true, color: C.headerText, fillColor: C.primary, margin: [0, 2, 0, 2] },
                tblCell:           { fontSize: 8.5, margin: [0, 2, 0, 2] },
                // HSN table
                hsnHdr:            { fontSize: 7.5, bold: true, color: C.headerText, fillColor: C.primaryLight, margin: [0, 2, 0, 2] },
                hsnCell:           { fontSize: 8, margin: [0, 1, 0, 1] },
                sectionTitle:      { fontSize: 8.5, bold: true, color: C.primary, margin: [0, 0, 0, 3] },
                // Footer totals
                footerSectionTitle:{ fontSize: 7.5, bold: true, color: C.primary, margin: [0, 0, 0, 2] },
                totLabel:          { fontSize: 8.5, color: C.textMid },
                totValue:          { fontSize: 8.5, bold: true, color: C.textDark },
                grandTotLabel:     { fontSize: 10, bold: true, color: '#FFFFFF' },
                grandTotValue:     { fontSize: 11, bold: true, color: '#FFFFFF' },
                // Signatures
                sigLabel:          { fontSize: 8, color: C.textMid },
                // Legacy (kept for any remaining references)
                label:             { fontSize: 8.5, color: C.textLight },
                value:             { fontSize: 8.5, bold: true },
                boxTitle:          { fontSize: 9, bold: true, color: C.primary },
                grandLabel:        { fontSize: 10, bold: true, color: '#FFFFFF' },
                grandValue:        { fontSize: 12, bold: true, color: '#FFFFFF' }
            },
            pageMargins: [30, 30, 30, 30]
        };

        const pdfDoc = await printer.createPdfKitDocument(docDefinition);
        console.log('PDF document created successfully');

        const safeBillNo = String(bill.bno || `BILL-${bill._id}`).replace(/[^a-zA-Z0-9._-]/g, '_');
        const filename = `Invoice_${safeBillNo}.pdf`;
        console.log('PDF filename:', filename);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        pdfDoc.pipe(res);
        pdfDoc.on('end', () => {
            console.log('PDF generation completed');
        });
        pdfDoc.on('error', (err) => {
            console.error('PDF generation error:', err);
        });
        pdfDoc.end();
        console.log('PDF sent to client');

    } catch (err) {
        console.error('pdfmake export error:', err);
        console.error('Error stack:', err.stack);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        } else {
            res.end();
        }
    }
};
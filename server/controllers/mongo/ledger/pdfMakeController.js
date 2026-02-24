

import PrinterModule       from 'pdfmake/js/Printer.js';
import path                from 'path';
import fs                  from 'fs';
import { fileURLToPath }   from 'url';
import mongoose            from 'mongoose';
import { Ledger, Firm }    from '../../../models/index.js';

const PdfPrinter = PrinterModule.default;

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

/* ── FONT SETUP (identical to SQLite version) ─────────────────────────── */

const getFontPath = (fileName) =>
  path.join(process.cwd(), 'client', 'public', 'fonts', fileName);

const fontFiles = [
  'DejaVuSans.ttf',
  'DejaVuSans-Bold.ttf',
  'DejaVuSans-Oblique.ttf',
  'DejaVuSans-BoldOblique.ttf',
];
fontFiles.forEach(f => {
  if (!fs.existsSync(getFontPath(f))) console.warn(`Warning: Font file not found: ${getFontPath(f)}`);
});

const fonts = {
  DejaVuSans: {
    normal:      getFontPath('DejaVuSans.ttf'),
    bold:        getFontPath('DejaVuSans-Bold.ttf'),
    italics:     getFontPath('DejaVuSans-Oblique.ttf'),
    bolditalics: getFontPath('DejaVuSans-BoldOblique.ttf'),
  },
};
const printer = new PdfPrinter(fonts);

/* ── FORMATTING HELPERS ───────────────────────────────────────────────── */

const formatINR = (n) =>
  '₹ ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));

const formatDate = (d) => {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-IN'); } catch { return d; }
};

const dateRangeText = (start, end) => {
  if (start && end) return `${start} to ${end}`;
  if (start)        return `From ${start}`;
  if (end)          return `To ${end}`;
  return null;
};

/* ── SHARED PDFMAKE STYLES ────────────────────────────────────────────── */

const baseStyles = {
  headerFirmName: { fontSize: 14, bold: true,  color: '#111827' },
  title:          { fontSize: 18, bold: true,  color: '#111827', decoration: 'underline', decorationStyle: 'solid' },
  accountInfo:    { fontSize: 12, bold: true,  color: '#374151' },
  dateRange:      { fontSize: 10,              color: '#4B5563' },
  generatedOn:    { fontSize: 9,  italics: true, color: '#6B7280' },
  tableHeader:    { fontSize: 9,  bold: true,  color: '#374151', fillColor: '#F9FAFB' },
  tableCell:      { fontSize: 8,  margin: [3, 4, 3, 4] },
  summaryTitle:   { fontSize: 10, bold: true,  color: '#111827', fillColor: '#F3F4F6' },
  summaryLabel:   { fontSize: 9,  bold: true,  color: '#374151', margin: [0, 5, 0, 5] },
  summaryValue:   { fontSize: 9,               color: '#111827', margin: [0, 5, 0, 5] },
  totalLabel:     { fontSize: 9,  bold: true,  color: '#111827', fillColor: '#F3F4F6' },
  totalValue:     { fontSize: 9,  bold: true,  color: '#111827', fillColor: '#F3F4F6' },
};

const tableLayout = {
  hLineWidth:   (i, n) => i === 0 || i === n.table.body.length ? 1 : 0.5,
  vLineWidth:   ()     => 0.5,
  hLineColor:   (i, n) => i === 0 || i === n.table.body.length ? '#374151' : '#E5E7EB',
  vLineColor:   ()     => '#E5E7EB',
  paddingLeft:  ()     => 5,
  paddingRight: ()     => 5,
  paddingTop:   ()     => 5,
  paddingBottom:()     => 5,
};

/* ── EXPORT ACCOUNT LEDGER PDF ────────────────────────────────────────── */

export const exportAccountLedgerPdf = async (req, res) => {
  try {
    const { account_head } = req.params;
    const { start_date, end_date } = req.query;

    if (!req.user?.firm_id) return res.status(403).json({ error: 'User is not associated with any firm' });

    const firmId = req.user.firm_id;

    // Firm info — firm_id auto-cast by findById
    const firm     = await Firm.findById(firmId).select('name address').lean();
    const firmName = firm?.name    ?? 'Unknown Firm';

    // Ledger records for this account
    const filter = { firm_id: firmId, account_head };
    if (start_date) filter.transaction_date = { ...filter.transaction_date, $gte: start_date };
    if (end_date)   filter.transaction_date = { ...filter.transaction_date, $lte: end_date };

    const rawRecords = await Ledger.find(filter).sort({ transaction_date: 1, createdAt: 1 }).lean();

    if (!rawRecords.length) return res.status(404).json({ error: 'No ledger records found for this account' });

    // Running balance
    let runningBalance = 0;
    const records = rawRecords.map(r => {
      const balance_before = runningBalance;
      runningBalance += (r.debit_amount || 0) - (r.credit_amount || 0);
      return { ...r, running_balance: balance_before, balance_after: runningBalance };
    });

    const totalDebits   = records.reduce((s, r) => s + (r.debit_amount  || 0), 0);
    const totalCredits  = records.reduce((s, r) => s + (r.credit_amount || 0), 0);
    const closingBalance = runningBalance;

    const rangeText  = dateRangeText(start_date ? formatDate(start_date) : null, end_date ? formatDate(end_date) : null);

    const docDefinition = {
      pageSize:    'A4',
      pageMargins: [20, 60, 20, 60],
      defaultStyle: { font: 'DejaVuSans' },
      header: {
        columns: [
          { text: firmName, style: 'headerFirmName', margin: [40, 20, 0, 5] },
          { text: 'Page 1',  alignment: 'right',      margin: [0,  20, 40, 5], fontSize: 9 },
        ],
      },
      content: [
        { text: 'LEDGER REPORT',          style: 'title',       alignment: 'center', margin: [0, 0, 0, 20] },
        { text: `Account: ${account_head}`, style: 'accountInfo', margin: [0, 0, 0, 5]  },
        ...(rangeText ? [{ text: `Date Range: ${rangeText}`, style: 'dateRange', margin: [0, 0, 0, 10] }] : []),
        { text: `Generated on: ${new Date().toLocaleString('en-IN')}`, style: 'generatedOn', margin: [0, 0, 0, 20] },
        {
          table: {
            headerRows: 1,
            widths:     ['auto', 'auto', 'auto', 'auto', '*', '*', '*'],
            body: [
              [
                { text: 'Date',         style: 'tableHeader', alignment: 'center' },
                { text: 'Voucher No',   style: 'tableHeader', alignment: 'center' },
                { text: 'Voucher Type', style: 'tableHeader', alignment: 'center' },
                { text: 'Narration',    style: 'tableHeader', alignment: 'center' },
                { text: 'Debit',        style: 'tableHeader', alignment: 'right'  },
                { text: 'Credit',       style: 'tableHeader', alignment: 'right'  },
                { text: 'Balance',      style: 'tableHeader', alignment: 'right'  },
              ],
              ...records.map(r => [
                { text: formatDate(r.transaction_date),    style: 'tableCell', alignment: 'center' },
                { text: r.voucher_no    || '',             style: 'tableCell', alignment: 'center' },
                { text: r.voucher_type  || '',             style: 'tableCell', alignment: 'center' },
                { text: r.narration     || '',             style: 'tableCell' },
                { text: r.debit_amount  > 0 ? formatINR(r.debit_amount)  : '', style: 'tableCell', alignment: 'right', color: r.debit_amount  > 0 ? '#059669' : undefined },
                { text: r.credit_amount > 0 ? formatINR(r.credit_amount) : '', style: 'tableCell', alignment: 'right', color: r.credit_amount > 0 ? '#DC2626' : undefined },
                {
                  text:  formatINR(Math.abs(r.balance_after)) + (r.balance_after > 0 ? ' DR' : r.balance_after < 0 ? ' CR' : ''),
                  style: 'tableCell', alignment: 'right', bold: true,
                  color: r.balance_after > 0 ? '#059669' : r.balance_after < 0 ? '#DC2626' : undefined,
                },
              ]),
            ],
          },
          layout: tableLayout,
        },
        {
          margin: [0, 20, 0, 0],
          table: {
            widths: ['*', 'auto', 'auto'],
            body: [
              [{ text: 'SUMMARY', style: 'summaryTitle', colSpan: 3, alignment: 'center' }, {}, {}],
              [{ text: 'Total Debits:',    style: 'summaryLabel' }, { text: formatINR(totalDebits),   style: 'summaryValue', alignment: 'right' }, {}],
              [{ text: 'Total Credits:',   style: 'summaryLabel' }, { text: formatINR(totalCredits),  style: 'summaryValue', alignment: 'right' }, {}],
              [
                { text: 'Closing Balance:', style: 'summaryLabel' },
                { text: formatINR(Math.abs(closingBalance)) + (closingBalance > 0 ? ' DR' : closingBalance < 0 ? ' CR' : ''), style: 'summaryValue', alignment: 'right', bold: true },
                {},
              ],
            ],
          },
          layout: 'noBorders',
        },
      ],
      styles: baseStyles,
    };

    const pdfDoc  = await printer.createPdfKitDocument(docDefinition);
    const safeName = String(account_head || 'LEDGER').replace(/[^a-zA-Z0-9._-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Ledger_${safeName}.pdf"`);
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (err) {
    console.error('Ledger PDF generation error:', err);
    res.status(500).json({ error: 'Error generating PDF: ' + err.message });
  }
};

/* ── EXPORT GENERAL LEDGER PDF ────────────────────────────────────────── */

export const exportGeneralLedgerPdf = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    if (!req.user?.firm_id) return res.status(403).json({ error: 'User is not associated with any firm' });

    const firmId = req.user.firm_id;
    const firm   = await Firm.findById(firmId).select('name').lean();
    const firmName = firm?.name ?? 'Unknown Firm';

    // Aggregate per account — must use ObjectId in $match
    const matchStage = { firm_id: new mongoose.Types.ObjectId(firmId) };
    if (start_date) matchStage.transaction_date = { ...matchStage.transaction_date, $gte: start_date };
    if (end_date)   matchStage.transaction_date = { ...matchStage.transaction_date, $lte: end_date };

    const rawAccounts = await Ledger.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id:          { account_head: '$account_head', account_type: '$account_type' },
          total_debit:  { $sum: '$debit_amount'  },
          total_credit: { $sum: '$credit_amount' },
        },
      },
      {
        $project: {
          _id:          0,
          account_head: '$_id.account_head',
          account_type: '$_id.account_type',
          total_debit:  1,
          total_credit: 1,
          balance:      { $subtract: ['$total_debit', '$total_credit'] },
        },
      },
      { $sort: { account_head: 1 } },
    ]);

    if (!rawAccounts.length) return res.status(404).json({ error: 'No ledger accounts found' });

    const rangeText = dateRangeText(start_date ? formatDate(start_date) : null, end_date ? formatDate(end_date) : null);

    const docDefinition = {
      pageSize:    'A4',
      pageMargins: [20, 60, 20, 60],
      defaultStyle: { font: 'DejaVuSans' },
      header: {
        columns: [
          { text: firmName, style: 'headerFirmName', margin: [40, 20, 0, 5] },
          { text: 'Page 1',  alignment: 'right',      margin: [0,  20, 40, 5], fontSize: 9 },
        ],
      },
      content: [
        { text: 'GENERAL LEDGER REPORT', style: 'title',       alignment: 'center', margin: [0, 0, 0, 20] },
        { text: `Firm: ${firmName}`,      style: 'accountInfo', margin: [0, 0, 0, 5]  },
        ...(rangeText ? [{ text: `Date Range: ${rangeText}`, style: 'dateRange', margin: [0, 0, 0, 10] }] : []),
        { text: `Generated on: ${new Date().toLocaleString('en-IN')}`, style: 'generatedOn', margin: [0, 0, 0, 20] },
        {
          table: {
            headerRows: 1,
            widths:     ['*', 'auto', 'auto', 'auto', 'auto'],
            body: [
              [
                { text: 'Account Head', style: 'tableHeader', alignment: 'left'   },
                { text: 'Account Type', style: 'tableHeader', alignment: 'center' },
                { text: 'Debits',       style: 'tableHeader', alignment: 'right'  },
                { text: 'Credits',      style: 'tableHeader', alignment: 'right'  },
                { text: 'Balance',      style: 'tableHeader', alignment: 'right'  },
              ],
              ...rawAccounts.map(a => [
                { text: a.account_head || '', style: 'tableCell' },
                { text: a.account_type || '', style: 'tableCell', alignment: 'center' },
                { text: formatINR(a.total_debit),  style: 'tableCell', alignment: 'right', color: a.total_debit  > 0 ? '#059669' : undefined },
                { text: formatINR(a.total_credit), style: 'tableCell', alignment: 'right', color: a.total_credit > 0 ? '#DC2626' : undefined },
                {
                  text:  formatINR(Math.abs(a.balance)) + (a.balance > 0 ? ' DR' : a.balance < 0 ? ' CR' : ''),
                  style: 'tableCell', alignment: 'right', bold: true,
                  color: a.balance > 0 ? '#059669' : a.balance < 0 ? '#DC2626' : undefined,
                },
              ]),
            ],
          },
          layout: tableLayout,
        },
      ],
      styles: baseStyles,
    };

    const pdfDoc = await printer.createPdfKitDocument(docDefinition);
    const filename = `General_Ledger_${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (err) {
    console.error('General Ledger PDF generation error:', err);
    res.status(500).json({ error: 'Error generating PDF: ' + err.message });
  }
};

/* ── EXPORT TRIAL BALANCE PDF ─────────────────────────────────────────── */

export const exportTrialBalancePdf = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    if (!req.user?.firm_id) return res.status(403).json({ error: 'User is not associated with any firm' });

    const firmId   = req.user.firm_id;
    const firm     = await Firm.findById(firmId).select('name').lean();
    const firmName = firm?.name ?? 'Unknown Firm';

    const matchStage = { firm_id: new mongoose.Types.ObjectId(firmId) }; // ⚠️ cast for aggregate
    if (start_date) matchStage.transaction_date = { ...matchStage.transaction_date, $gte: start_date };
    if (end_date)   matchStage.transaction_date = { ...matchStage.transaction_date, $lte: end_date };

    const accounts = await Ledger.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id:          { account_head: '$account_head', account_type: '$account_type' },
          total_debit:  { $sum: '$debit_amount'  },
          total_credit: { $sum: '$credit_amount' },
        },
      },
      {
        $project: {
          _id:          0,
          account_head: '$_id.account_head',
          account_type: '$_id.account_type',
          total_debit:  1,
          total_credit: 1,
          balance:      { $subtract: ['$total_debit', '$total_credit'] },
        },
      },
      { $sort: { account_head: 1 } },
    ]);

    if (!accounts.length) return res.status(404).json({ error: 'No ledger accounts found' });

    const totalDebits   = accounts.reduce((s, a) => s + a.total_debit,  0);
    const totalCredits  = accounts.reduce((s, a) => s + a.total_credit, 0);
    const totalBalance  = accounts.reduce((s, a) => s + a.balance,      0);

    const rangeText = dateRangeText(start_date ? formatDate(start_date) : null, end_date ? formatDate(end_date) : null);

    const docDefinition = {
      pageSize:    'A4',
      pageMargins: [20, 60, 20, 60],
      defaultStyle: { font: 'DejaVuSans' },
      header: {
        columns: [
          { text: firmName, style: 'headerFirmName', margin: [40, 20, 0, 5] },
          { text: 'Page 1',  alignment: 'right',      margin: [0,  20, 40, 5], fontSize: 9 },
        ],
      },
      content: [
        { text: 'TRIAL BALANCE',     style: 'title',       alignment: 'center', margin: [0, 0, 0, 20] },
        { text: `Firm: ${firmName}`, style: 'accountInfo', margin: [0, 0, 0, 5]  },
        ...(rangeText ? [{ text: `Date Range: ${rangeText}`, style: 'dateRange', margin: [0, 0, 0, 10] }] : []),
        { text: `Generated on: ${new Date().toLocaleString('en-IN')}`, style: 'generatedOn', margin: [0, 0, 0, 20] },
        {
          table: {
            headerRows: 1,
            widths:     ['*', 'auto', 'auto', 'auto'],
            body: [
              [
                { text: 'Account Head', style: 'tableHeader', alignment: 'left'  },
                { text: 'Debits',       style: 'tableHeader', alignment: 'right' },
                { text: 'Credits',      style: 'tableHeader', alignment: 'right' },
                { text: 'Balance',      style: 'tableHeader', alignment: 'right' },
              ],
              ...accounts.map(a => [
                { text: a.account_head || '', style: 'tableCell' },
                { text: formatINR(a.total_debit),  style: 'tableCell', alignment: 'right', color: a.total_debit  > 0 ? '#059669' : undefined },
                { text: formatINR(a.total_credit), style: 'tableCell', alignment: 'right', color: a.total_credit > 0 ? '#DC2626' : undefined },
                {
                  text:  formatINR(Math.abs(a.balance)) + (a.balance > 0 ? ' DR' : a.balance < 0 ? ' CR' : ''),
                  style: 'tableCell', alignment: 'right',
                  color: a.balance > 0 ? '#059669' : a.balance < 0 ? '#DC2626' : undefined,
                },
              ]),
              // Totals row
              [
                { text: 'TOTALS',              style: 'totalLabel', bold: true },
                { text: formatINR(totalDebits),  style: 'totalValue', bold: true, alignment: 'right' },
                { text: formatINR(totalCredits), style: 'totalValue', bold: true, alignment: 'right' },
                { text: formatINR(Math.abs(totalBalance)) + (totalBalance > 0 ? ' DR' : totalBalance < 0 ? ' CR' : ''), style: 'totalValue', bold: true, alignment: 'right' },
              ],
            ],
          },
          layout: tableLayout,
        },
      ],
      styles: baseStyles,
    };

    const pdfDoc = await printer.createPdfKitDocument(docDefinition);
    const filename = `Trial_Balance_${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (err) {
    console.error('Trial Balance PDF generation error:', err);
    res.status(500).json({ error: 'Error generating PDF: ' + err.message });
  }
};

/* ── EXPORT ACCOUNT TYPE PDF (client supplies pre-shaped data) ──────── */

export const exportAccountTypePdf = async (req, res) => {
  try {
    const { accounts, account_type } = req.body;
    if (!req.user?.firm_id) return res.status(403).json({ error: 'User is not associated with any firm' });

    const firmId   = req.user.firm_id;
    const firm     = await Firm.findById(firmId).select('name').lean();
    const firmName = firm?.name ?? 'Unknown Firm';

    // Client sends pre-shaped accounts array (same as SQLite version)
    const parsedAccounts = typeof accounts === 'string' ? JSON.parse(accounts) : accounts;
    if (!parsedAccounts?.length) return res.status(404).json({ error: 'No account data provided' });

    const totalDebits  = parsedAccounts.reduce((s, a) => s + (a.total_debit  || 0), 0);
    const totalCredits = parsedAccounts.reduce((s, a) => s + (a.total_credit || 0), 0);
    const netBalance   = totalDebits - totalCredits;

    const docDefinition = {
      pageSize:    'A4',
      pageMargins: [20, 60, 20, 60],
      defaultStyle: { font: 'DejaVuSans' },
      header: {
        columns: [
          { text: firmName, style: 'headerFirmName', margin: [40, 20, 0, 5] },
          { text: 'Page 1',  alignment: 'right',      margin: [0,  20, 40, 5], fontSize: 9 },
        ],
      },
      content: [
        { text: 'ACCOUNT TYPE DETAILS',          style: 'title',       alignment: 'center', margin: [0, 0, 0, 20] },
        { text: `Account Type: ${account_type}`, style: 'accountInfo', margin: [0, 0, 0, 10] },
        { text: `Generated on: ${new Date().toLocaleString('en-IN')}`, style: 'generatedOn', margin: [0, 0, 0, 20] },
        {
          table: {
            headerRows: 1,
            widths:     ['*', 'auto', 'auto', 'auto'],
            body: [
              [
                { text: 'Account Head', style: 'tableHeader', alignment: 'center' },
                { text: 'Debit Total',  style: 'tableHeader', alignment: 'right'  },
                { text: 'Credit Total', style: 'tableHeader', alignment: 'right'  },
                { text: 'Balance',      style: 'tableHeader', alignment: 'right'  },
              ],
              ...parsedAccounts.map(a => {
                const bal = a.balance || 0;
                return [
                  { text: a.account_head,              style: 'tableCell' },
                  { text: formatINR(a.total_debit  || 0), style: 'tableCell', alignment: 'right', color: '#059669' },
                  { text: formatINR(a.total_credit || 0), style: 'tableCell', alignment: 'right', color: '#DC2626' },
                  {
                    text:  formatINR(Math.abs(bal)) + (bal > 0 ? ' DR' : bal < 0 ? ' CR' : ' 0'),
                    style: 'tableCell', alignment: 'right', bold: true,
                    color: bal > 0 ? '#059669' : bal < 0 ? '#DC2626' : undefined,
                  },
                ];
              }),
            ],
          },
          layout: tableLayout,
        },
        {
          margin: [0, 20, 0, 0],
          table: {
            widths: ['*', 'auto', 'auto'],
            body: [
              [{ text: 'SUMMARY', style: 'summaryTitle', colSpan: 3, alignment: 'center' }, {}, {}],
              [{ text: 'Total Debits:',  style: 'summaryLabel' }, { text: formatINR(totalDebits),  style: 'summaryValue', alignment: 'right' }, {}],
              [{ text: 'Total Credits:', style: 'summaryLabel' }, { text: formatINR(totalCredits), style: 'summaryValue', alignment: 'right' }, {}],
              [
                { text: 'Net Balance:', style: 'summaryLabel' },
                { text: formatINR(Math.abs(netBalance)) + (netBalance > 0 ? ' DR' : netBalance < 0 ? ' CR' : ''), style: 'summaryValue', alignment: 'right', bold: true },
                {},
              ],
            ],
          },
          layout: 'noBorders',
        },
      ],
      styles: baseStyles,
    };

    const pdfDoc   = await printer.createPdfKitDocument(docDefinition);
    const safeType = String(account_type || 'ACCOUNT_TYPE').replace(/[^a-zA-Z0-9._-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Account_Type_${safeType}.pdf"`);
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (err) {
    console.error('Account Type PDF generation error:', err);
    res.status(500).json({ error: 'Error generating PDF: ' + err.message });
  }
};

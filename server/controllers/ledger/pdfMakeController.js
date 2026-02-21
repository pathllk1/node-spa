import PrinterModule from 'pdfmake/js/Printer.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db } from '../../utils/db.js';

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

// Set default font family globally
const defaultStyle = { font: 'DejaVuSans' };

// Helper functions
const formatINR = (n) => {
    return '₹ ' + new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Number(n || 0));
};

const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
        return new Date(dateString).toLocaleDateString('en-IN');
    } catch (e) {
        return dateString;
    }
};

// Export account ledger as PDF
export const exportAccountLedgerPdf = async (req, res) => {
    try {
        const { account_head } = req.params;
        const { start_date, end_date } = req.query;
        
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        
        
        // Get firm information
        const firmStmt = db.prepare('SELECT name, address FROM firms WHERE id = ?');
        const firm = firmStmt.get(req.user.firm_id);
        const firmName = firm ? firm.name : 'Unknown Firm';
        const firmAddress = firm ? firm.address : '';
        // Note: contact_info field doesn't exist in the firms table, so skipping it

        // Get account details
        let query = `
            SELECT * FROM ledger 
            WHERE firm_id = ? AND account_head = ?
        `;
        
        const queryParams = [req.user.firm_id, account_head];
        
        if (start_date) {
            query += ` AND transaction_date >= ?`;
            queryParams.push(start_date);
        }
        
        if (end_date) {
            query += ` AND transaction_date <= ?`;
            queryParams.push(end_date);
        }
        
        query += ` ORDER BY transaction_date ASC, created_at ASC`;
        
        const stmt = db.prepare(query); const rows = stmt.all(...queryParams); const result = { rows };
        
        // Convert BigInt values to numbers in records
        const records = result.rows.map(record => {
            const processedRecord = {};
            for (const [key, value] of Object.entries(record)) {
                if (typeof value === 'bigint') {
                    processedRecord[key] = Number(value);
                } else {
                    processedRecord[key] = value;
                }
            }
            return processedRecord;
        });

        if (!records || records.length === 0) {
            return res.status(404).json({ error: 'No ledger records found for this account' });
        }

        // Calculate running balance
        let runningBalance = 0;
        records.forEach(record => {
            record.running_balance = runningBalance;
            runningBalance += record.debit_amount - record.credit_amount;
            record.balance_after = runningBalance;
        });

        // Calculate totals
        const totalDebits = records.reduce((sum, record) => sum + record.debit_amount, 0);
        const totalCredits = records.reduce((sum, record) => sum + record.credit_amount, 0);
        const closingBalance = runningBalance;

        // Format dates for display
        const formattedStartDate = start_date ? formatDate(start_date) : null;
        const formattedEndDate = end_date ? formatDate(end_date) : null;

        // Build document definition
        const docDefinition = {
            pageSize: 'A4',
            pageMargins: [20, 60, 20, 60],
            defaultStyle: {
                font: 'DejaVuSans'
            },
            
            header: {
                columns: [
                    {
                        text: firmName,
                        style: 'headerFirmName',
                        margin: [40, 20, 0, 5]
                    },
                    {
                        text: `Page ${typeof this !== 'undefined' ? this.pageNum : 1}`,
                        alignment: 'right',
                        margin: [0, 20, 40, 5],
                        fontSize: 9
                    }
                ]
            },
            
            content: [
                // Title section
                {
                    text: 'LEDGER REPORT',
                    style: 'title',
                    alignment: 'center',
                    margin: [0, 0, 0, 20]
                },
                
                // Account information
                {
                    text: `Account: ${account_head}`,
                    style: 'accountInfo',
                    margin: [0, 0, 0, 5]
                },
                
                // Date range information
                ...(formattedStartDate || formattedEndDate ? [{
                    text: `Date Range: ${
                        formattedStartDate && formattedEndDate 
                            ? `${formattedStartDate} to ${formattedEndDate}`
                            : formattedStartDate 
                                ? `From ${formattedStartDate}` 
                                : `To ${formattedEndDate}`
                    }`,
                    style: 'dateRange',
                    margin: [0, 0, 0, 10]
                }] : []),
                
                // Generated on information
                {
                    text: `Generated on: ${new Date().toLocaleString('en-IN')}`,
                    style: 'generatedOn',
                    margin: [0, 0, 0, 20]
                },
                
                // Ledger table
                {
                    table: {
                        headerRows: 1,
                        widths: ['auto', 'auto', 'auto', 'auto', '*', '*', '*'],
                        body: [
                            // Header row
                            [
                                { text: 'Date', style: 'tableHeader', alignment: 'center' },
                                { text: 'Voucher No', style: 'tableHeader', alignment: 'center' },
                                { text: 'Voucher Type', style: 'tableHeader', alignment: 'center' },
                                { text: 'Narration', style: 'tableHeader', alignment: 'center' },
                                { text: 'Debit', style: 'tableHeader', alignment: 'right' },
                                { text: 'Credit', style: 'tableHeader', alignment: 'right' },
                                { text: 'Balance', style: 'tableHeader', alignment: 'right' }
                            ],
                            // Data rows
                            ...records.map(record => [
                                { text: formatDate(record.transaction_date), style: 'tableCell', alignment: 'center' },
                                { text: record.voucher_no || '', style: 'tableCell', alignment: 'center' },
                                { text: record.voucher_type || '', style: 'tableCell', alignment: 'center' },
                                { text: record.narration || '', style: 'tableCell' },
                                { 
                                    text: record.debit_amount > 0 ? formatINR(record.debit_amount) : '', 
                                    style: 'tableCell', 
                                    alignment: 'right',
                                    color: record.debit_amount > 0 ? '#059669' : undefined
                                },
                                { 
                                    text: record.credit_amount > 0 ? formatINR(record.credit_amount) : '', 
                                    style: 'tableCell', 
                                    alignment: 'right',
                                    color: record.credit_amount > 0 ? '#DC2626' : undefined
                                },
                                { 
                                    text: formatINR(Math.abs(record.balance_after)) + 
                                          (record.balance_after > 0 ? ' DR' : record.balance_after < 0 ? ' CR' : ''), 
                                    style: 'tableCell', 
                                    alignment: 'right',
                                    color: record.balance_after > 0 ? '#059669' : record.balance_after < 0 ? '#DC2626' : undefined,
                                    bold: true
                                }
                            ])
                        ]
                    },
                    layout: {
                        hLineWidth: (i, node) => i === 0 || i === node.table.body.length ? 1 : 0.5,
                        vLineWidth: () => 0.5,
                        hLineColor: (i, node) => i === 0 || i === node.table.body.length ? '#374151' : '#E5E7EB',
                        vLineColor: () => '#E5E7EB',
                        paddingLeft: () => 5,
                        paddingRight: () => 5,
                        paddingTop: () => 5,
                        paddingBottom: () => 5
                    }
                },
                
                // Summary section
                {
                    margin: [0, 20, 0, 0],
                    table: {
                        widths: ['*', 'auto', 'auto'],
                        body: [
                            [
                                { text: 'SUMMARY', style: 'summaryTitle', colSpan: 3, alignment: 'center' },
                                {},
                                {}
                            ],
                            [
                                { text: 'Total Debits:', style: 'summaryLabel' },
                                { text: formatINR(totalDebits), style: 'summaryValue', alignment: 'right' },
                                {}
                            ],
                            [
                                { text: 'Total Credits:', style: 'summaryLabel' },
                                { text: formatINR(totalCredits), style: 'summaryValue', alignment: 'right' },
                                {}
                            ],
                            [
                                { text: 'Closing Balance:', style: 'summaryLabel' },
                                { 
                                    text: formatINR(Math.abs(closingBalance)) + 
                                          (closingBalance > 0 ? ' DR' : closingBalance < 0 ? ' CR' : ''), 
                                    style: 'summaryValue', 
                                    alignment: 'right',
                                    bold: true
                                },
                                {}
                            ]
                        ]
                    },
                    layout: 'noBorders'
                }
            ],
            
            styles: {
                headerFirmName: {
                    fontSize: 14,
                    bold: true,
                    color: '#111827'
                },
                title: {
                    fontSize: 18,
                    bold: true,
                    color: '#111827',
                    decoration: 'underline',
                    decorationStyle: 'solid'
                },
                accountInfo: {
                    fontSize: 12,
                    bold: true,
                    color: '#374151'
                },
                dateRange: {
                    fontSize: 10,
                    color: '#4B5563'
                },
                generatedOn: {
                    fontSize: 9,
                    color: '#6B7280',
                    italics: true
                },
                tableHeader: {
                    fontSize: 9,
                    bold: true,
                    color: '#374151',
                    fillColor: '#F9FAFB'
                },
                tableCell: {
                    fontSize: 8,
                    margin: [3, 4, 3, 4]
                },
                summaryTitle: {
                    fontSize: 10,
                    bold: true,
                    color: '#111827',
                    fillColor: '#F3F4F6'
                },
                summaryLabel: {
                    fontSize: 9,
                    bold: true,
                    color: '#374151',
                    margin: [0, 5, 0, 5]
                },
                summaryValue: {
                    fontSize: 9,
                    color: '#111827',
                    margin: [0, 5, 0, 5]
                }
            }
        };

        const pdfDoc = await printer.createPdfKitDocument(docDefinition);
        
        const safeAccountHead = String(account_head || 'LEDGER').replace(/[^a-zA-Z0-9._-]/g, '_');
        const filename = `Ledger_${safeAccountHead}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        pdfDoc.pipe(res);
        pdfDoc.end();

    } catch (err) {
        console.error('Ledger PDF generation error:', err);
        res.status(500).json({ error: 'Error generating PDF: ' + err.message });
    }
};

// Export general ledger report
export const exportGeneralLedgerPdf = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        
        
        // Get firm information
        const firmStmt = db.prepare('SELECT name, address FROM firms WHERE id = ?');
        const firm = firmStmt.get(req.user.firm_id);
        const firmName = firm ? firm.name : 'Unknown Firm';

        // Get all ledger accounts with balances
        let query = `
            SELECT 
                account_head,
                account_type,
                SUM(debit_amount) as total_debit,
                SUM(credit_amount) as total_credit,
                (SUM(debit_amount) - SUM(credit_amount)) as balance
            FROM ledger 
            WHERE firm_id = ?
        `;
        
        const queryParams = [req.user.firm_id];
        
        if (start_date) {
            query += ` AND transaction_date >= ?`;
            queryParams.push(start_date);
        }
        
        if (end_date) {
            query += ` AND transaction_date <= ?`;
            queryParams.push(end_date);
        }
        
        query += ` GROUP BY account_head, account_type ORDER BY account_head`;
        
        const stmt = db.prepare(query); const rows = stmt.all(...queryParams); const result = { rows };
        
        // Convert BigInt values to numbers in accounts
        const accounts = result.rows.map(account => {
            const processedAccount = {};
            for (const [key, value] of Object.entries(account)) {
                if (typeof value === 'bigint') {
                    processedAccount[key] = Number(value);
                } else {
                    processedAccount[key] = value;
                }
            }
            return processedAccount;
        });

        if (!accounts || accounts.length === 0) {
            return res.status(404).json({ error: 'No ledger accounts found' });
        }

        // Format dates for display
        const formattedStartDate = start_date ? formatDate(start_date) : null;
        const formattedEndDate = end_date ? formatDate(end_date) : null;

        // Build document definition
        const docDefinition = {
            pageSize: 'A4',
            pageMargins: [20, 60, 20, 60],
            defaultStyle: {
                font: 'DejaVuSans'
            },
            
            header: {
                columns: [
                    {
                        text: firmName,
                        style: 'headerFirmName',
                        margin: [40, 20, 0, 5]
                    },
                    {
                        text: `Page ${typeof this !== 'undefined' ? this.pageNum : 1}`,
                        alignment: 'right',
                        margin: [0, 20, 40, 5],
                        fontSize: 9
                    }
                ]
            },
            
            content: [
                // Title section
                {
                    text: 'GENERAL LEDGER REPORT',
                    style: 'title',
                    alignment: 'center',
                    margin: [0, 0, 0, 20]
                },
                
                // Firm information
                {
                    text: `Firm: ${firmName}`,
                    style: 'accountInfo',
                    margin: [0, 0, 0, 5]
                },
                
                // Date range information
                ...(formattedStartDate || formattedEndDate ? [{
                    text: `Date Range: ${
                        formattedStartDate && formattedEndDate 
                            ? `${formattedStartDate} to ${formattedEndDate}`
                            : formattedStartDate 
                                ? `From ${formattedStartDate}` 
                                : `To ${formattedEndDate}`
                    }`,
                    style: 'dateRange',
                    margin: [0, 0, 0, 10]
                }] : []),
                
                // Generated on information
                {
                    text: `Generated on: ${new Date().toLocaleString('en-IN')}`,
                    style: 'generatedOn',
                    margin: [0, 0, 0, 20]
                },
                
                // Accounts table
                {
                    table: {
                        headerRows: 1,
                        widths: ['*', 'auto', 'auto', 'auto', 'auto'],
                        body: [
                            // Header row
                            [
                                { text: 'Account Head', style: 'tableHeader', alignment: 'left' },
                                { text: 'Account Type', style: 'tableHeader', alignment: 'center' },
                                { text: 'Debits', style: 'tableHeader', alignment: 'right' },
                                { text: 'Credits', style: 'tableHeader', alignment: 'right' },
                                { text: 'Balance', style: 'tableHeader', alignment: 'right' }
                            ],
                            // Data rows
                            ...accounts.map(account => [
                                { text: account.account_head || '', style: 'tableCell' },
                                { text: account.account_type || '', style: 'tableCell', alignment: 'center' },
                                { 
                                    text: formatINR(account.total_debit), 
                                    style: 'tableCell', 
                                    alignment: 'right',
                                    color: account.total_debit > 0 ? '#059669' : undefined
                                },
                                { 
                                    text: formatINR(account.total_credit), 
                                    style: 'tableCell', 
                                    alignment: 'right',
                                    color: account.total_credit > 0 ? '#DC2626' : undefined
                                },
                                { 
                                    text: formatINR(Math.abs(account.balance)) + 
                                          (account.balance > 0 ? ' DR' : account.balance < 0 ? ' CR' : ''), 
                                    style: 'tableCell', 
                                    alignment: 'right',
                                    color: account.balance > 0 ? '#059669' : account.balance < 0 ? '#DC2626' : undefined,
                                    bold: true
                                }
                            ])
                        ]
                    },
                    layout: {
                        hLineWidth: (i, node) => i === 0 || i === node.table.body.length ? 1 : 0.5,
                        vLineWidth: () => 0.5,
                        hLineColor: (i, node) => i === 0 || i === node.table.body.length ? '#374151' : '#E5E7EB',
                        vLineColor: () => '#E5E7EB',
                        paddingLeft: () => 5,
                        paddingRight: () => 5,
                        paddingTop: () => 5,
                        paddingBottom: () => 5
                    }
                }
            ],
            
            styles: {
                headerFirmName: {
                    fontSize: 14,
                    bold: true,
                    color: '#111827'
                },
                title: {
                    fontSize: 18,
                    bold: true,
                    color: '#111827',
                    decoration: 'underline',
                    decorationStyle: 'solid'
                },
                accountInfo: {
                    fontSize: 12,
                    bold: true,
                    color: '#374151'
                },
                dateRange: {
                    fontSize: 10,
                    color: '#4B5563'
                },
                generatedOn: {
                    fontSize: 9,
                    color: '#6B7280',
                    italics: true
                },
                tableHeader: {
                    fontSize: 9,
                    bold: true,
                    color: '#374151',
                    fillColor: '#F9FAFB'
                },
                tableCell: {
                    fontSize: 8,
                    margin: [3, 4, 3, 4]
                }
            }
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

// Export trial balance
export const exportTrialBalancePdf = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        
        
        // Get firm information
        const firmStmt = db.prepare('SELECT name, address FROM firms WHERE id = ?');
        const firm = firmStmt.get(req.user.firm_id);
        const firmName = firm ? firm.name : 'Unknown Firm';

        // Get trial balance data
        let query = `
            SELECT 
                account_head,
                account_type,
                SUM(debit_amount) as total_debit,
                SUM(credit_amount) as total_credit,
                (SUM(debit_amount) - SUM(credit_amount)) as balance
            FROM ledger 
            WHERE firm_id = ?
        `;
        
        const queryParams = [req.user.firm_id];
        
        if (start_date) {
            query += ` AND transaction_date >= ?`;
            queryParams.push(start_date);
        }
        
        if (end_date) {
            query += ` AND transaction_date <= ?`;
            queryParams.push(end_date);
        }
        
        query += ` GROUP BY account_head, account_type ORDER BY account_head`;
        
        const stmt = db.prepare(query); const rows = stmt.all(...queryParams); const result = { rows };
        
        // Convert BigInt values to numbers in accounts
        const accounts = result.rows.map(account => {
            const processedAccount = {};
            for (const [key, value] of Object.entries(account)) {
                if (typeof value === 'bigint') {
                    processedAccount[key] = Number(value);
                } else {
                    processedAccount[key] = value;
                }
            }
            return processedAccount;
        });

        if (!accounts || accounts.length === 0) {
            return res.status(404).json({ error: 'No ledger accounts found' });
        }

        // Calculate totals
        const totalDebits = accounts.reduce((sum, account) => sum + account.total_debit, 0);
        const totalCredits = accounts.reduce((sum, account) => sum + account.total_credit, 0);
        const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);

        // Format dates for display
        const formattedStartDate = start_date ? formatDate(start_date) : null;
        const formattedEndDate = end_date ? formatDate(end_date) : null;

        // Build document definition
        const docDefinition = {
            pageSize: 'A4',
            pageMargins: [20, 60, 20, 60],
            defaultStyle: {
                font: 'DejaVuSans'
            },
            
            header: {
                columns: [
                    {
                        text: firmName,
                        style: 'headerFirmName',
                        margin: [40, 20, 0, 5]
                    },
                    {
                        text: `Page ${typeof this !== 'undefined' ? this.pageNum : 1}`,
                        alignment: 'right',
                        margin: [0, 20, 40, 5],
                        fontSize: 9
                    }
                ]
            },
            
            content: [
                // Title section
                {
                    text: 'TRIAL BALANCE',
                    style: 'title',
                    alignment: 'center',
                    margin: [0, 0, 0, 20]
                },
                
                // Firm information
                {
                    text: `Firm: ${firmName}`,
                    style: 'accountInfo',
                    margin: [0, 0, 0, 5]
                },
                
                // Date range information
                ...(formattedStartDate || formattedEndDate ? [{
                    text: `Date Range: ${
                        formattedStartDate && formattedEndDate 
                            ? `${formattedStartDate} to ${formattedEndDate}`
                            : formattedStartDate 
                                ? `From ${formattedStartDate}` 
                                : `To ${formattedEndDate}`
                    }`,
                    style: 'dateRange',
                    margin: [0, 0, 0, 10]
                }] : []),
                
                // Generated on information
                {
                    text: `Generated on: ${new Date().toLocaleString('en-IN')}`,
                    style: 'generatedOn',
                    margin: [0, 0, 0, 20]
                },
                
                // Trial balance table
                {
                    table: {
                        headerRows: 1,
                        widths: ['*', 'auto', 'auto', 'auto'],
                        body: [
                            // Header row
                            [
                                { text: 'Account Head', style: 'tableHeader', alignment: 'left' },
                                { text: 'Debits', style: 'tableHeader', alignment: 'right' },
                                { text: 'Credits', style: 'tableHeader', alignment: 'right' },
                                { text: 'Balance', style: 'tableHeader', alignment: 'right' }
                            ],
                            // Data rows
                            ...accounts.map(account => [
                                { text: account.account_head || '', style: 'tableCell' },
                                { 
                                    text: formatINR(account.total_debit), 
                                    style: 'tableCell', 
                                    alignment: 'right',
                                    color: account.total_debit > 0 ? '#059669' : undefined
                                },
                                { 
                                    text: formatINR(account.total_credit), 
                                    style: 'tableCell', 
                                    alignment: 'right',
                                    color: account.total_credit > 0 ? '#DC2626' : undefined
                                },
                                { 
                                    text: formatINR(Math.abs(account.balance)) + 
                                          (account.balance > 0 ? ' DR' : account.balance < 0 ? ' CR' : ''), 
                                    style: 'tableCell', 
                                    alignment: 'right',
                                    color: account.balance > 0 ? '#059669' : account.balance < 0 ? '#DC2626' : undefined
                                }
                            ]),
                            // Total row
                            [
                                { text: 'TOTALS', style: 'totalLabel', bold: true },
                                { text: formatINR(totalDebits), style: 'totalValue', bold: true, alignment: 'right' },
                                { text: formatINR(totalCredits), style: 'totalValue', bold: true, alignment: 'right' },
                                { text: formatINR(Math.abs(totalBalance)) + (totalBalance > 0 ? ' DR' : totalBalance < 0 ? ' CR' : ''), style: 'totalValue', bold: true, alignment: 'right' }
                            ]
                        ]
                    },
                    layout: {
                        hLineWidth: (i, node) => i === 0 || i === node.table.body.length ? 1 : 0.5,
                        vLineWidth: () => 0.5,
                        hLineColor: (i, node) => i === 0 || i === node.table.body.length ? '#374151' : '#E5E7EB',
                        vLineColor: () => '#E5E7EB',
                        paddingLeft: () => 5,
                        paddingRight: () => 5,
                        paddingTop: () => 5,
                        paddingBottom: () => 5
                    }
                }
            ],
            
            styles: {
                headerFirmName: {
                    fontSize: 14,
                    bold: true,
                    color: '#111827'
                },
                title: {
                    fontSize: 18,
                    bold: true,
                    color: '#111827',
                    decoration: 'underline',
                    decorationStyle: 'solid'
                },
                accountInfo: {
                    fontSize: 12,
                    bold: true,
                    color: '#374151'
                },
                dateRange: {
                    fontSize: 10,
                    color: '#4B5563'
                },
                generatedOn: {
                    fontSize: 9,
                    color: '#6B7280',
                    italics: true
                },
                tableHeader: {
                    fontSize: 9,
                    bold: true,
                    color: '#374151',
                    fillColor: '#F9FAFB'
                },
                tableCell: {
                    fontSize: 8,
                    margin: [3, 4, 3, 4]
                },
                totalLabel: {
                    fontSize: 9,
                    bold: true,
                    color: '#111827',
                    fillColor: '#F3F4F6'
                },
                totalValue: {
                    fontSize: 9,
                    bold: true,
                    color: '#111827',
                    fillColor: '#F3F4F6'
                }
            }
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

// Export account type details as PDF
export const exportAccountTypePdf = async (req, res) => {
    try {
        const { accounts, account_type } = req.body;
        
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        
        
        // Get firm information
        const firmStmt = db.prepare('SELECT name, address FROM firms WHERE id = ?');
        const firm = firmStmt.get(req.user.firm_id);
        const firmName = firm ? firm.name : 'Unknown Firm';
        const firmAddress = firm ? firm.address : '';
        // Note: contact_info field doesn't exist in the firms table, so skipping it

        // Parse accounts if it's a string
        const parsedAccounts = typeof accounts === 'string' ? JSON.parse(accounts) : accounts;
        
        if (!parsedAccounts || parsedAccounts.length === 0) {
            return res.status(404).json({ error: 'No account data provided' });
        }

        // Calculate totals
        const totalDebits = parsedAccounts.reduce((sum, account) => sum + (account.total_debit || 0), 0);
        const totalCredits = parsedAccounts.reduce((sum, account) => sum + (account.total_credit || 0), 0);
        const netBalance = totalDebits - totalCredits;

        // Build document definition
        const docDefinition = {
            pageSize: 'A4',
            pageMargins: [20, 60, 20, 60],
            defaultStyle: {
                font: 'DejaVuSans'
            },
            
            header: {
                columns: [
                    {
                        text: firmName,
                        style: 'headerFirmName',
                        margin: [40, 20, 0, 5]
                    },
                    {
                        text: `Page ${typeof this !== 'undefined' ? this.pageNum : 1}`,
                        alignment: 'right',
                        margin: [0, 20, 40, 5],
                        fontSize: 9
                    }
                ]
            },
            
            content: [
                // Title section
                {
                    text: 'ACCOUNT TYPE DETAILS',
                    style: 'title',
                    alignment: 'center',
                    margin: [0, 0, 0, 20]
                },
                
                // Account type information
                {
                    text: `Account Type: ${account_type}`,
                    style: 'accountInfo',
                    margin: [0, 0, 0, 10]
                },
                
                // Generated on information
                {
                    text: `Generated on: ${new Date().toLocaleString('en-IN')}`,
                    style: 'generatedOn',
                    margin: [0, 0, 0, 20]
                },
                
                // Account type details table
                {
                    table: {
                        headerRows: 1,
                        widths: ['*', 'auto', 'auto', 'auto'],
                        body: [
                            // Header row
                            [
                                { text: 'Account Head', style: 'tableHeader', alignment: 'center' },
                                { text: 'Debit Total', style: 'tableHeader', alignment: 'right' },
                                { text: 'Credit Total', style: 'tableHeader', alignment: 'right' },
                                { text: 'Balance', style: 'tableHeader', alignment: 'right' }
                            ],
                            // Data rows
                            ...parsedAccounts.map(account => {
                                const balance = account.balance || 0;
                                const balanceLabel = balance > 0 ? 'DR' : balance < 0 ? 'CR' : '0';
                                
                                return [
                                    { text: account.account_head, style: 'tableCell' },
                                    { 
                                        text: formatINR(account.total_debit || 0), 
                                        style: 'tableCell', 
                                        alignment: 'right',
                                        color: '#059669'
                                    },
                                    { 
                                        text: formatINR(account.total_credit || 0), 
                                        style: 'tableCell', 
                                        alignment: 'right',
                                        color: '#DC2626'
                                    },
                                    { 
                                        text: formatINR(Math.abs(balance)) + ' ' + balanceLabel, 
                                        style: 'tableCell', 
                                        alignment: 'right',
                                        color: balance > 0 ? '#059669' : balance < 0 ? '#DC2626' : undefined,
                                        bold: true
                                    }
                                ];
                            })
                        ]
                    },
                    layout: {
                        hLineWidth: (i, node) => i === 0 || i === node.table.body.length ? 1 : 0.5,
                        vLineWidth: () => 0.5,
                        hLineColor: (i, node) => i === 0 || i === node.table.body.length ? '#374151' : '#E5E7EB',
                        vLineColor: () => '#E5E7EB',
                        paddingLeft: () => 5,
                        paddingRight: () => 5,
                        paddingTop: () => 5,
                        paddingBottom: () => 5
                    }
                },
                
                // Summary section
                {
                    margin: [0, 20, 0, 0],
                    table: {
                        widths: ['*', 'auto', 'auto'],
                        body: [
                            [
                                { text: 'SUMMARY', style: 'summaryTitle', colSpan: 3, alignment: 'center' },
                                {},
                                {}
                            ],
                            [
                                { text: 'Total Debits:', style: 'summaryLabel' },
                                { text: formatINR(totalDebits), style: 'summaryValue', alignment: 'right' },
                                {}
                            ],
                            [
                                { text: 'Total Credits:', style: 'summaryLabel' },
                                { text: formatINR(totalCredits), style: 'summaryValue', alignment: 'right' },
                                {}
                            ],
                            [
                                { text: 'Net Balance:', style: 'summaryLabel' },
                                { 
                                    text: formatINR(Math.abs(netBalance)) + 
                                          (netBalance > 0 ? ' DR' : netBalance < 0 ? ' CR' : ''), 
                                    style: 'summaryValue', 
                                    alignment: 'right',
                                    bold: true
                                },
                                {}
                            ]
                        ]
                    },
                    layout: 'noBorders'
                }
            ],
            
            styles: {
                headerFirmName: {
                    fontSize: 14,
                    bold: true,
                    color: '#111827'
                },
                title: {
                    fontSize: 18,
                    bold: true,
                    color: '#111827',
                    decoration: 'underline',
                    decorationStyle: 'solid'
                },
                accountInfo: {
                    fontSize: 12,
                    bold: true,
                    color: '#374151'
                },
                dateRange: {
                    fontSize: 10,
                    color: '#4B5563'
                },
                generatedOn: {
                    fontSize: 9,
                    color: '#6B7280',
                    italics: true
                },
                tableHeader: {
                    fontSize: 9,
                    bold: true,
                    color: '#374151',
                    fillColor: '#F9FAFB'
                },
                tableCell: {
                    fontSize: 8,
                    margin: [3, 4, 3, 4]
                },
                summaryTitle: {
                    fontSize: 10,
                    bold: true,
                    color: '#111827',
                    fillColor: '#F3F4F6'
                },
                summaryLabel: {
                    fontSize: 9,
                    bold: true,
                    color: '#374151',
                    margin: [0, 5, 0, 5]
                },
                summaryValue: {
                    fontSize: 9,
                    color: '#111827',
                    margin: [0, 5, 0, 5]
                }
            }
        };

        const pdfDoc = await printer.createPdfKitDocument(docDefinition);
        
        const safeAccountType = String(account_type || 'ACCOUNT_TYPE').replace(/[^a-zA-Z0-9._-]/g, '_');
        const filename = `Account_Type_${safeAccountType}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        pdfDoc.pipe(res);
        pdfDoc.end();

    } catch (err) {
        console.error('Account Type PDF generation error:', err);
        res.status(500).json({ error: 'Error generating PDF: ' + err.message });
    }
};

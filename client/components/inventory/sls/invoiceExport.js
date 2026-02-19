/**
 * INVOICE EXPORT COMPONENT
 * Handles invoice export to Excel and PDF formats
 */

export function exportInvoiceToExcel(state, formatCurrency) {
    try {
        // Create CSV content
        let csv = 'INVOICE EXPORT\n';
        csv += `Bill No,${state.meta.billNo}\n`;
        csv += `Date,${state.meta.billDate}\n`;
        csv += `Bill Type,${state.meta.billType}\n`;
        csv += `Reverse Charge,${state.meta.reverseCharge ? 'Yes' : 'No'}\n\n`;

        if (state.selectedParty) {
            csv += 'BILL TO\n';
            csv += `Party,${state.selectedParty.firm}\n`;
            csv += `GSTIN,${state.selectedParty.gstin}\n`;
            csv += `Address,${state.selectedParty.addr}\n\n`;
        }

        if (state.selectedConsignee) {
            csv += 'CONSIGNEE\n';
            csv += `Name,${state.selectedConsignee.name}\n`;
            csv += `Address,${state.selectedConsignee.address}\n\n`;
        }

        csv += 'ITEMS\n';
        csv += 'Item,Batch,Qty,Unit,Rate,Disc %,Tax %,Total\n';
        
        state.cart.forEach(item => {
            const qty = parseFloat(item.qty) || 0;
            const rate = parseFloat(item.rate) || 0;
            const disc = parseFloat(item.disc) || 0;
            const tax = parseFloat(item.tax) || 0;
            
            const discAmount = (qty * rate * disc) / 100;
            const taxableAmount = (qty * rate) - discAmount;
            const taxAmount = (taxableAmount * tax) / 100;
            const total = taxableAmount + taxAmount;
            
            csv += `"${item.item}","${item.batch || '-'}",${qty},${item.uom},${rate},${disc},${tax},${total}\n`;
        });

        csv += '\nOTHER CHARGES\n';
        csv += 'Charge,Amount,GST %,Total\n';
        
        state.otherCharges.forEach(charge => {
            const amount = parseFloat(charge.amount) || 0;
            const gstRate = parseFloat(charge.gstRate) || 0;
            const gstAmount = (amount * gstRate) / 100;
            const total = amount + gstAmount;
            
            csv += `"${charge.name}",${amount},${gstRate},${total}\n`;
        });

        // Create blob and download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `Invoice_${state.meta.billNo}_${state.meta.billDate}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert('Invoice exported to Excel successfully!');
    } catch (err) {
        console.error('Export error:', err);
        alert('Error exporting invoice: ' + err.message);
    }
}

export function exportInvoiceToPDF(state, formatCurrency, billId) {
    try {
        // If billId is provided, download PDF from backend controller
        if (billId) {
            const pdfUrl = `/api/inventory/sales/bills/${billId}/pdf`;
            console.log('Fetching PDF from:', pdfUrl);
            
            // Fetch the PDF with authentication
            fetch(pdfUrl, {
                method: 'GET',
                credentials: 'include'
            })
            .then(response => {
                console.log('PDF response status:', response.status, response.ok);
                if (!response.ok) {
                    return response.text().then(text => {
                        console.error('PDF error response:', text);
                        throw new Error(`HTTP error! status: ${response.status}`);
                    });
                }
                return response.blob();
            })
            .then(blob => {
                console.log('PDF blob received, size:', blob.size);
                // Create a temporary link and trigger download
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `Invoice_${state.meta.billNo || 'Bill'}.pdf`;
                link.style.display = 'none';
                
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Clean up the object URL
                URL.revokeObjectURL(url);
                console.log('PDF download triggered');
            })
            .catch(err => {
                console.error('PDF download error:', err);
                alert('Error downloading PDF: ' + err.message);
            });
            
            return;
        }
        
    } catch (err) {
        console.error('PDF export error:', err);
        alert('Error exporting to PDF: ' + err.message);
    }
}

function calculateGrandTotal(state) {
    let subtotal = 0;
    let totalTax = 0;

    state.cart.forEach(item => {
        const qty = parseFloat(item.qty) || 0;
        const rate = parseFloat(item.rate) || 0;
        const disc = parseFloat(item.disc) || 0;
        const tax = parseFloat(item.tax) || 0;
        
        const discAmount = (qty * rate * disc) / 100;
        const taxableAmount = (qty * rate) - discAmount;
        const taxAmount = (taxableAmount * tax) / 100;
        
        subtotal += taxableAmount;
        totalTax += taxAmount;
    });

    state.otherCharges.forEach(charge => {
        const amount = parseFloat(charge.amount) || 0;
        const gstRate = parseFloat(charge.gstRate) || 0;
        const gstAmount = (amount * gstRate) / 100;
        
        subtotal += amount;
        totalTax += gstAmount;
    });

    return subtotal + totalTax;
}

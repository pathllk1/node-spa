/**
 * BATCH MODAL COMPONENT
 * Handles batch selection when a stock item has multiple batches
 */

export async function showBatchSelectionModal(stock, onSelectBatch) {
    const subModal = document.getElementById('sub-modal-backdrop');
    const subContent = document.getElementById('sub-modal-content');
    if (!subModal || !subContent) return;

    subModal.classList.remove('hidden');

    const batches = stock.batches || [];
    
    subContent.innerHTML = `
        <div class="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h3 class="font-bold text-lg text-gray-800">Select Batch</h3>
            <button id="close-sub-modal" class="text-gray-400 hover:text-gray-800 text-2xl leading-none">&times;</button>
        </div>
        
        <div class="p-4 space-y-3 max-h-96 overflow-y-auto">
            <div class="text-sm text-gray-600 mb-4">
                <strong>${stock.item}</strong> - Select a batch to add to cart
            </div>
            
            ${batches.map((batch, idx) => `
                <div class="p-3 border border-gray-200 rounded hover:bg-blue-50 cursor-pointer transition-colors batch-option" data-batch-idx="${idx}">
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="font-bold text-gray-800">${batch.batch || 'No Batch'}</div>
                            <div class="text-xs text-gray-500 mt-1">
                                <div>Qty: <strong>${batch.qty} ${stock.uom}</strong></div>
                                <div>Rate: <strong>${batch.rate}</strong></div>
                                ${batch.expiry ? `<div>Expiry: <strong>${batch.expiry}</strong></div>` : ''}
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-xs text-gray-500">Available</div>
                            <div class="font-bold text-green-600">${batch.qty}</div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    document.getElementById('close-sub-modal').onclick = () => subModal.classList.add('hidden');

    // Batch selection
    document.querySelectorAll('.batch-option').forEach(option => {
        option.addEventListener('click', (e) => {
            const batchIdx = parseInt(e.currentTarget.getAttribute('data-batch-idx'));
            const selectedBatch = batches[batchIdx];
            
            const stockWithBatch = {
                ...stock,
                batch: selectedBatch.batch,
                qty: selectedBatch.qty,
                rate: selectedBatch.rate,
                expiry: selectedBatch.expiry
            };
            
            onSelectBatch(stockWithBatch);
            subModal.classList.add('hidden');
        });
    });
}

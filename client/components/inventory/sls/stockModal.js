/**
 * STOCK MODAL COMPONENT
 * Handles stock selection modal with search, filtering, and batch handling
 */

export function openStockModal(state, callbacks) {
    const { onSelectStock, onCreateStock, onEditStock, onViewHistory } = callbacks;
    const modal = document.getElementById('modal-backdrop');
    const content = document.getElementById('modal-content');
    if (!modal || !content) return;

    modal.classList.remove('hidden');

    content.innerHTML = `
        <div class="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h3 class="font-bold text-lg text-gray-800">Item Selection</h3>
            
            <div class="flex items-center gap-3 w-2/3 justify-end">
                <div class="relative w-full max-w-md">
                    <input type="text" id="stock-search" placeholder="Search Item, Batch, OEM, or HSN..." class="w-full border border-gray-300 rounded pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm">
                    <svg class="w-4 h-4 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
                
                <button id="btn-create-stock" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-xs font-bold shadow flex items-center gap-2 transition-colors whitespace-nowrap">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                    NEW ITEM
                </button>
                
                <button id="close-modal" class="text-gray-400 hover:text-gray-800 text-2xl leading-none ml-4">&times;</button>
            </div>
        </div>
        
        <div class="flex-1 overflow-y-auto p-0 bg-gray-50">
            <table class="w-full text-left border-collapse">
                <thead class="bg-white text-[11px] font-bold text-gray-500 uppercase sticky top-0 border-b border-gray-200 shadow-sm z-10">
                    <tr>
                        <th class="p-3">Item Name</th>
                        <th class="p-3">Batch</th>
                        <th class="p-3">OEM</th>
                        <th class="p-3 text-right">Available</th>
                        <th class="p-3 text-right">Rate</th>
                        <th class="p-3 text-right">GST%</th>
                        <th class="p-3 text-center">Action</th>
                    </tr>
                </thead>
                <tbody class="text-xs text-gray-700 divide-y divide-gray-100 bg-white" id="stock-list-body">
                </tbody>
            </table>
        </div>
    `;

    renderStockRows(state.stocks, state, callbacks);

    // Search functionality
    const searchInput = document.getElementById('stock-search');
    if (searchInput) {
        searchInput.focus();
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = state.stocks.filter(s =>
                (s.item && s.item.toLowerCase().includes(term)) ||
                (s.batch && s.batch.toLowerCase().includes(term)) ||
                (s.oem && s.oem.toLowerCase().includes(term)) ||
                (s.hsn && s.hsn.toLowerCase().includes(term)) ||
                (s.batches && Array.isArray(s.batches) && 
                    s.batches.some(batch => 
                        (batch.batch && batch.batch.toLowerCase().includes(term)) ||
                        (batch.expiry && batch.expiry.toLowerCase().includes(term))
                    )
                )
            );
            renderStockRows(filtered, state, callbacks);
        });
    }

    document.getElementById('close-modal').onclick = () => modal.classList.add('hidden');
    document.getElementById('btn-create-stock').onclick = () => {
        modal.classList.add('hidden');
        onCreateStock();
    };
}

function renderStockRows(data, state, callbacks) {
    const { onSelectStock, onEditStock, onViewHistory } = callbacks;
    const tbody = document.getElementById('stock-list-body');
    if (!tbody) return;

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-10 text-center text-gray-400 italic">No stocks found matching your query.</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(stock => `
        <tr class="hover:bg-blue-50 transition-colors group border-b border-gray-50">
            <td class="p-3 font-semibold text-blue-900">${stock.item}</td>
            <td class="p-3 font-mono text-gray-500">
                ${stock.batches && Array.isArray(stock.batches) && stock.batches.length > 0 
                    ? (stock.batches.length === 1 
                        ? (stock.batches[0].batch || 'No Batch') 
                        : `${stock.batches.length} batches`) 
                    : (stock.batch || '-')}
            </td>
            <td class="p-3 text-gray-500">${stock.oem || '-'}</td>
            <td class="p-3 text-right font-bold ${stock.qty > 0 ? 'text-green-600' : 'text-red-500'}">${stock.qty} ${stock.uom}</td>
            <td class="p-3 text-right font-mono">${stock.rate}</td>
            <td class="p-3 text-right text-gray-500">${stock.grate}%</td>
            <td class="p-3 text-center">
                <div class="flex items-center justify-center gap-2">
                    <button class="btn-edit-stock bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded text-[10px] font-bold hover:bg-gray-100 transition-colors shadow-sm"
                        data-stock='${JSON.stringify(stock).replace(/'/g, "&apos;")}'
                        type="button">
                        EDIT
                    </button>
                    <button class="btn-history-stock bg-white border border-amber-200 text-amber-700 px-3 py-1.5 rounded text-[10px] font-bold hover:bg-amber-50 transition-colors shadow-sm"
                        data-stock='${JSON.stringify(stock).replace(/'/g, "&apos;")}'
                        type="button">
                        HISTORY
                    </button>
                    <button class="btn-select-stock bg-white border border-blue-200 text-blue-600 px-3 py-1.5 rounded text-[10px] font-bold hover:bg-blue-600 hover:text-white transition-colors shadow-sm" 
                        data-stock='${JSON.stringify(stock).replace(/'/g, "&apos;")}'
                        type="button">
                        ADD +
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    // Attach event listeners
    tbody.querySelectorAll('.btn-select-stock').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const stock = JSON.parse(e.target.getAttribute('data-stock'));
            
            if (stock.batches && stock.batches.length > 1) {
                await onSelectStock(stock, true); // true = show batch modal
            } else if (stock.batches && stock.batches.length === 1) {
                const batch = stock.batches[0];
                const stockWithBatch = { ...stock, batch: batch.batch, qty: batch.qty, rate: batch.rate };
                await onSelectStock(stockWithBatch, false);
            } else {
                await onSelectStock(stock, false);
            }
            
            document.getElementById('modal-backdrop').classList.add('hidden');
        });
    });

    tbody.querySelectorAll('.btn-edit-stock').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const stock = JSON.parse(e.target.getAttribute('data-stock'));
            onEditStock(stock);
        });
    });

    tbody.querySelectorAll('.btn-history-stock').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const stock = JSON.parse(e.target.getAttribute('data-stock'));
            onViewHistory(stock);
        });
    });
}

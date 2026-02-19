/**
 * PARTY MODAL COMPONENT
 * Handles party selection and creation
 */

export function openPartyModal(state, callbacks) {
    const { onSelectParty, onCreateParty, onPartyCardUpdate } = callbacks;
    const modal = document.getElementById('modal-backdrop');
    const content = document.getElementById('modal-content');
    if (!modal || !content) return;

    modal.classList.remove('hidden');

    content.innerHTML = `
        <div class="p-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h3 class="font-bold text-gray-700">Select Party</h3>
            
            <div class="flex items-center gap-3">
                <div class="relative">
                    <input type="text" id="party-search" placeholder="Search Firm or GSTIN..." class="pl-8 pr-3 py-1.5 border border-gray-300 rounded text-xs w-48 focus:ring-1 focus:ring-blue-500 outline-none">
                    <svg class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>

                <button id="btn-create-party" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-medium shadow flex items-center gap-1 transition-colors">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                    New Party
                </button>
                
                <button id="close-party-modal" class="text-gray-400 hover:text-gray-800 text-2xl leading-none ml-2">&times;</button>
            </div>
        </div>
        
        <div class="p-4 grid gap-3 max-h-[60vh] overflow-y-auto bg-gray-50" id="party-list-container">
        </div>
    `;

    const renderPartyList = (data) => {
        const container = document.getElementById('party-list-container');
        if (!container) return;

        if (data.length === 0) {
            container.innerHTML = `<div class="text-center text-gray-400 py-8 italic">No parties found. Create a new one.</div>`;
            return;
        }

        container.innerHTML = data.map(party => `
            <div class="party-item border border-gray-200 p-3 rounded-lg hover:border-blue-400 hover:shadow-md cursor-pointer flex justify-between items-center transition-all bg-white group" data-id="${party.id}">
                <div>
                    <div class="font-bold text-blue-900 text-sm mb-1 group-hover:text-blue-700">${party.firm}</div>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 border border-gray-200">${party.gstin}</span>
                        <span class="text-[10px] text-gray-500">${party.state}</span>
                    </div>
                    <div class="text-[10px] text-gray-400 mt-1 truncate max-w-xs">${party.addr || ''}</div>
                </div>
                <span class="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">SELECT</span>
            </div>
        `).join('');

        // Re-attach click events for selection
        container.querySelectorAll('.party-item').forEach(div => {
            div.addEventListener('click', () => {
                const id = parseInt(div.getAttribute('data-id'));
                const selectedParty = state.parties.find(p => p.id === id);
                
                if (selectedParty) {
                    state.selectedParty = selectedParty;
                    state.historyCache = {};
                    modal.classList.add('hidden');
                    
                    onSelectParty(selectedParty);
                }
            });
        });
    };

    // Initial Render
    renderPartyList(state.parties);

    // Attach Event Listeners
    document.getElementById('close-party-modal').addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    document.getElementById('btn-create-party').addEventListener('click', () => {
        modal.classList.add('hidden');
        onCreateParty();
    });

    // Search Logic
    const searchInput = document.getElementById('party-search');
    if (searchInput) {
        searchInput.focus();
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = state.parties.filter(p =>
                p.firm.toLowerCase().includes(term) ||
                p.gstin.toLowerCase().includes(term)
            );
            renderPartyList(filtered);
        });
    }
}

/**
 * PARTY MODAL COMPONENT
 * Handles party selection
 */

import { escHtml } from './utils.js';

export function openPartyModal(state, callbacks) {
    const { onSelectParty, onCreateParty, onPartyCardUpdate } = callbacks;
    const modal   = document.getElementById('modal-backdrop');
    const content = document.getElementById('modal-content');
    if (!modal || !content) return;

    modal.classList.remove('hidden');

    content.innerHTML = `
        <div class="p-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white flex justify-between items-center gap-3">
            <h3 class="font-bold text-base text-gray-800 shrink-0">Select Party</h3>
            <div class="flex items-center gap-2 flex-1 justify-end">
                <div class="relative flex-1 max-w-sm">
                    <input type="text" id="party-search"
                           placeholder="Search firm name or GSTIN…"
                           class="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-400 outline-none shadow-sm">
                    <svg class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                    </svg>
                </div>
                <button id="btn-create-party"
                        class="shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                    </svg>
                    New Party
                </button>
                <button id="close-party-modal"
                        class="shrink-0 text-gray-400 hover:text-gray-700 w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 transition-colors text-xl leading-none">&times;</button>
            </div>
        </div>

        <div class="flex-1 overflow-y-auto p-3 grid gap-2 bg-gray-50" id="party-list-container"></div>
    `;

    const renderPartyList = (data) => {
        const container = document.getElementById('party-list-container');
        if (!container) return;

        if (data.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 text-gray-300">
                    <svg class="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    <p class="text-sm text-gray-400 italic">No parties found. Create a new one.</p>
                </div>`;
            return;
        }

        // FIX: escHtml applied to all party data (firm, gstin, state, addr)
        container.innerHTML = data.map(party => `
            <div class="party-item border border-gray-200 p-3 rounded-xl hover:border-blue-400 hover:shadow-md cursor-pointer
                        flex justify-between items-center transition-all bg-white group"
                 data-id="${escHtml(String(party._id || party.id || ''))}">
                <div class="min-w-0 flex-1">
                    <div class="font-bold text-blue-900 text-sm group-hover:text-blue-700 truncate">${escHtml(party.firm)}</div>
                    <div class="flex items-center flex-wrap gap-1.5 mt-1">
                        <span class="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 text-gray-600">${escHtml(party.gstin)}</span>
                        <span class="text-[10px] text-gray-400">${escHtml(party.state || '')}</span>
                    </div>
                    <div class="text-[10px] text-gray-400 mt-1 truncate max-w-xs">${escHtml(party.addr || '')}</div>
                </div>
                <span class="shrink-0 text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 px-2.5 py-1 rounded-full
                             opacity-0 group-hover:opacity-100 transition-all ml-3">SELECT →</span>
            </div>
        `).join('');

        container.querySelectorAll('.party-item').forEach(div => {
            div.addEventListener('click', () => {
                const id             = div.getAttribute('data-id');
                const selectedParty  = state.parties.find(p => (p._id || p.id)?.toString() === id);
                if (selectedParty) {
                    state.selectedParty  = selectedParty;
                    state.historyCache   = {};
                    modal.classList.add('hidden');
                    onSelectParty(selectedParty);
                }
            });
        });
    };

    renderPartyList(state.parties);

    document.getElementById('close-party-modal').addEventListener('click', () => modal.classList.add('hidden'));
    document.getElementById('btn-create-party').addEventListener('click', () => {
        modal.classList.add('hidden');
        onCreateParty();
    });

    const searchInput = document.getElementById('party-search');
    if (searchInput) {
        searchInput.focus();
        searchInput.addEventListener('input', e => {
            const term     = e.target.value.toLowerCase();
            const filtered = state.parties.filter(p =>
                p.firm.toLowerCase().includes(term) || p.gstin.toLowerCase().includes(term)
            );
            renderPartyList(filtered);
        });
    }
}
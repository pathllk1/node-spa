export function renderTabs({ activeTab }) {
  return `
      <div class="tabs" style="border-bottom: 2px solid #e5e7eb; margin-bottom: 20px;">
        <button 
          class="tab-btn ${activeTab === 'create' ? 'active' : ''}" 
          data-action="switch-tab"
          data-tab="create"
          style="
            padding: 12px 24px;
            background: ${activeTab === 'create' ? '#3b82f6' : 'transparent'};
            color: ${activeTab === 'create' ? 'white' : '#6b7280'};
            border: none;
            border-bottom: 3px solid ${activeTab === 'create' ? '#3b82f6' : 'transparent'};
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s;
          "
        >
          📝 Create Wages
        </button>
        <button 
          class="tab-btn ${activeTab === 'manage' ? 'active' : ''}" 
          data-action="switch-tab"
          data-tab="manage"
          style="
            padding: 12px 24px;
            background: ${activeTab === 'manage' ? '#3b82f6' : 'transparent'};
            color: ${activeTab === 'manage' ? 'white' : '#6b7280'};
            border: none;
            border-bottom: 3px solid ${activeTab === 'manage' ? '#3b82f6' : 'transparent'};
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s;
          "
        >
          ✔️ Manage Wages
        </button>
      </div>
    `;
}
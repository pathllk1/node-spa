export function renderManageMode(ctx) {
  const {
    manageMonth,
    existingWages,
    editedWages,
    selectedWageIds,
    isManageLoading,
    isBulkEditMode,
    bulkEditData,
    manageFilters,
    manageSort,
    formatMonthDisplay,
    formatDateDisplay,
    formatCurrency,
    calculateNetSalary,
    getFilteredManageWages,
    getUniqueValues,
    sortArray,
    toNumber
  } = ctx;

  const filteredWages = getFilteredManageWages();
  const uniqueBanks = getUniqueValues(existingWages, 'bank');
  const uniqueProjects = getUniqueValues(existingWages, 'project');
  const uniqueSites = getUniqueValues(existingWages, 'site');
  
  return `
      <div class="manage-mode">
        <!-- Controls -->
        <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px;">
          <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
            <div>
              <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Month</label>
              <input 
                type="month" 
                value="${manageMonth}"
                data-action="set-manage-month"
                style="padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px;"
              />
            </div>
            
            <div style="margin-top: auto;">
              <button 
                data-action="load-manage-wages" 
                ${isManageLoading ? 'disabled' : ''}
                style="
                  padding: 8px 16px;
                  background: #3b82f6;
                  color: white;
                  border: none;
                  border-radius: 6px;
                  cursor: pointer;
                  font-weight: 600;
                "
              >
                ${isManageLoading ? '⏳ Loading...' : '🔄 Load Wages'}
              </button>
            </div>

            ${existingWages.length > 0 ? `
              ${selectedWageIds.size > 0 ? `
                <div style="margin-top: auto;">
                  <button 
                    data-action="toggle-bulk-edit"
                    style="
                      padding: 8px 16px;
                      background: ${isBulkEditMode ? '#dc2626' : '#8b5cf6'};
                      color: white;
                      border: none;
                      border-radius: 6px;
                      cursor: pointer;
                      font-weight: 600;
                    "
                  >
                    ${isBulkEditMode ? '❌ Cancel Bulk Edit' : '✏️ Bulk Edit (' + selectedWageIds.size + ')'}
                  </button>
                </div>

                <div style="margin-top: auto;">
                  <button 
                    data-action="delete-selected"
                    style="
                      padding: 8px 16px;
                      background: #ef4444;
                      color: white;
                      border: none;
                      border-radius: 6px;
                      cursor: pointer;
                      font-weight: 600;
                    "
                  >
                    🗑️ Delete Selected (${selectedWageIds.size})
                  </button>
                </div>
              ` : ''}

              ${Object.keys(editedWages).length > 0 ? `
                <div style="margin-top: auto;">
                  <button 
                    data-action="save-edited"
                    ${isManageLoading ? 'disabled' : ''}
                    style="
                      padding: 8px 16px;
                      background: #059669;
                      color: white;
                      border: none;
                      border-radius: 6px;
                      cursor: pointer;
                      font-weight: 600;
                    "
                  >
                    💾 Save Changes (${Object.keys(editedWages).length})
                  </button>
                </div>
              ` : ''}

              <div style="margin-top: auto;">
                <button 
                  data-action="export-excel"
                  style="
                    padding: 8px 16px;
                    background: #6366f1;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 600;
                  "
                >
                  📊 Export
                </button>
              </div>
            ` : ''}
          </div>

          ${existingWages.length > 0 ? `
            <!-- Manage Mode Totals Section -->
            ${selectedWageIds.size > 0 ? `
              <div style="margin-top: 15px; padding: 15px; background: linear-gradient(135deg, #f0fdf4, #fef2f2); border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 15px;">
                <h4 style="margin-bottom: 10px; color: #374151; font-size: 13px; font-weight: 600;">📊 Summary (${selectedWageIds.size} selected)</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">
                  <div style="padding: 8px; background: white; border-radius: 4px; border-left: 3px solid #ef4444;">
                    <div style="font-size: 11px; color: #6b7280; margin-bottom: 3px;">Total Gross Salary</div>
                    <div style="font-size: 16px; font-weight: 700; color: #059669;"><span id="summary-total-gross">${formatCurrency(Array.from(selectedWageIds).reduce((sum, wageId) => {
                      const wage = existingWages.find(w => w.id === wageId);
                      const edited = editedWages[wageId] || wage;
                      return sum + (edited ? edited.gross_salary : 0);
                    }, 0))}</span></div>
                  </div>
                  <div style="padding: 8px; background: white; border-radius: 4px; border-left: 3px solid #10b981;">
                    <div style="font-size: 11px; color: #6b7280; margin-bottom: 3px;">Total EPF</div>
                    <div style="font-size: 16px; font-weight: 700; color: #f59e0b;"><span id="summary-total-epf">${formatCurrency(Array.from(selectedWageIds).reduce((sum, wageId) => {
                      const wage = existingWages.find(w => w.id === wageId);
                      const edited = editedWages[wageId] || wage;
                      return sum + (edited ? edited.epf_deduction : 0);
                    }, 0))}</span></div>
                  </div>
                  <div style="padding: 8px; background: white; border-radius: 4px; border-left: 3px solid #3b82f6;">
                    <div style="font-size: 11px; color: #6b7280; margin-bottom: 3px;">Total ESIC</div>
                    <div style="font-size: 16px; font-weight: 700; color: #3b82f6;"><span id="summary-total-esic">${formatCurrency(Array.from(selectedWageIds).reduce((sum, wageId) => {
                      const wage = existingWages.find(w => w.id === wageId);
                      const edited = editedWages[wageId] || wage;
                      return sum + (edited ? edited.esic_deduction : 0);
                    }, 0))}</span></div>
                  </div>
                  <div style="padding: 8px; background: white; border-radius: 4px; border-left: 3px solid #8b5cf6;">
                    <div style="font-size: 11px; color: #6b7280; margin-bottom: 3px;">Total Net Salary</div>
                    <div style="font-size: 16px; font-weight: 700; color: #059669;"><span id="summary-total-net">${formatCurrency(Array.from(selectedWageIds).reduce((sum, wageId) => {
                      const wage = existingWages.find(w => w.id === wageId);
                      const edited = editedWages[wageId] || wage;
                      return sum + (edited ? calculateNetSalary(
                        toNumber(edited.gross_salary),
                        toNumber(edited.epf_deduction),
                        toNumber(edited.esic_deduction),
                        toNumber(edited.other_deduction),
                        toNumber(edited.other_benefit)
                      ) : 0);
                    }, 0))}</span></div>
                  </div>
                </div>
              </div>
            ` : ''}

            <!-- Bulk Edit Form -->
            ${isBulkEditMode ? `
              <div style="margin-top: 15px; padding: 15px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                <h4 style="margin-bottom: 10px; color: #92400e; font-size: 14px; font-weight: 600;">✏️ Bulk Edit Form (${selectedWageIds.size} wages selected)</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 10px;">
                  <div>
                    <label style="display: block; margin-bottom: 3px; font-size: 12px; color: #78350f;">EPF Deduction</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value="${bulkEditData.epf_deduction || ''}"
                      data-action="set-bulk-edit"
                      data-field="epf_deduction"
                      placeholder="Leave blank to skip"
                      style="width: 100%; padding: 5px 8px; border: 1px solid #d97706; border-radius: 4px; font-size: 12px;"
                    />
                  </div>
                  <div>
                    <label style="display: block; margin-bottom: 3px; font-size: 12px; color: #78350f;">ESIC Deduction</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value="${bulkEditData.esic_deduction || ''}"
                      data-action="set-bulk-edit"
                      data-field="esic_deduction"
                      placeholder="Leave blank to skip"
                      style="width: 100%; padding: 5px 8px; border: 1px solid #d97706; border-radius: 4px; font-size: 12px;"
                    />
                  </div>
                  <div>
                    <label style="display: block; margin-bottom: 3px; font-size: 12px; color: #78350f;">Other Deduction</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value="${bulkEditData.other_deduction || ''}"
                      data-action="set-bulk-edit"
                      data-field="other_deduction"
                      placeholder="Leave blank to skip"
                      style="width: 100%; padding: 5px 8px; border: 1px solid #d97706; border-radius: 4px; font-size: 12px;"
                    />
                  </div>
                  <div>
                    <label style="display: block; margin-bottom: 3px; font-size: 12px; color: #78350f;">Other Benefit</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value="${bulkEditData.other_benefit || ''}"
                      data-action="set-bulk-edit"
                      data-field="other_benefit"
                      placeholder="Leave blank to skip"
                      style="width: 100%; padding: 5px 8px; border: 1px solid #d97706; border-radius: 4px; font-size: 12px;"
                    />
                  </div>
                  <div>
                    <label style="display: block; margin-bottom: 3px; font-size: 12px; color: #78350f;">Paid Date</label>
                    <input 
                      type="date"
                      value="${bulkEditData.paid_date || ''}"
                      data-action="set-bulk-edit"
                      data-field="paid_date"
                      style="width: 100%; padding: 5px 8px; border: 1px solid #d97706; border-radius: 4px; font-size: 12px;"
                    />
                  </div>
                  <div>
                    <label style="display: block; margin-bottom: 3px; font-size: 12px; color: #78350f;">Cheque No</label>
                    <input 
                      type="text"
                      value="${bulkEditData.cheque_no || ''}"
                      data-action="set-bulk-edit"
                      data-field="cheque_no"
                      placeholder="Leave blank to skip"
                      style="width: 100%; padding: 5px 8px; border: 1px solid #d97706; border-radius: 4px; font-size: 12px;"
                    />
                  </div>
                  <div>
                    <label style="display: block; margin-bottom: 3px; font-size: 12px; color: #78350f;">Paid From Bank</label>
                    <input 
                      type="text"
                      value="${bulkEditData.paid_from_bank_ac || ''}"
                      data-action="set-bulk-edit"
                      data-field="paid_from_bank_ac"
                      placeholder="Leave blank to skip"
                      style="width: 100%; padding: 5px 8px; border: 1px solid #d97706; border-radius: 4px; font-size: 12px;"
                    />
                  </div>
                  <div>
                    <label style="display: block; margin-bottom: 3px; font-size: 12px; color: #78350f;">Remarks</label>
                    <input 
                      type="text"
                      value="${bulkEditData.remarks || ''}"
                      data-action="set-bulk-edit"
                      data-field="remarks"
                      placeholder="Leave blank to skip"
                      style="width: 100%; padding: 5px 8px; border: 1px solid #d97706; border-radius: 4px; font-size: 12px;"
                    />
                  </div>
                </div>
                <div style="display: flex; gap: 10px;">
                  <button 
                    data-action="apply-bulk-edit"
                    style="
                      padding: 6px 12px;
                      background: #059669;
                      color: white;
                      border: none;
                      border-radius: 4px;
                      cursor: pointer;
                      font-weight: 600;
                      font-size: 12px;
                    "
                  >
                    ✅ Apply to ${selectedWageIds.size} Wages
                  </button>
                  <button 
                    data-action="clear-bulk-edit"
                    style="
                      padding: 6px 12px;
                      background: #6b7280;
                      color: white;
                      border: none;
                      border-radius: 4px;
                      cursor: pointer;
                      font-weight: 600;
                      font-size: 12px;
                    "
                  >
                    🔄 Clear Form
                  </button>
                </div>
              </div>
            ` : ''}

            <!-- Filters -->
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
              <h4 style="margin-bottom: 10px; color: #374151; font-size: 14px; font-weight: 600;">🔍 Filters</h4>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                <div>
                  <input 
                    type="text" 
                    placeholder="Search by name, account..."
                    value="${manageFilters.searchTerm}"
                    data-action="search-filter"
                    data-mode="manage"
                    data-field="searchTerm"
                    style="width: 100%; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px;"
                  />
                </div>
                
                <div>
                  <select 
                    data-action="filter-select"
                    data-mode="manage"
                    data-field="bankFilter"
                    style="width: 100%; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px;"
                  >
                    <option value="all" ${manageFilters.bankFilter === 'all' ? 'selected' : ''}>All Banks</option>
                    ${uniqueBanks.map(bank => `<option value="${bank}" ${manageFilters.bankFilter === bank ? 'selected' : ''}>${bank}</option>`).join('')}
                  </select>
                </div>
                
                <div>
                  <select 
                    data-action="filter-select"
                    data-mode="manage"
                    data-field="projectFilter"
                    style="width: 100%; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px;"
                  >
                    <option value="all" ${manageFilters.projectFilter === 'all' ? 'selected' : ''}>All Projects</option>
                    ${uniqueProjects.map(proj => `<option value="${proj}" ${manageFilters.projectFilter === proj ? 'selected' : ''}>${proj}</option>`).join('')}
                  </select>
                </div>
                
                <div>
                  <select 
                    data-action="filter-select"
                    data-mode="manage"
                    data-field="siteFilter"
                    style="width: 100%; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px;"
                  >
                    <option value="all" ${manageFilters.siteFilter === 'all' ? 'selected' : ''}>All Sites</option>
                    ${uniqueSites.map(site => `<option value="${site}" ${manageFilters.siteFilter === site ? 'selected' : ''}>${site}</option>`).join('')}
                  </select>
                </div>
                
                <div>
                  <select 
                    data-action="filter-select"
                    data-mode="manage"
                    data-field="paidFilter"
                    style="width: 100%; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px;"
                  >
                    <option value="all" ${manageFilters.paidFilter === 'all' ? 'selected' : ''}>All Payment Status</option>
                    <option value="paid" ${manageFilters.paidFilter === 'paid' ? 'selected' : ''}>Paid</option>
                    <option value="unpaid" ${manageFilters.paidFilter === 'unpaid' ? 'selected' : ''}>Unpaid</option>
                  </select>
                </div>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Wages Table -->
        ${existingWages.length > 0 ? `
          <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h3 style="margin-bottom: 15px; color: #1f2937;">
              Wage Records for ${formatMonthDisplay(manageMonth)}
              <span style="color: #6b7280; font-size: 14px;">(${filteredWages.length} of ${existingWages.length} records)</span>
              ${Object.keys(editedWages).length > 0 ? `
                <span style="color: #f59e0b; font-size: 14px; margin-left: 10px;">⚠️ ${Object.keys(editedWages).length} unsaved changes</span>
              ` : ''}
            </h3>
            
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                  <tr style="background: linear-gradient(to right, #ef4444, #10b981); border-bottom: 2px solid #e5e7eb;">
                    <th style="padding: 10px; text-align: center; color: white; font-weight: 600;">
                      <input 
                        type="checkbox" 
                        ${selectedWageIds.size === filteredWages.length && filteredWages.length > 0 ? 'checked' : ''}
                        data-action="select-all-wages"
                        style="cursor: pointer; width: 16px; height: 16px;"
                      />
                    </th>
                    <th style="padding: 10px; text-align: left; font-weight: 600; color: white; cursor: pointer;" data-action="sort" data-column="employee_name" data-mode="manage">Employee ${manageSort.column === 'employee_name' ? (manageSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th style="padding: 10px; text-align: center; font-weight: 600; color: white; cursor: pointer;" data-action="sort" data-column="wage_days" data-mode="manage">Days ${manageSort.column === 'wage_days' ? (manageSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th style="padding: 10px; text-align: right; font-weight: 600; color: white; cursor: pointer;" data-action="sort" data-column="gross_salary" data-mode="manage">Gross ${manageSort.column === 'gross_salary' ? (manageSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th style="padding: 10px; text-align: right; font-weight: 600; color: white; cursor: pointer;" data-action="sort" data-column="epf_deduction" data-mode="manage">EPF ${manageSort.column === 'epf_deduction' ? (manageSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th style="padding: 10px; text-align: right; font-weight: 600; color: white; cursor: pointer;" data-action="sort" data-column="esic_deduction" data-mode="manage">ESIC ${manageSort.column === 'esic_deduction' ? (manageSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th style="padding: 10px; text-align: right; font-weight: 600; color: white; cursor: pointer;" data-action="sort" data-column="other_deduction" data-mode="manage">Other Ded ${manageSort.column === 'other_deduction' ? (manageSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th style="padding: 10px; text-align: right; font-weight: 600; color: white; cursor: pointer;" data-action="sort" data-column="other_benefit" data-mode="manage">Other Ben ${manageSort.column === 'other_benefit' ? (manageSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th style="padding: 10px; text-align: right; font-weight: 600; color: white; cursor: pointer;" data-action="sort" data-column="net_salary" data-mode="manage">Net ${manageSort.column === 'net_salary' ? (manageSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th style="padding: 10px; text-align: left; font-weight: 600; color: white;">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  ${sortArray(filteredWages, manageSort.column, manageSort.asc).map(wage => {
                    const edited = editedWages[wage.id] || wage;
                    const isEdited = !!editedWages[wage.id];
                    const isSelected = selectedWageIds.has(wage.id);
                    const netSalary = calculateNetSalary(
                      toNumber(edited.gross_salary),
                      toNumber(edited.epf_deduction),
                      toNumber(edited.esic_deduction),
                      toNumber(edited.other_deduction),
                      toNumber(edited.other_benefit)
                    );
                    
                    return `
                      <tr style="
                        border-bottom: 1px solid #e5e7eb;
                        background: ${isSelected ? '#eff6ff' : 'white'};
                      ">
                        <td style="padding: 10px; text-align: center;">
                          <input 
                            type="checkbox" 
                            ${isSelected ? 'checked' : ''}
                            data-action="toggle-wage"
                            data-wage-id="${wage.id}"
                            style="cursor: pointer; width: 16px; height: 16px;"
                          />
                        </td>
                        <td style="padding: 10px;">
                          <div style="font-weight: 600; color: #1f2937;">${wage.employee_name}</div>
                          <div style="font-size: 11px; color: #6b7280;">${wage.bank} - ${wage.account_no}</div>
                        </td>
                        <td style="padding: 10px; text-align: center;">
                          <input 
                            id="wage-${wage.id}-wage_days"
                            type="number" 
                            value="${edited.wage_days ?? ''}"
                            data-action="edit-wage"
                            data-wage-id="${wage.id}"
                            data-field="wage_days"
                            style="width: 50px; padding: 4px; border: 1px solid #d1d5db; border-radius: 4px; text-align: center;"
                          />
                        </td>
                        <td style="padding: 10px; text-align: right;">
                          <span id="wage-${wage.id}-gross-display" style="font-weight: 500;">${formatCurrency(edited.gross_salary)}</span>
                        </td>
                        <td style="padding: 10px; text-align: right;">
                          <input 
                            id="wage-${wage.id}-epf_deduction"
                            type="number" 
                            step="0.01"
                            value="${edited.epf_deduction ?? ''}"
                            data-action="edit-wage"
                            data-wage-id="${wage.id}"
                            data-field="epf_deduction"
                            style="width: 70px; padding: 4px; border: 1px solid #d1d5db; border-radius: 4px; text-align: right;"
                          />
                        </td>
                        <td style="padding: 10px; text-align: right;">
                          <input 
                            id="wage-${wage.id}-esic_deduction"
                            type="number" 
                            step="0.01"
                            value="${edited.esic_deduction ?? ''}"
                            data-action="edit-wage"
                            data-wage-id="${wage.id}"
                            data-field="esic_deduction"
                            style="width: 70px; padding: 4px; border: 1px solid #d1d5db; border-radius: 4px; text-align: right;"
                          />
                        </td>
                        <td style="padding: 10px; text-align: right;">
                          <input 
                            id="wage-${wage.id}-other_deduction"
                            type="number" 
                            step="0.01"
                            value="${edited.other_deduction ?? ''}"
                            data-action="edit-wage"
                            data-wage-id="${wage.id}"
                            data-field="other_deduction"
                            style="width: 70px; padding: 4px; border: 1px solid #d1d5db; border-radius: 4px; text-align: right;"
                          />
                        </td>
                        <td style="padding: 10px; text-align: right;">
                          <input 
                            id="wage-${wage.id}-other_benefit"
                            type="number" 
                            step="0.01"
                            value="${edited.other_benefit ?? ''}"
                            data-action="edit-wage"
                            data-wage-id="${wage.id}"
                            data-field="other_benefit"
                            style="width: 70px; padding: 4px; border: 1px solid #d1d5db; border-radius: 4px; text-align: right;"
                          />
                        </td>
                        <td style="padding: 10px; text-align: right;">
                          <span id="wage-${wage.id}-net-display" style="font-weight: 600; color: #059669;">${formatCurrency(netSalary)}</span>
                        </td>
                        <td style="padding: 10px;">
                          <div style="font-size: 11px;">
                            <div style="color: #6b7280;">${edited.paid_date ? formatDateDisplay(edited.paid_date) : 'Not paid'}</div>
                            <div style="color: #6b7280;">${edited.cheque_no || '-'}</div>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : `
          <div style="background: white; padding: 40px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center;">
            <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
            <h3 style="color: #6b7280; margin-bottom: 8px;">No Wage Records Found</h3>
            <p style="color: #9ca3af;">Select a month and click "Load Wages" to manage existing wage records</p>
          </div>
        `}
      </div>
    `;
}
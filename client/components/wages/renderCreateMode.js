export function renderCreateMode(ctx) {
  const {
    selectedMonth,
    employees,
    wageData,
    selectedEmployeeIds,
    isLoading,
    createFilters,
    createSort,
    commonPaymentData,
    formatMonthDisplay,
    formatCurrency,
    calculateNetSalary,
    getFilteredCreateEmployees,
    getUniqueValues,
    sortArray
  } = ctx;

  const filteredEmployees = getFilteredCreateEmployees();
  const uniqueBanks = getUniqueValues(employees, 'bank');
  const uniqueProjects = getUniqueValues(employees, 'project');
  const uniqueSites = getUniqueValues(employees, 'site');
  
  return `
      <div class="create-mode">
        <!-- Controls -->
        <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px;">
          <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
            <div>
              <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Month</label>
              <input 
                type="month" 
                value="${selectedMonth}"
                data-action="set-month"
                style="padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px;"
              />
            </div>
            
            <div style="margin-top: auto;">
              <button 
                data-action="load-employees" 
                ${isLoading ? 'disabled' : ''}
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
                ${isLoading ? '⏳ Loading...' : '🔄 Load Unpaid Employees'}
              </button>
            </div>

            ${employees.length > 0 ? `
              <div style="margin-top: auto;">
                <button 
                  data-action="calculate-bulk"
                  style="
                    padding: 8px 16px;
                    background: #10b981;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 600;
                  "
                >
                  🧮 Calculate All
                </button>
              </div>

              <div style="margin-top: auto;">
                <button 
                  id="save-wages-btn"
                  data-action="save-wages"
                  ${isLoading || selectedEmployeeIds.size === 0 ? 'disabled' : ''}
                  style="
                    padding: 8px 16px;
                    background: ${selectedEmployeeIds.size === 0 ? '#9ca3af' : '#059669'};
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: ${selectedEmployeeIds.size === 0 ? 'not-allowed' : 'pointer'};
                    font-weight: 600;
                  "
                >
                  💾 Save Wages${selectedEmployeeIds.size > 0 ? ` (${selectedEmployeeIds.size})` : ''}
                </button>
              </div>

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

          ${employees.length > 0 ? `
            <!-- Filters -->
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
              <h4 style="margin-bottom: 10px; color: #374151; font-size: 14px; font-weight: 600;">🔍 Filters</h4>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                <div>
                  <input 
                    type="text" 
                    placeholder="Search by name, aadhar, account..."
                    value="${createFilters.searchTerm}"
                    data-action="search-filter"
                    data-mode="create"
                    data-field="searchTerm"
                    style="width: 100%; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px;"
                  />
                </div>
                
                <div>
                  <select 
                    data-action="filter-select"
                    data-mode="create"
                    data-field="bankFilter"
                    style="width: 100%; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px;"
                  >
                    <option value="all" ${createFilters.bankFilter === 'all' ? 'selected' : ''}>All Banks</option>
                    ${uniqueBanks.map(bank => `<option value="${bank}" ${createFilters.bankFilter === bank ? 'selected' : ''}>${bank}</option>`).join('')}
                  </select>
                </div>
                
                <div>
                  <select 
                    data-action="filter-select"
                    data-mode="create"
                    data-field="projectFilter"
                    style="width: 100%; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px;"
                  >
                    <option value="all" ${createFilters.projectFilter === 'all' ? 'selected' : ''}>All Projects</option>
                    ${uniqueProjects.map(proj => `<option value="${proj}" ${createFilters.projectFilter === proj ? 'selected' : ''}>${proj}</option>`).join('')}
                  </select>
                </div>
                
                <div>
                  <select 
                    data-action="filter-select"
                    data-mode="create"
                    data-field="siteFilter"
                    style="width: 100%; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px;"
                  >
                    <option value="all" ${createFilters.siteFilter === 'all' ? 'selected' : ''}>All Sites</option>
                    ${uniqueSites.map(site => `<option value="${site}" ${createFilters.siteFilter === site ? 'selected' : ''}>${site}</option>`).join('')}
                  </select>
                </div>
              </div>
            </div>

            <!-- Common Payment Data -->
            <div style="margin-top: 15px; padding: 15px; background: #f3f4f6; border-radius: 6px; border-left: 4px solid #3b82f6;">
              <h4 style="margin-bottom: 10px; color: #374151; font-size: 14px; font-weight: 600;">💰 Common Payment Data (Apply to Selected)</h4>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">
                <div>
                  <label style="display: block; margin-bottom: 3px; font-size: 12px; color: #6b7280;">Paid Date</label>
                  <input 
                    type="date" 
                    value="${commonPaymentData.paid_date}"
                    data-action="common-payment"
                    data-field="paid_date"
                    style="width: 100%; padding: 5px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px;"
                  />
                </div>
                <div>
                  <label style="display: block; margin-bottom: 3px; font-size: 12px; color: #6b7280;">Cheque No</label>
                  <input 
                    type="text" 
                    value="${commonPaymentData.cheque_no}"
                    data-action="common-payment"
                    data-field="cheque_no"
                    placeholder="Optional"
                    style="width: 100%; padding: 5px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px;"
                  />
                </div>
                <div>
                  <label style="display: block; margin-bottom: 3px; font-size: 12px; color: #6b7280;">Paid From Bank</label>
                  <input 
                    type="text" 
                    value="${commonPaymentData.paid_from_bank_ac}"
                    data-action="common-payment"
                    data-field="paid_from_bank_ac"
                    placeholder="Optional"
                    style="width: 100%; padding: 5px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px;"
                  />
                </div>
                <div>
                  <label style="display: block; margin-bottom: 3px; font-size: 12px; color: #6b7280;">Remarks</label>
                  <input 
                    type="text" 
                    value="${commonPaymentData.remarks}"
                    data-action="common-payment"
                    data-field="remarks"
                    placeholder="Optional"
                    style="width: 100%; padding: 5px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px;"
                  />
                </div>
              </div>
            </div>

            <!-- Summary -->
            <div style="margin-top: 15px; padding: 15px; background: linear-gradient(135deg, #f0fdf4, #fef2f2); border-radius: 8px; border: 1px solid #e5e7eb;">
              <h4 id="create-summary-header" style="margin-bottom: 10px; color: #374151; font-size: 13px; font-weight: 600;">📊 Summary (${selectedEmployeeIds.size} selected / ${filteredEmployees.length} total)</h4>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">
                <div style="padding: 8px; background: white; border-radius: 4px; border-left: 3px solid #ef4444;">
                  <div style="font-size: 11px; color: #6b7280; margin-bottom: 3px;">Total Gross</div>
                  <div style="font-size: 16px; font-weight: 700; color: #ef4444;"><span id="create-summary-gross">${formatCurrency(Array.from(selectedEmployeeIds).reduce((sum, empId) => sum + (wageData[empId]?.gross_salary || 0), 0))}</span></div>
                </div>
                <div style="padding: 8px; background: white; border-radius: 4px; border-left: 3px solid #f59e0b;">
                  <div style="font-size: 11px; color: #6b7280; margin-bottom: 3px;">Total EPF</div>
                  <div style="font-size: 16px; font-weight: 700; color: #f59e0b;"><span id="create-summary-epf">${formatCurrency(Array.from(selectedEmployeeIds).reduce((sum, empId) => sum + (wageData[empId]?.epf_deduction || 0), 0))}</span></div>
                </div>
                <div style="padding: 8px; background: white; border-radius: 4px; border-left: 3px solid #3b82f6;">
                  <div style="font-size: 11px; color: #6b7280; margin-bottom: 3px;">Total ESIC</div>
                  <div style="font-size: 16px; font-weight: 700; color: #3b82f6;"><span id="create-summary-esic">${formatCurrency(Array.from(selectedEmployeeIds).reduce((sum, empId) => sum + (wageData[empId]?.esic_deduction || 0), 0))}</span></div>
                </div>
                <div style="padding: 8px; background: white; border-radius: 4px; border-left: 3px solid #10b981;">
                  <div style="font-size: 11px; color: #6b7280; margin-bottom: 3px;">Total Net Salary</div>
                  <div style="font-size: 16px; font-weight: 700; color: #059669;"><span id="create-summary-net">${formatCurrency(Array.from(selectedEmployeeIds).reduce((sum, empId) => {
                    const wage = wageData[empId];
                    if (!wage) return sum;
                    return sum + calculateNetSalary(
                      wage.gross_salary,
                      wage.epf_deduction,
                      wage.esic_deduction,
                      wage.other_deduction,
                      wage.other_benefit
                    );
                  }, 0))}</span></div>
                </div>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Employees Table -->
        ${employees.length > 0 ? `
          <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h3 style="margin-bottom: 15px; color: #1f2937;">
              Unpaid Employees for ${formatMonthDisplay(selectedMonth)}
              <span style="color: #6b7280; font-size: 14px;">(${filteredEmployees.length} of ${employees.length} employees)</span>
            </h3>
            
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                  <tr style="background: linear-gradient(to right, #ef4444, #10b981); border-bottom: 2px solid #e5e7eb;">
                    <th style="padding: 12px; text-align: center; color: white; font-weight: 600;">
                      <input 
                        id="select-all-create"
                        type="checkbox" 
                        ${selectedEmployeeIds.size === filteredEmployees.length && filteredEmployees.length > 0 ? 'checked' : ''}
                        data-action="select-all-employees"
                        style="cursor: pointer; width: 16px; height: 16px;"
                      />
                    </th>
                    <th style="padding: 12px; text-align: left; font-weight: 600; color: white; cursor: pointer;" data-action="sort" data-column="employee_name" data-mode="create">Employee ${createSort.column === 'employee_name' ? (createSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th style="padding: 12px; text-align: left; font-weight: 600; color: white;">Bank Details</th>
                    <th style="padding: 12px; text-align: center; font-weight: 600; color: white; cursor: pointer;" data-action="sort" data-column="p_day_wage" data-mode="create">Per Day ${createSort.column === 'p_day_wage' ? (createSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th style="padding: 12px; text-align: center; font-weight: 600; color: white; cursor: pointer;" data-action="sort" data-column="wage_days" data-mode="create">Days ${createSort.column === 'wage_days' ? (createSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th style="padding: 12px; text-align: right; font-weight: 600; color: white; cursor: pointer;" data-action="sort" data-column="gross_salary" data-mode="create">Gross ${createSort.column === 'gross_salary' ? (createSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th style="padding: 12px; text-align: right; font-weight: 600; color: white; cursor: pointer;" data-action="sort" data-column="epf_deduction" data-mode="create">EPF ${createSort.column === 'epf_deduction' ? (createSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th style="padding: 12px; text-align: right; font-weight: 600; color: white; cursor: pointer;" data-action="sort" data-column="esic_deduction" data-mode="create">ESIC ${createSort.column === 'esic_deduction' ? (createSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th style="padding: 12px; text-align: right; font-weight: 600; color: white; cursor: pointer;" data-action="sort" data-column="other_deduction" data-mode="create">Other Ded ${createSort.column === 'other_deduction' ? (createSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th style="padding: 12px; text-align: right; font-weight: 600; color: white; cursor: pointer;" data-action="sort" data-column="other_benefit" data-mode="create">Other Ben ${createSort.column === 'other_benefit' ? (createSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th style="padding: 12px; text-align: right; font-weight: 600; color: white; cursor: pointer;" data-action="sort" data-column="net_salary" data-mode="create">Net Salary ${createSort.column === 'net_salary' ? (createSort.asc ? '▲' : '▼') : '⇅'}</th>
                  </tr>
                </thead>
                <tbody>
                  ${sortArray(filteredEmployees, createSort.column, createSort.asc).map(emp => {
                    const wage = wageData[emp.master_roll_id] || {};
                    const isSelected = selectedEmployeeIds.has(emp.master_roll_id);
                    const netSalary = calculateNetSalary(
                      wage.gross_salary,
                      wage.epf_deduction,
                      wage.esic_deduction,
                      wage.other_deduction,
                      wage.other_benefit
                    );
                    
                    return `
                      <tr data-emp-row="${emp.master_roll_id}" style="border-bottom: 1px solid #e5e7eb; background: ${isSelected ? '#eff6ff' : 'white'};">
                        <td style="padding: 12px; text-align: center;">
                          <input 
                            type="checkbox" 
                            ${isSelected ? 'checked' : ''}
                            data-action="toggle-employee"
                            data-emp-id="${emp.master_roll_id}"
                            style="cursor: pointer; width: 16px; height: 16px;"
                          />
                        </td>
                        <td style="padding: 12px;">
                          <div style="font-weight: 600; color: #1f2937;">${emp.employee_name}</div>
                          <div style="font-size: 11px; color: #6b7280;">${emp.project || 'N/A'} - ${emp.site || 'N/A'}</div>
                        </td>
                        <td style="padding: 12px;">
                          <div style="font-size: 13px; color: #374151;">${emp.bank}</div>
                          <div style="font-size: 11px; color: #6b7280;">${emp.account_no}</div>
                        </td>
                        <td style="padding: 12px; text-align: center;">
                          <input 
                            type="number" 
                            step="0.01"
                            value="${wage.p_day_wage || emp.p_day_wage || 0}"
                            data-action="edit-employee"
                            data-emp-id="${emp.master_roll_id}"
                            data-field="p_day_wage"
                            style="width: 80px; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; text-align: right; font-size: 13px;"
                          />
                        </td>
                        <td style="padding: 12px; text-align: center;">
                          <input 
                            type="number" 
                            value="${wage.wage_days || 26}"
                            data-action="edit-employee"
                            data-emp-id="${emp.master_roll_id}"
                            data-field="wage_days"
                            style="width: 60px; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; text-align: center; font-size: 13px;"
                          />
                        </td>
                        <td style="padding: 12px; text-align: right;">
                          <input 
                            type="number" 
                            value="${wage.gross_salary || 0}"
                            data-emp-id="${emp.master_roll_id}"
                            data-field="gross_salary"
                            readonly
                            style="width: 100px; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; background: #f9fafb; text-align: right; font-size: 13px; color: #374151;"
                          />
                        </td>
                        <td style="padding: 12px; text-align: right;">
  <input 
    type="number" 
    step="0.01"
    value="${wage.epf_deduction || 0}"
    data-action="edit-employee"
    data-emp-id="${emp.master_roll_id}"
    data-field="epf_deduction"
    style="width: 80px; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; text-align: right; font-size: 13px;"
  />
</td>
                        <td style="padding: 12px; text-align: right;">
  <input 
    type="number" 
    step="0.01"
    value="${wage.esic_deduction || 0}"
    data-action="edit-employee"
    data-emp-id="${emp.master_roll_id}"
    data-field="esic_deduction"
    style="width: 80px; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; text-align: right; font-size: 13px;"
  />
</td>
                        <td style="padding: 12px; text-align: right;">
                          <input 
                            type="number" 
                            step="0.01"
                            value="${wage.other_deduction || 0}"
                            data-action="edit-employee"
                            data-emp-id="${emp.master_roll_id}"
                            data-field="other_deduction"
                            style="width: 80px; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; text-align: right; font-size: 13px;"
                          />
                        </td>
                        <td style="padding: 12px; text-align: right;">
                          <input 
                            type="number" 
                            step="0.01"
                            value="${wage.other_benefit || 0}"
                            data-action="edit-employee"
                            data-emp-id="${emp.master_roll_id}"
                            data-field="other_benefit"
                            style="width: 80px; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; text-align: right; font-size: 13px;"
                          />
                        </td>
                        <td style="padding: 12px; text-align: right;">
                          <input 
                            type="number" 
                            value="${netSalary.toFixed(2)}"
                            data-emp-id="${emp.master_roll_id}"
                            data-field="net_salary"
                            readonly
                            style="width: 110px; padding: 6px; border: 2px solid #10b981; border-radius: 4px; background: #ecfdf5; text-align: right; font-weight: 600; color: #059669; font-size: 13px;"
                          />
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
            <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
            <h3 style="color: #6b7280; margin-bottom: 8px;">No Employees Loaded</h3>
            <p style="color: #9ca3af;">Select a month and click "Load Unpaid Employees" to get started</p>
          </div>
        `}
      </div>
    `;
}
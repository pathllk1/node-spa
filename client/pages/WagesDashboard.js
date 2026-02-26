import { renderTabs } from "../components/wages/renderTabs.js";
import { renderCreateMode } from "../components/wages/renderCreateMode.js";
import { renderManageMode } from "../components/wages/renderManageMode.js";
import { requireAuth } from '../middleware/authMiddleware.js';
import { renderLayout } from '../components/layout.js';
import { api, fetchWithCSRF } from '../utils/api.js';

export async function renderWagesDashboard(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  // Load XLSX library dynamically like master-roll.js
  await loadXLSX();
  const XLSX = window.XLSX;

  function loadXLSX() {
    return new Promise((resolve) => {
      if (window.XLSX) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = '/public/cdns/xlsx.full.min.js';
      script.onload = () => resolve();
      document.head.appendChild(script);
    });
  }

  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  
  // Tab state
  let activeTab = 'create'; // 'create' or 'manage'
  
  // Create mode state
  let selectedMonth = '';
  let employees = [];
  let wageData = {};
  let isLoading = false;
  let selectedEmployeeIds = new Set(); // ✅ CHECKBOXES for CREATE mode
  
  // Manage mode state
  let manageMonth = '';
  let existingWages = [];
  let editedWages = {}; // Track edited wages by ID
  let selectedWageIds = new Set(); // For bulk operations
  let isManageLoading = false;
  
  // Bulk edit mode
  let isBulkEditMode = false;
  let bulkEditData = {
    wage_days: '',
    epf_deduction: '',
    esic_deduction: '',
    other_deduction: '',
    other_benefit: '',
    paid_date: '',
    cheque_no: '',
    paid_from_bank_ac: '',
    remarks: ''
  };
  
  // Common payment fields (Create mode)
  let commonPaymentData = {
    paid_date: '',
    cheque_no: '',
    paid_from_bank_ac: '',
    remarks: ''
  };
  
  // Filter state (for both Create and Manage)
  let createFilters = {
    searchTerm: '',
    bankFilter: 'all',
    projectFilter: 'all',
    siteFilter: 'all'
  };
  
  let manageFilters = {
    searchTerm: '',
    bankFilter: 'all',
    projectFilter: 'all',
    siteFilter: 'all',
    paidFilter: 'all'
  };

  // Debounce timers for search filters
  let createSearchDebounceTimer = null;
  let manageSearchDebounceTimer = null;

  // Sort state for tables
  let createSort = { column: null, asc: true };
  let manageSort = { column: null, asc: true };

  // Event delegation flag - attach listeners only once
  let listenersAttached = false;

  let manageRenderDebounceTimer = null;
let createRenderDebounceTimer = null;

  /* --------------------------------------------------
     UTILITY FUNCTIONS
  -------------------------------------------------- */

  function formatDateDisplay(dateStr) {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN');
    } catch (e) {
      return dateStr;
    }
  }

  function formatMonthDisplay(yearMonth) {
    if (!yearMonth) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const [year, month] = yearMonth.split('-');
    return `${months[parseInt(month) - 1]} ${year}`;
  }

  function inputValue(value) {
    if (value === null || value === undefined) return '';
    return value;
  }

  function toNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function toInt(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : 0;
    const parsed = parseInt(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '₹0.00';
    return `₹${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function calculateNetSalary(gross, epf, esic, otherDed, otherBen) {
    const totalDeductions = (epf || 0) + (esic || 0) + (otherDed || 0);
    const totalBenefits = otherBen || 0;
    return parseFloat((gross - totalDeductions + totalBenefits).toFixed(2));
  }

  function showToast(message, type = 'success') {
    const bgColor = type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#10b981';
    Toastify({ 
      text: message, 
      backgroundColor: bgColor, 
      duration: 3000,
      gravity: 'top',
      position: 'right'
    }).showToast();
  }

  /* --------------------------------------------------
     CREATE MODE - WAGE CALCULATION FUNCTIONS
  -------------------------------------------------- */

  function calculateAllWagesForEmployee(empId) {
    const emp = employees.find(e => e.master_roll_id === empId);
    const wage = wageData[empId];
    if (!emp || !wage) return;

    const dailyRate = wage.p_day_wage || emp.p_day_wage || 0;
    const wageDays = wage.wage_days || 26;

    // Calculate gross salary = Daily Rate * days
    wage.gross_salary = parseFloat((dailyRate * wageDays).toFixed(2));

    // Calculate EPF: round(gross_salary * 12%), max 1800
    wage.epf_deduction = Math.min(Math.round(wage.gross_salary * 0.12), 1800);

    // Calculate ESIC: round up(gross_salary * 0.75%)
    wage.esic_deduction = Math.ceil(wage.gross_salary * 0.0075);

    // Update UI immediately
    updateWageRowDisplay(empId);
  }

  function updateWageRowDisplay(empId) {
    const wage = wageData[empId];
    if (!wage) return;

    const netSalary = calculateNetSalary(
      wage.gross_salary,
      wage.epf_deduction,
      wage.esic_deduction,
      wage.other_deduction,
      wage.other_benefit
    );

    // Update all readonly/auto-calculated fields
    // NOTE: selector must match data-emp-id (not data-employee) used in the template
    const fields = ['gross_salary', 'epf_deduction', 'esic_deduction'];
    fields.forEach(field => {
      const input = document.querySelector(`input[data-emp-id="${empId}"][data-field="${field}"]`);
      if (input) input.value = wage[field] || 0;
    });

    const netInput = document.querySelector(`input[data-emp-id="${empId}"][data-field="net_salary"]`);
    if (netInput) netInput.value = netSalary.toFixed(2);
  }

  function calculateBulkForAllEmployees() {
    employees.forEach(emp => {
      if (!wageData[emp.master_roll_id]) {
        wageData[emp.master_roll_id] = {
          p_day_wage: emp.p_day_wage || 0,
          wage_days: emp.last_wage_days || 26,
          gross_salary: 0,
          epf_deduction: 0,
          esic_deduction: 0,
          other_deduction: 0,
          other_benefit: 0
        };
      }
      calculateAllWagesForEmployee(emp.master_roll_id);
    });
    const content = render();
    renderLayout(content, window.wagesDashboard.router);
  }

  // ====================================================================
// COMPLETE BUGFIX FOR handleCreateFieldChange FUNCTION
// Replace lines 180-209 in WagesDashboard.js
// ====================================================================

function handleCreateFieldChange(empId, field, value) {
  if (!wageData[empId]) {
    wageData[empId] = {
      p_day_wage: 0,
      wage_days: 26,
      gross_salary: 0,
      epf_deduction: 0,
      esic_deduction: 0,
      other_deduction: 0,
      other_benefit: 0
    };
  }
  
  // Parse value based on field type
  let parsedValue;
  if (field === 'wage_days') {
    parsedValue = parseInt(value) || 0;
  } else {
    parsedValue = parseFloat(value) || 0;
  }
  
  // ✅ FIX: Validation - No negative values
  if (parsedValue < 0) {
    showToast('Value cannot be negative', 'error');
    parsedValue = 0;
  }
  
  // ✅ FIX: Validation - Wage days max 31
  if (field === 'wage_days' && parsedValue > 31) {
    showToast('Wage days cannot exceed 31', 'warning');
    parsedValue = 31;
  }
  
  // ✅ FIX: Validation - EPF max 1800
  if (field === 'epf_deduction' && parsedValue > 1800) {
    showToast('EPF deduction cannot exceed ₹1800', 'warning');
    parsedValue = 1800;
  }
  
  // Update the field value
  wageData[empId][field] = parsedValue;
  
  // ✅ AUTO-CALCULATE when p_day_wage or wage_days changes
  if (field === 'p_day_wage' || field === 'wage_days') {
    const dailyRate = wageData[empId].p_day_wage || 0;
    const wageDays = wageData[empId].wage_days || 26;
    
    // Calculate gross
    wageData[empId].gross_salary = parseFloat((dailyRate * wageDays).toFixed(2));
    
    // Calculate EPF (12%, max 1800)
    wageData[empId].epf_deduction = Math.min(
      Math.round(wageData[empId].gross_salary * 0.12), 
      1800
    );
    
    // Calculate ESIC (0.75%, round up)
    wageData[empId].esic_deduction = Math.ceil(
      wageData[empId].gross_salary * 0.0075
    );
    
    updateWageRowDisplay(empId);
  }
  
  // ✅ FIX BUG #2: AUTO-UPDATE net when EPF/ESIC manually edited
  // ✅ FIX BUG #3: If gross manually edited, recalculate EPF/ESIC
  if (field === 'gross_salary') {
    // Recalculate per-day wage
    const wage = wageData[empId];
    wage.p_day_wage = wage.wage_days > 0 
      ? parseFloat((wage.gross_salary / wage.wage_days).toFixed(2)) 
      : 0;
    
    // Recalculate EPF/ESIC based on new gross
    wage.epf_deduction = Math.min(Math.round(wage.gross_salary * 0.12), 1800);
    wage.esic_deduction = Math.ceil(wage.gross_salary * 0.0075);
    
    updateWageRowDisplay(empId);
  }
  
  // ✅ FIX BUG #2: Update net salary when ANY deduction/benefit changes
  if (field === 'epf_deduction' || field === 'esic_deduction' || 
      field === 'other_deduction' || field === 'other_benefit') {
    updateWageRowDisplay(empId);
  }
}

  /* --------------------------------------------------
     CREATE MODE - API FUNCTIONS
  -------------------------------------------------- */

  async function loadEmployeesForWages() {
    if (!selectedMonth) {
      showToast('Please select a month', 'error');
      return;
    }

    isLoading = true;
    const content = render();
    renderLayout(content, window.wagesDashboard.router);

    try {
      const result = await api.post('/api/wages/employees', { month: selectedMonth });

      if (result.success) {
        employees = result.data;
        wageData = {};
        selectedEmployeeIds = new Set(); // Clear selections

        // Initialize wage data with last values
        employees.forEach(emp => {
          wageData[emp.master_roll_id] = {
            p_day_wage: emp.p_day_wage || 0,
            wage_days: emp.last_wage_days || 26,
            gross_salary: 0,
            epf_deduction: 0,
            esic_deduction: 0,
            other_deduction: 0,
            other_benefit: 0
          };
        });

        showToast(`Loaded ${employees.length} employees (${result.meta.already_paid} already paid)`, 'success');
      } else {
        showToast(result.message || 'Failed to load employees', 'error');
      }
    } catch (error) {
      console.error('Error loading employees:', error);
      showToast('Error loading employees', 'error');
    } finally {
      isLoading = false;
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    }
  }

  async function saveWages() {
    if (!selectedMonth) {
      showToast('Please select a month', 'error');
      return;
    }

    // ✅ Only create wages for SELECTED employees
    if (selectedEmployeeIds.size === 0) {
      showToast('Please select at least one employee', 'warning');
      return;
    }

    const wageRecords = Array.from(selectedEmployeeIds).map(empId => {
      const emp = employees.find(e => e.master_roll_id.toString() === empId.toString());

      if (!emp) {
        console.warn(`Employee with ID ${empId} not found in employees list, skipping`);
        return null;
      }

      const wage = wageData[empId] || {};
      return {
        master_roll_id: empId,
        p_day_wage: wage.p_day_wage || emp.p_day_wage || 0,
        wage_days: wage.wage_days || 26,
        gross_salary: wage.gross_salary || 0,
        epf_deduction: wage.epf_deduction || 0,
        esic_deduction: wage.esic_deduction || 0,
        other_deduction: wage.other_deduction || 0,
        other_benefit: wage.other_benefit || 0,
        paid_date: commonPaymentData.paid_date || null,
        cheque_no: commonPaymentData.cheque_no || null,
        paid_from_bank_ac: commonPaymentData.paid_from_bank_ac || null
      };
    }).filter(record => record !== null);

    // Server requires non-empty wages array - align with server validation
    if (wageRecords.length === 0) {
      showToast('No valid employees selected. Please select employees from the current list.', 'error');
      return;
    }

    isLoading = true;
    const content = render();
    renderLayout(content, window.wagesDashboard.router);

    try {
      const result = await api.post('/api/wages/create', { month: selectedMonth, wages: wageRecords });

      if (result.success) {
        showToast(result.message, 'success');
        // Clear form after successful save
        employees = [];
        wageData = {};
        selectedMonth = '';
        selectedEmployeeIds = new Set();
      } else {
        showToast(result.message || 'Failed to save wages', 'error');
      }
    } catch (error) {
      console.error('Error saving wages:', error);
      showToast('Error saving wages', 'error');
    } finally {
      isLoading = false;
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    }
  }

  /* --------------------------------------------------
     MANAGE MODE - API FUNCTIONS
  -------------------------------------------------- */

  async function loadExistingWages() {
    if (!manageMonth) {
      showToast('Please select a month', 'error');
      return;
    }

    isManageLoading = true;
    const content = render();
    renderLayout(content, window.wagesDashboard.router);

    try {
      const result = await api.get(`/api/wages/manage?month=${manageMonth}`);

      if (result.success) {
        existingWages = result.data;
        editedWages = {};
        selectedWageIds = new Set();
        isBulkEditMode = false;
        
        showToast(`Loaded ${existingWages.length} wage records for ${formatMonthDisplay(manageMonth)}`, 'success');
      } else {
        showToast(result.message || 'Failed to load wages', 'error');
      }
    } catch (error) {
      console.error('Error loading wages:', error);
      showToast('Error loading wages', 'error');
    } finally {
      isManageLoading = false;
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    }
  }

  async function saveEditedWages() {
    const wagesToUpdate = Object.keys(editedWages).map(id => {
      const edited = editedWages[id];
      return {
        id: id, // MongoDB ObjectId string — do NOT parseInt, it produces NaN
        ...edited,
        wage_days: toInt(edited.wage_days),
        p_day_wage: toNumber(edited.p_day_wage),
        gross_salary: toNumber(edited.gross_salary),
        epf_deduction: toNumber(edited.epf_deduction),
        esic_deduction: toNumber(edited.esic_deduction),
        other_deduction: toNumber(edited.other_deduction),
        other_benefit: toNumber(edited.other_benefit),
        paid_date: edited.paid_date || null,
        cheque_no: edited.cheque_no || null,
        paid_from_bank_ac: edited.paid_from_bank_ac || null
      };
    });

    if (wagesToUpdate.length === 0) {
      showToast('No changes to save', 'warning');
      return;
    }

    isManageLoading = true;
    const content = render();
    renderLayout(content, window.wagesDashboard.router);

    try {
      const result = await api.put('/api/wages/bulk-update', { wages: wagesToUpdate });

      if (result.success) {
        showToast(result.message, 'success');
        editedWages = {};
        await loadExistingWages(); // Reload to get fresh data
      } else {
        showToast(result.message || 'Failed to update wages', 'error');
      }
    } catch (error) {
      console.error('Error updating wages:', error);
      showToast('Error updating wages', 'error');
    } finally {
      isManageLoading = false;
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    }
  }

  async function deleteSelectedWages() {
    if (selectedWageIds.size === 0) {
      showToast('Please select wages to delete', 'warning');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedWageIds.size} wage record(s)?`)) {
      return;
    }

    isManageLoading = true;
    const content = render();
    renderLayout(content, window.wagesDashboard.router);

    try {
      const response = await fetchWithCSRF('/api/wages/bulk-delete', {
        method: 'DELETE',
        body: JSON.stringify({ ids: Array.from(selectedWageIds) })
      });

      const result = await response.json();

      if (result.success) {
        showToast(result.message, 'success');
        selectedWageIds = new Set();
        await loadExistingWages(); // Reload to get fresh data
      } else {
        showToast(result.message || 'Failed to delete wages', 'error');
      }
    } catch (error) {
      console.error('Error deleting wages:', error);
      showToast('Error deleting wages', 'error');
    } finally {
      isManageLoading = false;
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    }
  }

  /* --------------------------------------------------
     MANAGE MODE - BULK EDIT FUNCTIONS
  -------------------------------------------------- */

  function applyBulkEdit() {
    if (selectedWageIds.size === 0) {
      showToast('Please select wages to edit', 'warning');
      return;
    }

    selectedWageIds.forEach(wageId => {
      const wage = existingWages.find(w => w.id === wageId);
      if (!wage) return;

      if (!editedWages[wageId]) {
        editedWages[wageId] = { ...wage };
      }

      // Apply bulk edit fields that are not empty
      if (bulkEditData.wage_days !== '') {
        editedWages[wageId].wage_days = parseInt(bulkEditData.wage_days);
        // Recalculate gross
        const perDayWage = wage.p_day_wage || 0;
        editedWages[wageId].gross_salary = parseFloat((perDayWage * editedWages[wageId].wage_days).toFixed(2));
      }

      if (bulkEditData.epf_deduction !== '') {
        editedWages[wageId].epf_deduction = parseFloat(bulkEditData.epf_deduction);
      }

      if (bulkEditData.esic_deduction !== '') {
        editedWages[wageId].esic_deduction = parseFloat(bulkEditData.esic_deduction);
      }

      if (bulkEditData.other_deduction !== '') {
        editedWages[wageId].other_deduction = parseFloat(bulkEditData.other_deduction);
      }

      if (bulkEditData.other_benefit !== '') {
        editedWages[wageId].other_benefit = parseFloat(bulkEditData.other_benefit);
      }

      if (bulkEditData.paid_date !== '') {
        editedWages[wageId].paid_date = bulkEditData.paid_date;
      }

      if (bulkEditData.cheque_no !== '') {
        editedWages[wageId].cheque_no = bulkEditData.cheque_no;
      }

      if (bulkEditData.paid_from_bank_ac !== '') {
        editedWages[wageId].paid_from_bank_ac = bulkEditData.paid_from_bank_ac;
      }

      if (bulkEditData.remarks !== '') {
        editedWages[wageId].remarks = bulkEditData.remarks;
      }
    });

    // Clear bulk edit data
    bulkEditData = {
      wage_days: '',
      epf_deduction: '',
      esic_deduction: '',
      other_deduction: '',
      other_benefit: '',
      paid_date: '',
      cheque_no: '',
      paid_from_bank_ac: '',
      remarks: ''
    };

    isBulkEditMode = false;
    showToast(`Bulk edit applied to ${selectedWageIds.size} records`, 'success');
    const content = render();
    renderLayout(content, window.wagesDashboard.router);
  }

function handleManageFieldChange(wageId, field, value) {
    const wage = existingWages.find(w => w.id === wageId);
    if (!wage) return;

    if (!editedWages[wageId]) {
      editedWages[wageId] = { ...wage };
    }

    // Preserve raw input so we don't break cursor position during edits
    editedWages[wageId][field] = value;

    // 1. Auto-recalculate Gross Salary + EPF/ESIC if wage_days changes
    if (field === 'wage_days') {
      const perDayWage = wage.p_day_wage || 0;
      const wageDaysNumber = toInt(value);
      const newGross = parseFloat((perDayWage * wageDaysNumber).toFixed(2));
      editedWages[wageId].gross_salary = newGross;

      // Auto-recalculate EPF (12%, max ₹1800) and ESIC (0.75%, round up)
      const newEpf = Math.min(Math.round(newGross * 0.12), 1800);
      const newEsic = Math.ceil(newGross * 0.0075);
      editedWages[wageId].epf_deduction = newEpf;
      editedWages[wageId].esic_deduction = newEsic;

      // Direct DOM Update: Gross display span
      const grossEl = document.getElementById(`wage-${wageId}-gross-display`);
      if (grossEl) grossEl.innerText = formatCurrency(newGross);

      // Direct DOM Update: EPF and ESIC input values
      const epfInput = document.getElementById(`wage-${wageId}-epf_deduction`);
      if (epfInput) epfInput.value = newEpf;
      const esicInput = document.getElementById(`wage-${wageId}-esic_deduction`);
      if (esicInput) esicInput.value = newEsic;
    }

    // 2. Recalculate Net Salary (affected by ANY field change)
    const currentData = editedWages[wageId];
    const newNetSalary = calculateNetSalary(
      toNumber(currentData.gross_salary),
      toNumber(currentData.epf_deduction),
      toNumber(currentData.esic_deduction),
      toNumber(currentData.other_deduction),
      toNumber(currentData.other_benefit)
    );

    // Direct DOM Update: Net Salary display span
    const netEl = document.getElementById(`wage-${wageId}-net-display`);
    if (netEl) netEl.innerText = formatCurrency(newNetSalary);

    updateSummaryPanel();
  }

  /* --------------------------------------------------
     EXPORT FUNCTIONS
  -------------------------------------------------- */

  function exportToExcel() {
    // Determine which rows to export
    let rowsToExport = [];
    
    if (activeTab === 'create') {
      if (selectedEmployeeIds.size > 0) {
        // Export only selected rows
        rowsToExport = Array.from(selectedEmployeeIds);
      } else if (employees.length === 0) {
        showToast('No data to export', 'warning');
        return;
      } else {
        // Export all if none selected
        rowsToExport = employees.map(e => e.master_roll_id);
      }
    } else {
      if (selectedWageIds.size > 0) {
        // Export only selected rows
        rowsToExport = Array.from(selectedWageIds);
      } else if (existingWages.length === 0) {
        showToast('No data to export', 'warning');
        return;
      } else {
        // Export all if none selected
        rowsToExport = existingWages.map(w => w.id);
      }
    }

    const data = activeTab === 'create' 
      ? employees.filter(emp => rowsToExport.includes(emp.master_roll_id)).map(emp => {
          const wage = wageData[emp.master_roll_id] || {};
          return {
            'Employee Name': emp.employee_name,
            'Bank': emp.bank,
            'Account No': emp.account_no,
            'Per Day Wage': wage.p_day_wage || emp.p_day_wage || 0,
            'Wage Days': wage.wage_days || 26,
            'Gross Salary': wage.gross_salary || 0,
            'EPF': wage.epf_deduction || 0,
            'ESIC': wage.esic_deduction || 0,
            'Other Deduction': wage.other_deduction || 0,
            'Other Benefit': wage.other_benefit || 0,
            'Net Salary': calculateNetSalary(
              wage.gross_salary,
              wage.epf_deduction,
              wage.esic_deduction,
              wage.other_deduction,
              wage.other_benefit
            )
          };
        })
      : existingWages.filter(wage => rowsToExport.includes(wage.id)).map(wage => {
          const edited = editedWages[wage.id] || wage;
          const mr = wage.master_roll_id || {}; // populated nested object
          return {
            'Employee Name': mr.employee_name || '-',
            'Aadhar': mr.aadhar || '-',
            'Bank': mr.bank || '-',
            'Account No': mr.account_no || '-',
            'Per Day Wage': edited.p_day_wage,
            'Wage Days': edited.wage_days,
            'Gross Salary': edited.gross_salary,
            'EPF': edited.epf_deduction,
            'ESIC': edited.esic_deduction,
            'Other Deduction': edited.other_deduction || 0,
            'Other Benefit': edited.other_benefit || 0,
            'Net Salary': calculateNetSalary(
              edited.gross_salary,
              edited.epf_deduction,
              edited.esic_deduction,
              edited.other_deduction,
              edited.other_benefit
            ),
            'Paid Date': edited.paid_date || '-',
            'Cheque No': edited.cheque_no || '-',
            'Paid From Bank': edited.paid_from_bank_ac || '-'
          };
        });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Wages');
    
    const month = activeTab === 'create' ? selectedMonth : manageMonth;
    XLSX.writeFile(wb, `Wages_${month}_${activeTab}.xlsx`);
    const exportCount = activeTab === 'create' ? selectedEmployeeIds.size || employees.length : selectedWageIds.size || existingWages.length;
    showToast(`Exported ${exportCount} record(s) successfully`, 'success');
  }
     /* --------------------------------------------------
     FILTERING AND SORTING
  -------------------------------------------------- */

  function sortArray(data, column, asc) {
    if (!column) return data;
    
    return [...data].sort((a, b) => {
      let aVal, bVal;
      
      // Handle nested access for manage mode employee data
      if (column === 'employee_name' && a.master_roll_id) {
        aVal = a.master_roll_id.employee_name;
        bVal = b.master_roll_id.employee_name;
      } else {
        aVal = a[column];
        bVal = b[column];
      }
      
      // Handle undefined/null
      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';
      
      // Numeric comparison
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return asc ? aVal - bVal : bVal - aVal;
      }
      
      // String comparison
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      
      if (asc) {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
  }

  function getFilteredCreateEmployees() {
    return employees.filter(emp => {
      // Search filter
      const searchMatch = !createFilters.searchTerm || 
        emp.employee_name.toLowerCase().includes(createFilters.searchTerm.toLowerCase()) ||
        emp.aadhar.includes(createFilters.searchTerm) ||
        emp.account_no.includes(createFilters.searchTerm);

      // Bank filter
      const bankMatch = createFilters.bankFilter === 'all' || 
        emp.bank === createFilters.bankFilter;

      // Project filter
      const projectMatch = createFilters.projectFilter === 'all' || 
        emp.project === createFilters.projectFilter;

      // Site filter
      const siteMatch = createFilters.siteFilter === 'all' || 
        emp.site === createFilters.siteFilter;

      return searchMatch && bankMatch && projectMatch && siteMatch;
    });
  }

  function getFilteredManageWages() {
    return existingWages.filter(wage => {
      // Search filter
      const searchMatch = !manageFilters.searchTerm || 
        wage.master_roll_id?.employee_name?.toLowerCase().includes(manageFilters.searchTerm.toLowerCase()) ||
        wage.master_roll_id?.aadhar?.includes(manageFilters.searchTerm) ||
        wage.master_roll_id?.account_no?.includes(manageFilters.searchTerm);

      // Bank filter
      const bankMatch = manageFilters.bankFilter === 'all' || 
        wage.master_roll_id?.bank === manageFilters.bankFilter;

      // Project filter
      const projectMatch = manageFilters.projectFilter === 'all' || 
        wage.master_roll_id?.project === manageFilters.projectFilter;

      // Site filter
      const siteMatch = manageFilters.siteFilter === 'all' || 
        wage.master_roll_id?.site === manageFilters.siteFilter;

      // Paid filter
      const paidMatch = manageFilters.paidFilter === 'all' ||
        (manageFilters.paidFilter === 'paid' && wage.paid_date) ||
        (manageFilters.paidFilter === 'unpaid' && !wage.paid_date);

      return searchMatch && bankMatch && projectMatch && siteMatch && paidMatch;
    });
  }

  function getUniqueValues(array, key) {
    return [...new Set(array.map(item => item[key]).filter(Boolean))].sort();
  }

  /* --------------------------------------------------
     RENDER FUNCTIONS
  -------------------------------------------------- */

  function attachEventDelegation(container) {
    if (!container) return;
    
    // Delegate input changes for edit handlers
    container.addEventListener('input', (e) => {
      const action = e.target.dataset.action;
      if (action === 'edit-wage' || action === 'edit-employee') {
        const wageId = e.target.dataset.wageId;
        const empId = e.target.dataset.empId;
        const field = e.target.dataset.field;
        const value = e.target.value;
        
        if (wageId) window.wagesDashboard.handleManageEdit(wageId, field, value);
        if (empId) window.wagesDashboard.handleCreateFieldChange(empId, field, value);
      } else if (action === 'search-filter') {
        const mode = e.target.dataset.mode;
        const field = e.target.dataset.field;
        if (mode === 'create') {
          window.wagesDashboard.setCreateFilterDebounced(field, e.target.value);
        } else if (mode === 'manage') {
          window.wagesDashboard.setManageFilterDebounced(field, e.target.value);
        }
      } else if (action === 'set-bulk-edit') {
        const field = e.target.dataset.field;
        window.wagesDashboard.setBulkEdit(field, e.target.value);
      }
    });
    
    // Delegate checkbox and select changes
    container.addEventListener('change', (e) => {
      const action = e.target.dataset.action;
      if (action === 'toggle-wage') {
        const wageId = e.target.dataset.wageId;
        window.wagesDashboard.toggleWageSelection(wageId, e.target.checked);
      } else if (action === 'toggle-employee') {
        const empId = e.target.dataset.empId;
        window.wagesDashboard.toggleEmployeeSelection(empId, e.target.checked);
      } else if (action === 'select-all-wages') {
        window.wagesDashboard.toggleSelectAll(e.target.checked);
      } else if (action === 'select-all-employees') {
        window.wagesDashboard.toggleSelectAllCreate(e.target.checked);
      } else if (action === 'set-month') {
        window.wagesDashboard.setMonth(e.target.value);
      } else if (action === 'set-manage-month') {
        window.wagesDashboard.setManageMonth(e.target.value);
      } else if (action === 'filter-select') {
        const mode = e.target.dataset.mode;
        const field = e.target.dataset.field;
        if (mode === 'create') {
          window.wagesDashboard.setCreateFilter(field, e.target.value);
        } else if (mode === 'manage') {
          window.wagesDashboard.setManageFilter(field, e.target.value);
        }
      } else if (action === 'common-payment') {
        const field = e.target.dataset.field;
        window.wagesDashboard.setCommonPayment(field, e.target.value);
      }
    });
    
    // Delegate click events
    container.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (action === 'switch-tab') {
        const tab = e.target.dataset.tab;
        window.wagesDashboard.switchTab(tab);
      } else if (action === 'sort') {
        const column = e.target.dataset.column;
        const mode = e.target.dataset.mode;
        if (mode === 'create') {
          window.wagesDashboard.toggleCreateSort(column);
        } else if (mode === 'manage') {
          window.wagesDashboard.toggleManageSort(column);
        }
      } else if (action === 'load-employees') {
        window.wagesDashboard.loadEmployees();
      } else if (action === 'load-manage-wages') {
        window.wagesDashboard.loadManageWages();
      } else if (action === 'calculate-bulk') {
        window.wagesDashboard.calculateBulk();
      } else if (action === 'save-wages') {
        window.wagesDashboard.saveWages();
      } else if (action === 'export-excel') {
        window.wagesDashboard.exportToExcel();
      } else if (action === 'reset-filters') {
        const mode = e.target.dataset.mode;
        if (mode === 'create') {
          window.wagesDashboard.resetCreateFilters();
        } else if (mode === 'manage') {
          window.wagesDashboard.resetManageFilters();
        }
      } else if (action === 'toggle-bulk-edit') {
        window.wagesDashboard.toggleBulkEdit();
      } else if (action === 'delete-selected') {
        window.wagesDashboard.deleteSelected();
      } else if (action === 'save-edited') {
        window.wagesDashboard.saveEdited();
      } else if (action === 'apply-bulk-edit') {
        window.wagesDashboard.applyBulkEdit();
      } else if (action === 'clear-bulk-edit') {
        window.wagesDashboard.clearBulkEdit();
      }
    });
  }

  function render() {
    // Reset listeners flag when rendering (so they get re-attached)
    listenersAttached = false;
    
    // Capture currently focused element before re-render
    const activeElement = document.activeElement;
    const focusedWageId = activeElement?.dataset?.wageId;
    const focusedField = activeElement?.dataset?.field;
    const focusedEmpId = activeElement?.dataset?.empId;
    const focusedMode = activeElement?.dataset?.mode;
    const focusedSelectionStart = activeElement?.selectionStart;
    const focusedSelectionEnd = activeElement?.selectionEnd;
    const focusedSelectionDirection = activeElement?.selectionDirection;

    const html = `
      <div id="wages-dashboard" style="padding: 20px; max-width: 1600px; margin: 0 auto;">
        <div style="margin-bottom: 20px;">
          <h2 style="color: #1f2937; font-size: 24px; font-weight: 700;">💰 Wages Management</h2>
          <p style="color: #6b7280; margin-top: 5px;">Create new wages or manage existing wage records</p>
        </div>

        ${renderTabs({ activeTab })}
        
        ${activeTab === 'create' ? renderCreateMode({
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
        }) : renderManageMode({
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
          inputValue,
          toNumber
        })}
      </div>
    `;
    
    // Attach event delegation for CSP compliance
    setTimeout(() => {
      const container = document.getElementById('wages-dashboard');
      if (container && !listenersAttached) {
        attachEventDelegation(container);
        listenersAttached = true;
      }

      // Restore focus to previously focused field
      if (focusedWageId && focusedField) {
        const focusedInput = document.querySelector(`input[data-wage-id="${focusedWageId}"][data-field="${focusedField}"]`);
        if (focusedInput) {
          focusedInput.focus();
          try {
            if (focusedSelectionStart !== null && focusedSelectionStart !== undefined &&
                focusedSelectionEnd !== null && focusedSelectionEnd !== undefined) {
              focusedInput.setSelectionRange(
                focusedSelectionStart,
                focusedSelectionEnd,
                focusedSelectionDirection || 'none'
              );
            } else {
              const length = focusedInput.value.length;
              focusedInput.setSelectionRange(length, length);
            }
          } catch (e) {
            // Some input types don't support selection ranges
          }
        }
      } else if (focusedEmpId && focusedField) {
        const focusedInput = document.querySelector(`input[data-emp-id="${focusedEmpId}"][data-field="${focusedField}"]`);
        if (focusedInput) {
          focusedInput.focus();
          try {
            if (focusedSelectionStart !== null && focusedSelectionStart !== undefined &&
                focusedSelectionEnd !== null && focusedSelectionEnd !== undefined) {
              focusedInput.setSelectionRange(
                focusedSelectionStart,
                focusedSelectionEnd,
                focusedSelectionDirection || 'none'
              );
            } else {
              const length = focusedInput.value.length;
              focusedInput.setSelectionRange(length, length);
            }
          } catch (e) {
            // Some input types don't support selection ranges
          }
        }
      }
      else if (focusedMode && focusedField) { // <--- ADD THIS BLOCK
        const focusedInput = document.querySelector(`input[data-mode="${focusedMode}"][data-field="${focusedField}"], select[data-mode="${focusedMode}"][data-field="${focusedField}"]`);
        if (focusedInput) {
          focusedInput.focus();
          try {
             if (focusedSelectionStart !== null && focusedSelectionStart !== undefined) {
               focusedInput.setSelectionRange(focusedSelectionStart, focusedSelectionEnd);
             } else {
               const length = focusedInput.value.length;
               focusedInput.setSelectionRange(length, length);
             }
          } catch (e) {}
        }
      }
    }, 0);

    return html;
  }

  function updateSummaryPanel() {
    // If no summary panel is visible (no selection), stop
    if (selectedWageIds.size === 0) return;

    let totalGross = 0;
    let totalEpf = 0;
    let totalEsic = 0;
    let totalNet = 0;

    // Loop through ALL selected wages to recalculate totals
    selectedWageIds.forEach(wageId => {
      const wage = existingWages.find(w => w.id === wageId);
      if (!wage) return;

      // Use the edited value if it exists, otherwise use the original value
      const data = editedWages[wageId] || wage;

      totalGross += toNumber(data.gross_salary);
      totalEpf += toNumber(data.epf_deduction);
      totalEsic += toNumber(data.esic_deduction);
      
      totalNet += calculateNetSalary(
        toNumber(data.gross_salary),
        toNumber(data.epf_deduction),
        toNumber(data.esic_deduction),
        toNumber(data.other_deduction),
        toNumber(data.other_benefit)
      );
    });

    // Update the DOM elements directly
    const elGross = document.getElementById('summary-total-gross');
    const elEpf = document.getElementById('summary-total-epf');
    const elEsic = document.getElementById('summary-total-esic');
    const elNet = document.getElementById('summary-total-net');

    if (elGross) elGross.innerText = formatCurrency(totalGross);
    if (elEpf) elEpf.innerText = formatCurrency(totalEpf);
    if (elEsic) elEsic.innerText = formatCurrency(totalEsic);
    if (elNet) elNet.innerText = formatCurrency(totalNet);
  }

  /* --------------------------------------------------
     PUBLIC API (exposed to window for onclick handlers)
  -------------------------------------------------- */

  window.wagesDashboard = {
    router: router,
    // Tab switching
    switchTab: (tab) => {
      activeTab = tab;
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    },

    // Create mode - Data loading
    setMonth: (month) => {
      selectedMonth = month;
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    },
    loadEmployees: loadEmployeesForWages,
    
    // Create mode - Calculations (auto-calculate on field change)
    calculateBulk: calculateBulkForAllEmployees,
    handleCreateFieldChange: handleCreateFieldChange,
    
    // Create mode - Selection
    toggleEmployeeSelection: (empId, checked) => {
      if (checked) {
        selectedEmployeeIds.add(empId);
      } else {
        selectedEmployeeIds.delete(empId);
      }
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    },
    toggleSelectAllCreate: (checked) => {
      const filteredEmployees = getFilteredCreateEmployees();
      if (checked) {
        filteredEmployees.forEach(emp => selectedEmployeeIds.add(emp.master_roll_id));
      } else {
        filteredEmployees.forEach(emp => selectedEmployeeIds.delete(emp.master_roll_id));
      }
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    },
    
    // Create mode - Filters
    setCreateFilter: (field, value) => {
      createFilters[field] = value;
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    },
    
    setCreateFilterDebounced: (field, value) => {
      createFilters[field] = value;
      clearTimeout(createSearchDebounceTimer);
      createSearchDebounceTimer = setTimeout(() => {
        const content = render();
        renderLayout(content, window.wagesDashboard.router);
      }, 300);
    },
    
    resetCreateFilters: () => {
      createFilters = {
        searchTerm: '',
        bankFilter: 'all',
        projectFilter: 'all',
        siteFilter: 'all'
      };
      selectedEmployeeIds.clear();
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    },
    
    // Create mode - Sorting
    toggleCreateSort: (column) => {
      if (createSort.column === column) {
        createSort.asc = !createSort.asc;
      } else {
        createSort.column = column;
        createSort.asc = true;
      }
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    },
    
    // Create mode - Save & Payment
    saveWages: saveWages,
    setCommonPayment: (field, value) => {
      commonPaymentData[field] = value;
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    },

    // Manage mode - Data loading
    setManageMonth: (month) => {
      manageMonth = month;
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    },
    loadManageWages: loadExistingWages,
    
    // Manage mode - Editing
    handleManageEdit: handleManageFieldChange,
    saveEdited: saveEditedWages,
    deleteSelected: deleteSelectedWages,
    
    // Manage mode - Filters
    setManageFilter: (field, value) => {
      manageFilters[field] = value;
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    },
    
    setManageFilterDebounced: (field, value) => {
      manageFilters[field] = value;
      clearTimeout(manageSearchDebounceTimer);
      manageSearchDebounceTimer = setTimeout(() => {
        const content = render();
        renderLayout(content, window.wagesDashboard.router);
      }, 300);
    },
    
    resetManageFilters: () => {
      manageFilters = {
        searchTerm: '',
        bankFilter: 'all',
        projectFilter: 'all',
        siteFilter: 'all',
        paidFilter: 'all'
      };
      selectedWageIds.clear();
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    },
    
    // Manage mode - Sorting
    toggleManageSort: (column) => {
      if (manageSort.column === column) {
        manageSort.asc = !manageSort.asc;
      } else {
        manageSort.column = column;
        manageSort.asc = true;
      }
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    },
    
    // Manage mode - Bulk edit
    toggleBulkEdit: () => {
      isBulkEditMode = !isBulkEditMode;
      if (!isBulkEditMode) {
        bulkEditData = {
          wage_days: '',
          epf_deduction: '',
          esic_deduction: '',
          other_deduction: '',
          other_benefit: '',
          paid_date: '',
          cheque_no: '',
          paid_from_bank_ac: '',
          remarks: ''
        };
      }
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    },
    setBulkEdit: (field, value) => {
      bulkEditData[field] = value;
    },
    applyBulkEdit: applyBulkEdit,
    clearBulkEdit: () => {
      bulkEditData = {
        wage_days: '',
        epf_deduction: '',
        esic_deduction: '',
        other_deduction: '',
        other_benefit: '',
        paid_date: '',
        cheque_no: '',
        paid_from_bank_ac: '',
        remarks: ''
      };
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    },
    
    // Manage mode - Selection
    toggleWageSelection: (wageId, checked) => {
      if (checked) {
        selectedWageIds.add(wageId);
      } else {
        selectedWageIds.delete(wageId);
      }
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    },
    toggleSelectAll: (checked) => {
      const filteredWages = getFilteredManageWages();
      if (checked) {
        filteredWages.forEach(wage => selectedWageIds.add(wage.id));
      } else {
        filteredWages.forEach(wage => selectedWageIds.delete(wage.id));
      }
      const content = render();
      renderLayout(content, window.wagesDashboard.router);
    },

    // Export
    exportToExcel: exportToExcel
  };

  // Initial render
  const content = render();
  renderLayout(content, router);
}
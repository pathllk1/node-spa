# Stock Movement Tracking System Documentation

## Overview

The Stock Movement Tracking System provides comprehensive visibility into all inventory transactions and movements across the business. It displays detailed stock movement records with advanced filtering, sorting, pagination, and export capabilities, enabling users to track inventory flow and analyze stock patterns.

## Architecture

### Core Components
- **Movement Tracking**: Complete audit trail of all stock transactions
- **Real-time Analytics**: Summary statistics and movement analytics
- **Advanced Filtering**: Multi-criteria filtering by type, date, and search terms
- **Data Export**: CSV export functionality for external analysis
- **Pagination**: Efficient handling of large datasets
- **Sorting**: Multi-column sorting with visual indicators

### Movement Types
- **SALE**: Outward movement for sales transactions
- **PURCHASE**: Inward movement for purchase receipts
- **RECEIPT**: General inward stock movement
- **TRANSFER**: Stock transfers between locations
- **ADJUSTMENT**: Stock adjustments (corrections)
- **OPENING**: Opening stock entries

## User Interface

### Dashboard Layout
```html
<!-- Header with branding and description -->
<div class="text-center space-y-4">
  <div class="icon-container">📦</div>
  <h1>Stock Movement</h1>
  <p>View and analyze all stock movements...</p>
</div>

<!-- Control Panel -->
<div class="filter-controls">
  <input type="text" placeholder="Search movements..." />
  <select id="type-filter">
    <option>All Types</option>
    <option>SALE</option>
    <option>PURCHASE</option>
    <!-- ... -->
  </select>
  <input type="date" id="date-from" />
  <input type="date" id="date-to" />
  <button>Refresh</button>
  <button>Export CSV</button>
</div>

<!-- Summary Cards -->
<div class="summary-grid">
  <div>Total In: <span id="total-in">0</span></div>
  <div>Total Out: <span id="total-out">0</span></div>
  <div>Net Movement: <span id="net-movement">0</span></div>
  <div>Total Records: <span id="total-records">0</span></div>
</div>

<!-- Data Table with sorting -->
<table class="movements-table">
  <thead>
    <tr>
      <th data-sort="bdate">Date ↕️</th>
      <th data-sort="type">Type ↕️</th>
      <th data-sort="bno">Bill No ↕️</th>
      <!-- ... -->
    </tr>
  </thead>
  <tbody id="movements-table-body">
    <!-- Dynamic rows -->
  </tbody>
</table>

<!-- Pagination Controls -->
<div class="pagination">
  <button id="prev-page">Previous</button>
  <span id="page-numbers">1 2 3 ...</span>
  <button id="next-page">Next</button>
</div>
```

## Data Flow

### API Integration
```javascript
// Fetch movements data
const response = await fetch('/api/inventory/sales/stock-movements', {
  method: 'GET',
  credentials: 'same-origin',
  headers: { 'Content-Type': 'application/json' }
});

const data = await response.json();
// data.data.rows contains movement records
```

### Data Processing
```javascript
// Process raw movement data
allMovements = data.data.rows || [];

// Apply filtering
filteredMovements = allMovements.filter(movement => {
  // Search filter
  const matchesSearch = !searchTerm || 
    movement.item.toLowerCase().includes(searchTerm) ||
    movement.bno.toLowerCase().includes(searchTerm);
  
  // Type filter
  const matchesType = !typeFilter || movement.type === typeFilter;
  
  // Date range filter
  const matchesDate = (!dateFrom || movement.bdate >= dateFrom) &&
                     (!dateTo || movement.bdate <= dateTo);
  
  return matchesSearch && matchesType && matchesDate;
});

// Apply sorting
sortedMovements = [...filteredMovements].sort((a, b) => {
  // Dynamic sorting logic
});
```

## Movement Record Structure

### Database Schema (Mongoose)
```javascript
// StockReg model contains movement records
const stockRegSchema = new Schema({
  firm_id:   { type: Schema.Types.ObjectId, ref: 'Firm', required: true },
  type:      { type: String, required: true }, // 'SALE', 'PURCHASE', etc.
  bno:       { type: String }, // Bill/Document number
  bdate:     { type: String }, // Movement date
  party:     { type: String }, // Party name
  item:      { type: String, required: true },
  narration: { type: String },
  batch:     { type: String },
  hsn:       { type: String },
  qty:       { type: Number, required: true },
  uom:       { type: String },
  rate:      { type: Number, required: true },
  grate:     { type: Number, default: 0 },
  disc:      { type: Number, default: 0 },
  total:     { type: Number, required: true },
  stock_id:  { type: Schema.Types.ObjectId, ref: 'Stock' },
  bill_id:   { type: Schema.Types.ObjectId, ref: 'Bill' },
  user:      { type: String },
  firm:      { type: String }
}, { timestamps: true });

// Indexes for fast querying
stockRegSchema.index({ firm_id: 1, type: 1 });
stockRegSchema.index({ firm_id: 1, stock_id: 1 });
```

### Frontend Display Format
```javascript
const movement = {
  reg_id: 1,
  stock_id: 123,
  item: "Product A",
  batch: "BATCH001",
  qty: 10.00,
  uom: "PCS",
  rate: 50.00,
  total: 500.00,
  bno: "SAL001",
  bdate: "2024-01-15",
  type: "SALE",
  party_name: "ABC Corp"
};
```

## Features

### Advanced Filtering
```javascript
// Multi-criteria filtering
function filterMovements() {
  const searchTerm = searchInput.value.toLowerCase();
  const typeFilterValue = typeFilter.value;
  const dateFrom = dateFromFilter.value;
  const dateTo = dateToFilter.value;
  
  filteredMovements = allMovements.filter(movement => {
    // Text search across multiple fields
    const searchMatch = !searchTerm || 
      movement.item.toLowerCase().includes(searchTerm) ||
      movement.bno.toLowerCase().includes(searchTerm) ||
      movement.party_name.toLowerCase().includes(searchTerm);
    
    // Type dropdown filter
    const typeMatch = !typeFilterValue || 
      movement.type === typeFilterValue;
    
    // Date range filter
    const dateMatch = (!dateFrom || movement.bdate >= dateFrom) &&
                     (!dateTo || movement.bdate <= dateTo);
    
    return searchMatch && typeMatch && dateMatch;
  });
}
```

### Dynamic Sorting
```javascript
// Click-to-sort functionality
function sortMovements(column, direction) {
  sortedMovements.sort((a, b) => {
    let valueA, valueB;
    
    switch (column) {
      case 'bdate':
        valueA = new Date(a.bdate || 0);
        valueB = new Date(b.bdate || 0);
        break;
      case 'qty':
        valueA = parseFloat(a.qty || 0);
        valueB = parseFloat(b.qty || 0);
        break;
      case 'rate':
      case 'total':
        valueA = parseFloat(a[column] || 0);
        valueB = parseFloat(b[column] || 0);
        break;
      default:
        valueA = (a[column] || '').toString().toLowerCase();
        valueB = (b[column] || '').toString().toLowerCase();
    }
    
    if (direction === 'asc') {
      return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
    } else {
      return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
    }
  });
}
```

### Visual Sort Indicators
```html
<th data-sort="bdate">
  Date
  <svg class="sort-icon">
    <!-- Dynamic sort arrow -->
  </svg>
</th>
```

```javascript
function updateSortIcons() {
  const headers = document.querySelectorAll('th[data-sort]');
  headers.forEach(header => {
    const icon = header.querySelector('.sort-icon');
    const column = header.dataset.sort;
    
    if (column === sortColumn) {
      // Active sort column
      if (sortDirection === 'asc') {
        icon.innerHTML = '<path d="M4.5 15.75l7.5-7.5 7.5 7.5" />';
      } else {
        icon.innerHTML = '<path d="M19.5 8.25l-7.5 7.5-7.5-7.5" />';
      }
    } else {
      // Inactive columns
      icon.innerHTML = '<path d="M8.25 15L12 18.75 15.75 15M8.25 9l3.75-3.75L15.75 9" />';
    }
  });
}
```

### Pagination System
```javascript
// Configurable items per page
const itemsPerPageOptions = [10, 25, 50, 100];
let itemsPerPage = 25;

// Calculate pagination
function getPaginatedMovements() {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  return sortedMovements.slice(startIndex, endIndex);
}

function getTotalPages() {
  return Math.ceil(sortedMovements.length / itemsPerPage);
}
```

### Summary Statistics
```javascript
function updateSummary() {
  const totalRecords = allMovements.length;
  let totalIn = 0;
  let totalOut = 0;

  allMovements.forEach(movement => {
    const qty = parseFloat(movement.qty || 0);
    const type = movement.type || '';
    
    // Categorize movements
    if (['RECEIPT', 'PURCHASE', 'OPENING'].includes(type.toUpperCase())) {
      totalIn += qty;
    } else if (['SALE', 'TRANSFER', 'ADJUSTMENT'].includes(type.toUpperCase())) {
      totalOut += qty;
    }
  });

  const netMovement = totalIn - totalOut;
  
  // Update UI elements
  document.getElementById('total-in').textContent = totalIn.toFixed(2);
  document.getElementById('total-out').textContent = totalOut.toFixed(2);
  document.getElementById('net-movement').textContent = netMovement.toFixed(2);
  document.getElementById('total-records').textContent = totalRecords;
}
```

## Data Export

### CSV Export Functionality
```javascript
function exportToCSV() {
  const csvContent = [
    ['Date', 'Type', 'Bill No', 'Item', 'Batch', 'Quantity', 'UOM', 'Rate', 'Total', 'Party'],
    ...filteredMovements.map(movement => [
      formatDate(movement.bdate),
      movement.type || '',
      movement.bno || '',
      movement.item || '',
      movement.batch || '',
      (movement.qty || 0).toFixed(2),
      movement.uom || '',
      (movement.rate || 0).toFixed(2),
      (movement.total || 0).toFixed(2),
      movement.party_name || ''
    ])
  ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

  // Create and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `stock-movements-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}
```

## Visual Design

### Color-coded Movement Types
```javascript
// Movement type badges
const isOutward = ['SALE', 'TRANSFER', 'ADJUSTMENT'].includes(type.toUpperCase());
const badgeClass = isOutward 
  ? 'bg-red-100 text-red-800' 
  : 'bg-green-100 text-green-800';

// Quantity color coding
const qtyClass = isOutward ? 'text-red-600' : 'text-green-600';
```

### Responsive Table Design
```html
<table class="min-w-full divide-y divide-gray-200">
  <!-- Responsive table with horizontal scroll -->
</table>
```

### Gradient Styling
```css
/* Table header gradient */
thead {
  background: linear-gradient(to right, #dc2626, #2563eb, #eab308);
}

/* Row hover effects */
tbody tr:hover {
  background: linear-gradient(to right, #ecfccb, #ecfdf5);
}
```

## Performance Optimizations

### Efficient Data Processing
- Client-side filtering and sorting
- Lazy loading of large datasets
- Memory-efficient pagination
- Debounced search input

### API Optimization
```javascript
// Single API call for all movements
const response = await fetch('/api/inventory/sales/stock-movements');
// Process data client-side for flexibility
```

### DOM Manipulation
```javascript
// Efficient table updates
function renderMovements() {
  const paginatedData = getPaginatedMovements();
  tableBody.innerHTML = paginatedData.map(createRowHTML).join('');
}

function createRowHTML(movement) {
  return `
    <tr class="table-row">
      <td>${formatDate(movement.bdate)}</td>
      <!-- ... -->
    </tr>
  `;
}
```

## Error Handling

### API Error Handling
```javascript
try {
  const response = await fetch('/api/inventory/sales/stock-movements');
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
} catch (error) {
  console.error('Error loading movements:', error);
  showErrorMessage('Failed to load stock movements');
}
```

### Empty State Handling
```html
<tr>
  <td colspan="10" class="text-center text-gray-500">
    <div class="flex items-center justify-center">
      <svg class="w-5 h-5 mr-2"><!-- icon --></svg>
      No movements found matching your criteria.
    </div>
  </td>
</tr>
```

## Integration Points

### Inventory System
- Connects to stock register data
- Real-time stock level updates
- Batch tracking integration

### Sales System
- Links to sales transactions
- Customer/supplier information
- Invoice reference numbers

### Reporting System
- Export capabilities for analysis
- Date range filtering
- Multi-format data export

This stock movement tracking system provides comprehensive visibility into inventory flow with advanced filtering, sorting, and analysis capabilities essential for effective inventory management.

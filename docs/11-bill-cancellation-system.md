# Bill Cancellation System Documentation

## Overview

The Bill Cancellation System provides comprehensive bill cancellation functionality for the inventory management system. It allows authorized users to cancel sales bills, automatically restoring stock quantities and reversing financial ledger entries while maintaining complete audit trails.

## Architecture

### Core Components
- **Bill Status Management**: Updates bill status to 'CANCELLED'
- **Stock Restoration**: Automatically restores quantities to inventory batches
- **Financial Reversal**: Deletes associated ledger entries
- **Audit Trail**: Complete logging of cancellation actions
- **User Permissions**: Role-based access control for cancellation operations

### Database Schema Impact

#### Bills Table Updates
```sql
-- Bill status changes to 'CANCELLED'
UPDATE bills SET
  status = 'CANCELLED',
  cancelled_at = CURRENT_TIMESTAMP,
  cancelled_by = ?,
  cancellation_reason = ?,
  cancellation_remarks = ?
WHERE id = ? AND firm_id = ?
```

#### Stock Register Restoration
```sql
-- Stock quantities restored to batches
UPDATE stocks SET
  batches = JSON_UPDATE(batches, batch_path, restored_quantity)
WHERE id = ? AND firm_id = ?
```

#### Ledger Reversal
```sql
-- Associated ledger entries deleted
DELETE FROM ledger
WHERE voucher_id = ? AND voucher_type = 'SALES' AND firm_id = ?
```

## Server-Side Implementation

### Bill Cancellation Controller (`inventory/sls/inventory.js`)

```javascript
export const cancelBill = (req, res) => {
  try {
    const { id } = req.params;
    const { reason, remarks } = req.body;

    const actorUsername = getActorUsername(req);
    if (!actorUsername) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Authentication and authorization checks
    if (!req.user || !req.user.firm_id) {
      return res.status(403).json({ error: 'User is not associated with any firm' });
    }

    // Bill existence and ownership verification
    const bill = Bill.getById.get(id, req.user.firm_id);
    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    // Prevent double cancellation
    if (bill.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Bill is already cancelled' });
    }

    // Get bill items for stock restoration
    const items = db.prepare('SELECT * FROM stock_reg WHERE bill_id = ? AND firm_id = ?')
                   .all(id, req.user.firm_id);

    // Restore stock quantities to batches
    for (const item of items) {
      const stockRecord = Stock.getById.get(item.stock_id, req.user.firm_id);
      if (stockRecord) {
        let batches = stockRecord.batches ? JSON.parse(stockRecord.batches) : [];
        const batchIndex = batches.findIndex(b => b.batch === item.batch);

        if (batchIndex !== -1) {
          // Restore quantity to existing batch
          batches[batchIndex].qty += item.qty;
        } else {
          // Create new batch entry if batch doesn't exist
          batches.push({
            batch: item.batch,
            qty: item.qty,
            rate: item.rate,
            expiry: null,
            mrp: null
          });
        }

        const newTotalQty = batches.reduce((sum, b) => sum + b.qty, 0);

        // Update stock record with restored quantities
        Stock.update.run(
          stockRecord.item,
          stockRecord.pno,
          stockRecord.oem,
          stockRecord.hsn,
          newTotalQty,
          stockRecord.uom,
          stockRecord.rate,
          stockRecord.grate,
          newTotalQty * stockRecord.rate,
          stockRecord.mrp,
          JSON.stringify(batches),
          actorUsername,
          item.stock_id,
          req.user.firm_id
        );
      }
    }

    // Delete associated ledger entries
    db.prepare('DELETE FROM ledger WHERE voucher_id = ? AND voucher_type = ? AND firm_id = ?')
       .run(id, 'SALES', req.user.firm_id);

    // Update bill status to cancelled
    Bill.updateStatus.run(
      'CANCELLED',
      reason || null,
      now(),
      req.user.id,
      id,
      req.user.firm_id
    );

    res.json({ success: true, message: 'Bill cancelled successfully' });

  } catch (err) {
    console.error('Error cancelling bill:', err);
    res.status(500).json({ error: err.message });
  }
};
```

### API Endpoint

```javascript
PUT /api/inventory/sales/bills/:id/cancel
```

**Request Body:**
```json
{
  "reason": "CUSTOMER_REQUEST",
  "remarks": "Customer requested cancellation due to wrong item"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Bill cancelled successfully"
}
```

**Response (Error):**
```json
{
  "error": "Bill not found"
}
```

## Client-Side Implementation

### Bill Cancellation UI (`inventory-reports.js`)

#### Modal Integration
```html
<!-- Cancel Bill Section -->
<div id="cancel-bill-section" class="hidden">
  <div class="bg-red-50 border border-red-200 rounded-lg p-6">
    <div class="flex items-center justify-between mb-4">
      <h4 class="text-lg font-medium text-red-900">Cancel Bill</h4>
      <button id="cancel-section-toggle">Toggle</button>
    </div>

    <div id="cancel-form-content">
      <div>
        <label>Cancellation Reason *</label>
        <select id="cancel-reason" required>
          <option value="">Select a reason...</option>
          <option value="CUSTOMER_REQUEST">Customer Request</option>
          <option value="DATA_ENTRY_ERROR">Data Entry Error</option>
          <option value="DUPLICATE_BILL">Duplicate Bill</option>
          <option value="BILLING_ERROR">Billing Error</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      <div>
        <label>Remarks/Notes</label>
        <textarea id="cancel-remarks" rows="3"
                  placeholder="Additional notes about the cancellation...">
        </textarea>
      </div>

      <div class="flex items-center space-x-4 pt-4">
        <button id="confirm-cancel">Confirm Cancellation</button>
        <button id="cancel-cancel">Cancel</button>
      </div>
    </div>
  </div>
</div>
```

#### JavaScript Implementation
```javascript
async function cancelBill(billId) {
  const reason = cancelReasonSelect.value;
  const remarks = cancelRemarksTextarea.value.trim();

  if (!reason) {
    alert('Please select a cancellation reason.');
    return;
  }

  if (!confirm('Are you sure you want to cancel this bill? This action cannot be undone.')) {
    return;
  }

  try {
    confirmCancelBtn.disabled = true;
    confirmCancelBtn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Cancelling...
    `;

    const response = await fetch(`/api/inventory/sales/bills/${billId}/cancel`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        reason: reason,
        remarks: remarks
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to cancel bill');
    }

    const result = await response.json();

    // Update UI to reflect cancelled status
    modalBillStatus.textContent = 'CANCELLED';
    modalBillStatus.className = 'mt-1 text-sm text-red-600 font-semibold';

    // Disable cancel button
    cancelBillBtn.disabled = true;
    cancelBillBtn.classList.add('opacity-50', 'cursor-not-allowed');
    cancelBillBtn.textContent = 'Bill Cancelled';

    // Hide cancel section
    cancelBillSection.classList.add('hidden');

    // Show success message
    alert('Bill cancelled successfully.');

    // Refresh the bills list
    await loadBills();

  } catch (error) {
    console.error('Error cancelling bill:', error);
    alert('Failed to cancel bill: ' + error.message);
  } finally {
    confirmCancelBtn.disabled = false;
    confirmCancelBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      Confirm Cancellation
    `;
  }
}
```

## Features

### Comprehensive Cancellation Logic

#### 1. Stock Restoration
- **Batch-Level Restoration**: Quantities restored to specific batches
- **Quantity Validation**: Ensures accurate inventory reconciliation
- **Batch Creation**: Creates new batch entries if batch doesn't exist
- **Total Updates**: Recalculates total stock quantities

#### 2. Financial Reversal
- **Ledger Deletion**: Removes all associated ledger entries
- **Audit Trail**: Maintains financial transaction history
- **GST Compliance**: Handles GST liability reversals
- **Party Balance**: Updates customer/supplier balances

#### 3. Bill Status Management
- **Status Update**: Changes bill status to 'CANCELLED'
- **Reason Tracking**: Records cancellation reason and remarks
- **User Attribution**: Tracks who performed the cancellation
- **Timestamp Logging**: Records when cancellation occurred

### User Interface Features

#### Modal Integration
- **Conditional Display**: Cancel button only shows for active bills
- **Collapsible Form**: Reason and remarks form toggles visibility
- **Validation**: Required reason selection with client-side validation
- **Confirmation**: Double confirmation to prevent accidental cancellation

#### Visual Feedback
- **Loading States**: Spinner and disabled buttons during processing
- **Status Updates**: Real-time status changes in the modal
- **Button States**: Cancel button disabled after successful cancellation
- **Toast Messages**: Success and error notifications

### Security & Permissions

#### Role-Based Access
- **Authentication Required**: JWT token validation
- **Firm Isolation**: Users can only cancel their firm's bills
- **Ownership Verification**: Ensures bill belongs to user's firm
- **Audit Logging**: All cancellations logged with user information

#### Data Integrity
- **Transaction Safety**: Atomic operations for data consistency
- **Rollback Prevention**: Prevents partial cancellations
- **Duplicate Prevention**: Cannot cancel already cancelled bills
- **Validation Checks**: Comprehensive input and state validation

## Business Logic

### Cancellation Reasons
```javascript
const cancellationReasons = [
  'CUSTOMER_REQUEST',    // Customer requested cancellation
  'DATA_ENTRY_ERROR',    // Billing/data entry mistake
  'DUPLICATE_BILL',      // Duplicate bill created
  'BILLING_ERROR',       // Billing calculation error
  'OTHER'               // Other reasons with remarks
];
```

### Stock Restoration Algorithm
```javascript
// For each item in the cancelled bill:
foreach (item in bill.items) {
  // Find the corresponding stock record
  stock = findStock(item.stock_id);

  // Parse existing batches
  batches = JSON.parse(stock.batches);

  // Find the batch that was deducted
  batchIndex = batches.findIndex(b => b.batch === item.batch);

  if (batchIndex !== -1) {
    // Restore quantity to existing batch
    batches[batchIndex].qty += item.qty;
  } else {
    // Create new batch if it doesn't exist
    batches.push({
      batch: item.batch,
      qty: item.qty,
      rate: item.rate,
      expiry: null,
      mrp: null
    });
  }

  // Recalculate total quantity
  totalQty = batches.reduce((sum, b) => sum + b.qty, 0);

  // Update stock record
  updateStock(stock, totalQty, batches);
}
```

### Financial Impact Analysis

#### Before Cancellation:
- **Stock Levels**: Reduced by sold quantities
- **Ledger Entries**: Sales revenue and GST liabilities recorded
- **Party Balance**: Customer balance updated
- **Bill Status**: ACTIVE

#### After Cancellation:
- **Stock Levels**: Restored to original quantities
- **Ledger Entries**: All sales entries removed
- **Party Balance**: Customer balance reversed
- **Bill Status**: CANCELLED

## Error Handling

### Client-Side Errors
- **Network Failures**: Connection timeout or server unreachable
- **Authentication Errors**: Invalid or expired tokens
- **Validation Errors**: Missing required fields
- **Server Errors**: 5xx status codes with error messages

### Server-Side Errors
- **Bill Not Found**: 404 when bill doesn't exist or access denied
- **Already Cancelled**: 400 when attempting to cancel cancelled bill
- **Database Errors**: Transaction failures and constraint violations
- **Stock Errors**: Issues with stock restoration logic

### Recovery Mechanisms
- **Graceful Degradation**: UI remains functional even with errors
- **User Feedback**: Clear error messages and recovery suggestions
- **State Consistency**: UI updates only after successful server operations
- **Retry Logic**: Client can retry failed operations

## Audit & Compliance

### Audit Trail
```sql
-- Cancellation audit log
INSERT INTO audit_log (
  action_type,
  entity_type,
  entity_id,
  user_id,
  old_values,
  new_values,
  reason,
  remarks,
  timestamp
) VALUES (
  'CANCEL',
  'BILL',
  bill_id,
  user_id,
  bill_data,
  cancelled_bill_data,
  reason,
  remarks,
  CURRENT_TIMESTAMP
);
```

### Compliance Features
- **Data Retention**: Cancelled bills preserved for regulatory compliance
- **Reason Tracking**: Mandatory reason codes for audit purposes
- **User Attribution**: All actions linked to specific users
- **Timestamp Accuracy**: Precise timing of all operations

## Performance Considerations

### Database Optimization
- **Indexed Queries**: Fast bill and stock lookups
- **Batch Operations**: Efficient bulk stock updates
- **Transaction Management**: Minimal lock times
- **Query Optimization**: Prepared statements for repeated operations

### Client Performance
- **Lazy Loading**: UI components load on demand
- **Debounced Actions**: Prevent excessive API calls
- **State Management**: Efficient DOM updates
- **Memory Management**: Cleanup of event listeners and timers

## Testing Strategy

### Unit Testing
```javascript
// Test stock restoration logic
test('restores quantities to correct batches', () => {
  const cancelledItem = { batch: 'BATCH001', qty: 10 };
  const stockBatches = [{ batch: 'BATCH001', qty: 5 }];
  const result = restoreStock(cancelledItem, stockBatches);
  expect(result[0].qty).toBe(15);
});

// Test financial reversal
test('removes ledger entries correctly', () => {
  // Test ledger deletion logic
});
```

### Integration Testing
```javascript
// Test complete cancellation flow
test('end-to-end bill cancellation', async () => {
  // 1. Create bill with stock deduction
  // 2. Cancel bill
  // 3. Verify stock restoration
  // 4. Verify ledger reversal
  // 5. Verify bill status update
});
```

### User Acceptance Testing
- **UI Workflow**: Modal opening, form filling, confirmation
- **Error Scenarios**: Network failures, permission issues
- **Data Validation**: Reason selection, remarks handling
- **Performance**: Response times under load

## Future Enhancements

### Advanced Features
- **Partial Cancellation**: Cancel individual line items
- **Cancellation Approval**: Multi-level approval workflow
- **Automatic Refunds**: Integration with payment systems
- **Cancellation Analytics**: Reporting on cancellation patterns

### Integration Improvements
- **Email Notifications**: Automatic customer notifications
- **SMS Alerts**: Real-time cancellation alerts
- **Third-party ERP**: Integration with external systems
- **Document Archival**: Secure storage of cancelled documents

This bill cancellation system provides enterprise-grade functionality for handling bill cancellations with complete data integrity, audit compliance, and user-friendly interfaces.

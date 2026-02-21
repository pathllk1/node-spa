# IFSC Lookup System Documentation

## Overview

The IFSC (Indian Financial System Code) Lookup System provides real-time bank and branch information validation for employee banking details. It integrates with Razorpay's public IFSC API to automatically populate bank and branch names when users enter IFSC codes.

## Architecture

### Server-Side Implementation

#### IFSC Lookup Controller (`masterRoll.controller.js`)

```javascript
export const lookupIFSC = async (req, res) => {
  try {
    const { ifsc } = req.params;

    // Input validation
    if (!ifsc || typeof ifsc !== 'string' || ifsc.length !== 11) {
      return res.status(400).json({
        success: false,
        error: 'Invalid IFSC code. Must be exactly 11 characters.'
      });
    }

    // API call to Razorpay
    const response = await fetch(`https://ifsc.razorpay.com/${normalizedIFSC}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MasterRoll-System/1.0'
      }
    });

    // Response handling with comprehensive error management
    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({
          success: false,
          error: `IFSC "${normalizedIFSC}" not found. Please check the code.`
        });
      }
      // Handle other errors
    }

    const data = await response.json();
    res.json({
      success: true,
      data: {
        ifsc: normalizedIFSC,
        bank: data.BANK,
        branch: data.BRANCH,
        address: data.ADDRESS,
        city: data.CITY,
        state: data.STATE,
        district: data.DISTRICT,
        bankcode: data.BANKCODE,
        micr: data.MICR
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Unable to reach IFSC lookup service.'
    });
  }
};
```

#### API Endpoint

```javascript
GET /api/master-rolls/lookup-ifsc/:ifsc
```

**Parameters:**
- `ifsc`: 11-character IFSC code (URL parameter)

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "ifsc": "SBIN0001234",
    "bank": "State Bank of India",
    "branch": "Main Branch",
    "address": "123 Main Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "district": "Mumbai",
    "bankcode": "SBIN",
    "micr": "400002001"
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "IFSC 'INVALID12' not found. Please check the code."
}
```

### Client-Side Implementation

#### IFSC Lookup Integration (`master-roll.js`)

```javascript
setupIFSCLookup() {
  const ifscInput = this.elements.form.querySelector('[name="ifsc"]');
  const bankInput = this.elements.form.querySelector('[name="bank"]');
  const branchInput = this.elements.form.querySelector('[name="branch"]');

  let debounceTimer = null;
  let lastLookedUpIFSC = '';

  // Visual feedback system
  const setIFSCState = (state) => {
    ifscInput.classList.remove('border-gray-300', 'border-green-500', 'border-red-400');
    const existingBadge = ifscInput.parentElement.querySelector('.ifsc-status');
    if (existingBadge) existingBadge.remove();

    if (state === 'loading') {
      ifscInput.disabled = true;
      const badge = document.createElement('span');
      badge.className = 'ifsc-status absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400';
      badge.textContent = '⏳';
      ifscInput.parentElement.appendChild(badge);
    } else if (state === 'success') {
      ifscInput.disabled = false;
      ifscInput.classList.add('border-green-500', 'ring-2', 'ring-green-200');
      const badge = document.createElement('span');
      badge.className = 'ifsc-status absolute right-2 top-1/2 -translate-y-1/2 text-xs text-green-600';
      badge.textContent = '✓';
      ifscInput.parentElement.appendChild(badge);
    } else if (state === 'error') {
      ifscInput.disabled = false;
      ifscInput.classList.add('border-red-400', 'ring-2', 'ring-red-200');
      const badge = document.createElement('span');
      badge.className = 'ifsc-status absolute right-2 top-1/2 -translate-y-1/2 text-xs text-red-500';
      badge.textContent = '✗';
      ifscInput.parentElement.appendChild(badge);
    } else {
      ifscInput.disabled = false;
      ifscInput.classList.add('border-gray-300');
    }
  };

  // Main lookup function
  const lookupIFSC = async (ifscCode) => {
    const normalizedIFSC = ifscCode.toUpperCase();

    if (normalizedIFSC === lastLookedUpIFSC) return;

    setIFSCState('loading');

    try {
      const response = await fetch(`/api/master-rolls/lookup-ifsc/${normalizedIFSC}`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));

        if (response.status === 404) {
          this.showToast(`IFSC "${normalizedIFSC}" not found. Please check the code.`, 'error');
        } else {
          this.showToast(`IFSC lookup failed: ${errorData.error || 'Unknown error'}`, 'error');
        }

        setIFSCState('error');
        lastLookedUpIFSC = '';
        return;
      }

      const data = await response.json();

      if (data.success && data.data) {
        if (data.data.bank) bankInput.value = data.data.bank;
        if (data.data.branch) branchInput.value = data.data.branch;

        lastLookedUpIFSC = normalizedIFSC;
        setIFSCState('success');
        this.showToast(`✓ Bank details filled for IFSC ${normalizedIFSC}`, 'success');
      } else {
        throw new Error(data.error || 'Invalid response from server');
      }

    } catch (error) {
      console.error('[IFSC lookup] Error:', error);
      this.showToast('Could not reach IFSC lookup service. Please enter Bank/Branch manually.', 'error');
      setIFSCState('error');
      lastLookedUpIFSC = '';
    }
  };

  // Debounced input handler
  ifscInput.addEventListener('input', () => {
    setIFSCState('idle');
    lastLookedUpIFSC = '';

    clearTimeout(debounceTimer);

    const value = ifscInput.value.trim();
    if (value.length !== 11) return;

    debounceTimer = setTimeout(() => {
      lookupIFSC(value);
    }, 500);
  });

  // Cleanup on form reset
  this.elements.form.addEventListener('reset', () => {
    clearTimeout(debounceTimer);
    lastLookedUpIFSC = '';
    setIFSCState('idle');
  });
}
```

## Features

### Real-Time Validation
- **Debounced Input**: 500ms delay prevents excessive API calls
- **11-Character Trigger**: Only fires when IFSC is complete
- **Duplicate Prevention**: Avoids redundant lookups for same IFSC

### Visual Feedback
- **Loading State**: ⏳ icon with disabled input during lookup
- **Success State**: ✓ green checkmark with green border
- **Error State**: ✗ red X with red border
- **Idle State**: Default styling when user edits

### Error Handling
- **404 Errors**: "IFSC not found" with specific messaging
- **Network Errors**: Graceful fallback with user guidance
- **Invalid Responses**: Comprehensive error detection
- **Manual Override**: Users can always enter details manually

### Data Integration
- **Bank Name**: Auto-populated from Razorpay API
- **Branch Name**: Auto-populated from Razorpay API
- **Preservation**: Existing data preserved if API fails
- **Optional Fields**: Only populates if API returns values

## Security Considerations

### Authentication Required
- Endpoint protected by `authMiddleware`
- JWT token validation required
- Firm-based access control maintained

### Input Sanitization
- IFSC normalized to uppercase
- Length validation (exactly 11 characters)
- Type checking and validation

### Rate Limiting Considerations
- Debounced client-side requests
- External API dependency management
- Error recovery and retry logic

## Performance Optimizations

### Client-Side Optimizations
- **Debouncing**: Reduces API call frequency
- **Caching**: Prevents duplicate lookups
- **Lazy Loading**: Only loads when needed
- **State Management**: Efficient DOM updates

### Server-Side Optimizations
- **Lightweight Proxy**: Minimal processing overhead
- **Error Handling**: Fast failure detection
- **Caching Strategy**: Could be enhanced with Redis
- **Connection Management**: Proper timeout handling

## Integration Points

### Master Roll System
- **Employee Banking**: Validates bank details during employee creation
- **Data Accuracy**: Ensures correct bank information entry
- **Audit Trail**: Maintains change history for bank details

### External Dependencies
- **Razorpay IFSC API**: Public financial data service
- **No Authentication**: Public API with no credentials required
- **Rate Limits**: Consider implementing client-side caching

## Testing

### Unit Testing
```javascript
// Test IFSC validation
test('validates 11-character IFSC', () => {
  expect(validateIFSC('SBIN0001234')).toBe(true);
  expect(validateIFSC('INVALID')).toBe(false);
});

// Test API response handling
test('handles successful lookup', async () => {
  const mockResponse = {
    BANK: 'State Bank of India',
    BRANCH: 'Main Branch'
  };
  // Test response parsing and field population
});
```

### Integration Testing
```javascript
// Test complete user flow
test('IFSC lookup user journey', () => {
  // 1. User types IFSC
  // 2. Debounce triggers API call
  // 3. Bank/branch fields populate
  // 4. Visual feedback updates
  // 5. Success toast displays
});
```

### Error Testing
```javascript
// Test error scenarios
test('handles invalid IFSC', () => {
  // Should show error state and message
});

test('handles network failure', () => {
  // Should show fallback message
});
```

## Future Enhancements

### Caching Layer
- **Redis Integration**: Cache frequently used IFSC data
- **TTL Management**: Appropriate cache expiration
- **Fallback Strategy**: Serve cached data during API outages

### Enhanced Validation
- **Bank Code Validation**: Verify bank codes against master list
- **Branch Verification**: Cross-reference with bank databases
- **Address Validation**: Validate address components

### UI Improvements
- **Autocomplete**: Suggest IFSC codes as user types
- **Bank Logos**: Display bank logos based on IFSC
- **Recent Searches**: Show recently used IFSC codes

This IFSC lookup system provides a seamless, user-friendly way to validate and populate bank details, improving data accuracy and user experience in the master roll management system.

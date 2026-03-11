# Client-side CSP Violations Report

## Analysis Summary

**Analysis Date:** [Current Date]
**System:** Client-side UI Components
**Components Analyzed:** Entire `client/` directory (pages, components, utilities).
**Issue:** The application implements a Content Security Policy (CSP), but several UI components utilize inline event handlers (e.g., `onclick=`). Inline handlers violate strict CSP rules (specifically `script-src` without `'unsafe-inline'`), causing the browser to block their execution. This results in broken functionality.

**Total Violations Identified:** 3

---

## 🔴 CRITICAL BUGS: Inline Event Handlers

### Bug #1: Inline Navigation (Sales Component)
**Severity:** Critical 🔴
**Location:** `client/components/inventory/sls/index.js:113`
**Impact:** "Back to Sales Report" button click is blocked by CSP, breaking navigation.

**Description:**
The success/summary screen after creating a bill uses an inline `onclick` handler to navigate.

**Code Issue:**
```html
<button onclick="window.location.href='/inventory/sls-rpt'" class="px-4 py-2 bg-gray-600 text-white rounded shadow hover:bg-gray-700 transition">Back to Sales Report</button>
```

**Fix:**
Remove the `onclick` attribute. Assign an `id` or specific class, and attach an event listener via JavaScript after the HTML is injected into the DOM. Alternatively, use standard link navigation (`<a>` tags) or integrate with the `Navigo` router if programmatic navigation is required.

---

### Bug #2: Inline Navigation (Sales Component)
**Severity:** Critical 🔴
**Location:** `client/components/inventory/sls/index.js:114`
**Impact:** "Create New Bill" button click is blocked by CSP, breaking the ability to quickly create another bill.

**Description:**
Similar to Bug #1, the button to reset/create a new bill uses an inline `onclick` handler.

**Code Issue:**
```html
<button onclick="window.location.href='/inventory/sls'" class="px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition">Create New Bill</button>
```

**Fix:**
Same as Bug #1. Remove inline JS and attach an event listener dynamically.

---

### Bug #3: Toast Notification Dismissal
**Severity:** Critical 🔴
**Location:** `client/components/admin/toast.js:51`
**Impact:** Users cannot dismiss toast notifications manually because the close button's click handler is blocked.

**Description:**
The close button inside the generated toast HTML uses an inline handler to remove its parent element.

**Code Issue:**
```html
<button class="ml-3 flex-shrink-0 text-white hover:text-gray-200 focus:outline-none" onclick="this.parentElement.remove()">
```

**Fix:**
```javascript
// Remove the onclick attribute from the template string.
// Inside the `show` method of the toast component, after creating the element:

const closeBtn = toast.querySelector('button');
if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    toast.remove();
  });
}
```

---

## Conclusion & Recommendations

While the number of violations is small, their impact is critical because they completely break the intended functionality on those specific UI elements when a strict CSP is enforced.

1. **Immediate Remediation:** Apply the suggested fixes to remove all `onclick=` attributes.
2. **Development Practices:** Enforce a strict "No Inline Javascript" rule. All event bindings should happen via `addEventListener` in the component's JavaScript logic after rendering the HTML template.
3. **Automated Checks:** Implement a linter rule (e.g., using an HTML or ESLint plugin) to fail the build if inline event handlers (`on*`) are detected in template strings or HTML files.

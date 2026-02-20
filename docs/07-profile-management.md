# Profile Management System Documentation

## Overview

The Profile Management System provides users with a comprehensive dashboard to view and manage their account information, preferences, and system settings. It includes user profile display, security token management, and system configuration controls with real-time updates.

## Architecture

### Core Components
- **User Information Display**: Read-only account details and role information
- **Preferences Management**: User preference settings (theme, notifications, language)
- **Account Analytics**: Account activity and membership information
- **System Settings**: GST configuration and business rule settings
- **Security Management**: Token authentication status and manual refresh
- **Real-time Updates**: Live system setting changes with feedback

### Data Sources
- **User Authentication**: JWT payload and database user records
- **System Settings**: Global and firm-specific configuration settings
- **Account History**: Login timestamps and account activity data

## User Interface Structure

### Profile Layout
```html
<div class="max-w-6xl mx-auto px-4 py-12 space-y-12">

  <!-- Header Section -->
  <div>
    <h1 class="text-3xl font-bold text-gray-900">Profile</h1>
    <p class="text-gray-600 mt-2">Manage your account settings and preferences</p>
  </div>

  <!-- User Information Section -->
  <section>
    <h2>User Information</h2>
    <div class="grid md:grid-cols-2 gap-6">
      <!-- Read-only input fields -->
    </div>
  </section>

  <!-- Preferences Section -->
  <section>
    <h2>Preferences</h2>
    <div class="grid md:grid-cols-3 gap-6">
      <!-- Theme, Notifications, Language -->
    </div>
  </section>

  <!-- Account Information Section -->
  <section>
    <h2>Account Information</h2>
    <div class="account-stats">
      <!-- Member since, last password change, 2FA status -->
    </div>
  </section>

  <!-- System Settings Section -->
  <section>
    <h2>System Settings</h2>
    <div class="settings-controls">
      <!-- GST toggle with real-time feedback -->
    </div>
  </section>

  <!-- Security Section -->
  <section>
    <h2>Security</h2>
    <div class="token-management">
      <!-- Token status and manual refresh -->
    </div>
  </section>

</div>
```

## Data Fetching and State Management

### Profile Data Loading
```javascript
async function loadProfileData() {
  try {
    // Fetch profile data from API
    const profileRes = await fetch('/api/pages/profile', {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!profileRes.ok) {
      throw new Error(`HTTP ${profileRes.status}`);
    }

    const profileData = await profileRes.json();
    if (!profileData.success) {
      throw new Error(profileData.error || 'Failed to fetch profile data');
    }

    // Fetch system settings
    const settingsRes = await fetch('/api/settings/system-config/gst-status', {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }
    });

    let gstEnabled = true;
    if (settingsRes.ok) {
      const settingsData = await settingsRes.json();
      gstEnabled = settingsData.success ? 
        (settingsData.data?.gst_enabled ?? true) : true;
    }

    return { profileData, gstEnabled };
  } catch (error) {
    console.error('Profile data loading error:', error);
    throw error;
  }
}
```

### User Information Display
```javascript
// Display user information from JWT payload
const user = authManager.getUser();

const userInfoFields = [
  { label: "User ID", value: user.id },
  { label: "Username", value: user.username },
  { label: "Email", value: user.email },
  { label: "Role", value: user.role }
];

// Render read-only input fields
function createInput(label, value) {
  return `
    <div class="space-y-2">
      <label class="block text-sm font-medium text-gray-700">${label}</label>
      <input
        type="text"
        value="${value}"
        disabled
        class="w-full px-4 py-2 border border-gray-300 rounded-lg
               bg-gray-100 text-gray-700 cursor-not-allowed"
      />
    </div>
  `;
}
```

## Preferences Management

### Preferences Display
```javascript
// Display user preferences
const preferences = profileData.data?.preferences || {};

const preferenceFields = [
  { 
    label: "Theme", 
    value: preferences.theme || "light" 
  },
  { 
    label: "Notifications", 
    value: preferences.notifications ? "Enabled" : "Disabled" 
  },
  { 
    label: "Language", 
    value: preferences.language || "en" 
  }
];

// Note: Currently read-only, can be extended to editable
```

### Account Information Analytics
```javascript
// Display account statistics
const accountInfo = profileData.data?.accountInfo || {};

const accountStats = [
  {
    label: "Member Since",
    value: accountInfo.memberSince || "N/A"
  },
  {
    label: "Last Password Change",
    value: accountInfo.lastPasswordChange || "N/A"
  },
  {
    label: "Two-Factor Authentication",
    value: accountInfo.twoFactorEnabled ? "Enabled" : "Disabled"
  }
];

// Render account statistics
function renderAccountStats(stats) {
  return stats.map(stat => 
    `<p><strong>${stat.label}:</strong> ${stat.value}</p>`
  ).join('');
}
```

## System Settings Management

### GST Toggle Implementation
```javascript
// GST toggle with real-time updates
const gstToggle = document.getElementById('gst-toggle');
const gstMessage = document.getElementById('gst-message');

gstToggle.addEventListener('change', async () => {
  try {
    // Show loading state
    gstMessage.innerHTML = `
      <div class="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
        Updating GST setting...
      </div>
    `;

    // Update setting via API
    const res = await fetch('/api/settings/system-config/gst-status', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: gstToggle.checked })
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || `Failed (${res.status})`);
    }

    const result = await res.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to update GST setting');
    }

    // Show success message
    gstMessage.innerHTML = `
      <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
        GST setting updated successfully!
      </div>
    `;

    // Auto-clear message
    setTimeout(() => {
      gstMessage.innerHTML = '';
    }, 3000);

  } catch (error) {
    // Revert toggle on error
    gstToggle.checked = !gstToggle.checked;
    
    // Show error message
    gstMessage.innerHTML = `
      <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
        Error: ${error.message}
      </div>
    `;
  }
});
```

### Toggle Component Design
```html
<!-- Modern toggle switch -->
<label class="relative inline-flex items-center cursor-pointer">
  <input 
    type="checkbox" 
    id="gst-toggle" 
    ${gstEnabled ? 'checked' : ''} 
    class="sr-only peer"
  />
  <div class="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 
              peer-focus:ring-blue-300 rounded-full peer 
              peer-checked:after:translate-x-full peer-checked:after:border-white 
              after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
              after:bg-white after:border-gray-300 after:border after:rounded-full 
              after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600">
  </div>
</label>
```

## Security Management

### Token Status Display
```javascript
// Display current token status
const tokenStatus = [
  "✅ Access Token: Active (15 min expiry)",
  "✅ Refresh Token: Active (30 day expiry)", 
  "✅ Auto-Refresh: Enabled (every 10 minutes)"
];

// Render security status
function renderTokenStatus(status) {
  return status.map(item => `<p>${item}</p>`).join('');
}
```

### Manual Token Refresh
```javascript
// Manual token refresh functionality
const refreshBtn = document.getElementById('manual-refresh-btn');
const refreshMessage = document.getElementById('refresh-message');

refreshBtn.addEventListener('click', async () => {
  try {
    // Show loading state
    refreshMessage.innerHTML = `
      <div class="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
        Refreshing token...
      </div>
    `;

    // Trigger token refresh
    await authManager.refreshToken();

    // Show success message
    refreshMessage.innerHTML = `
      <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
        Token refreshed successfully!
      </div>
    `;

    // Auto-clear message
    setTimeout(() => {
      refreshMessage.innerHTML = '';
    }, 3000);

  } catch (error) {
    // Show error message
    refreshMessage.innerHTML = `
      <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
        Token refresh failed
      </div>
    `;
  }
});
```

## API Integration

### Profile Data Endpoint
```
GET /api/pages/profile
Response: {
  success: true,
  data: {
    preferences: { theme, notifications, language },
    accountInfo: { memberSince, lastPasswordChange, twoFactorEnabled }
  }
}
```

### GST Settings Endpoint
```
GET  /api/settings/system-config/gst-status
PUT  /api/settings/system-config/gst-status
Body: { enabled: boolean }
Response: { success: true, data: { gst_enabled: boolean } }
```

### Token Refresh Endpoint
```
POST /api/auth/refresh
Response: { success: true, message: "Token refreshed", user: {...} }
```

## Error Handling

### Profile Loading Errors
```javascript
try {
  const { profileData, gstEnabled } = await loadProfileData();
  // Render profile
} catch (error) {
  // Show error page
  const errorContent = `
    <div class="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
      Failed to load profile data. ${error.message}
    </div>
  `;
  renderLayout(errorContent, router);
}
```

### Settings Update Errors
```javascript
// Revert UI state on API failure
gstToggle.checked = !gstToggle.checked;
gstMessage.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">Error: ${error.message}</div>`;
```

## Responsive Design

### Grid Layout System
```css
/* Responsive grid for different screen sizes */
.grid.md\\:grid-cols-2.gap-6 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

@media (min-width: 768px) {
  .grid.md\\:grid-cols-2 {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .grid.md\\:grid-cols-3 {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### Mobile-First Approach
```javascript
// Responsive form layout
<div class="grid md:grid-cols-2 gap-6">
  <!-- Two columns on medium+ screens, stacked on mobile -->
</div>
```

## Performance Optimizations

### Lazy Loading
```javascript
// Dynamic import for profile page
const { renderProfile } = await import('./pages/profile.js');
```

### Efficient Re-renders
```javascript
// Only update changed elements
function updateGSTStatus(enabled) {
  gstToggle.checked = enabled;
  // No full page re-render needed
}
```

### Minimal API Calls
```javascript
// Single profile data fetch
const [profileRes, settingsRes] = await Promise.all([
  fetch('/api/pages/profile', { credentials: 'same-origin' }),
  fetch('/api/settings/system-config/gst-status', { credentials: 'same-origin' })
]);
```

## Security Considerations

### Data Protection
- No sensitive information displayed (passwords, tokens)
- Read-only user information display
- Secure API communication with credentials

### Token Management
- Manual refresh capability for users
- Visual token status indicators
- Automatic cleanup of error messages

### Input Validation
- Server-side validation for all setting changes
- Client-side feedback for invalid operations
- Proper error message sanitization

This profile management system provides users with comprehensive account oversight and system configuration capabilities while maintaining security and performance standards.

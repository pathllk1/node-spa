// ─────────────────────────────────────────────
//  Lazy page loaders
//  Each function dynamically imports the module
//  only when the route is first visited.
// ─────────────────────────────────────────────

const loadHome = () => import('./pages/home.js').then(m => m.renderHome);
const loadAbout = () => import('./pages/about.js').then(m => m.renderAbout);
const loadLogin = () => import('./pages/login.js').then(m => m.renderLogin);
const loadDashboard = () => import('./pages/dashboard.js').then(m => m.renderDashboard);
const loadProfile = () => import('./pages/profile.js').then(m => m.renderProfile);
const loadSuperAdmin = () => import('./pages/superAdmin.js').then(m => m.renderSuperAdmin);
const loadMasterRoll = () => import('./pages/master-roll.js').then(m => m.renderMasterRoll);
const loadWagesDashboard = () => import('./pages/WagesDashboard.js').then(m => m.renderWagesDashboard);
const loadSales = () => import('./pages/sales.js').then(m => m.renderSales);
const loadStocks = () => import('./pages/stocks.js').then(m => m.renderStocks);
const loadInventoryDashboard = () => import('./pages/inventory-dashboard.js').then(m => m.renderInventoryDashboard);
const loadInventoryCategories = () => import('./pages/inventory-categories.js').then(m => m.renderInventoryCategories);
const loadInventorySuppliers = () => import('./pages/inventory-suppliers.js').then(m => m.renderInventorySuppliers);
const loadInventoryReports = () => import('./pages/inventory-reports.js').then(m => m.renderInventoryReports);
const loadStockMovement = () => import('./pages/stock-movement.js').then(m => m.renderStockMovement);
const loadAccountsDashboard = () => import('./pages/accounts-dashboard.js').then(m => m.renderAccountsDashboard);
const loadJournalEntries = () => import('./pages/ledger/journal-entries.js').then(m => m.renderJournalEntries);
const loadVouchers = () => import('./pages/ledger/vouchers.js').then(m => m.renderVouchers);
const loadTrialBalance = () => import('./pages/ledger/trial-balance.js').then(m => m.renderTrialBalance);
const loadGeneralLedger = () => import('./pages/ledger/general-ledger.js').then(m => m.renderGeneralLedger);
const loadAccountDetails = () => import('./pages/ledger/account-details.js').then(m => m.renderAccountDetails);
const loadNewJournalEntry = () => import('./pages/ledger/new-journal-entry.js').then(m => m.renderNewJournalEntry);
const loadNewVoucher = () => import('./pages/ledger/new-voucher.js').then(m => m.renderNewVoucher);

// ─────────────────────────────────────────────
//  Loading spinner
// ─────────────────────────────────────────────

const showLoading = () => {
  let loadingEl = document.getElementById('page-loading');
  if (!loadingEl) {
    loadingEl = document.createElement('div');
    loadingEl.id = 'page-loading';
    loadingEl.innerHTML = `
      <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,255,255,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;">
        <div style="text-align:center;">
          <div style="border:4px solid #f3f3f3;border-top:4px solid #3498db;border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite;margin:0 auto 10px;"></div>
          <p style="color:#666;font-family:Arial,sans-serif;">Loading...</p>
        </div>
      </div>
      <style>
        @keyframes spin { 0% { transform:rotate(0deg); } 100% { transform:rotate(360deg); } }
      </style>
    `;
    document.body.appendChild(loadingEl);
  }
  loadingEl.style.display = 'block';
};

const hideLoading = () => {
  const loadingEl = document.getElementById('page-loading');
  if (loadingEl) loadingEl.style.display = 'none';
};

// ─────────────────────────────────────────────
//  Navigation helper
//
//  Wraps every route handler with:
//    1. showLoading() before the import
//    2. try/catch  — shows an error message if
//       the import or render function throws
//    3. finally    — hideLoading() is ALWAYS
//       called, even on error, so the spinner
//       never gets stuck on screen
//
//  Usage:  .on('/path', navigate(loadFn))
//          .on('/path/:id', navigate(loadFn))   ← match.data is forwarded automatically
// ─────────────────────────────────────────────

const navigate = (loadFn) => async (match) => {
  showLoading();
  try {
    const renderFn = await loadFn();
    // Pass router + route params (if any) to the page render function
    await renderFn(router, match?.data);
  } catch (err) {
    console.error('[Router] Failed to load page:', err);
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div style="max-width:480px;margin:4rem auto;padding:2rem;text-align:center;font-family:Arial,sans-serif;">
          <h2 style="color:#dc2626;margin-bottom:0.5rem;">Failed to load page</h2>
          <p style="color:#6b7280;margin-bottom:1.5rem;">${err.message || 'An unexpected error occurred.'}</p>
          <a href="/" data-navigo
             style="display:inline-block;padding:0.6rem 1.4rem;background:#3b82f6;color:#fff;border-radius:6px;text-decoration:none;">
            Go Home
          </a>
        </div>
      `;
      router.updatePageLinks();
    }
  } finally {
    hideLoading();
  }
};

// ─────────────────────────────────────────────
//  Router
// ─────────────────────────────────────────────

const router = new Navigo('/', { hash: false });

router
  // General
  .on('/',                          navigate(loadHome))
  .on('/about',                     navigate(loadAbout))
  .on('/login',                     navigate(loadLogin))
  .on('/dashboard',                 navigate(loadDashboard))
  .on('/profile',                   navigate(loadProfile))
  .on('/super-admin',               navigate(loadSuperAdmin))

  // HR
  .on('/master-roll',               navigate(loadMasterRoll))
  .on('/wages-dashboard',           navigate(loadWagesDashboard))

  // Inventory
  .on('/inventory/sls',             navigate(loadSales))
  .on('/inventory/stocks',          navigate(loadStocks))
  .on('/inventory/dashboard',       navigate(loadInventoryDashboard))
  .on('/inventory/categories',      navigate(loadInventoryCategories))
  .on('/inventory/suppliers',       navigate(loadInventorySuppliers))
  .on('/inventory/reports',         navigate(loadInventoryReports))
  .on('/inventory/stock-movement',  navigate(loadStockMovement))

  // Accounts
  .on('/accounts-dashboard',        navigate(loadAccountsDashboard))

  // Ledger
  .on('/ledger/journal-entries',    navigate(loadJournalEntries))
  .on('/ledger/journal-entries/new', navigate(loadNewJournalEntry))
  .on('/ledger/vouchers',           navigate(loadVouchers))
  .on('/ledger/vouchers/new',       navigate(loadNewVoucher))
  .on('/ledger/trial-balance',      navigate(loadTrialBalance))
  .on('/ledger/general-ledger',     navigate(loadGeneralLedger))
  .on('/ledger/account/:account_head', navigate(loadAccountDetails))

  // 404
  .notFound(() => {
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div style="max-width:480px;margin:4rem auto;padding:2rem;text-align:center;font-family:Arial,sans-serif;">
          <h1 style="color:#111827;">404 — Page Not Found</h1>
          <p style="color:#6b7280;margin-bottom:1.5rem;">The page you're looking for doesn't exist.</p>
          <a href="/" data-navigo
             style="display:inline-block;padding:0.6rem 1.4rem;background:#3b82f6;color:#fff;border-radius:6px;text-decoration:none;">
            Go Home
          </a>
        </div>
      `;
      router.updatePageLinks();
    }
    hideLoading();
  });

// Resolve the initial route on page load
router.resolve();
// Lazy loading functions for pages
const loadHome = async () => {
  const { renderHome } = await import('./pages/home.js');
  return renderHome;
};

const loadAbout = async () => {
  const { renderAbout } = await import('./pages/about.js');
  return renderAbout;
};

const loadLogin = async () => {
  const { renderLogin } = await import('./pages/login.js');
  return renderLogin;
};

const loadDashboard = async () => {
  const { renderDashboard } = await import('./pages/dashboard.js');
  return renderDashboard;
};

const loadProfile = async () => {
  const { renderProfile } = await import('./pages/profile.js');
  return renderProfile;
};

const loadMasterRoll = async () => {
  const { renderMasterRoll } = await import('./pages/master-roll.js');
  return renderMasterRoll;
};

const loadWagesDashboard = async () => {
  const { renderWagesDashboard } = await import('./pages/WagesDashboard.js');
  return renderWagesDashboard;
};

const loadSales = async () => {
  const { renderSales } = await import('./pages/sales.js');
  return renderSales;
};

const loadStocks = async () => {
  const { renderStocks } = await import('./pages/stocks.js');
  return renderStocks;
};

const loadInventoryDashboard = async () => {
  const { renderInventoryDashboard } = await import('./pages/inventory-dashboard.js');
  return renderInventoryDashboard;
};

const loadInventoryCategories = async () => {
  const { renderInventoryCategories } = await import('./pages/inventory-categories.js');
  return renderInventoryCategories;
};

const loadInventorySuppliers = async () => {
  const { renderInventorySuppliers } = await import('./pages/inventory-suppliers.js');
  return renderInventorySuppliers;
};

const loadInventoryReports = async () => {
  const { renderInventoryReports } = await import('./pages/inventory-reports.js');
  return renderInventoryReports;
};

// Loading UI functions
const showLoading = () => {
  let loadingEl = document.getElementById('page-loading');
  if (!loadingEl) {
    loadingEl = document.createElement('div');
    loadingEl.id = 'page-loading';
    loadingEl.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;">
        <div style="text-align: center;">
          <div style="border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 10px;"></div>
          <p style="color: #666; font-family: Arial, sans-serif;">Loading...</p>
        </div>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    document.body.appendChild(loadingEl);
  }
  loadingEl.style.display = 'block';
};

const hideLoading = () => {
  const loadingEl = document.getElementById('page-loading');
  if (loadingEl) {
    loadingEl.style.display = 'none';
  }
};

// Initialize Navigo router
const router = new Navigo('/', { hash: false });

// Define routes
router
  .on('/', async () => {
    showLoading();
    const renderHome = await loadHome();
    renderHome(router);
    hideLoading();
  })
  .on('/about', async () => {
    showLoading();
    const renderAbout = await loadAbout();
    renderAbout(router);
    hideLoading();
  })
  .on('/login', async () => {
    showLoading();
    const renderLogin = await loadLogin();
    renderLogin(router);
    hideLoading();
  })
  .on('/dashboard', async () => {
    showLoading();
    const renderDashboard = await loadDashboard();
    renderDashboard(router);
    hideLoading();
  })
  .on('/profile', async () => {
    showLoading();
    const renderProfile = await loadProfile();
    renderProfile(router);
    hideLoading();
  })
  .on('/master-roll', async () => {
    showLoading();
    const renderMasterRoll = await loadMasterRoll();
    renderMasterRoll(router);
    hideLoading();
  })
  .on('/wages-dashboard', async () => {
    showLoading();
    const renderWagesDashboard = await loadWagesDashboard();
    renderWagesDashboard(router);
    hideLoading();
  })
  .on('/inventory/sls', async () => {
    showLoading();
    const renderSales = await loadSales();
    renderSales(router);
    hideLoading();
  })
  .on('/inventory/stocks', async () => {
    showLoading();
    const renderStocks = await loadStocks();
    renderStocks(router);
    hideLoading();
  })
  .on('/inventory/dashboard', async () => {
    showLoading();
    const renderInventoryDashboard = await loadInventoryDashboard();
    renderInventoryDashboard(router);
    hideLoading();
  })
  .on('/inventory/categories', async () => {
    showLoading();
    const renderInventoryCategories = await loadInventoryCategories();
    renderInventoryCategories(router);
    hideLoading();
  })
  .on('/inventory/suppliers', async () => {
    showLoading();
    const renderInventorySuppliers = await loadInventorySuppliers();
    renderInventorySuppliers(router);
    hideLoading();
  })
  .on('/inventory/reports', async () => {
    showLoading();
    const renderInventoryReports = await loadInventoryReports();
    renderInventoryReports(router);
    hideLoading();
  })
  .notFound(() => {
    document.getElementById('app').innerHTML = `
      <div class="container">
        <div class="page">
          <h1>404 - Page Not Found</h1>
          <p>The page you're looking for doesn't exist.</p>
          <a href="/" class="btn btn-primary" data-navigo>Go Home</a>
        </div>
      </div>
    `;
    router.updatePageLinks();
  });

// Resolve the initial route
router.resolve();

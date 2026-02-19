import { renderHome } from './pages/home.js';
import { renderAbout } from './pages/about.js';
import { renderLogin } from './pages/login.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderProfile } from './pages/profile.js';
import {renderMasterRoll} from './pages/master-roll.js';

// Initialize Navigo router
const router = new Navigo('/', { hash: false });

// Define routes
router
  .on('/', () => renderHome(router))
  .on('/about', () => renderAbout(router))
  .on('/login', () => renderLogin(router))
  .on('/dashboard', () => renderDashboard(router))
  .on('/profile', () => renderProfile(router))
  .on('/master-roll', () => renderMasterRoll(router))
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

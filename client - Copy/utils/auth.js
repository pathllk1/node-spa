import { api } from './api.js';

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.isAuthenticated = false;
    this.refreshInterval = null;
  }

  async login(username, password) {
    try {
      const response = await api.post('/api/auth/login', { username, password });
      
      if (response.success) {
        this.currentUser = response.user;
        this.isAuthenticated = true;
        this.startAutoRefresh();
        return response;
      }
      
      throw new Error(response.message);
    } catch (error) {
      throw error;
    }
  }

  async logout() {
    try {
      await api.post('/api/auth/logout');
      this.currentUser = null;
      this.isAuthenticated = false;
      this.stopAutoRefresh();
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  }

  async checkAuth() {
    try {
      const response = await api.get('/api/auth/me');
      
      if (response.success) {
        this.currentUser = response.user;
        this.isAuthenticated = true;
        this.startAutoRefresh();
        return true;
      }
      
      return false;
    } catch (error) {
      this.currentUser = null;
      this.isAuthenticated = false;
      return false;
    }
  }

  async refreshToken() {
    try {
      const response = await api.post('/api/auth/refresh');
      
      if (response.success) {
        console.log('Token refreshed successfully');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.currentUser = null;
      this.isAuthenticated = false;
      this.stopAutoRefresh();
      return false;
    }
  }

  startAutoRefresh() {
    // Clear any existing interval
    this.stopAutoRefresh();
    
    // Refresh token every 10 minutes (before 15 min expiry)
    this.refreshInterval = setInterval(async () => {
      console.log('Auto-refreshing token...');
      await this.refreshToken();
    }, 10 * 60 * 1000); // 10 minutes
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  getUser() {
    return this.currentUser;
  }

  isLoggedIn() {
    return this.isAuthenticated;
  }
}

export const authManager = new AuthManager();

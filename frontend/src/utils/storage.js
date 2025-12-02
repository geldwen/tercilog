/**
 * Storage utility with fallback for Safari and browsers with localStorage restrictions
 * Priority: localStorage > sessionStorage > cookies
 */

class StorageManager {
  constructor() {
    this.storageType = this.detectAvailableStorage();
    console.log(`[StorageManager] Utilise: ${this.storageType}`);
  }

  detectAvailableStorage() {
    // Try localStorage first
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return 'localStorage';
    } catch (e) {
      // localStorage not available, try sessionStorage
      try {
        const test = '__storage_test__';
        sessionStorage.setItem(test, test);
        sessionStorage.removeItem(test);
        return 'sessionStorage';
      } catch (e) {
        // Fall back to cookies
        return 'cookies';
      }
    }
  }

  setItem(key, value) {
    try {
      if (this.storageType === 'localStorage') {
        localStorage.setItem(key, value);
        console.log(`[StorageManager] Token sauvegardé via localStorage`);
      } else if (this.storageType === 'sessionStorage') {
        sessionStorage.setItem(key, value);
        console.log(`[StorageManager] Token sauvegardé via sessionStorage`);
      } else {
        // Use cookies as fallback
        const expires = new Date();
        expires.setTime(expires.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days
        document.cookie = `${key}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
        console.log(`[StorageManager] Token sauvegardé via cookies`);
      }
      return true;
    } catch (e) {
      console.error('[StorageManager] Erreur setItem:', e);
      return false;
    }
  }

  getItem(key) {
    try {
      if (this.storageType === 'localStorage') {
        return localStorage.getItem(key);
      } else if (this.storageType === 'sessionStorage') {
        return sessionStorage.getItem(key);
      } else {
        // Read from cookies
        const name = key + "=";
        const decodedCookie = decodeURIComponent(document.cookie);
        const ca = decodedCookie.split(';');
        for (let i = 0; i < ca.length; i++) {
          let c = ca[i];
          while (c.charAt(0) === ' ') {
            c = c.substring(1);
          }
          if (c.indexOf(name) === 0) {
            return c.substring(name.length, c.length);
          }
        }
        return null;
      }
    } catch (e) {
      console.error('Storage error:', e);
      return null;
    }
  }

  removeItem(key) {
    try {
      if (this.storageType === 'localStorage') {
        localStorage.removeItem(key);
      } else if (this.storageType === 'sessionStorage') {
        sessionStorage.removeItem(key);
      } else {
        // Remove cookie
        document.cookie = `${key}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
      }
      return true;
    } catch (e) {
      console.error('Storage error:', e);
      return false;
    }
  }

  clear() {
    try {
      if (this.storageType === 'localStorage') {
        localStorage.clear();
      } else if (this.storageType === 'sessionStorage') {
        sessionStorage.clear();
      } else {
        // Clear all cookies
        const cookies = document.cookie.split(";");
        for (let i = 0; i < cookies.length; i++) {
          const cookie = cookies[i];
          const eqPos = cookie.indexOf("=");
          const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;";
        }
      }
      return true;
    } catch (e) {
      console.error('Storage error:', e);
      return false;
    }
  }
}

// Create singleton instance
const storage = new StorageManager();

export default storage;

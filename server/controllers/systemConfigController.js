import { Settings, FirmSettings } from '../utils/db.js';

// Get all settings
export const getAllSettings = (req, res) => {
  try {
    // Get global settings
    const globalSettings = Settings.getAll.all();
    
    // If user has firm access, also get firm-specific settings
    let firmSettings = [];
    if (req.user && req.user.firm_id) {
      firmSettings = FirmSettings.getByFirm.all(req.user.firm_id);
    }
    
    res.json({ 
      global_settings: globalSettings,
      firm_settings: firmSettings
    });
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get specific setting
export const getSetting = (req, res) => {
  try {
    const { key } = req.params;
    
    // If user has firm access, check for firm-specific setting first
    if (req.user && req.user.firm_id) {
      const firmSetting = FirmSettings.getByFirmAndKey.get(req.user.firm_id, key);
      
      if (firmSetting) {
        res.json(firmSetting);
        return;
      }
    }
    
    // Fall back to global setting
    const setting = Settings.getByKey.get(key);
    
    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    
    res.json(setting);
  } catch (err) {
    console.error('Error fetching setting:', err);
    res.status(500).json({ error: err.message });
  }
};

// Update specific setting
export const updateSetting = (req, res) => {
  try {
    const { key } = req.params;
    const { setting_value, description } = req.body;
    
    if (!setting_value) {
      return res.status(400).json({ error: 'Setting value is required' });
    }
    
    // Check if user has firm access (for firm-specific settings)
    if (req.user && req.user.firm_id) {
      // Check for existing firm-specific setting
      const existingFirmSetting = FirmSettings.getByFirmAndKey.get(req.user.firm_id, key);
      
      if (existingFirmSetting) {
        // Update existing firm setting
        const result = FirmSettings.update.run(
          setting_value,
          description || existingFirmSetting.description,
          req.user.firm_id,
          key
        );
        
        if (result.changes === 0) {
          return res.status(400).json({ error: 'No changes made to setting' });
        }
        
        // Return updated setting
        const updatedSetting = FirmSettings.getByFirmAndKey.get(req.user.firm_id, key);
        res.json({ message: 'Setting updated successfully', setting: updatedSetting });
      } else {
        // Create new firm setting
        const result = FirmSettings.create.run(
          req.user.firm_id,
          key,
          setting_value,
          description || `Firm-specific ${key} setting`
        );
        
        if (result.changes === 0) {
          return res.status(400).json({ error: 'Failed to create setting' });
        }
        
        // Return newly created setting
        const newSetting = FirmSettings.getByFirmAndKey.get(req.user.firm_id, key);
        res.json({ message: 'Setting created successfully', setting: newSetting });
      }
    } else {
      // Update global setting if no firm context
      const existingSetting = Settings.getByKey.get(key);
      if (!existingSetting) {
        return res.status(404).json({ error: 'Setting not found' });
      }
      
      // Update the setting
      const result = Settings.update.run(
        setting_value,
        description || existingSetting.description,
        key
      );
      
      if (result.changes === 0) {
        return res.status(400).json({ error: 'No changes made to setting' });
      }
      
      // Return updated setting
      const updatedSetting = Settings.getByKey.get(key);
      res.json({ message: 'Setting updated successfully', setting: updatedSetting });
    }
  } catch (err) {
    console.error('Error updating setting:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get GST status
export const getGstStatus = (req, res) => {
  try {
    // Check if user has firm access (for firm-specific settings)
    if (req.user && req.user.firm_id) {
      // First check for firm-specific GST setting
      const firmSetting = FirmSettings.getByFirmAndKey.get(req.user.firm_id, 'gst_enabled');
      
      if (firmSetting) {
        // Use firm-specific setting
        const gstEnabled = firmSetting.setting_value === 'true';
        res.json({ gst_enabled: gstEnabled });
        return;
      }
    }
    
    // Fall back to global setting if no firm-specific setting exists
    const setting = Settings.getByKey.get('gst_enabled');
    const gstEnabled = setting ? setting.setting_value === 'true' : true; // Default to true if not found
    res.json({ gst_enabled: gstEnabled });
  } catch (err) {
    console.error('Error fetching GST status:', err);
    res.status(500).json({ error: err.message });
  }
};

// Toggle GST status
export const toggleGstStatus = (req, res) => {
  try {
    const { enabled } = req.body;
    
    if (enabled === undefined) {
      return res.status(400).json({ error: 'Enabled parameter is required (true/false)' });
    }
    
    const settingValue = enabled ? 'true' : 'false';
    
    // Check if user has firm access (for firm-specific settings)
    if (req.user && req.user.firm_id) {
      // Check for existing firm-specific GST setting
      const existingFirmSetting = FirmSettings.getByFirmAndKey.get(req.user.firm_id, 'gst_enabled');
      
      if (existingFirmSetting) {
        // Update existing firm setting
        FirmSettings.update.run(
          settingValue,
          existingFirmSetting.description,
          req.user.firm_id,
          'gst_enabled'
        );
      } else {
        // Create new firm setting
        FirmSettings.create.run(
          req.user.firm_id,
          'gst_enabled',
          settingValue,
          'Firm-specific GST calculation toggle'
        );
      }
    } else {
      // Update global setting if no firm context
      const existingSetting = Settings.getByKey.get('gst_enabled');
      
      if (existingSetting) {
        // Update existing setting
        Settings.update.run(
          settingValue,
          existingSetting.description,
          'gst_enabled'
        );
      } else {
        // Create new setting
        Settings.create.run(
          'gst_enabled',
          settingValue,
          'Global GST calculation toggle'
        );
      }
    }
    
    res.json({ message: `GST has been ${enabled ? 'enabled' : 'disabled'} successfully`, gst_enabled: enabled });
  } catch (err) {
    console.error('Error updating GST status:', err);
    res.status(500).json({ error: err.message });
  }
};

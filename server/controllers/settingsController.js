import { Settings } from '../utils/db.js';

// Create new setting
export const createSetting = (req, res) => {
  try {
    const { setting_key, setting_value, description } = req.body;
    
    if (!setting_key || !setting_value) {
      return res.status(400).json({ error: 'Setting key and value are required' });
    }
    
    // Check if setting already exists
    const existing = Settings.getByKey.get(setting_key);
    if (existing) {
      return res.status(409).json({ error: 'Setting already exists' });
    }
    
    const result = Settings.create.run(
      setting_key,
      setting_value,
      description || null
    );
    
    if (result.changes === 0) {
      return res.status(400).json({ error: 'Failed to create setting' });
    }
    
    const newSetting = Settings.getByKey.get(setting_key);
    res.status(201).json({ message: 'Setting created successfully', setting: newSetting });
  } catch (err) {
    console.error('Error creating setting:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get all settings
export const getAllSettings = (req, res) => {
  try {
    const settings = Settings.getAll.all();
    res.json({ settings });
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get specific setting
export const getSetting = (req, res) => {
  try {
    const { key } = req.params;
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
    
    // Check if setting exists
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
  } catch (err) {
    console.error('Error updating setting:', err);
    res.status(500).json({ error: err.message });
  }
};

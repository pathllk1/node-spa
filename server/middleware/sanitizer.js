import xss from 'xss';

// Helper function to clean data recursively
const clean = (data) => {
    if (typeof data === 'string') {
        return xss(data.trim()); // Sanitize and trim whitespace
    } else if (Array.isArray(data)) {
        return data.map(item => clean(item)); // Clean each item in array
    } else if (typeof data === 'object' && data !== null) {
        // Clean each key in the object
        Object.keys(data).forEach(key => {
            data[key] = clean(data[key]);
        });
        return data;
    }
    return data; // Return numbers, booleans, null as is
};

const sanitizer = (req, res, next) => {
    if (req.body) req.body = clean(req.body);
    if (req.query) req.query = clean(req.query);
    if (req.params) req.params = clean(req.params);
    
    next();
};

export default sanitizer;
const { database } = require('../lib/database.js');

export default async function handler(req, res) {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ success: false, error: `方法 ${req.method} 不被允许` });
    }

    try {
        const result = await database.exportData();
        
        if (result.success) {
            // 设置下载头
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="companies_export_${new Date().toISOString().split('T')[0]}.json"`);
            return res.json(result.data);
        } else {
            return res.status(500).json(result);
        }
    } catch (error) {
        console.error('Export API Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
const { database } = require('../lib/database.js');

export default async function handler(req, res) {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ success: false, error: `方法 ${req.method} 不被允许` });
    }

    try {
        const { data: importData, options = { merge: false } } = req.body;
        
        if (!importData) {
            return res.status(400).json({ success: false, error: '缺少导入数据' });
        }

        const result = await database.importData(importData, options);
        return res.json(result);
    } catch (error) {
        console.error('Import API Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
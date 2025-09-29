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
        const result = await database.getStatistics();
        return res.json(result);
    } catch (error) {
        console.error('Statistics API Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
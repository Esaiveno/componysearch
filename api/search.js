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
        const { q: query } = req.query;
        
        if (!query) {
            return res.status(400).json({ success: false, error: '缺少搜索关键词' });
        }

        const result = await database.searchCompanies(query);
        return res.json(result);
    } catch (error) {
        console.error('Search API Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
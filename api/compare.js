const { database } = require('../data.js');
const fs = require('fs');
const path = require('path');

export default async function handler(req, res) {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const compareFile = path.join(process.cwd(), 'data', 'compare.json');

        if (req.method === 'GET') {
            // 获取对比列表
            try {
                if (fs.existsSync(compareFile)) {
                    const compareData = JSON.parse(fs.readFileSync(compareFile, 'utf8'));
                    return res.json({ success: true, data: compareData });
                } else {
                    return res.json({ success: true, data: [] });
                }
            } catch (error) {
                return res.json({ success: true, data: [] });
            }
        } else if (req.method === 'POST') {
            // 保存对比列表
            const { companies } = req.body;
            
            if (!companies || !Array.isArray(companies)) {
                return res.status(400).json({ success: false, error: '无效的对比数据' });
            }

            try {
                // 确保目录存在
                const dataDir = path.dirname(compareFile);
                if (!fs.existsSync(dataDir)) {
                    fs.mkdirSync(dataDir, { recursive: true });
                }
                
                fs.writeFileSync(compareFile, JSON.stringify(companies, null, 2));
                return res.json({ success: true, message: '对比列表已保存' });
            } catch (error) {
                return res.status(500).json({ success: false, error: '保存对比列表失败' });
            }
        } else {
            res.setHeader('Allow', ['GET', 'POST']);
            return res.status(405).json({ success: false, error: `方法 ${req.method} 不被允许` });
        }
    } catch (error) {
        console.error('Compare API Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
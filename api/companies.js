const { database } = require('../lib/database.js');

export default async function handler(req, res) {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { method, query, body } = req;
        const { id } = query;

        switch (method) {
            case 'GET':
                if (id) {
                    // 获取单个公司
                    const result = await database.getCompanyById(id);
                    if (result.success && result.data) {
                        return res.json(result);
                    } else {
                        return res.status(404).json({ success: false, error: '公司不存在' });
                    }
                } else {
                    // 获取所有公司
                    const result = await database.getAllCompanies();
                    return res.json(result);
                }

            case 'POST':
                // 添加新公司
                const addResult = await database.addCompany(body);
                return res.json(addResult);

            case 'PUT':
                // 更新公司
                if (!id) {
                    return res.status(400).json({ success: false, error: '缺少公司ID' });
                }
                const updateResult = await database.updateCompany(id, body);
                return res.json(updateResult);

            case 'DELETE':
                // 删除公司
                if (!id) {
                    return res.status(400).json({ success: false, error: '缺少公司ID' });
                }
                const deleteResult = await database.deleteCompany(id);
                return res.json(deleteResult);

            default:
                res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
                return res.status(405).json({ success: false, error: `方法 ${method} 不被允许` });
        }
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
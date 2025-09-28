const express = require('express');
const path = require('path');
const os = require('os');
const { database } = require('./data.js');

const app = express();
const PORT = 3000;

// 中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS支持 - 允许局域网内跨域访问
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// 静态文件服务
app.use(express.static(__dirname));

// 主页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ==================== API 路由 ====================

// 获取所有公司
app.get('/api/companies', async (req, res) => {
    try {
        const result = await database.getAllCompanies();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 根据ID获取公司
app.get('/api/companies/:id', async (req, res) => {
    try {
        const result = await database.getCompanyById(req.params.id);
        if (result.success && result.data) {
            res.json(result);
        } else {
            res.status(404).json({ success: false, error: '公司不存在' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 添加新公司
app.post('/api/companies', async (req, res) => {
    try {
        const result = await database.addCompany(req.body);
        if (result.success) {
            res.status(201).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 更新公司信息
app.put('/api/companies/:id', async (req, res) => {
    try {
        const result = await database.updateCompany(req.params.id, req.body);
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 删除公司
app.delete('/api/companies/:id', async (req, res) => {
    try {
        const result = await database.deleteCompany(req.params.id);
        if (result.success) {
            res.json(result);
        } else {
            res.status(404).json(result);
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 搜索公司
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.status(400).json({ success: false, error: '缺少搜索关键词' });
        }
        const result = await database.searchCompanies(query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取统计信息
app.get('/api/statistics', async (req, res) => {
    try {
        const result = await database.getStatistics();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 批量操作
app.post('/api/batch', async (req, res) => {
    try {
        const operations = req.body.operations;
        if (!Array.isArray(operations)) {
            return res.status(400).json({ success: false, error: '操作列表格式错误' });
        }
        const result = await database.batchOperation(operations);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 数据导出
app.get('/api/export', async (req, res) => {
    try {
        const result = await database.exportData();
        if (result.success) {
            res.setHeader('Content-Disposition', 'attachment; filename=companies_export.json');
            res.setHeader('Content-Type', 'application/json');
            res.json(result.data);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 数据导入
app.post('/api/import', async (req, res) => {
    try {
        const importData = req.body;
        const options = {
            merge: req.query.merge === 'true'
        };
        const result = await database.importData(importData, options);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取比较数据
app.get('/api/compare', async (req, res) => {
    try {
        const fs = require('fs').promises;
        const comparePath = path.join(__dirname, 'data', 'compare.json');
        
        try {
            const data = await fs.readFile(comparePath, 'utf8');
            res.json(JSON.parse(data));
        } catch (error) {
            // 如果文件不存在，返回默认结构
            res.json({ comparisons: {} });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 保存比较数据
app.post('/api/compare', async (req, res) => {
    try {
        const fs = require('fs').promises;
        const comparePath = path.join(__dirname, 'data', 'compare.json');
        
        const compareData = {
            ...req.body,
            lastUpdated: new Date().toISOString()
        };
        
        await fs.writeFile(comparePath, JSON.stringify(compareData, null, 2), 'utf8');
        res.json({ success: true, message: '比较数据保存成功' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 获取本机IP地址
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const interface of interfaces[name]) {
            if (interface.family === 'IPv4' && !interface.internal) {
                return interface.address;
            }
        }
    }
    return 'localhost';
}

// 启动服务器，监听所有网络接口
app.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log('\n=== 企业基本面调查系统 ===');
    console.log('服务器已启动，可通过以下地址访问：');
    console.log(`\n本机访问: http://localhost:${PORT}`);
    console.log(`局域网访问: http://${localIP}:${PORT}`);
    console.log('\n请确保防火墙允许端口 3000 的入站连接');
    console.log('其他设备可通过局域网IP地址访问此服务\n');
});
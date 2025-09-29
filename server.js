// 这个文件仅用于本地开发
// 在Vercel部署时，使用api/目录下的Serverless Functions

const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors());

// 静态文件服务
app.use(express.static(path.join(__dirname)));

// 主页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 本地开发时的API路由代理
if (process.env.NODE_ENV !== 'production') {
    // 导入本地数据库
    const { database } = require('./data.js');
    
    // 公司相关API
    app.get('/api/companies', async (req, res) => {
        try {
            const companies = await database.getAllCompanies();
            res.json(companies);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    app.get('/api/companies/:id', async (req, res) => {
        try {
            const company = await database.getCompanyById(req.params.id);
            if (!company) {
                return res.status(404).json({ error: '公司未找到' });
            }
            res.json(company);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    app.post('/api/companies', async (req, res) => {
        try {
            const company = await database.addCompany(req.body);
            res.status(201).json(company);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    app.put('/api/companies/:id', async (req, res) => {
        try {
            const company = await database.updateCompany(req.params.id, req.body);
            if (!company) {
                return res.status(404).json({ error: '公司未找到' });
            }
            res.json(company);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    app.delete('/api/companies/:id', async (req, res) => {
        try {
            const success = await database.deleteCompany(req.params.id);
            if (!success) {
                return res.status(404).json({ error: '公司未找到' });
            }
            res.json({ message: '删除成功' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // 搜索API
    app.get('/api/search', async (req, res) => {
        try {
            const { q, category, minScore, maxScore } = req.query;
            const results = await database.searchCompanies(q, { category, minScore, maxScore });
            res.json(results);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // 统计API
    app.get('/api/statistics', async (req, res) => {
        try {
            const stats = await database.getStatistics();
            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // 批量操作API
    app.post('/api/batch', async (req, res) => {
        try {
            const { operation, data } = req.body;
            const result = await database.batchOperation(operation, data);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // 导出API
    app.get('/api/export', async (req, res) => {
        try {
            const companies = await database.getAllCompanies();
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename="companies.json"');
            res.json(companies);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // 导入API
    app.post('/api/import', async (req, res) => {
        try {
            const { companies } = req.body;
            const result = await database.importCompanies(companies);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // 对比API
    app.get('/api/compare', async (req, res) => {
        try {
            const compareList = await database.getCompareList();
            res.json(compareList);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    app.post('/api/compare', async (req, res) => {
        try {
            const { companyIds } = req.body;
            const result = await database.saveCompareList(companyIds);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // 健康检查API
    app.get('/api/health', (req, res) => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            environment: 'local'
        });
    });
}

// 启动服务器
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});

module.exports = app;
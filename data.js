const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * 企业基本面调查数据库模块
 * 支持局域网内多设备数据同步的JSON数据库实现
 */
class CompanyDatabase {
    constructor() {
        this.dataFile = path.join(__dirname, 'data', 'companies.json');
        this.backupDir = path.join(__dirname, 'data', 'backups');
        this.lockFile = path.join(__dirname, 'data', '.lock');
        this.companies = [];
        this.isLocked = false;
        
        // 确保数据目录存在
        this.ensureDirectories();
        
        // 初始化数据
        this.loadData();
        
        // 定期备份
        this.startBackupSchedule();
    }

    /**
     * 确保必要的目录存在
     */
    ensureDirectories() {
        const dataDir = path.dirname(this.dataFile);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    /**
     * 文件锁机制 - 防止并发写入冲突
     */
    async acquireLock() {
        let attempts = 0;
        const maxAttempts = 50;
        
        while (attempts < maxAttempts) {
            try {
                if (!fs.existsSync(this.lockFile)) {
                    fs.writeFileSync(this.lockFile, process.pid.toString());
                    this.isLocked = true;
                    return true;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            } catch (error) {
                console.error('获取文件锁失败:', error);
                attempts++;
            }
        }
        throw new Error('无法获取文件锁，请稍后重试');
    }

    /**
     * 释放文件锁
     */
    releaseLock() {
        try {
            if (this.isLocked && fs.existsSync(this.lockFile)) {
                fs.unlinkSync(this.lockFile);
                this.isLocked = false;
            }
        } catch (error) {
            console.error('释放文件锁失败:', error);
        }
    }

    /**
     * 加载数据
     */
    loadData() {
        try {
            if (fs.existsSync(this.dataFile)) {
                const data = fs.readFileSync(this.dataFile, 'utf8');
                const parsed = JSON.parse(data);
                
                // 验证数据完整性
                if (this.validateData(parsed)) {
                    this.companies = parsed.companies || [];
                } else {
                    console.warn('数据文件损坏，尝试从备份恢复');
                    this.restoreFromBackup();
                }
            } else {
                this.companies = [];
                this.saveData();
            }
        } catch (error) {
            console.error('加载数据失败:', error);
            this.restoreFromBackup();
        }
    }

    /**
     * 验证数据完整性
     */
    validateData(data) {
        try {
            if (!data || typeof data !== 'object') return false;
            if (!Array.isArray(data.companies)) return false;
            
            // 验证每个公司数据的必要字段
            for (const company of data.companies) {
                if (!company.id || !company.name || typeof company.investmentScore !== 'number') {
                    return false;
                }
            }
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 保存数据到文件
     */
    async saveData() {
        try {
            await this.acquireLock();
            
            const dataToSave = {
                companies: this.companies,
                lastModified: new Date().toISOString(),
                version: '1.0.0',
                checksum: this.generateChecksum(this.companies)
            };
            
            const jsonData = JSON.stringify(dataToSave, null, 2);
            
            // 原子写入 - 先写入临时文件，再重命名
            const tempFile = this.dataFile + '.tmp';
            fs.writeFileSync(tempFile, jsonData, 'utf8');
            fs.renameSync(tempFile, this.dataFile);
            
            console.log('数据保存成功');
        } catch (error) {
            console.error('保存数据失败:', error);
            throw error;
        } finally {
            this.releaseLock();
        }
    }

    /**
     * 生成数据校验和
     */
    generateChecksum(data) {
        const hash = crypto.createHash('md5');
        hash.update(JSON.stringify(data));
        return hash.digest('hex');
    }

    /**
     * 创建备份
     */
    createBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(this.backupDir, `companies_${timestamp}.json`);
            
            if (fs.existsSync(this.dataFile)) {
                fs.copyFileSync(this.dataFile, backupFile);
                
                // 只保留最近10个备份
                this.cleanOldBackups();
            }
        } catch (error) {
            console.error('创建备份失败:', error);
        }
    }

    /**
     * 清理旧备份
     */
    cleanOldBackups() {
        try {
            const backups = fs.readdirSync(this.backupDir)
                .filter(file => file.startsWith('companies_') && file.endsWith('.json'))
                .map(file => ({
                    name: file,
                    path: path.join(this.backupDir, file),
                    mtime: fs.statSync(path.join(this.backupDir, file)).mtime
                }))
                .sort((a, b) => b.mtime - a.mtime);

            // 删除超过3个的旧备份
            if (backups.length > 3) {
                for (let i = 3; i < backups.length; i++) {
                    fs.unlinkSync(backups[i].path);
                }
            }
        } catch (error) {
            console.error('清理备份失败:', error);
        }
    }

    /**
     * 从备份恢复数据
     */
    restoreFromBackup() {
        try {
            const backups = fs.readdirSync(this.backupDir)
                .filter(file => file.startsWith('companies_') && file.endsWith('.json'))
                .map(file => ({
                    name: file,
                    path: path.join(this.backupDir, file),
                    mtime: fs.statSync(path.join(this.backupDir, file)).mtime
                }))
                .sort((a, b) => b.mtime - a.mtime);

            if (backups.length > 0) {
                const latestBackup = backups[0];
                const backupData = JSON.parse(fs.readFileSync(latestBackup.path, 'utf8'));
                
                if (this.validateData(backupData)) {
                    this.companies = backupData.companies || [];
                    console.log('从备份恢复数据成功');
                    return;
                }
            }
            
            // 如果没有有效备份，初始化为空数据
            this.companies = [];
            console.log('初始化为空数据');
        } catch (error) {
            console.error('从备份恢复失败:', error);
            this.companies = [];
        }
    }

    /**
     * 开始定期备份
     */
    startBackupSchedule() {
        // 每24小时创建一次备份
        setInterval(() => {
            this.createBackup();
        }, 24 * 60 * 60 * 1000);
    }

    // ==================== CRUD 操作接口 ====================

    /**
     * 获取所有公司数据
     */
    async getAllCompanies() {
        try {
            // 重新加载最新数据以确保同步
            this.loadData();
            return {
                success: true,
                data: this.companies,
                count: this.companies.length
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: []
            };
        }
    }

    /**
     * 根据ID获取公司
     */
    async getCompanyById(id) {
        try {
            this.loadData();
            const company = this.companies.find(c => c.id === id);
            return {
                success: true,
                data: company || null
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * 添加新公司
     */
    async addCompany(companyData) {
        try {
            // 验证必要字段
            if (!companyData.name || typeof companyData.investmentScore !== 'number') {
                throw new Error('缺少必要字段：公司名称和投资评分');
            }

            // 检查是否已存在同名公司
            this.loadData();
            const existingCompany = this.companies.find(c => c.name === companyData.name);
            if (existingCompany) {
                throw new Error('公司名称已存在');
            }

            const newCompany = {
                id: companyData.id || Date.now().toString(),
                name: companyData.name,
                business: companyData.business || '',
                investmentScore: companyData.investmentScore,
                investmentLevel: companyData.investmentLevel || this.getInvestmentLevel(companyData.investmentScore),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            this.companies.push(newCompany);
            await this.saveData();
            
            return {
                success: true,
                data: newCompany,
                message: '公司添加成功'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * 更新公司信息
     */
    async updateCompany(id, updateData) {
        try {
            this.loadData();
            const index = this.companies.findIndex(c => c.id === id);
            
            if (index === -1) {
                throw new Error('公司不存在');
            }

            // 检查名称冲突（排除自己）
            if (updateData.name) {
                const existingCompany = this.companies.find(c => c.name === updateData.name && c.id !== id);
                if (existingCompany) {
                    throw new Error('公司名称已存在');
                }
            }

            const updatedCompany = {
                ...this.companies[index],
                ...updateData,
                updatedAt: new Date().toISOString()
            };

            // 如果更新了投资评分，重新计算投资等级
            if (typeof updateData.investmentScore === 'number') {
                updatedCompany.investmentLevel = this.getInvestmentLevel(updateData.investmentScore);
            }

            this.companies[index] = updatedCompany;
            await this.saveData();
            
            return {
                success: true,
                data: updatedCompany,
                message: '公司信息更新成功'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * 删除公司
     */
    async deleteCompany(id) {
        try {
            this.loadData();
            const index = this.companies.findIndex(c => c.id === id);
            
            if (index === -1) {
                throw new Error('公司不存在');
            }

            const deletedCompany = this.companies.splice(index, 1)[0];
            await this.saveData();
            
            return {
                success: true,
                data: deletedCompany,
                message: '公司删除成功'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * 批量操作
     */
    async batchOperation(operations) {
        const results = [];
        
        try {
            await this.acquireLock();
            
            for (const operation of operations) {
                let result;
                switch (operation.type) {
                    case 'add':
                        result = await this.addCompany(operation.data);
                        break;
                    case 'update':
                        result = await this.updateCompany(operation.id, operation.data);
                        break;
                    case 'delete':
                        result = await this.deleteCompany(operation.id);
                        break;
                    default:
                        result = { success: false, error: '未知操作类型' };
                }
                results.push(result);
            }
            
            return {
                success: true,
                results: results
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                results: results
            };
        } finally {
            this.releaseLock();
        }
    }

    /**
     * 根据分数获取投资等级
     */
    getInvestmentLevel(score) {
        if (score >= 0 && score <= 25) {
            return '不建议投资';
        } else if (score >= 26 && score <= 50) {
            return '高风险';
        } else if (score >= 51 && score <= 75) {
            return '谨慎投资';
        } else if (score >= 76 && score <= 100) {
            return '值得投资';
        } else {
            return '未知';
        }
    }

    /**
     * 搜索公司
     */
    async searchCompanies(query) {
        try {
            this.loadData();
            const searchTerm = query.toLowerCase();
            const results = this.companies.filter(company => 
                company.name.toLowerCase().includes(searchTerm) ||
                company.business.toLowerCase().includes(searchTerm) ||
                company.investmentLevel.toLowerCase().includes(searchTerm)
            );
            
            return {
                success: true,
                data: results,
                count: results.length
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: []
            };
        }
    }

    /**
     * 获取统计信息
     */
    async getStatistics() {
        try {
            this.loadData();
            
            const stats = {
                totalCompanies: this.companies.length,
                investmentLevels: {
                    '值得投资': 0,
                    '谨慎投资': 0,
                    '高风险': 0,
                    '不建议投资': 0
                },
                averageScore: 0,
                lastUpdated: new Date().toISOString()
            };
            
            let totalScore = 0;
            this.companies.forEach(company => {
                stats.investmentLevels[company.investmentLevel]++;
                totalScore += company.investmentScore;
            });
            
            if (this.companies.length > 0) {
                stats.averageScore = Math.round(totalScore / this.companies.length);
            }
            
            return {
                success: true,
                data: stats
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * 数据导出
     */
    async exportData() {
        try {
            this.loadData();
            return {
                success: true,
                data: {
                    companies: this.companies,
                    exportTime: new Date().toISOString(),
                    version: '1.0.0'
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * 数据导入
     */
    async importData(importData, options = { merge: false }) {
        try {
            if (!importData.companies || !Array.isArray(importData.companies)) {
                throw new Error('导入数据格式错误');
            }

            await this.acquireLock();
            
            // 创建导入前备份
            this.createBackup();
            
            if (options.merge) {
                // 合并模式：保留现有数据，添加新数据
                this.loadData();
                const existingIds = new Set(this.companies.map(c => c.id));
                const newCompanies = importData.companies.filter(c => !existingIds.has(c.id));
                this.companies.push(...newCompanies);
            } else {
                // 替换模式：完全替换现有数据
                this.companies = importData.companies;
            }
            
            await this.saveData();
            
            return {
                success: true,
                message: `数据导入成功，共导入 ${importData.companies.length} 条记录`,
                data: { count: importData.companies.length }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: null
            };
        } finally {
            this.releaseLock();
        }
    }
}

// 创建数据库实例
const database = new CompanyDatabase();

// 导出数据库实例和类
module.exports = {
    database,
    CompanyDatabase
};
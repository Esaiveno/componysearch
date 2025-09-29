/**
 * Vercel适配的数据库模块
 * 由于Vercel的只读文件系统限制，使用内存存储和外部API
 */

// 默认数据 - 从原始companies.json复制
const defaultCompanies = [
    {
        "id": "1",
        "name": "华为技术有限公司",
        "business": "半导体,AI算力,网络通信",
        "investmentScore": 95,
        "investmentLevel": "A+",
        "createdAt": "2024-01-15T08:30:00.000Z",
        "updatedAt": "2024-01-15T08:30:00.000Z"
    },
    {
        "id": "2", 
        "name": "比亚迪股份有限公司",
        "business": "新能源,智能终端",
        "investmentScore": 92,
        "investmentLevel": "A+",
        "createdAt": "2024-01-15T09:15:00.000Z",
        "updatedAt": "2024-01-15T09:15:00.000Z"
    },
    {
        "id": "3",
        "name": "宁德时代新能源科技股份有限公司", 
        "business": "新能源,高性能材料",
        "investmentScore": 90,
        "investmentLevel": "A+",
        "createdAt": "2024-01-15T10:00:00.000Z",
        "updatedAt": "2024-01-15T10:00:00.000Z"
    }
];

class VercelDatabase {
    constructor() {
        // 使用内存存储，每次冷启动会重置
        this.companies = [...defaultCompanies];
        this.compareList = [];
    }

    /**
     * 获取所有公司
     */
    async getAllCompanies() {
        try {
            return {
                success: true,
                data: this.companies,
                total: this.companies.length,
                timestamp: new Date().toISOString()
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
            const company = this.companies.find(c => c.id === id);
            if (company) {
                return {
                    success: true,
                    data: company
                };
            } else {
                return {
                    success: false,
                    error: '公司不存在',
                    data: null
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * 添加公司
     */
    async addCompany(companyData) {
        try {
            // 验证必填字段
            if (!companyData.name || !companyData.business) {
                return {
                    success: false,
                    error: '公司名称和业务类型为必填项'
                };
            }

            // 生成新ID
            const newId = (Math.max(...this.companies.map(c => parseInt(c.id) || 0)) + 1).toString();
            
            const newCompany = {
                id: newId,
                name: companyData.name,
                business: companyData.business,
                investmentScore: companyData.investmentScore || 0,
                investmentLevel: this.getInvestmentLevel(companyData.investmentScore || 0),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            this.companies.push(newCompany);

            return {
                success: true,
                data: newCompany,
                message: '公司添加成功'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 更新公司
     */
    async updateCompany(id, updateData) {
        try {
            const index = this.companies.findIndex(c => c.id === id);
            if (index === -1) {
                return {
                    success: false,
                    error: '公司不存在'
                };
            }

            const updatedCompany = {
                ...this.companies[index],
                ...updateData,
                id: id, // 确保ID不被修改
                updatedAt: new Date().toISOString()
            };

            // 重新计算投资级别
            if (updateData.investmentScore !== undefined) {
                updatedCompany.investmentLevel = this.getInvestmentLevel(updateData.investmentScore);
            }

            this.companies[index] = updatedCompany;

            return {
                success: true,
                data: updatedCompany,
                message: '公司更新成功'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 删除公司
     */
    async deleteCompany(id) {
        try {
            const index = this.companies.findIndex(c => c.id === id);
            if (index === -1) {
                return {
                    success: false,
                    error: '公司不存在'
                };
            }

            const deletedCompany = this.companies.splice(index, 1)[0];

            return {
                success: true,
                data: deletedCompany,
                message: '公司删除成功'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 搜索公司
     */
    async searchCompanies(query) {
        try {
            const searchTerm = query.toLowerCase();
            const results = this.companies.filter(company => 
                company.name.toLowerCase().includes(searchTerm) ||
                company.business.toLowerCase().includes(searchTerm) ||
                company.investmentLevel.toLowerCase().includes(searchTerm)
            );

            return {
                success: true,
                data: results,
                total: results.length,
                query: query
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
            const total = this.companies.length;
            const levelCounts = {};
            const businessCounts = {};

            this.companies.forEach(company => {
                // 统计投资级别
                levelCounts[company.investmentLevel] = (levelCounts[company.investmentLevel] || 0) + 1;
                
                // 统计业务类型
                const businesses = company.business.split(',').map(b => b.trim());
                businesses.forEach(business => {
                    businessCounts[business] = (businessCounts[business] || 0) + 1;
                });
            });

            return {
                success: true,
                data: {
                    total,
                    levelDistribution: levelCounts,
                    businessDistribution: businessCounts,
                    averageScore: total > 0 ? 
                        this.companies.reduce((sum, c) => sum + c.investmentScore, 0) / total : 0
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 批量操作
     */
    async batchOperation(operations) {
        try {
            const results = [];
            
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
                results.push({ operation, result });
            }

            return {
                success: true,
                data: results,
                message: `批量操作完成，共处理 ${operations.length} 个操作`
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 导出数据
     */
    async exportData() {
        try {
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
                error: error.message
            };
        }
    }

    /**
     * 导入数据
     */
    async importData(importData, options = { merge: false }) {
        try {
            if (!importData.companies || !Array.isArray(importData.companies)) {
                return {
                    success: false,
                    error: '无效的导入数据格式'
                };
            }

            if (options.merge) {
                // 合并模式：添加新数据，更新已存在的数据
                let addedCount = 0;
                let updatedCount = 0;

                importData.companies.forEach(importCompany => {
                    const existingIndex = this.companies.findIndex(c => c.id === importCompany.id);
                    if (existingIndex >= 0) {
                        this.companies[existingIndex] = {
                            ...importCompany,
                            updatedAt: new Date().toISOString()
                        };
                        updatedCount++;
                    } else {
                        this.companies.push({
                            ...importCompany,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        });
                        addedCount++;
                    }
                });

                return {
                    success: true,
                    message: `数据导入成功，新增 ${addedCount} 条，更新 ${updatedCount} 条`
                };
            } else {
                // 替换模式：完全替换现有数据
                this.companies = importData.companies.map(company => ({
                    ...company,
                    updatedAt: new Date().toISOString()
                }));

                return {
                    success: true,
                    message: `数据导入成功，共导入 ${this.companies.length} 条记录`
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 根据投资评分计算投资级别
     */
    getInvestmentLevel(score) {
        if (score >= 90) return 'A+';
        if (score >= 80) return 'A';
        if (score >= 70) return 'B+';
        if (score >= 60) return 'B';
        if (score >= 50) return 'C+';
        if (score >= 40) return 'C';
        return 'D';
    }
}

// 创建单例实例
const database = new VercelDatabase();

module.exports = {
    database,
    VercelDatabase
};
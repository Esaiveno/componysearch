class CompanyManager {
    constructor() {
        this.companies = [];
        this.selectedCompany = null;
        this.currentChart = null;
        this.apiBase = window.location.origin;
        // 筛选/排序/搜索状态
        this.filterLevel = 'all';
        this.sortOrder = 'desc'; // desc: 高->低, asc: 低->高
        this.searchTerm = '';
        this.categoryFilter = ''; // 新增：分类筛选
        this.categorySearchTerm = ''; // 新增：分类搜索
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadCompanies();
    }

    // API调用方法
    async apiCall(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.apiBase}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }
            
            return data;
        } catch (error) {
            console.error('API调用失败:', error);
            this.showError(`网络错误: ${error.message}`);
            throw error;
        }
    }

    // 加载所有公司数据
    async loadCompanies() {
        try {
            this.showLoading(true);
            const result = await this.apiCall('/api/companies');
            if (result.success) {
                this.companies = result.data;
                this.renderCompanyList();
            }
        } catch (error) {
            console.error('加载公司数据失败:', error);
        } finally {
            this.showLoading(false);
        }
    }

    // 显示加载状态
    showLoading(show) {
        const container = document.getElementById('companyList');
        if (show) {
            container.innerHTML = '<div class="loading">正在加载数据...</div>';
        }
    }

    // 显示错误信息
    showError(message) {
        const container = document.getElementById('companyList');
        container.innerHTML = `<div class="error">错误: ${message}</div>`;
    }

    bindEvents() {
        // 添加公司按钮
        document.getElementById('addCompanyBtn').addEventListener('click', () => {
            this.showModal();
        });

        // 模态框关闭
        document.getElementById('closeModal').addEventListener('click', () => {
            this.hideModal();
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.hideModal();
        });

        // 点击模态框外部关闭
        document.getElementById('addModal').addEventListener('click', (e) => {
            if (e.target.id === 'addModal') {
                this.hideModal();
            }
        });

        // 表单提交
        document.getElementById('companyForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCompany();
        });

        // 详情模态框关闭
        const closeDetailBtn = document.getElementById('closeDetail');
        if (closeDetailBtn) {
            closeDetailBtn.addEventListener('click', () => this.hideDetailModal());
        }
        const detailModalEl = document.getElementById('detailModal');
        if (detailModalEl) {
            detailModalEl.addEventListener('click', (e) => {
                if (e.target.id === 'detailModal') this.hideDetailModal();
            });
        }

        // ====== 工具栏筛选/排序/搜索 事件 ======
        const filterLevelEl = document.getElementById('filterLevel');
        const sortOrderEl = document.getElementById('sortOrder');
        const searchInputEl = document.getElementById('searchInput');

        if (filterLevelEl) {
            filterLevelEl.addEventListener('change', (e) => {
                this.filterLevel = e.target.value;
                this.renderCompanyList();
            });
        }
        if (sortOrderEl) {
            sortOrderEl.addEventListener('change', (e) => {
                this.sortOrder = e.target.value;
                this.renderCompanyList();
            });
        }
        if (searchInputEl) {
            const debounced = this.debounce((val) => {
                this.searchTerm = val.trim();
                this.renderCompanyList();
            }, 200);
            searchInputEl.addEventListener('input', (e) => debounced(e.target.value));
        }

        // ====== 分类Tab栏事件 ======
        // 分类tab切换
        const categoryTabs = document.querySelectorAll('.category-tab');
        categoryTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                // 移除所有active状态
                categoryTabs.forEach(t => t.classList.remove('active'));
                // 添加当前tab的active状态
                e.target.classList.add('active');
                // 更新分类筛选
                this.categoryFilter = e.target.dataset.category || '';
                this.renderCompanyList();
            });
        });

        // 分类搜索
        const categorySearchInput = document.getElementById('categorySearchInput');
        if (categorySearchInput) {
            const categorySearchDebounced = this.debounce((val) => {
                this.categorySearchTerm = val.trim().toLowerCase();
                this.filterCategoryTabs();
            }, 200);
            categorySearchInput.addEventListener('input', (e) => categorySearchDebounced(e.target.value));
        }

        // 绑定展开按钮事件
        const expandBtn = document.getElementById('expandBtn');
        const categoryTabsGrid = document.getElementById('categoryTabsGrid');
        if (expandBtn && categoryTabsGrid) {
            expandBtn.addEventListener('click', () => {
                const isExpanded = categoryTabsGrid.classList.contains('expanded');
                
                if (isExpanded) {
                    // 收起
                    categoryTabsGrid.classList.remove('expanded');
                    expandBtn.classList.remove('expanded');
                    expandBtn.querySelector('.expand-text').textContent = '展开更多';
                } else {
                    // 展开
                    categoryTabsGrid.classList.add('expanded');
                    expandBtn.classList.add('expanded');
                    expandBtn.querySelector('.expand-text').textContent = '收起';
                }
            });
        }

        // 右键菜单
        document.addEventListener('contextmenu', (e) => {
            const companyCard = e.target.closest('.company-card');
            if (companyCard) {
                e.preventDefault();
                this.showContextMenu(e, companyCard);
            }
        }, true);

        // 点击其他地方隐藏右键菜单（仅左键，且不在菜单内）
        document.addEventListener('click', (e) => {
            if (e.button !== 0) return;
            if (!e.target.closest('#contextMenu')) {
                this.hideContextMenu();
            }
        });

        // 右键菜单项点击
        document.getElementById('downloadChart').addEventListener('click', () => {
            this.downloadChart();
        });

        document.getElementById('editCompany').addEventListener('click', () => {
            this.editCompany();
        });

        document.getElementById('deleteCompany').addEventListener('click', () => {
            this.deleteCompany();
        });
    }

    // 简单防抖
    debounce(fn, wait = 200) {
        let t = null;
        return (...args) => {
            if (t) clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), wait);
        };
    }



    // 根据分数获取投资等级
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

    // 模态框相关方法
    showModal(company = null) {
        const modal = document.getElementById('addModal');
        const form = document.getElementById('companyForm');
        
        if (company) {
            // 编辑模式
            document.getElementById('companyName').value = company.name;
            document.getElementById('mainBusiness').value = company.business;
            document.getElementById('investmentScore').value = company.investmentScore || '';
            form.dataset.editId = company.id;
        } else {
            // 添加模式
            form.reset();
            delete form.dataset.editId;
        }
        
        modal.style.display = 'block';
    }

    hideModal() {
        document.getElementById('addModal').style.display = 'none';
    }

    // 保存公司信息
    async saveCompany() {
        const form = document.getElementById('companyForm');
        const formData = new FormData(form);
        
        const investmentScore = parseInt(formData.get('investmentScore'));
        const investmentLevel = this.getInvestmentLevel(investmentScore);
        
        const companyData = {
            name: formData.get('companyName'),
            business: formData.get('mainBusiness'),
            investmentScore: investmentScore,
            investmentLevel: investmentLevel
        };

        try {
            let result;
            if (form.dataset.editId) {
                // 编辑模式
                result = await this.apiCall(`/api/companies/${form.dataset.editId}`, {
                    method: 'PUT',
                    body: JSON.stringify(companyData)
                });
            } else {
                // 添加模式
                result = await this.apiCall('/api/companies', {
                    method: 'POST',
                    body: JSON.stringify(companyData)
                });
            }

            if (result.success) {
                this.hideModal();
                await this.loadCompanies();
            }
        } catch (error) {
            console.error('保存公司信息失败:', error);
        }
    }

    // 渲染公司列表
    renderCompanyList() {
        const container = document.getElementById('companyList');
        const list = this.getProcessedCompanies();
        
        if (list.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>未找到匹配的公司</h3>
                    <p>调整筛选/排序/搜索条件试试看</p>
                </div>
            `;
            return;
        }

        container.innerHTML = list.map(company => `
            <div class="company-card" data-id="${company.id}">
                <div class="company-header">
                    <div class="company-name">${company.name}</div>
                    <div class="investment-status ${this.getInvestmentClass(company.investmentLevel || company.investment)}">
                        ${company.investmentScore !== undefined ? company.investmentScore + '分 - ' + (company.investmentLevel || company.investment) : (company.investment || '未评分')}
                    </div>
                </div>
                <div class="company-business">${company.business}</div>
                <div class="chart-container" id="chart-${company.id}"></div>
            </div>
        `).join('');

        // 渲染图表
        list.forEach(company => {
            this.renderChart(company);
        });

        // 绑定卡片点击事件
        container.querySelectorAll('.company-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.context-menu')) {
                    const id = card.dataset.id;
                    this.selectCompany(id);
                    this.showCompanyDetail(id);
                }
            });
        });
    }

    // 计算筛选+排序+搜索后的列表
    getProcessedCompanies() {
        const term = (this.searchTerm || '').toLowerCase();
        const filtered = this.companies.filter(c => {
            const level = (c.investmentLevel || c.investment || '').toLowerCase();
            const name = (c.name || '').toLowerCase();
            const business = (c.business || '').toLowerCase();
            
            // 投资等级筛选
            const matchLevel = this.filterLevel === 'all' || (c.investmentLevel || c.investment) === this.filterLevel;
            
            // 搜索词匹配
            const matchSearch = !term || name.includes(term) || business.includes(term) || level.includes(term);
            
            // 分类筛选
            const matchCategory = !this.categoryFilter || business.includes(this.categoryFilter);
            
            return matchLevel && matchSearch && matchCategory;
        });

        const sorted = filtered.sort((a, b) => {
            const scoreA = (typeof a.investmentScore === 'number') ? a.investmentScore : this.getProspectScore(a);
            const scoreB = (typeof b.investmentScore === 'number') ? b.investmentScore : this.getProspectScore(b);
            return this.sortOrder === 'asc' ? (scoreA - scoreB) : (scoreB - scoreA);
        });

        return sorted;
    }

    // 筛选分类tab显示
    filterCategoryTabs() {
        const categoryTabs = document.querySelectorAll('.category-tab');
        const searchTerm = this.categorySearchTerm;
        
        categoryTabs.forEach(tab => {
            const categoryName = tab.textContent.toLowerCase();
            const shouldShow = !searchTerm || categoryName.includes(searchTerm);
            
            if (shouldShow) {
                tab.classList.remove('hidden');
                // 高亮匹配的部分
                if (searchTerm && categoryName.includes(searchTerm)) {
                    tab.classList.add('highlight');
                } else {
                    tab.classList.remove('highlight');
                }
            } else {
                tab.classList.add('hidden');
                tab.classList.remove('highlight');
            }
        });
    }

    getInvestmentClass(investment) {
        switch(investment) {
            case '值得投资': return 'worth';
            case '谨慎投资': return 'caution';
            case '不建议投资': return 'not-recommended';
            case '高风险': return 'high-risk';
            default: return '';
        }
    }

    // 选择公司
    selectCompany(companyId) {
        // 移除之前的选中状态
        document.querySelectorAll('.company-card').forEach(card => {
            card.classList.remove('selected');
        });

        // 添加新的选中状态
        const selectedCard = document.querySelector(`[data-id="${companyId}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
            this.selectedCompany = this.companies.find(c => c.id === companyId);
        }
    }

    // 渲染ECharts图表
    renderChart(company) {
        const chartContainer = document.getElementById(`chart-${company.id}`);
        if (!chartContainer) return;

        const chart = echarts.init(chartContainer);
        
        // 简化数据，只显示前景评分
        const prospectScore = this.getProspectScore(company);
        
        const option = {
            title: {
                text: `${company.name}的基本面与前景`,
                textStyle: {
                    fontSize: 16,
                    color: '#333',
                    fontWeight: '500'
                },
                left: 'center',
                top: 15
            },
            tooltip: {
                show: false
            },
            series: [{
                type: 'gauge',
                center: ['50%', '60%'],
                radius: '70%',
                min: 0,
                max: 100,
                splitNumber: 5,
                axisLine: {
                    lineStyle: {
                        width: 8,
                        color: [
                            [0.3, '#ff6b6b'],
                            [0.7, '#feca57'],
                            [1, '#48dbfb']
                        ]
                    }
                },
                pointer: {
                    itemStyle: {
                        color: '#666'
                    }
                },
                axisTick: {
                    distance: -8,
                    length: 6,
                    lineStyle: {
                        color: '#fff',
                        width: 1
                    }
                },
                splitLine: {
                    distance: -12,
                    length: 12,
                    lineStyle: {
                        color: '#fff',
                        width: 2
                    }
                },
                axisLabel: {
                    color: '#666',
                    distance: 16,
                    fontSize: 10
                },
                detail: {
                    valueAnimation: true,
                    formatter: '{value}分',
                    color: '#333',
                    fontSize: 14,
                    offsetCenter: [0, '80%']
                },
                data: [{
                    value: prospectScore,
                    name: company.investment
                }]
            }]
        };

        chart.setOption(option);
        
        // 保存图表实例以供下载使用
        chartContainer.chartInstance = chart;
        
        // 响应式调整
        const resizeHandler = () => {
            chart.resize();
        };
        window.addEventListener('resize', resizeHandler);
        
        // 清理事件监听器
        chartContainer.resizeHandler = resizeHandler;
    }

    // 获取前景评分
    getProspectScore(company) {
        // 直接返回投资分数，如果没有分数则根据投资建议计算
        if (company.investmentScore !== undefined) {
            return company.investmentScore;
        }
        
        // 兼容旧数据格式
        switch (company.investment) {
            case '值得投资': return 85;
            case '谨慎投资': return 60;
            case '不建议投资': return 30;
            default: return 50;
        }
    }

    // 右键菜单相关方法
    showContextMenu(e, companyCard) {
        const contextMenu = document.getElementById('contextMenu');
        this.selectedCompany = this.companies.find(c => c.id === companyCard.dataset.id);
        
        contextMenu.style.display = 'block';
        // 使用clientX/clientY配合position: fixed，避免滚动后位置偏移
        const clickX = e.clientX;
        const clickY = e.clientY;
        contextMenu.style.left = clickX + 'px';
        contextMenu.style.top = clickY + 'px';
        
        // 确保菜单不会超出屏幕
        const rect = contextMenu.getBoundingClientRect();
        let left = clickX;
        let top = clickY;
        if (rect.right > window.innerWidth) {
            left = clickX - rect.width;
        }
        if (rect.bottom > window.innerHeight) {
            top = clickY - rect.height;
        }
        contextMenu.style.left = Math.max(0, left) + 'px';
        contextMenu.style.top = Math.max(0, top) + 'px';
    }

    hideContextMenu() {
        document.getElementById('contextMenu').style.display = 'none';
    }

    // 下载图表
    downloadChart() {
        if (!this.selectedCompany) return;
        
        const chartContainer = document.getElementById(`chart-${this.selectedCompany.id}`);
        const chart = chartContainer?.chartInstance;
        
        if (chart) {
            try {
                const url = chart.getDataURL({
                    type: 'png',
                    pixelRatio: 2,
                    backgroundColor: '#ffffff'
                });
                
                const link = document.createElement('a');
                link.download = `${this.selectedCompany.name}_基本面与前景.png`;
                link.href = url;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (error) {
                console.error('下载图表失败:', error);
                alert('下载图表失败，请重试');
            }
        }
        
        this.hideContextMenu();
    }

    // 编辑公司
    editCompany() {
        if (this.selectedCompany) {
            this.showModal(this.selectedCompany);
        }
        this.hideContextMenu();
    }

    // 删除公司
    async deleteCompany() {
        if (this.selectedCompany && confirm(`确定要删除 ${this.selectedCompany.name} 吗？`)) {
            try {
                const result = await this.apiCall(`/api/companies/${this.selectedCompany.id}`, {
                    method: 'DELETE'
                });
                
                if (result.success) {
                    this.selectedCompany = null;
                    await this.loadCompanies();
                }
            } catch (error) {
                console.error('删除公司失败:', error);
            }
        }
        this.hideContextMenu();
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new CompanyManager();
});


// 展示公司详情（利好消息 / 年度营收 / 其他信息）
CompanyManager.prototype.showCompanyDetail = function(companyId) {
    const company = this.companies.find(c => c.id === companyId);
    if (!company) return;

    // 标题
    const titleEl = document.getElementById('detailTitle');
    if (titleEl) titleEl.textContent = `${company.name} · 公司详情`;

    // 基本信息
    this.populateBasicInfo(company);

    // 风险评估
    this.populateRiskAssessment(company);

    // 操作区域
    this.setupActionButtons(company);

    // 设置编辑功能
    this.setupEditFunctions(company);

    // 利好消息
    this.showFavorableContent(company);

    // 年度营收
    this.showRevenueContent(company);

    // 其他信息
    const otherEl = document.getElementById('detailOther');
    if (otherEl) {
        const other = company.other || company.notes || '';
        otherEl.textContent = other ? String(other) : '暂无数据';
    }

    // 显示模态框
    const modal = document.getElementById('detailModal');
    if (modal) modal.style.display = 'block';
};

CompanyManager.prototype.hideDetailModal = function() {
    const modal = document.getElementById('detailModal');
    if (modal) modal.style.display = 'none';
    if (this.detailChart) {
        this.detailChart.dispose();
        this.detailChart = null;
    }
};

// 归一化营收数据，支持多种结构
CompanyManager.prototype.normalizeRevenue = function(company) {
    const src = company.revenue || company.annualRevenue || null;
    const items = [];
    if (!src) return items;
    if (Array.isArray(src)) {
        if (src.length > 0 && typeof src[0] === 'object') {
            src.forEach(it => {
                if (it && (it.year !== undefined) && (it.value !== undefined)) {
                    items.push({ year: String(it.year), value: Number(it.value) });
                }
            });
        } else {
            src.forEach((v, idx) => items.push({ year: String(idx + 1), value: Number(v) }));
        }
    } else if (typeof src === 'object') {
        Object.keys(src).forEach(y => items.push({ year: String(y), value: Number(src[y]) }));
        items.sort((a, b) => (parseInt(a.year) || 0) - (parseInt(b.year) || 0));
    }
    return items.filter(it => !isNaN(it.value));
};

// 渲染营收图表（柱状图）
CompanyManager.prototype.renderRevenueChart = function(container, data) {
    if (this.detailChart) {
        this.detailChart.dispose();
        this.detailChart = null;
    }
    const years = data.map(d => d.year);
    const values = data.map(d => d.value);
    
    // 确保容器可见且有尺寸
    setTimeout(() => {
        this.detailChart = echarts.init(container);
        this.detailChart.setOption({
            tooltip: { trigger: 'axis' },
            grid: { left: 65, right: 20, top: 30, bottom: 40 },
            xAxis: { type: 'category', data: years, axisLine: { lineStyle: { color: '#999' } } },
            yAxis: { 
                type: 'value', 
                name: '万元',
                nameLocation: 'end',
                nameGap: 15,
                nameTextStyle: { 
                    color: '#48dbfb', 
                    fontSize: 14,
                    fontWeight: 'bold',
                    padding: [0, 0, 0, 10]
                },
                axisLine: { lineStyle: { color: '#999' } }, 
                splitLine: { lineStyle: { color: '#eee' } } 
            },
            series: [{
                name: '营收', type: 'bar', data: values,
                itemStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'#48dbfb'},{offset:1,color:'#667eea'}]) }
            }]
        });
        
        // 强制resize确保正确尺寸
        setTimeout(() => {
            if (this.detailChart) {
                this.detailChart.resize();
            }
        }, 100);
        
        // 自适应
        const handler = () => this.detailChart && this.detailChart.resize();
        window.addEventListener('resize', handler);
        container._resizeHandler = handler;
    }, 50);
};

// 简单转义，防止XSS
CompanyManager.prototype.escapeHtml = function(str) {
    return String(str).replace(/[&<>"']/g, (match) => {
        const escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return escapeMap[match];
    });
};

// 填充基本信息
CompanyManager.prototype.populateBasicInfo = function(company) {
    // 公司名称
    const nameEl = document.getElementById('detailCompanyName');
    if (nameEl) nameEl.textContent = company.name || '未知公司';

    // 投资评分
    const scoreEl = document.getElementById('detailInvestmentScore');
    if (scoreEl) scoreEl.textContent = company.investmentScore !== undefined ? `${company.investmentScore}分` : '未评分';

    // 投资等级
    const levelEl = document.getElementById('detailInvestmentLevel');
    if (levelEl) {
        const level = company.investmentLevel || this.getInvestmentLevel(company.investmentScore);
        levelEl.textContent = level || '未评级';
        levelEl.className = 'info-value level ' + this.getInvestmentClass(level);
    }

    // 创建时间
    const createdEl = document.getElementById('detailCreatedAt');
    if (createdEl) {
        const createdTime = company.createdAt || company.created || new Date().toISOString();
        const date = new Date(createdTime);
        createdEl.textContent = date.toLocaleDateString('zh-CN');
    }

    // 主要业务
    const businessEl = document.getElementById('detailBusiness');
    if (businessEl) businessEl.textContent = company.business || company.mainBusiness || '暂无信息';
};

// 填充风险评估
CompanyManager.prototype.populateRiskAssessment = function(company) {
    const riskLevelEl = document.getElementById('detailRiskLevel');
    const riskIndicatorEl = document.querySelector('#detailRiskLevel .risk-indicator');
    const riskTitleEl = document.getElementById('detailRiskTitle');
    const riskDescriptionEl = document.getElementById('detailRiskDescription');
    const investmentSuggestionEl = document.getElementById('detailInvestmentSuggestion');

    // 根据投资评分计算风险等级
    const score = company.investmentScore || 0;
    let riskLevel, riskColor, riskDescription, suggestion;

    if (score >= 80) {
        riskLevel = '低风险';
        riskColor = '#28a745';
        riskDescription = '该公司财务状况良好，业务稳定，投资风险较低。';
        suggestion = '建议积极投资，可作为核心持仓。';
    } else if (score >= 60) {
        riskLevel = '中等风险';
        riskColor = '#ffc107';
        riskDescription = '该公司基本面尚可，但存在一定不确定性。';
        suggestion = '建议适度投资，注意风险控制。';
    } else if (score >= 40) {
        riskLevel = '较高风险';
        riskColor = '#fd7e14';
        riskDescription = '该公司存在较多风险因素，需要谨慎评估。';
        suggestion = '建议谨慎投资，仅作为小仓位配置。';
    } else {
        riskLevel = '高风险';
        riskColor = '#dc3545';
        riskDescription = '该公司风险较高，投资需要极度谨慎。';
        suggestion = '不建议投资，或仅作为投机性小额投资。';
    }

    if (riskTitleEl) riskTitleEl.textContent = riskLevel;
    if (riskIndicatorEl) riskIndicatorEl.style.backgroundColor = riskColor;
    if (riskDescriptionEl) riskDescriptionEl.textContent = riskDescription;
    if (investmentSuggestionEl) investmentSuggestionEl.textContent = suggestion;
};

// 设置操作按钮
CompanyManager.prototype.setupActionButtons = function(company) {
    const editBtn = document.getElementById('detailEditBtn');
    const compareBtn = document.getElementById('detailCompareBtn');
    const deleteBtn = document.getElementById('detailDeleteBtn');

    if (editBtn) {
        editBtn.onclick = () => {
            this.hideDetailModal();
            this.showModal(company);
        };
    }

    if (compareBtn) {
        compareBtn.onclick = () => {
            // 跳转到比较页面，并传递当前公司ID
            window.open(`pages/compare.html?companyId=${company.id}`, '_blank');
        };
    }

    if (deleteBtn) {
        deleteBtn.onclick = () => {
            if (confirm(`确定要删除公司"${company.name}"吗？此操作不可撤销。`)) {
                this.hideDetailModal();
                this.deleteCompanyById(company.id);
            }
        };
    }
};

// 删除指定公司
CompanyManager.prototype.deleteCompanyById = async function(companyId) {
    try {
        const result = await this.apiCall(`/api/companies/${companyId}`, {
            method: 'DELETE'
        });

        if (result.success) {
            await this.loadCompanies();
        }
    } catch (error) {
        console.error('删除公司失败:', error);
        this.showError('删除公司失败，请重试');
    }
};

// 设置编辑功能
CompanyManager.prototype.setupEditFunctions = function(company) {
    // 利好消息编辑
    this.setupFavorableEdit(company);
    // 年度营收编辑
    this.setupRevenueEdit(company);
    // 其他信息编辑
    this.setupOtherEdit(company);
};

// 利好消息编辑功能
CompanyManager.prototype.setupFavorableEdit = function(company) {
    const editBtn = document.getElementById('editFavorableBtn');
    const editArea = document.getElementById('detailFavorableEdit');
    const textarea = document.getElementById('favorableTextarea');
    const saveBtn = document.getElementById('saveFavorableBtn');
    const cancelBtn = document.getElementById('cancelFavorableBtn');
    const listEl = document.getElementById('detailFavorableList');
    const emptyEl = document.getElementById('detailFavorableEmpty');

    if (!editBtn || !editArea || !textarea || !saveBtn || !cancelBtn) return;

    editBtn.onclick = () => {
        // 显示编辑区域
        editArea.style.display = 'block';
        listEl.style.display = 'none';
        emptyEl.style.display = 'none';
        
        // 填充当前数据
        const favorable = Array.isArray(company.favorableNews) 
            ? company.favorableNews 
            : (Array.isArray(company.favorable) ? company.favorable : []);
        textarea.value = favorable.join('\n');
        textarea.focus();
    };

    cancelBtn.onclick = () => {
        editArea.style.display = 'none';
        this.showFavorableContent(company);
    };

    saveBtn.onclick = async () => {
        const newFavorable = textarea.value.split('\n').filter(item => item.trim());
        
        try {
            const result = await this.apiCall(`/api/companies/${company.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    ...company,
                    favorableNews: newFavorable
                })
            });

            if (result.success) {
                company.favorableNews = newFavorable;
                editArea.style.display = 'none';
                this.showFavorableContent(company);
                await this.loadCompanies(); // 刷新列表
            }
        } catch (error) {
            console.error('保存利好消息失败:', error);
            this.showError('保存失败，请重试');
        }
    };
};

// 年度营收编辑功能
CompanyManager.prototype.setupRevenueEdit = function(company) {
    const editBtn = document.getElementById('editRevenueBtn');
    const editArea = document.getElementById('detailRevenueEdit');
    const saveBtn = document.getElementById('saveRevenueBtn');
    const cancelBtn = document.getElementById('cancelRevenueBtn');
    const chartEl = document.getElementById('detailRevenueChart');
    const emptyEl = document.getElementById('detailRevenueEmpty');

    if (!editBtn || !editArea || !saveBtn || !cancelBtn) return;

    editBtn.onclick = () => {
        // 显示编辑区域
        editArea.style.display = 'block';
        chartEl.style.display = 'none';
        emptyEl.style.display = 'none';
        
        // 填充当前数据
        const revenue = company.revenue || {};
        document.getElementById('revenue2021').value = revenue['2021'] || '';
        document.getElementById('revenue2022').value = revenue['2022'] || '';
        document.getElementById('revenue2023').value = revenue['2023'] || '';
        document.getElementById('revenue2024').value = revenue['2024'] || '';
    };

    cancelBtn.onclick = () => {
        editArea.style.display = 'none';
        this.showRevenueContent(company);
    };

    saveBtn.onclick = async () => {
        const newRevenue = {
            '2021': parseFloat(document.getElementById('revenue2021').value) || 0,
            '2022': parseFloat(document.getElementById('revenue2022').value) || 0,
            '2023': parseFloat(document.getElementById('revenue2023').value) || 0,
            '2024': parseFloat(document.getElementById('revenue2024').value) || 0
        };
        
        try {
            const result = await this.apiCall(`/api/companies/${company.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    ...company,
                    revenue: newRevenue
                })
            });

            if (result.success) {
                company.revenue = newRevenue;
                editArea.style.display = 'none';
                this.showRevenueContent(company);
                await this.loadCompanies(); // 刷新列表
            }
        } catch (error) {
            console.error('保存年度营收失败:', error);
            this.showError('保存失败，请重试');
        }
    };
};

// 其他信息编辑功能
CompanyManager.prototype.setupOtherEdit = function(company) {
    const editBtn = document.getElementById('editOtherBtn');
    const editArea = document.getElementById('detailOtherEdit');
    const textarea = document.getElementById('otherTextarea');
    const saveBtn = document.getElementById('saveOtherBtn');
    const cancelBtn = document.getElementById('cancelOtherBtn');
    const otherEl = document.getElementById('detailOther');

    if (!editBtn || !editArea || !textarea || !saveBtn || !cancelBtn) return;

    editBtn.onclick = () => {
        // 显示编辑区域
        editArea.style.display = 'block';
        otherEl.style.display = 'none';
        
        // 填充当前数据
        textarea.value = company.other || company.notes || '';
        textarea.focus();
    };

    cancelBtn.onclick = () => {
        editArea.style.display = 'none';
        otherEl.style.display = 'block';
    };

    saveBtn.onclick = async () => {
        const newOther = textarea.value.trim();
        
        try {
            const result = await this.apiCall(`/api/companies/${company.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    ...company,
                    other: newOther
                })
            });

            if (result.success) {
                company.other = newOther;
                editArea.style.display = 'none';
                otherEl.style.display = 'block';
                otherEl.textContent = newOther || '暂无数据';
                await this.loadCompanies(); // 刷新列表
            }
        } catch (error) {
            console.error('保存其他信息失败:', error);
            this.showError('保存失败，请重试');
        }
    };
};

// 显示利好消息内容
CompanyManager.prototype.showFavorableContent = function(company) {
    const listEl = document.getElementById('detailFavorableList');
    const emptyEl = document.getElementById('detailFavorableEmpty');
    const favorable = Array.isArray(company.favorableNews)
        ? company.favorableNews
        : (Array.isArray(company.favorable) ? company.favorable : []);
    
    if (favorable && favorable.length > 0) {
        listEl.innerHTML = favorable.map((item) => `<li>${this.escapeHtml(String(item))}</li>`).join('');
        listEl.style.display = '';
        emptyEl.style.display = 'none';
    } else {
        listEl.innerHTML = '';
        listEl.style.display = 'none';
        emptyEl.style.display = '';
    }
};

// 显示年度营收内容
CompanyManager.prototype.showRevenueContent = function(company) {
    const revenueChartEl = document.getElementById('detailRevenueChart');
    const emptyRevEl = document.getElementById('detailRevenueEmpty');
    const revenueData = this.normalizeRevenue(company);
    
    if (revenueData.length > 0) {
        emptyRevEl.style.display = 'none';
        revenueChartEl.style.display = '';
        this.renderRevenueChart(revenueChartEl, revenueData);
    } else {
        // 清理可能存在的图表
        if (this.detailChart) {
            this.detailChart.dispose();
            this.detailChart = null;
        }
        revenueChartEl.style.display = 'none';
        emptyRevEl.style.display = '';
    }
};
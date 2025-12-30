// === 完整的 Markdown 简易解析器 ===
export function simpleMarkdownParser(text) {
    if (text === null || text === undefined) return '';
    let html = String(text);

    // 1. 处理 <think> 标签 (深度思考)
    html = html.replace(
        /<think>([\s\S]*?)<\/think>/gi, 
        '<details class="think-box"><summary class="think-title">点击查看深度思考过程...</summary>$1</details>'
    );

    // 2. 提取代码块 (防止被后续的 markdown 符号误伤)
    const codeBlocks = [];
    html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
        // 转义 HTML 字符
        const safeCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        codeBlocks.push(safeCode); 
        return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    // 3. 处理表格和行级元素
    const lines = html.split('\n');
    let inTable = false;
    let tableHtml = '';
    let newLines = [];

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        
        // 简单的表格识别逻辑
        if (line.startsWith('|') && line.endsWith('|')) {
            if (!inTable) { inTable = true; tableHtml = '<table>'; }
            
            // 忽略分隔行 (例如 |---|---|)
            if (line.includes('---')) {
                // do nothing
            } else {
                const cells = line.split('|').filter(c => c.trim() !== '');
                tableHtml += '<tr>';
                cells.forEach(cell => {
                    tableHtml += `<td>${cell.trim()}</td>`;
                });
                tableHtml += '</tr>';
            }
        } else {
            // 如果刚刚在处理表格，现在这一行不是表格了，结束表格
            if (inTable) {
                tableHtml += '</table>';
                newLines.push(tableHtml);
                inTable = false;
                tableHtml = '';
            }
            newLines.push(line);
        }
    }
    // 防止最后一行是表格
    if (inTable) { newLines.push(tableHtml + '</table>'); }
    
    html = newLines.join('\n');

    // 4. 常见 Markdown 格式
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^\- (.*$)/gim, '<ul><li>$1</li></ul>');
    // 合并相邻的 ul (简易处理)
    html = html.replace(/<\/ul>\n<ul>/g, ''); 
    
    // 5. 还原代码块
    html = html.replace(/__CODE_BLOCK_(\d+)__/g, (match, index) => {
        return `<pre><code>${codeBlocks[index]}</code></pre>`;
    });
    
    // 6. 换行处理
    html = html.replace(/\n/g, '<br>');
    return html;
}

// === 报告卡片渲染器 ===
export function renderReportCard(data) {
    const isPrediction = data.hasOwnProperty("成矿概率");

    if (isPrediction) {
        const prob = data["成矿概率"] || "未知";
        let stampClass = "stamp-low";
        if (prob.includes("高")) stampClass = "stamp-high";
        else if (prob.includes("中")) stampClass = "stamp-med";

        return `
        <div class="report-card">
            <div class="stamp-badge ${stampClass}">成矿概率：${prob}</div>
            <h3 style="color:#fff; margin-bottom:20px; border-bottom:1px solid #555; padding-bottom:12px; font-size: 20px;">
                <i class="fas fa-clipboard-check"></i> 综合评价报告
            </h3>
            <div class="report-section">
                <div class="report-title" style="color: #2ecc71"><i class="fas fa-crosshairs"></i> 有利部位 (Targeting)</div>
                <div class="report-text highlight-loc">${data["有利部位"] || "未指定"}</div>
            </div>
            <div class="report-section">
                <div class="report-title" style="color: #3498db"><i class="fas fa-brain"></i> 成矿解释 (Interpretation)</div>
                <div class="report-text">${data["成矿解释"] || "无详细解释"}</div>
            </div>
            <div class="report-section">
                <div class="report-title" style="color: #f1c40f"><i class="fas fa-step-forward"></i> 下一步建议 (Next Steps)</div>
                <div class="report-text">${data["下一步建议"] || "无建议"}</div>
            </div>
        </div>
        `;
    } else {
        return `
        <div class="report-card general-mode">
            <div class="stamp-badge stamp-info">知识综述</div>
            <h3 style="color:#fff; margin-bottom:20px; border-bottom:1px solid #555; padding-bottom:12px; font-size: 20px;">
                <i class="fas fa-graduation-cap"></i> 地质知识研讨摘要
            </h3>
            
            <div class="report-section">
                <div class="report-title" style="color: #3498db"><i class="fas fa-lightbulb"></i> 核心结论 (Summary)</div>
                <div class="report-text">${data["研讨总结"] || data["summary"] || "无总结"}</div>
            </div>

            <div class="report-section">
                <div class="report-title" style="color: #9b59b6"><i class="fas fa-tags"></i> 关键概念与知识点</div>
                <div class="report-text">${data["关键知识点"] || data["key_points"] || "无"}</div>
            </div>

            <div class="report-section">
                <div class="report-title" style="color: #7f8c8d"><i class="fas fa-database"></i> 支撑与引用 (Reference)</div>
                <div class="report-text" style="font-size:14px; color:#aaa;">${data["数据支撑"] || data["reference"] || "基于专家通用知识库"}</div>
            </div>
        </div>
        `;
    }
}
import { AGENTS } from './config.js';
import { state } from './state.js';
import { simpleMarkdownParser } from './utils.js';

const chatStream = document.getElementById('chat-stream');

// === 核心：添加消息到聊天窗口 ===
export function appendMessage(text, agentKey, type = 'agent', references = null) {
    const div = document.createElement('div');
    div.className = `message ${type}`;
    
    let avatarClass = 'c-general';
    let iconClass = 'fa-user';
    let name = '用户';
    let roleTextClass = '';

    // 1. 确定角色样式
    if (type === 'agent' && AGENTS[agentKey]) {
        const agent = AGENTS[agentKey];
        avatarClass = agent.class;
        iconClass = agent.icon;
        name = agent.name;
        roleTextClass = agent.roleText;
    } else if (type === 'system') {
        avatarClass = 'c-system';
        iconClass = 'fa-cog';
        name = '系统通知';
    } else if (type === 'user') {
        roleTextClass = 't-general';
    }

    // 2. 解析内容
    const htmlContent = simpleMarkdownParser(text);
    
    // 3. 渲染引用来源 (如果有)
    let refHtml = renderReferences(references); 

    // 4. 组装 HTML
    div.innerHTML = `
        <div class="avatar ${type === 'user' ? 'c-general' : avatarClass}" style="${type === 'user' ? 'background:#34495e':''}">
            <i class="fas ${iconClass}"></i>
        </div>
        <div class="content">
            <span class="sender-tag ${roleTextClass}">${name}</span>
            ${htmlContent}
            ${refHtml}
        </div>
    `;
    
    // 5. 插入 DOM 并滚动到底部
    chatStream.appendChild(div);
    chatStream.scrollTop = chatStream.scrollHeight;
    
    // 6. 保存到历史记录 (系统消息除外)
    if (type !== 'system') {
        state.contextHistory.push({
            role: type === 'user' ? '用户' : (AGENTS[agentKey] ? AGENTS[agentKey].name : '未知'),
            key: agentKey, 
            content: (typeof text === 'string') ? text : JSON.stringify(text) 
        });
    }
}

// === 辅助：渲染引用来源折叠框 ===
function renderReferences(references) {
    if (!references || !Array.isArray(references) || references.length === 0) return '';
    
    const listItems = references.map(ref => {
        const docName = ref.document_name || ref.doc_name || "未知文档";
        // 兼容不同的后端返回字段
        const content = ref.content_with_weight || ref.content || "无内容摘要";
        const sim = ref.similarity ? (ref.similarity * 100).toFixed(1) + '%' : '';
        
        return `
            <div class="ref-item">
                <div class="ref-header">
                    <span class="ref-doc-name"><i class="far fa-file-alt"></i> ${docName}</span>
                    ${sim ? `<span class="ref-sim">${sim}</span>` : ''}
                </div>
                <div class="ref-content-text">${content}</div>
            </div>
        `;
    }).join('');

    return `
        <div class="ref-wrapper">
            <details class="ref-box">
                <summary class="ref-summary">
                    <i class="fas fa-quote-right"></i> 
                    <span>参考了 ${references.length} 处知识库来源</span>
                </summary>
                <div class="ref-list">
                    ${listItems}
                </div>
            </details>
        </div>
    `;
}

// === 显示加载动画 ===
export function showLoading(agentKey) {
    const div = document.createElement('div');
    div.id = `loading-${agentKey}`;
    div.className = `message agent`;
    
    // 注意：这里用到了 AGENTS 配置
    const agent = AGENTS[agentKey] || { class: 'c-system', icon: 'fa-spinner', name: '系统' };

    div.innerHTML = `
        <div class="avatar ${agent.class} thinking"><i class="fas ${agent.icon}"></i></div>
        <div class="content" style="color:#aaa; font-style:italic;">
            <i class="fas fa-circle-notch fa-spin"></i> ${agent.name} 正在思考...
        </div>
    `;
    chatStream.appendChild(div);
    chatStream.scrollTop = chatStream.scrollHeight;
}

// === 移除加载动画 ===
export function removeLoading(agentKey) {
    const el = document.getElementById(`loading-${agentKey}`);
    if (el) el.remove();
}

// === 仅清空屏幕 ===
export function clearChatUIOnly() {
    if(confirm('仅清空屏幕？(历史记忆将保留)')) {
        chatStream.innerHTML = '';
        const div = document.createElement('div');
        div.className = 'message agent';
        div.innerHTML = `<div class="avatar c-host"><i class="fas fa-eraser"></i></div><div class="content">屏幕已清空。</div>`;
        chatStream.appendChild(div);
    }
}
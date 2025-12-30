import { AGENTS, MAX_DEBATE_ROUNDS } from './config.js';
import { state } from './state.js';
import { appendMessage, showLoading, removeLoading } from './ui.js';
import { callAgent, createRemoteSession } from './api.js';
import { renderReportCard } from './utils.js';

// === 辅助：构建历史上下文字符串 ===
function buildContextString() {
    if (state.contextHistory.length === 0) return "";
    return state.contextHistory.map(item => {
        const idInfo = item.key ? ` (ID: ${item.key})` : "";
        return `【${item.role}${idInfo}】:\n${item.content}`;
    }).join("\n\n");
}

// === 辅助：Prompt 增强 (文件内容注入) ===
function getAugmentedPrompt(originalPrompt) {
    if (state.isFileEnabled && state.globalFileContent) {
        return originalPrompt + "\n\n【全局外部参考资料(用户上传)】:\n" + state.globalFileContent + "\n\n(请结合以上资料和你的知识库进行回答)";
    }
    return originalPrompt;
}

// ==========================================
// 功能 1：自动研讨流程
// ==========================================
export async function triggerDebateFlow() {
    const userInput = document.getElementById('user-input');
    const mainBtn = document.getElementById('btn-auto-main');
    const query = userInput.value.trim();

    // 校验：既没输入也没历史，不许开始
    if (!query && state.contextHistory.length === 0) { alert("请输入研讨主题"); return; }
    if (state.isDebating) return;
    
    state.isDebating = true;
    mainBtn.disabled = true;
    state.debateRound = 0;

    // 用户有输入，先上屏
    if (query) {
        appendMessage(query, null, 'user');
        userInput.value = '';
    }

    try {
        appendMessage("正在通知所有专家进行独立分析...", null, 'system');
        let initialPrompt = `用户问题：${query}\n请仅根据你的专业知识库进行分析和回答。`;
        initialPrompt = getAugmentedPrompt(initialPrompt);

        // 并发调用四位专家
        const experts = ['general', 'geophysical', 'geochemical', 'achievement'];
        await Promise.all(experts.map(key => callAgent(key, initialPrompt)));
        
        // 进入主持人循环
        await hostEvaluationLoop();
    } catch (e) {
        appendMessage("研讨流程异常: " + e.message, null, 'system');
    } finally {
        state.isDebating = false;
        mainBtn.disabled = false;
    }
}

// ==========================================
// 功能 2：主持人循环逻辑 (已包含完整长Prompt)
// ==========================================
async function hostEvaluationLoop() {
    while (state.debateRound < MAX_DEBATE_ROUNDS) {
        state.debateRound++;
        const history = buildContextString();
        
        let hostPrompt = `
            你是研讨会的主持人。
            【任务】审视历史，若存在观点冲突或证据不足，请追问特定专家；若结论清晰，请总结。
                你的目标是挖掘最深层的地质逻辑。
                当涉及到矿区预测问题，各个专家给出的矿区不完全一样时，你要针对不一样的地方追问相应专家，要求他们给出合理解释。
                1. 找出目前回答中【最薄弱】或【最缺乏证据】的观点。
                2. 指定一位专家，要求他提供具体的案例或数据支持。
                3.每次追问一位专家，但至少总计要进行两次追问。
                当不涉及到矿区预测问题，正常分析总结，但仍要追问有冲突的地方。
            【追问策略】
             - 不要接受笼统的回答。
             【总结策略】
             - 总结要尽可能详细，全面。                    
            【判断】
            1. 如果这是【成矿预测/找矿】任务：请在 FINISH 时输出 JSON 格式 A。
            2. 如果这是【通用地质/科普/查询】任务：请在 FINISH 时输出 JSON 格式 B。
            
            【输出格式】必须是 Strict JSON：
            {"action": "ASK", "target": "expert_key", "content": "question"} 
            OR 
            {"action": "FINISH", "content": JSON_OBJECT}

            其中 JSON_OBJECT 的格式：
            [格式A - 预测]: {"成矿概率": "高/中/低", "有利部位": "...", "成矿解释": "...", "下一步建议": "..."}
            [格式B - 通用]: {"研讨总结": "...", "关键知识点": "...", "数据支撑": "..."}

            【专家Key】general, geophysical, geochemical, achievement
            历史：${history}
        `;
        
        hostPrompt = getAugmentedPrompt(hostPrompt);

        // 调用主持人
        showLoading('host');
        let hostResponse = await callAgent('host', hostPrompt, true);
        removeLoading('host');
        
        if (!hostResponse) break;

        // === 复杂的指令解析逻辑 ===
        let command = null;
        try {
            // 1. 尝试清洗 Markdown 代码块标记
            const jsonStr = hostResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            // 2. 尝试解析 JSON
            command = JSON.parse(jsonStr);
        } catch(e) {
            // 3. JSON解析失败，尝试正则回退匹配
            const askMatch = hostResponse.match(/CMD:\s*ASK\s+(\w+)\s+(.+)/i);
            if (askMatch) {
                command = { action: 'ASK', target: askMatch[1], content: askMatch[2] };
            } else if (hostResponse.includes("CMD: FINISH")) {
                command = { action: 'FINISH', content: hostResponse.replace("CMD: FINISH", "") };
            }
        }

        // === 执行指令 ===
        if (command) {
            if (command.action === 'FINISH') {
                let finalContent = command.content;
                // 如果 content 也是对象，说明是结构化报告，进行渲染
                if (typeof finalContent === 'object' && finalContent !== null) {
                    finalContent = renderReportCard(finalContent);
                }
                appendMessage(finalContent, 'host');
                appendMessage("✅ 研讨结束。", null, 'system');
                break; // 退出循环
            } else if (command.action === 'ASK') {
                const target = command.target.toLowerCase();
                const validKey = Object.keys(AGENTS).find(k => k.toLowerCase() === target) || target;
                
                if (AGENTS[validKey]) {
                    appendMessage(`(追问 ${AGENTS[validKey].name}) ${command.content}`, 'host');
                    
                    let askPrompt = `主持人追问：${command.content}`;
                    askPrompt = getAugmentedPrompt(askPrompt);
                    await callAgent(validKey, askPrompt);
                } else {
                    appendMessage(hostResponse, 'host'); 
                    break;
                }
            }
        } else {
            appendMessage(hostResponse, 'host'); 
            break;
        }
        
        await new Promise(r => setTimeout(r, 1000));
    }
}

// ==========================================
// 功能 3：手动触发单个 Agent
// ==========================================
export async function manualTrigger(agentKey) {
    const userInput = document.getElementById('user-input');
    const q = userInput.value.trim();
    let prompt = q ? `用户提问：${q}\n历史：${buildContextString()}` : `请基于历史发言。\n历史：${buildContextString()}`;
    
    prompt = getAugmentedPrompt(prompt);

    if(q) { appendMessage(`(指定) ${q}`, null, 'user'); userInput.value = ''; }
    await callAgent(agentKey, prompt);
}

// ==========================================
// 功能 4：主持人强行干预 (已包含完整长Prompt)
// ==========================================
export async function triggerHostIntervention() {
    const userInput = document.getElementById('user-input');
    const instruction = userInput.value.trim();
    if (!instruction) { alert("请输入指令"); return; }
    
    appendMessage(`(干预指令) ${instruction}`, null, 'user');
    userInput.value = '';

    let interventionPrompt = `
        【最高优先级指令】用户刚刚介入并下达了指令：
        "${instruction}"
        请立即执行该指令。必须输出标准 JSON 指令 {"action": "ASK"...} 或直接回复。
        历史参考：
        ${buildContextString()}
    `;
    
    interventionPrompt = getAugmentedPrompt(interventionPrompt);

    showLoading('host');
    const hostResponse = await callAgent('host', interventionPrompt, true);
    removeLoading('host');

    if (!hostResponse) return;

    let command = null;
    try {
        const jsonStr = hostResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const firstBrace = jsonStr.indexOf('{');
        const lastBrace = jsonStr.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            command = JSON.parse(jsonStr.substring(firstBrace, lastBrace + 1));
        }
    } catch (e) {
        console.warn("解析干预响应失败，将直接作为普通回复显示");
    }

    if (command && command.action === 'ASK') {
        const target = command.target.toLowerCase();
        const validKey = Object.keys(AGENTS).find(k => k.toLowerCase() === target) || target;
        if (AGENTS[validKey]) {
            appendMessage(`(执行干预: 追问 ${AGENTS[validKey].name}) ${command.content}`, 'host');
            let askPrompt = `主持人根据用户干预向你提问：${command.content}\n请基于历史回答。`;
            askPrompt = getAugmentedPrompt(askPrompt);
            await callAgent(validKey, askPrompt);
        }
    } else {
        appendMessage(hostResponse, 'host');
    }
}

// ==========================================
// 功能 5：文件上传
// ==========================================
export function handleFileUpload(file) {
    const nameDisplay = document.getElementById('file-name-display');
    const toggleBtn = document.getElementById('btn-toggle-file');
    
    if (!file) return;
    nameDisplay.textContent = `加载中: ${file.name}`;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        state.globalFileContent = e.target.result;
        nameDisplay.textContent = `已就绪: ${file.name}`;
        toggleBtn.disabled = false;
        
        // 默认自动开启并通知
        if (!state.isFileEnabled) {
            toggleFileContext();
        }
        
        appendMessage(`📁 文件已加载: **${file.name}**\n已启用为全局研讨资料。`, null, 'system');
    };
    reader.onerror = function() {
        nameDisplay.textContent = "读取失败";
        appendMessage(`❌ 读取文件失败`, null, 'system');
    };
    reader.readAsText(file);
}

// ==========================================
// 功能 6：文件引用开关 (带系统通知)
// ==========================================
export function toggleFileContext() {
    if (!state.globalFileContent) return;
    state.isFileEnabled = !state.isFileEnabled;
    const btn = document.getElementById('btn-toggle-file');
    const icon = btn.querySelector('i');
    const span = btn.querySelector('span');
    
    if (state.isFileEnabled) {
        btn.classList.add('active');
        icon.className = 'fas fa-toggle-on';
        span.textContent = "文件已启用";
        appendMessage('系统通知：文件引用已启用。接下来的回答将参考该文件。', null, 'system');
    } else {
        btn.classList.remove('active');
        icon.className = 'fas fa-toggle-off';
        span.textContent = "文件未启用";
        appendMessage('系统通知：文件引用已禁用。', null, 'system');
    }
}

// ==========================================
// 功能 7：刷新会话
// ==========================================
export async function refreshAllSessionsLogic() {
    state.contextHistory = [];
    document.getElementById('chat-stream').innerHTML = '';
    
    const keys = Object.keys(AGENTS);
    const promises = keys.map(key => createRemoteSession(key));
    const newIds = await Promise.all(promises);
    
    let successCount = 0;
    keys.forEach((key, index) => {
        if (newIds[index]) {
            AGENTS[key].sessionId = newIds[index];
            successCount++;
        } else {
            AGENTS[key].sessionId = null;
        }
    });

    const div = document.createElement('div');
    div.className = 'message agent';
    div.innerHTML = `<div class="avatar c-host"><i class="fas fa-check-circle"></i></div><div class="content"><strong>会话已重置</strong><br>已成功为 ${successCount} 位专家申请新ID。</div>`;
    document.getElementById('chat-stream').appendChild(div);
}
import { API_BASE, API_TOKEN, AGENTS } from './config.js';
import { appendMessage, showLoading, removeLoading } from './ui.js';

export async function createRemoteSession(agentKey) {
    const agent = AGENTS[agentKey];
    try {
        const response = await fetch(`${API_BASE}/${agent.id}/sessions`, {
            method: 'POST',
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_TOKEN}` },
            body: JSON.stringify({ name: "Session " + new Date().toLocaleTimeString() }) 
        });
        const data = await response.json();
        if (data.code === 0 && data.data) return data.data.id; 
        return null;
    } catch (e) {
        console.error(`[Session Error] ${agent.name}:`, e);
        return null;
    }
}

export async function callAgent(agentKey, promptText, hidden = false) {
    if (!hidden) showLoading(agentKey);
    const agent = AGENTS[agentKey];
    
    try {
        const payload = { "question": promptText, "stream": false };
        if (agent.sessionId) payload.session_id = agent.sessionId;

        const response = await fetch(`${API_BASE}/${agent.id}/completions`, {
            method: 'POST',
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_TOKEN}` },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!hidden) removeLoading(agentKey);

        if (data.code === 0 && data.data) {
            if (data.data.session_id) agent.sessionId = data.data.session_id;
            
            let answer = data.data.answer || "无回复";
            let refs = data.data.reference;
            if (refs && !Array.isArray(refs) && refs.chunks) refs = refs.chunks;

            if (!hidden) appendMessage(answer, agentKey, 'agent', refs);
            return answer;
        } else {
            if (!hidden) appendMessage(`⚠️ 错误: ${data.message || "未知API错误"}`, agentKey, 'system');
            return null;
        }
    } catch (e) {
        if (!hidden) removeLoading(agentKey);
        if (!hidden) appendMessage(`❌ 请求失败: ${e.message}`, agentKey, 'system');
        return null;
    }
}
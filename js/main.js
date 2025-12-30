import { appendMessage, clearChatUIOnly } from './ui.js';
import { 
    triggerDebateFlow, 
    manualTrigger, 
    handleFileUpload, 
    toggleFileContext, 
    refreshAllSessionsLogic,
    triggerHostIntervention // ✅ 新增：导入干预逻辑
} from './logic.js';

// 初始化函数
function init() {
    console.log("System Initializing...");
    
    // 1. 显示初始欢迎语
    appendMessage('欢迎使用地质成矿预测系统。请点击 <strong>[新建会话]</strong>，然后输入目标区域或问题。', 'host');

    // 2. 绑定事件监听器 (替代 HTML 中的 onclick)
    
    // === 自动研讨流程 ===
    const btnDebate = document.getElementById('btn-debate');
    if (btnDebate) btnDebate.addEventListener('click', triggerDebateFlow);

    const btnAutoMain = document.getElementById('btn-auto-main');
    if (btnAutoMain) btnAutoMain.addEventListener('click', triggerDebateFlow);

    // === 基础功能 ===
    const btnClear = document.getElementById('btn-clear-ui');
    if (btnClear) btnClear.addEventListener('click', clearChatUIOnly);
    
    // === 刷新会话 (带 Loading 状态处理) ===
    const btnRefresh = document.getElementById('btn-refresh-sessions');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const originalHTML = btn.innerHTML;
            // 按钮变态：禁用并显示转圈
            btn.disabled = true;
            btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> 申请ID中...`;
            
            await refreshAllSessionsLogic();
            
            // 恢复按钮
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        });
    }

    // === 手动点名 (批量绑定) ===
    document.querySelectorAll('.manual-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.getAttribute('data-key');
            manualTrigger(key);
        });
    });

    // === 主持人紧急干预 (修复版) ===
    const btnIntervention = document.getElementById('btn-host-intervention');
    if (btnIntervention) {
        btnIntervention.addEventListener('click', triggerHostIntervention);
    }

    // === 文件上传功能 ===
    const fileInput = document.getElementById('file-upload-input');
    const btnTriggerUpload = document.getElementById('btn-trigger-upload');
    const btnToggleFile = document.getElementById('btn-toggle-file');

    if (btnTriggerUpload && fileInput) {
        btnTriggerUpload.addEventListener('click', () => fileInput.click());
    }
    
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileUpload(e.target.files[0]);
            }
        });
    }

    if (btnToggleFile) {
        btnToggleFile.addEventListener('click', toggleFileContext);
    }
}

// 等待 DOM 加载完毕后启动
document.addEventListener('DOMContentLoaded', init);
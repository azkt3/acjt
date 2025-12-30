        // 用户输入处理函数

// 发送用户自定义输入
async function sendUserInput() {
    const inputBox = document.getElementById('userInput');
    let userText = inputBox.value.trim();

    if (!userText) {
        alert('请输入内容！');
        return;
    }

    if (gameState.isProcessing) return;

    if (!gameState.isGameStarted) {
        alert('请先创建角色并开始游戏！');
        return;
    }

    // 🆕 自动附加操作缓存
    const actionsSummary = getPendingActionsSummary();
    if (actionsSummary) {
        userText = actionsSummary + userText;
    }

    // 🆕 在控制台显示完整的用户输入
    console.log('📤 [用户输入]', userText);

    // 清空输入框
    inputBox.value = '';

    gameState.isProcessing = true;

    // 显示用户输入
    displayUserMessage(userText);

    // 添加到历史记录
    gameState.conversationHistory.push({
        role: 'user',
        content: userText
    });

    // 保存当前变量快照（用户消息）
    gameState.variableSnapshots.push(JSON.parse(JSON.stringify(gameState.variables)));

    // 🆕 清空操作缓存
    clearPendingActions();

    // 保存游戏历史
    saveGameHistory().catch(err => console.error('保存历史失败:', err));

    // 显示加载提示
    const historyDiv = document.getElementById('gameHistory');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message ai-message';
    loadingDiv.innerHTML = '<div class="message-content"><span class="loading"></span> AI思考中...</div>';
    loadingDiv.id = 'loading-message';
    historyDiv.appendChild(loadingDiv);
    historyDiv.scrollTop = historyDiv.scrollHeight;

    try {
        // 🎭 用户输入分析（如果启用）
        let userProfileEnhancement = '';
        if (window.userProfileAnalyzer && window.userProfileAnalyzer.isEnabled()) {
            console.log('[🎭用户画像] 正在分析用户输入...');
            
            // 更新加载提示
            const loadingEl = document.getElementById('loading-message');
            if (loadingEl) {
                loadingEl.innerHTML = '<div class="message-content"><span class="loading"></span> 正在分析用户意图...</div>';
            }
            
            try {
                // 构建游戏上下文（传递给分析API）
                const gameContext = {
                    currentLocation: gameState.variables.location || '未知',
                    currentScene: gameState.conversationHistory.slice(-2).map(h => h.content?.substring(0, 200)).join('\n'),
                    characterName: gameState.variables.name || '未知',
                    realm: gameState.variables.realm || '凡人'
                };
                
                const analysisResult = await window.userProfileAnalyzer.analyze(userText, gameContext);
                
                if (analysisResult) {
                    userProfileEnhancement = window.userProfileAnalyzer.getEnhancedPrompt(analysisResult);
                    console.log('[🎭用户画像] 分析完成，增强提示已生成');
                }
            } catch (analysisError) {
                console.warn('[🎭用户画像] 分析失败，将使用原始输入:', analysisError);
            }
            
            // 恢复加载提示
            if (loadingEl) {
                loadingEl.innerHTML = '<div class="message-content"><span class="loading"></span> AI思考中...</div>';
            }
        }
        
        // 🎯 使用统一函数构建增强提示
        let enhancedInput = buildEnhancedPrompt(userText);
        
        // 🎭 如果有用户画像增强，添加到提示中
        if (userProfileEnhancement) {
            enhancedInput = userProfileEnhancement + '\n\n---\n\n' + enhancedInput;
        }

        // 🆕 在控制台显示完整的增强提示
        console.log('📤 [原始用户输入]', userText);
        if (userProfileEnhancement) {
            console.log('🎭 [用户画像增强]', userProfileEnhancement);
        }
        console.log('🤖 [发送给AI的完整Prompt]', enhancedInput);

        // 🔧 传入原始用户输入（用于向量检索）
        const response = await callAI(enhancedInput, false, userText);

        // 移除加载提示
        const loading = document.getElementById('loading-message');
        if (loading) loading.remove();

        handleAIResponse(response);

        // 触发动态世界生成（异步，不阻塞主流程）
        generateDynamicWorld().catch(err => console.error('[动态世界] 生成异常:', err));

        // 📨 触发好友自动消息（异步，不阻塞主流程）
        if (typeof window.generateAutoFriendMessage === 'function') {
            window.generateAutoFriendMessage().catch(err => console.error('[📨好友自动消息] 生成异常:', err));
        }

    } catch (error) {
        // 移除加载提示
        const loading = document.getElementById('loading-message');
        if (loading) loading.remove();

        // ❌ 不要移除用户消息！显示错误和重试按钮
        displayErrorMessageWithRetry('AI响应失败：' + error.message, async () => {
            // 移除错误消息
            const errorDiv = document.getElementById('error-message-with-retry');
            if (errorDiv) errorDiv.remove();
            
            // 重新生成最后的响应
            await regenerateLastResponse();
        });
    }

    gameState.isProcessing = false;
}

// 创建思维链显示组件
        function createReasoningDisplay(reasoning) {
            const container = document.createElement('div');
            container.className = 'reasoning-container';

            // 创建可折叠的标题
            const header = document.createElement('div');
            header.className = 'reasoning-header';
            header.innerHTML = `
                <span>🧠 AI思维链</span>
                <span class="reasoning-toggle">点击展开/折叠</span>
            `;

            // 创建内容区域
            const content = document.createElement('div');
            content.className = 'reasoning-content';

            // 情况分析
            if (reasoning.situation) {
                const section = document.createElement('div');
                section.className = 'reasoning-section';
                section.innerHTML = `
                    <div class="reasoning-section-title">📊 情况分析</div>
                    <div class="reasoning-text">${reasoning.situation}</div>
                `;
                content.appendChild(section);
            }

            // 玩家选择分析
            if (reasoning.playerChoice) {
                const section = document.createElement('div');
                section.className = 'reasoning-section';
                section.innerHTML = `
                    <div class="reasoning-section-title">🎯 选择分析</div>
                    <div class="reasoning-text">${reasoning.playerChoice}</div>
                `;
                content.appendChild(section);
            }

            // 推理链条
            if (reasoning.logicChain && Array.isArray(reasoning.logicChain)) {
                const section = document.createElement('div');
                section.className = 'reasoning-section';
                section.innerHTML = `<div class="reasoning-section-title">🔗 推理步骤</div>`;
                
                const list = document.createElement('ul');
                list.className = 'reasoning-chain';
                reasoning.logicChain.forEach((step, index) => {
                    const li = document.createElement('li');
                    li.textContent = step;
                    list.appendChild(li);
                });
                section.appendChild(list);
                content.appendChild(section);
            }

            // 最终决策
            if (reasoning.outcome) {
                const section = document.createElement('div');
                section.className = 'reasoning-section';
                section.innerHTML = `
                    <div class="reasoning-section-title">✅ 最终决策</div>
                    <div class="reasoning-text">${reasoning.outcome}</div>
                `;
                content.appendChild(section);
            }

            // 添加点击事件来折叠/展开
            header.onclick = () => {
                content.classList.toggle('expanded');
            };

            container.appendChild(header);
            container.appendChild(content);

            return container;
        }

        // 显示AI消息
        // isRestore: 是否从存档恢复（恢复时不自动生成图片，只显示"点击生成"按钮）
        function displayAIMessage(story, options, reasoning = null, imgPrompt = null, isRestore = false) {
            const historyDiv = document.getElementById('gameHistory');

            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ai-message';
            messageDiv.setAttribute('data-message-index', historyDiv.children.length);

            const headerDiv = document.createElement('div');
            headerDiv.className = 'message-header';

            // 添加复选框（仅在删除模式下显示）
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'message-checkbox';
            checkbox.style.display = gameState.deleteMode ? 'inline-block' : 'none';
            checkbox.onclick = (e) => {
                e.stopPropagation();
                handleMessageCheck(messageDiv);
            };

            headerDiv.innerHTML = `
                <span>世界</span>
                <button class="regenerate-btn" onclick="regenerateLastResponseDebounced()">🔄</button>
            `;
            headerDiv.insertBefore(checkbox, headerDiv.firstChild);

            messageDiv.appendChild(headerDiv);

            // 添加思维链显示（如果有且用户开启了显示）
            const showReasoningCheckbox = document.getElementById('showReasoning');
            if (reasoning && showReasoningCheckbox && showReasoningCheckbox.checked) {
                const reasoningDiv = createReasoningDisplay(reasoning);
                messageDiv.appendChild(reasoningDiv);
            }

            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            
            // 🎨 如果启用了 NovelAI 且故事中包含 img: 格式，处理图片提示词
            const hasImagePrompt = story && story.includes('img:');
            if (hasImagePrompt && window.novelAIGenerator && window.novelAIGenerator.enabled && typeof processStoryWithImages === 'function') {
                contentDiv.innerHTML = processStoryWithImages(story);
            } else {
                contentDiv.textContent = story;
            }

            messageDiv.appendChild(contentDiv);
            
            // 🎨 如果有独立的 img 字段且启用了 NovelAI，生成图片
            console.log('[displayAIMessage] 🖼️ 收到 imgPrompt:', imgPrompt ? imgPrompt.substring(0, 50) + '...' : '无');
            console.log('[displayAIMessage] 🎨 NovelAI 启用状态:', window.novelAIGenerator ? window.novelAIGenerator.enabled : 'generator不存在');
            console.log('[displayAIMessage] 📦 isRestore:', isRestore);
            if (imgPrompt && window.novelAIGenerator && window.novelAIGenerator.enabled) {
                const imgContainer = document.createElement('div');
                imgContainer.className = 'nai-image-container';
                
                // 🎨 如果是存档恢复，显示可编辑的提示词界面
                if (isRestore) {
                    // 生成唯一ID用于标识这个编辑器
                    const editorId = 'nai-editor-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                    imgContainer.innerHTML = `
                        <div class="nai-image-restore-placeholder" data-editor-id="${editorId}">
                            <div class="nai-restore-actions">
                                <button class="nai-btn nai-restore-generate-btn" onclick="generateRestoredImageFromEditor('${editorId}')">
                                    🖼️ 生成图片
                                </button>
                                <button class="nai-btn nai-view-prompt-btn" onclick="togglePromptEditor('${editorId}')">
                                    📝 查看/编辑提示词
                                </button>
                            </div>
                            <div class="nai-prompt-editor-container" id="${editorId}" style="display: none;">
                                <div class="nai-prompt-editor-header">
                                    <span>✏️ 编辑提示词</span>
                                    <button class="nai-btn nai-btn-small" onclick="togglePromptEditor('${editorId}')">收起</button>
                                </div>
                                <textarea class="nai-prompt-textarea" id="${editorId}-textarea" rows="4">${imgPrompt}</textarea>
                                <div class="nai-prompt-editor-footer">
                                    <span class="nai-prompt-char-count">字符数: ${imgPrompt.length}</span>
                                    <div class="nai-prompt-editor-buttons">
                                        <button class="nai-btn nai-btn-reset" onclick="resetPromptEditor('${editorId}', '${imgPrompt.replace(/'/g, "\\'")}')">🔄 重置</button>
                                        <button class="nai-btn nai-btn-generate" onclick="generateRestoredImageFromEditor('${editorId}')">🎨 生成图片</button>
                                    </div>
                                </div>
                            </div>
                            <div class="nai-image-prompt-preview">
                                提示词预览: ${imgPrompt.substring(0, 80)}${imgPrompt.length > 80 ? '...' : ''}
                            </div>
                        </div>
                    `;
                    // 存储原始提示词
                    imgContainer.dataset.originalPrompt = imgPrompt;
                    messageDiv.appendChild(imgContainer);
                } else {
                    // 正常生成流程
                    imgContainer.innerHTML = `
                        <div class="nai-image-loading">
                            <div>🎨 正在生成插图...</div>
                            <div class="nai-image-prompt-preview">${imgPrompt.substring(0, 80)}...</div>
                        </div>
                    `;
                    messageDiv.appendChild(imgContainer);
                    
                    // 异步生成图片
                    (async () => {
                        try {
                            console.log('[NovelAI] 🎨 开始生成图片:', imgPrompt.substring(0, 50) + '...');
                            const imageBase64 = await window.novelAIGenerator.generateImage(imgPrompt);
                            
                            // 检查返回值是否已包含 data URL 前缀
                            const imageSrc = imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`;
                            
                            imgContainer.innerHTML = `
                                <div class="nai-generated-image-container">
                                    <img class="nai-generated-image" src="${imageSrc}" 
                                         onclick="openNAIImageModal(this.src)" title="点击放大" />
                                    <div class="nai-image-actions">
                                        <button class="nai-btn" onclick="this.parentElement.nextElementSibling.style.display = this.parentElement.nextElementSibling.style.display === 'none' ? 'block' : 'none'">📝 提示词</button>
                                        <button class="nai-btn" onclick="regenerateNAIImage(this, '${imgPrompt.replace(/'/g, "\\'")}')">🔄 重新生成</button>
                                    </div>
                                    <div class="nai-image-prompt-hidden" style="display:none;"><code>${imgPrompt}</code></div>
                                </div>
                            `;
                            console.log('[NovelAI] ✅ 图片生成成功');
                        } catch (error) {
                            console.error('[NovelAI] ❌ 图片生成失败:', error);
                            imgContainer.innerHTML = `
                                <div class="nai-image-error">
                                    <strong>❌ 图片生成失败</strong>
                                    <div>${error.message}</div>
                                    <button class="nai-btn" onclick="regenerateNAIImage(this, '${imgPrompt.replace(/'/g, "\\'")}')">🔄 重试</button>
                                </div>
                            `;
                        }
                    })();
                }
            }

            // 添加选项
            if (options && options.length > 0) {
                const optionsDiv = document.createElement('div');
                optionsDiv.className = 'options-container';

                // 选项图标映射 - 白虎宗游戏只显示4个选项（移除战斗）
                const isBhzGame = window.location.pathname.includes('game-bhz.html') || document.title.includes('白虎宗');
                const optionIcons = isBhzGame ? ['💬', '🚪', '⚡', '💕'] : ['💬', '🚪', '⚡', '💕', '⚔️'];
                const optionTitles = isBhzGame ? ['对话/交互', '跳过/离开', '转折/行动', 'R18选项'] : ['对话/交互', '跳过/离开', '转折/行动', 'R18选项', '回合制战斗'];

                // 白虎宗游戏只处理前4个选项
                const maxOptions = isBhzGame ? 4 : options.length;
                options.slice(0, maxOptions).forEach((option, index) => {
                    const btn = document.createElement('button');
                    btn.className = 'option-btn';

                    // 确保option是字符串
                    const optionText = typeof option === 'string' ? option : String(option);

                    // 解析属性要求
                    const requirement = parseAttributeRequirement(optionText);
                    const checkResult = checkAttributeRequirement(requirement);

                    // 添加图标
                    const icon = optionIcons[index] || '📌';
                    const title = optionTitles[index] || '选项';

                    // 构建显示文本
                    let displayText = `${icon} ${requirement.cleanText}`;

                    // 如果有属性要求，添加状态显示
                    if (requirement.hasRequirement) {
                        const statusIcon = checkResult.met ? '✅' : '❌';
                        const statusClass = checkResult.met ? 'requirement-met' : 'requirement-not-met';
                        const reqText = `${checkResult.attributeName}${requirement.operator}${requirement.value}`;
                        const currentText = `当前:${checkResult.currentValue}`;

                        displayText += ` <span class="option-requirement ${statusClass}">${statusIcon}${reqText} (${currentText})</span>`;

                        // 设置tooltip
                        const tooltipText = checkResult.met
                            ? `${title} - 属性检定：通过`
                            : `${title} - 属性检定：未通过（可能失败）`;
                        btn.setAttribute('title', tooltipText);
                    } else {
                        btn.setAttribute('title', title);
                    }

                    btn.innerHTML = displayText;

                    // 存储原始选项和检定结果
                    btn.setAttribute('data-option', optionText);
                    btn.setAttribute('data-check-result', JSON.stringify(checkResult));

                    btn.onclick = async () => {
                        try {
                            // 尝试使用全局 selectOption 函数
                            if (typeof window.selectOption === 'function') {
                                await window.selectOption(optionText);
                            } else {
                                // 备用选项处理逻辑
                                console.log('使用备用选项处理逻辑');
                                
                                if (gameState.isProcessing) return;
                                
                                gameState.isProcessing = true;
                                
                                // 显示用户选择
                                displayUserMessage(optionText);
                                
                                // 添加到历史记录
                                gameState.conversationHistory.push({
                                    role: 'user',
                                    content: optionText
                                });
                                
                                // 保存游戏历史
                                if (typeof saveGameHistory === 'function') {
                                    saveGameHistory().catch(err => console.error('保存历史失败:', err));
                                }
                                
                                // 显示加载提示
                                const historyDiv = document.getElementById('gameHistory');
                                const loadingDiv = document.createElement('div');
                                loadingDiv.className = 'message ai-message';
                                loadingDiv.innerHTML = '<div class="message-content"><span class="loading"></span> AI思考中...</div>';
                                loadingDiv.id = 'loading-message';
                                historyDiv.appendChild(loadingDiv);
                                historyDiv.scrollTop = historyDiv.scrollHeight;
                                
                                try {
                                    // 🎭 用户输入分析（如果启用）
                                    let optionEnhancement = '';
                                    if (window.userProfileAnalyzer && window.userProfileAnalyzer.isEnabled()) {
                                        try {
                                            const loadingEl = document.getElementById('loading-message');
                                            if (loadingEl) {
                                                loadingEl.innerHTML = '<div class="message-content"><span class="loading"></span> 正在分析用户意图...</div>';
                                            }
                                            
                                            const gameContext = {
                                                currentLocation: gameState.variables.location || '未知',
                                                characterName: gameState.variables.name || '未知',
                                                realm: gameState.variables.realm || '凡人'
                                            };
                                            
                                            const analysisResult = await window.userProfileAnalyzer.analyze(optionText, gameContext);
                                            
                                            if (analysisResult) {
                                                optionEnhancement = window.userProfileAnalyzer.getEnhancedPrompt(analysisResult);
                                            }
                                            
                                            if (loadingEl) {
                                                loadingEl.innerHTML = '<div class="message-content"><span class="loading"></span> AI思考中...</div>';
                                            }
                                        } catch (analysisErr) {
                                            console.warn('[🎭用户画像] 选项分析失败:', analysisErr);
                                        }
                                    }
                                    
                                    // 调用AI
                                    if (typeof callAI === 'function') {
                                        let enhancedOption = optionText;
                                        if (optionEnhancement) {
                                            enhancedOption = optionEnhancement + '\n\n---\n\n用户选择：' + optionText;
                                        }
                                        
                                        const response = await callAI(enhancedOption, false, optionText);
                                        
                                        // 移除加载提示
                                        const loading = document.getElementById('loading-message');
                                        if (loading) loading.remove();
                                        
                                        // 处理AI响应
                                        if (typeof handleAIResponse === 'function') {
                                            handleAIResponse(response);
                                        }
                                    } else {
                                        throw new Error('AI调用函数未定义');
                                    }
                                } catch (error) {
                                    // 移除加载提示
                                    const loading = document.getElementById('loading-message');
                                    if (loading) loading.remove();
                                    
                                    console.error('选项处理失败:', error);
                                    alert('处理选项时出错：' + error.message);
                                }
                                
                                gameState.isProcessing = false;
                            }
                        } catch (error) {
                            console.error('选项点击处理失败:', error);
                            alert('选项处理失败，请刷新页面重试');
                        }
                    };
                    optionsDiv.appendChild(btn);
                });

                messageDiv.appendChild(optionsDiv);
            }

            historyDiv.appendChild(messageDiv);
            historyDiv.scrollTop = historyDiv.scrollHeight;
        }

        // 全局变量：保存当前错误的重试回调
        let currentErrorRetryCallback = null;

        // 显示错误消息和重试按钮
        function displayErrorMessageWithRetry(errorMessage, retryCallback) {
            const historyDiv = document.getElementById('gameHistory');

            // 移除已存在的错误消息
            const existingError = document.getElementById('error-message-with-retry');
            if (existingError) existingError.remove();

            // 保存回调函数到全局变量
            currentErrorRetryCallback = retryCallback;

            // 🔍 生成诊断信息
            const diagnosticInfo = generateDiagnosticInfo(errorMessage);

            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ai-message';
            messageDiv.id = 'error-message-with-retry';
            messageDiv.style.background = 'linear-gradient(135deg, #ffe6e6 0%, #ffd6d6 100%)';

            const headerDiv = document.createElement('div');
            headerDiv.className = 'message-header';
            headerDiv.innerHTML = '<span>❌ 错误</span>';

            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.style.color = '#c85a54';
            contentDiv.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 10px; line-height: 1.6;">${errorMessage}</div>
                ${diagnosticInfo}
                <div style="margin-top: 15px; display: flex; gap: 10px;">
                    <button class="btn btn-primary" onclick="retryLastError()" style="flex: 1;">
                        🔄 重新生成
                    </button>
                    <button class="btn btn-secondary" onclick="dismissError()" style="flex: 1;">
                        ❌ 关闭错误
                    </button>
                </div>
                <div style="margin-top: 10px; padding: 10px; background: rgba(255,255,255,0.5); border-radius: 5px; font-size: 12px; color: #666;">
                    💡 提示：如果多次失败，请打开浏览器控制台（F12）查看详细错误信息。
                </div>
            `;

            messageDiv.appendChild(headerDiv);
            messageDiv.appendChild(contentDiv);
            historyDiv.appendChild(messageDiv);
            historyDiv.scrollTop = historyDiv.scrollHeight;
        }

        // 生成诊断信息
        function generateDiagnosticInfo(errorMessage) {
            let suggestions = [];

            // 根据错误类型提供建议
            if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
                suggestions.push('🔌 网络连接问题 - 检查网络或 API 端点是否正确');
            }
            if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
                suggestions.push('🔑 API密钥错误 - 请检查密钥是否正确');
            }
            if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
                suggestions.push('⏰ API调用频率限制 - 请稍后再试');
            }
            if (errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503')) {
                suggestions.push('🚨 API服务器错误 - 稍后重试或更换API');
            }
            if (errorMessage.includes('timeout')) {
                suggestions.push('⏱️ 请求超时 - 降低字数要求或更换网络');
            }
            if (errorMessage.includes('解析') || errorMessage.includes('JSON')) {
                suggestions.push('📄 JSON解析失败 - 可能是 API 截断输出');
                suggestions.push('🔧 建议：增加"最大输出Tokens"到 16384 或更高');
            }

            if (suggestions.length === 0) {
                suggestions.push('❓ 未知错误 - 查看控制台（F12）了解详情');
            }

            return `
                <div style="margin-top: 10px; padding: 10px; background: rgba(255,200,200,0.3); border-radius: 5px; border-left: 3px solid #c85a54;">
                    <div style="font-weight: bold; font-size: 12px; margin-bottom: 5px;">🔍 可能的解决方案：</div>
                    ${suggestions.map(s => `<div style="font-size: 11px; margin: 3px 0;">• ${s}</div>`).join('')}
                </div>
            `;
        }

        // 重试最后的错误
        async function retryLastError() {
            if (currentErrorRetryCallback) {
                await currentErrorRetryCallback();
            } else {
                alert('没有可重试的操作！');
            }
        }

        // 关闭错误消息
        function dismissError() {
            const errorDiv = document.getElementById('error-message-with-retry');
            if (errorDiv) errorDiv.remove();
            currentErrorRetryCallback = null;
            gameState.isProcessing = false;
        }

        // 显示用户消息
        function displayUserMessage(message, forceRender = false) {
            const historyDiv = document.getElementById('gameHistory');
            // 调试模式：不渲染用户楼层，直接输出到调试区
            // forceRender参数可以强制渲染（用于加载存档时）
            const debugCheckbox = document.getElementById('debugMode');
            if (!forceRender && debugCheckbox && debugCheckbox.checked) {
                appendDebug('USER', message);
                return;
            }

            const messageDiv = document.createElement('div');
            messageDiv.className = 'message user-message';
            const messageIndex = historyDiv.children.length;
            messageDiv.setAttribute('data-message-index', messageIndex);

            const headerDiv = document.createElement('div');
            headerDiv.className = 'message-header';

            // 添加复选框（仅在删除模式下显示）
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'message-checkbox';
            checkbox.style.display = gameState.deleteMode ? 'inline-block' : 'none';
            checkbox.onclick = (e) => {
                e.stopPropagation();
                handleMessageCheck(messageDiv);
            };

            // 添加操作按钮容器
            const actionsDiv = document.createElement('div');
            actionsDiv.style.cssText = 'display: flex; gap: 5px; align-items: center;';
            
            // 编辑按钮
            const editBtn = document.createElement('button');
            editBtn.className = 'regenerate-btn';
            editBtn.innerHTML = '✏️';
            editBtn.style.background = '#17a2b8';
            editBtn.onclick = () => editUserMessage(messageIndex);
            
            // 重新发送按钮
            const resendBtn = document.createElement('button');
            resendBtn.className = 'regenerate-btn';
            resendBtn.innerHTML = '🔄';
            resendBtn.onclick = () => resendUserMessage(messageIndex);
            
            actionsDiv.appendChild(editBtn);
            actionsDiv.appendChild(resendBtn);

            headerDiv.innerHTML = '<span>👤 你的选择</span>';
            headerDiv.insertBefore(checkbox, headerDiv.firstChild);
            headerDiv.appendChild(actionsDiv);

            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.textContent = message;
            contentDiv.setAttribute('data-original-text', message);

            messageDiv.appendChild(headerDiv);
            messageDiv.appendChild(contentDiv);

            historyDiv.appendChild(messageDiv);
            historyDiv.scrollTop = historyDiv.scrollHeight;
        }

        // 🎨 切换提示词编辑器显示/隐藏
        window.togglePromptEditor = function(editorId) {
            const editor = document.getElementById(editorId);
            if (editor) {
                const isHidden = editor.style.display === 'none';
                editor.style.display = isHidden ? 'block' : 'none';
                
                // 更新字符计数
                if (isHidden) {
                    const textarea = document.getElementById(editorId + '-textarea');
                    if (textarea) {
                        updatePromptCharCount(editorId, textarea.value.length);
                        // 添加输入监听
                        textarea.oninput = () => updatePromptCharCount(editorId, textarea.value.length);
                    }
                }
            }
        };

        // 🎨 更新字符计数
        window.updatePromptCharCount = function(editorId, count) {
            const editor = document.getElementById(editorId);
            if (editor) {
                const charCount = editor.querySelector('.nai-prompt-char-count');
                if (charCount) {
                    charCount.textContent = `字符数: ${count}`;
                }
            }
        };

        // 🎨 重置提示词编辑器
        window.resetPromptEditor = function(editorId, originalPrompt) {
            const textarea = document.getElementById(editorId + '-textarea');
            if (textarea) {
                textarea.value = originalPrompt;
                updatePromptCharCount(editorId, originalPrompt.length);
            }
        };

        // 🎨 从编辑器获取提示词并生成图片
        window.generateRestoredImageFromEditor = async function(editorId) {
            const textarea = document.getElementById(editorId + '-textarea');
            const container = document.querySelector(`[data-editor-id="${editorId}"]`)?.closest('.nai-image-container');
            
            if (!textarea || !container) {
                console.error('[NovelAI] 找不到编辑器或容器');
                return;
            }
            
            const imgPrompt = textarea.value.trim();
            if (!imgPrompt) {
                alert('提示词不能为空！');
                return;
            }
            
            // 显示加载状态
            container.innerHTML = `
                <div class="nai-image-loading">
                    <div>🎨 正在生成插图...</div>
                    <div class="nai-image-prompt-preview">${imgPrompt.substring(0, 80)}...</div>
                </div>
            `;
            
            try {
                console.log('[NovelAI] 🎨 开始生成图片:', imgPrompt.substring(0, 50) + '...');
                const imageBase64 = await window.novelAIGenerator.generateImage(imgPrompt);
                
                // 检查返回值是否已包含 data URL 前缀
                const imageSrc = imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`;
                const escapedPrompt = imgPrompt.replace(/'/g, "\\'").replace(/\n/g, '\\n');
                
                container.innerHTML = `
                    <div class="nai-generated-image-container">
                        <img class="nai-generated-image" src="${imageSrc}" 
                             onclick="openNAIImageModal(this.src)" title="点击放大" />
                        <div class="nai-image-actions">
                            <button class="nai-btn" onclick="toggleGeneratedPromptView(this)">📝 查看提示词</button>
                            <button class="nai-btn" onclick="editAndRegenerateImage(this)">✏️ 编辑并重新生成</button>
                        </div>
                        <div class="nai-image-prompt-hidden" style="display:none;">
                            <div class="nai-prompt-view-header">当前提示词：</div>
                            <code>${imgPrompt}</code>
                        </div>
                        <div class="nai-image-edit-panel" style="display:none;">
                            <textarea class="nai-prompt-textarea" rows="4">${imgPrompt}</textarea>
                            <div class="nai-prompt-editor-footer">
                                <button class="nai-btn nai-btn-cancel" onclick="cancelEditPrompt(this)">取消</button>
                                <button class="nai-btn nai-btn-generate" onclick="regenerateWithEditedPrompt(this)">🎨 重新生成</button>
                            </div>
                        </div>
                    </div>
                `;
                console.log('[NovelAI] ✅ 图片生成成功');
            } catch (error) {
                console.error('[NovelAI] ❌ 图片生成失败:', error);
                // 恢复编辑界面
                const newEditorId = 'nai-editor-' + Date.now();
                container.innerHTML = `
                    <div class="nai-image-error">
                        <strong>❌ 图片生成失败</strong>
                        <div>${error.message}</div>
                    </div>
                    <div class="nai-image-restore-placeholder" data-editor-id="${newEditorId}">
                        <div class="nai-restore-actions">
                            <button class="nai-btn nai-restore-generate-btn" onclick="generateRestoredImageFromEditor('${newEditorId}')">
                                🖼️ 重试生成
                            </button>
                            <button class="nai-btn nai-view-prompt-btn" onclick="togglePromptEditor('${newEditorId}')">
                                📝 编辑提示词
                            </button>
                        </div>
                        <div class="nai-prompt-editor-container" id="${newEditorId}" style="display: block;">
                            <textarea class="nai-prompt-textarea" id="${newEditorId}-textarea" rows="4">${imgPrompt}</textarea>
                            <div class="nai-prompt-editor-footer">
                                <span class="nai-prompt-char-count">字符数: ${imgPrompt.length}</span>
                                <button class="nai-btn nai-btn-generate" onclick="generateRestoredImageFromEditor('${newEditorId}')">🎨 重试</button>
                            </div>
                        </div>
                    </div>
                `;
            }
        };

        // 🎨 切换已生成图片的提示词显示
        window.toggleGeneratedPromptView = function(btn) {
            const container = btn.closest('.nai-generated-image-container');
            if (container) {
                const promptHidden = container.querySelector('.nai-image-prompt-hidden');
                const editPanel = container.querySelector('.nai-image-edit-panel');
                if (promptHidden) {
                    // 隐藏编辑面板
                    if (editPanel) editPanel.style.display = 'none';
                    // 切换显示
                    promptHidden.style.display = promptHidden.style.display === 'none' ? 'block' : 'none';
                }
            }
        };

        // 🎨 编辑并重新生成图片
        window.editAndRegenerateImage = function(btn) {
            const container = btn.closest('.nai-generated-image-container');
            if (container) {
                const promptHidden = container.querySelector('.nai-image-prompt-hidden');
                const editPanel = container.querySelector('.nai-image-edit-panel');
                if (promptHidden && editPanel) {
                    // 隐藏提示词显示
                    promptHidden.style.display = 'none';
                    // 显示编辑面板
                    editPanel.style.display = 'block';
                }
            }
        };

        // 🎨 取消编辑提示词
        window.cancelEditPrompt = function(btn) {
            const container = btn.closest('.nai-generated-image-container');
            if (container) {
                const editPanel = container.querySelector('.nai-image-edit-panel');
                if (editPanel) {
                    editPanel.style.display = 'none';
                }
            }
        };

        // 🎨 用编辑后的提示词重新生成图片
        window.regenerateWithEditedPrompt = async function(btn) {
            const container = btn.closest('.nai-generated-image-container');
            const imgContainer = btn.closest('.nai-image-container');
            if (!container || !imgContainer) return;
            
            const textarea = container.querySelector('.nai-image-edit-panel textarea');
            if (!textarea) return;
            
            const imgPrompt = textarea.value.trim();
            if (!imgPrompt) {
                alert('提示词不能为空！');
                return;
            }
            
            // 显示加载状态
            imgContainer.innerHTML = `
                <div class="nai-image-loading">
                    <div>🎨 正在重新生成插图...</div>
                    <div class="nai-image-prompt-preview">${imgPrompt.substring(0, 80)}...</div>
                </div>
            `;
            
            try {
                console.log('[NovelAI] 🎨 开始重新生成图片:', imgPrompt.substring(0, 50) + '...');
                const imageBase64 = await window.novelAIGenerator.generateImage(imgPrompt);
                
                const imageSrc = imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`;
                
                imgContainer.innerHTML = `
                    <div class="nai-generated-image-container">
                        <img class="nai-generated-image" src="${imageSrc}" 
                             onclick="openNAIImageModal(this.src)" title="点击放大" />
                        <div class="nai-image-actions">
                            <button class="nai-btn" onclick="toggleGeneratedPromptView(this)">📝 查看提示词</button>
                            <button class="nai-btn" onclick="editAndRegenerateImage(this)">✏️ 编辑并重新生成</button>
                        </div>
                        <div class="nai-image-prompt-hidden" style="display:none;">
                            <div class="nai-prompt-view-header">当前提示词：</div>
                            <code>${imgPrompt}</code>
                        </div>
                        <div class="nai-image-edit-panel" style="display:none;">
                            <textarea class="nai-prompt-textarea" rows="4">${imgPrompt}</textarea>
                            <div class="nai-prompt-editor-footer">
                                <button class="nai-btn nai-btn-cancel" onclick="cancelEditPrompt(this)">取消</button>
                                <button class="nai-btn nai-btn-generate" onclick="regenerateWithEditedPrompt(this)">🎨 重新生成</button>
                            </div>
                        </div>
                    </div>
                `;
                console.log('[NovelAI] ✅ 重新生成成功');
            } catch (error) {
                console.error('[NovelAI] ❌ 重新生成失败:', error);
                const newEditorId = 'nai-editor-' + Date.now();
                imgContainer.innerHTML = `
                    <div class="nai-image-error">
                        <strong>❌ 图片生成失败</strong>
                        <div>${error.message}</div>
                    </div>
                    <div class="nai-image-restore-placeholder" data-editor-id="${newEditorId}">
                        <div class="nai-restore-actions">
                            <button class="nai-btn nai-restore-generate-btn" onclick="generateRestoredImageFromEditor('${newEditorId}')">
                                🖼️ 重试
                            </button>
                        </div>
                        <div class="nai-prompt-editor-container" id="${newEditorId}" style="display: block;">
                            <textarea class="nai-prompt-textarea" id="${newEditorId}-textarea" rows="4">${imgPrompt}</textarea>
                            <div class="nai-prompt-editor-footer">
                                <span class="nai-prompt-char-count">字符数: ${imgPrompt.length}</span>
                                <button class="nai-btn nai-btn-generate" onclick="generateRestoredImageFromEditor('${newEditorId}')">🎨 重试</button>
                            </div>
                        </div>
                    </div>
                `;
            }
        };

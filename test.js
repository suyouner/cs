
        // --- IndexedDB Helpers ---
        let db;
        function initDB(callback) {
            const request = indexedDB.open('UserData', 9); // Version 9

            request.onerror = (event) => {
                console.error("Database error: ", event.target.error);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('friends')) {
                    db.createObjectStore('friends', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('ai_stickers')) {
                    const aiStickerStore = db.createObjectStore('ai_stickers', { keyPath: 'id', autoIncrement: true });
                    aiStickerStore.createIndex('friendId', 'friendId', { unique: false });
                }
                 if (!db.objectStoreNames.contains('chat_history')) {
                    const chatStore = db.createObjectStore('chat_history', { keyPath: 'id', autoIncrement: true });
                    chatStore.createIndex('friendId', 'friendId', { unique: false });
                }
                if (!db.objectStoreNames.contains('user_profile')) {
                    db.createObjectStore('user_profile', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('stickers')) {
                    const stickerStore = db.createObjectStore('stickers', { keyPath: 'id', autoIncrement: true });
                    stickerStore.createIndex('group', 'group', { unique: false });
                }
                if (!db.objectStoreNames.contains('my_personas')) {
                    db.createObjectStore('my_personas', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('discover_posts')) {
                    const postStore = db.createObjectStore('discover_posts', { keyPath: 'id' });
                    postStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
                if (!db.objectStoreNames.contains('regex_rules')) {
                    const regexStore = db.createObjectStore('regex_rules', { keyPath: 'id' });
                    // No specific index needed yet, we'll fetch all and filter in memory or by index if needed later
                }
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                console.log("Database opened successfully.");
                if (callback) callback();
            };
        }

        function dbAdd(storeName, item, callback) {
            if (!db) return;
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(item);
            request.onsuccess = (e) => { 
                if (storeName === 'chat_history') {
                    item.id = e.target.result;
                    // Try to update the DOM if it was using timestamp as a fallback
                    if (item.timestamp) {
                        const wrappers = document.querySelectorAll(`.message-bubble-wrapper[data-msg-id="${item.timestamp}"]`);
                        wrappers.forEach(wrapper => {
                            wrapper.dataset.msgId = item.id;
                        });
                    }
                }
                if (callback) callback(); 
            };
            request.onerror = (e) => console.error(`Error adding to ${storeName}:`, e.target.error);
        }

        function dbGetAll(storeName, callback) {
            if (!db) return;
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => { if (callback) callback(request.result); };
            request.onerror = (e) => console.error(`Error getting all from ${storeName}:`, e.target.error);
        }

        function dbGet(storeName, key, callback) {
            if (!db) return;
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            request.onsuccess = () => { if (callback) callback(request.result); };
            request.onerror = (e) => console.error(`Error getting from ${storeName}:`, e.target.error);
        }

        function dbUpdate(storeName, item, callback) {
            if (!db) return;
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(item);
            request.onsuccess = () => { if (callback) callback(); };
            request.onerror = (e) => console.error(`Error updating ${storeName}:`, e.target.error);
        }

        function dbDelete(storeName, key, callback) {
            if (!db) return;
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);
            request.onsuccess = () => { if (callback) callback(); };
            request.onerror = (e) => console.error(`Error deleting from ${storeName}:`, e.target.error);
        }


        function showPage(pageId) {
            document.querySelectorAll('.page').forEach(page => {
                page.classList.remove('active');
            });
            const newPage = document.getElementById(pageId);
            if (!newPage) return; // Exit if page doesn't exist
            newPage.classList.add('active');
            
            const statusBar = document.querySelector('.status-bar');
            const settingsHeader = document.querySelector('.settings-header');
            const settingsPage = document.getElementById('settings-page');

            if (pageId === 'theme-page' || pageId === 'desktop-theme-page' || pageId === 'chat-theme-page' || pageId === 'world-book-page' || pageId === 'wechat-page' || pageId === 'wechat-contacts-page' || pageId === 'wechat-me-page' || pageId === 'persona-management-page' || pageId === 'friend-profile-page' || pageId === 'memory-management-page' || pageId === 'emoji-library-page' || pageId === 'search-detail-page') {
                statusBar.style.backgroundColor = (pageId === 'wechat-page' || pageId === 'wechat-contacts-page' || pageId === 'wechat-me-page' || pageId === 'friend-profile-page' || pageId === 'memory-management-page' || pageId === 'search-detail-page') ? '#ededed' : 'white';
                statusBar.style.color = '#333';
            } else if (pageId === 'settings-page' || pageId === 'chat-info-page') {
                const settingsBgColor = '#f0f2f5';
                statusBar.style.backgroundColor = settingsBgColor;
                statusBar.style.color = '#333';
                if (pageId === 'settings-page') settingsHeader.style.backgroundColor = settingsBgColor;
            } else if (pageId === 'wechat-discover-page') {
                statusBar.style.backgroundColor = 'transparent';
                const scrollArea = document.getElementById('discover-scroll-area');
                if (scrollArea && scrollArea.scrollTop > 100) {
                    statusBar.style.color = '#333';
                } else {
                    statusBar.style.color = 'white';
                }
            } else {
                statusBar.style.backgroundColor = 'transparent';
                statusBar.style.color = '#333';
            }

            if (pageId === 'desktop-theme-page') {
                generateIconPreviews();
            }
            if (pageId === 'world-book-page') {
                renderWbTabs();
                renderWbList();
            }
            if (pageId === 'wechat-page') {
                const searchInput = document.getElementById('global-search-input');
                if (searchInput) searchInput.value = '';
                renderChatList();
            }
            if (pageId === 'wechat-me-page') {
                renderMePage();
            }
            if (pageId === 'persona-management-page') {
                renderPersonaList();
            }
            if (pageId === 'emoji-library-page') {
                renderEmojiLibraryCharacters();
            }
            if (pageId === 'regex-app-page') {
                renderRegexRules();
            }
            if (pageId === 'wechat-discover-page') {
                renderDiscoverPage();
                renderDiscoverFeed();
            }
            if (pageId === 'chat-theme-page') {
                renderChatThemePage();
            }
        }

        let currentChatThemeFriendId = '';

        function renderChatThemePage() {
            const select = document.getElementById('chat-theme-character-select');
            
            dbGetAll('friends', friends => {
                select.innerHTML = '';
                
                const defaultOption = document.createElement('option');
                defaultOption.value = "";
                defaultOption.textContent = "默认/全局";
                select.appendChild(defaultOption);

                if (friends && friends.length > 0) {
                    friends.forEach(friend => {
                        const option = document.createElement('option');
                        option.value = friend.id;
                        option.textContent = friend.name;
                        if (friend.id === currentChatThemeFriendId) {
                            option.selected = true;
                        }
                        select.appendChild(option);
                    });
                }
                
                refreshCustomSelect(select);
                
                select.onchange = (e) => {
                    currentChatThemeFriendId = e.target.value;
                    updateChatThemePreview();
                };
                
                updateChatThemePreview();
            });
        }

        function updateChatThemePreview() {
            const preview = document.getElementById('chat-wallpaper-preview');
            if (currentChatThemeFriendId) {
                dbGet('friends', currentChatThemeFriendId, friend => {
                    if (friend && friend.chatWallpaper) {
                        preview.style.backgroundImage = `url(${friend.chatWallpaper})`;
                    } else {
                        // Fallback to global
                        const globalWallpaper = localStorage.getItem('chat_wallpaper');
                        if (globalWallpaper) {
                            preview.style.backgroundImage = `url(${globalWallpaper})`;
                        } else {
                            preview.style.backgroundImage = 'none';
                            preview.style.backgroundColor = '#ededed';
                        }
                    }
                });
            } else {
                const globalWallpaper = localStorage.getItem('chat_wallpaper');
                if (globalWallpaper) {
                    preview.style.backgroundImage = `url(${globalWallpaper})`;
                } else {
                    preview.style.backgroundImage = 'none';
                    preview.style.backgroundColor = '#ededed';
                }
            }
        }

        function resetChatWallpaper() {
            if (currentChatThemeFriendId) {
                dbGet('friends', currentChatThemeFriendId, friend => {
                    if (friend) {
                        friend.chatWallpaper = null;
                        dbUpdate('friends', friend, () => {
                            updateChatThemePreview();
                            showToast('已恢复为全局背景');
                        });
                    }
                });
            } else {
                localStorage.removeItem('chat_wallpaper');
                updateChatThemePreview();
                showToast('全局背景已恢复默认');
            }
        }

        function initDiscoverScroll() {
            const scrollArea = document.getElementById('discover-scroll-area');
            const header = document.getElementById('discover-sticky-header');
            const title = document.getElementById('discover-header-title');
            const backIcon = document.getElementById('discover-back-icon');
            const cameraIcon = document.getElementById('discover-camera-icon');
            const statusBar = document.querySelector('.status-bar');

            if (!scrollArea || scrollArea.dataset.scrollBound) return;
            scrollArea.dataset.scrollBound = 'true';

            scrollArea.addEventListener('scroll', () => {
                if (!document.getElementById('wechat-discover-page').classList.contains('active')) return;

                const y = scrollArea.scrollTop;
                
                if (y > 50) {
                    const opacity = Math.min((y - 50) / 100, 1);
                    header.style.backgroundColor = `rgba(237, 237, 237, ${opacity})`; // Match wechat top bar color
                    
            if (opacity > 0.5) {
                title.style.color = `rgba(0, 0, 0, ${(opacity - 0.5) * 2})`;
                backIcon.style.stroke = '#333';
                backIcon.style.filter = 'none';
                cameraIcon.style.stroke = '#333';
                cameraIcon.style.filter = 'none';
                statusBar.style.color = '#333';
                const fakeStatusBar = document.getElementById('discover-fake-status-bar');
                if (fakeStatusBar) fakeStatusBar.style.color = '#333';
            } else {
                title.style.color = 'rgba(0,0,0,0)';
                backIcon.style.stroke = 'white';
                backIcon.style.filter = 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))';
                cameraIcon.style.stroke = 'white';
                cameraIcon.style.filter = 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))';
                statusBar.style.color = 'white';
                const fakeStatusBar = document.getElementById('discover-fake-status-bar');
                if (fakeStatusBar) fakeStatusBar.style.color = 'rgba(0,0,0,0)';
            }
                } else {
                    header.style.backgroundColor = 'rgba(237,237,237,0)';
                    title.style.color = 'rgba(0,0,0,0)';
                    backIcon.style.stroke = 'white';
                    backIcon.style.filter = 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))';
                    cameraIcon.style.stroke = 'white';
                    cameraIcon.style.filter = 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))';
                    statusBar.style.color = 'white';
                }
            });
        }

        function renderDiscoverPage() {
            initDiscoverScroll();
            // trigger an initial scroll check
            const scrollArea = document.getElementById('discover-scroll-area');
            if (scrollArea) scrollArea.dispatchEvent(new Event('scroll'));

            dbGet('user_profile', 'main_user', profile => {
                const avatar = document.getElementById('discover-avatar');
                const name = document.getElementById('discover-name');
                
                if (profile) {
                    if (profile.avatar) {
                        avatar.src = profile.avatar;
                    } else {
                        avatar.src = 'https://via.placeholder.com/150/B5EAD7/ffffff?text=Me';
                    }
                    if (profile.name) {
                        name.textContent = profile.name;
                    } else {
                        name.textContent = '我';
                    }
                } else {
                    avatar.src = 'https://via.placeholder.com/150/B5EAD7/ffffff?text=Me';
                    name.textContent = '我';
                }
            });
            
            const coverUrl = localStorage.getItem('discover_cover');
            if (coverUrl) {
                document.getElementById('discover-cover-container').style.backgroundImage = `url(${coverUrl})`;
            }
        }

        function openDiscoverActionSheet() {
            const overlay = document.getElementById('discover-action-sheet-overlay');
            overlay.style.display = 'block';
            // Trigger reflow to ensure transition works
            void overlay.offsetWidth;
            overlay.classList.add('show');
        }

        function closeDiscoverActionSheet(e) {
            // If e is provided, it came from the overlay click. Make sure we didn't click inside the sheet itself.
            if (e && e.target !== document.getElementById('discover-action-sheet-overlay')) {
                return;
            }
            const overlay = document.getElementById('discover-action-sheet-overlay');
            overlay.classList.remove('show');
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 300); // Wait for transition
        }

        function handleDiscoverAction(action) {
            closeDiscoverActionSheet();
            setTimeout(() => {
                if (action === 'post') {
                    openPostDiscoverModal();
                } else if (action === 'roles') {
                    showToast('功能尚未开发');
                }
            }, 300);
        }

        function triggerDiscoverCoverUpload() {
            document.getElementById('discover-cover-input').click();
        }

        function handleDiscoverCoverUpload(input) {
            if (input.files && input.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const imageUrl = e.target.result;
                    document.getElementById('discover-cover-container').style.backgroundImage = `url(${imageUrl})`;
                    localStorage.setItem('discover_cover', imageUrl);
                }
                reader.readAsDataURL(input.files[0]);
            }
        }

        let currentPostImageDataUrl = null;
        let currentVisibilityType = '公开';
        let currentSelectedRoles = [];

        function openPostDiscoverModal() {
            document.getElementById('post-text-input').value = '';
            document.getElementById('post-image-preview').style.display = 'none';
            document.getElementById('post-image-preview').src = '';
            document.getElementById('post-image-status').textContent = '未选择';
            
            const publishBtn = document.querySelector('.post-btn-publish');
            if (publishBtn) {
                publishBtn.disabled = false;
                publishBtn.textContent = '发表';
                publishBtn.style.opacity = '1';
            }

            currentPostImageDataUrl = null;
            currentVisibilityType = '公开';
            currentSelectedRoles = [];
            updateVisibilityDisplay();
            document.getElementById('post-discover-modal').style.display = 'flex';
        }

        function closePostDiscoverModal() {
            document.getElementById('post-discover-modal').style.display = 'none';
        }

        function triggerPostImageUpload() {
            document.getElementById('post-image-input').click();
        }

        function handlePostImageUpload(input) {
            if (input.files && input.files[0]) {
                compressImage(input.files[0], 0.7, (compressedSrc) => {
                    currentPostImageDataUrl = compressedSrc;
                    const preview = document.getElementById('post-image-preview');
                    preview.src = compressedSrc;
                    preview.style.display = 'block';
                    document.getElementById('post-image-status').textContent = '已选择1张';
                });
            }
            input.value = '';
        }

        function togglePostVisibility() {
            document.getElementById('visibility-modal').style.display = 'flex';
        }

        function closeVisibilityModal(e) {
            if (e && e.target !== document.getElementById('visibility-modal')) {
                return;
            }
            document.getElementById('visibility-modal').style.display = 'none';
        }

        function selectVisibilityType(type) {
            document.getElementById('visibility-modal').style.display = 'none';
            setTimeout(() => {
                if (type === '公开' || type === '私密') {
                    currentVisibilityType = type;
                    currentSelectedRoles = [];
                    updateVisibilityDisplay();
                } else {
                    openRoleSelectionModal(type);
                }
            }, 100);
        }

        function openRoleSelectionModal(type) {
            currentVisibilityType = type;
            document.getElementById('role-selection-title').textContent = type === '部分可见' ? '谁可以看' : '不给谁看';
            document.getElementById('role-selection-modal').style.display = 'flex';
            document.getElementById('role-search-input').value = '';
            
            const listContainer = document.getElementById('role-selection-list');
            listContainer.innerHTML = '';

            dbGetAll('friends', friends => {
                friends.forEach(friend => {
                    const label = document.createElement('label');
                    label.className = 'gm-contact-item';
                    label.style.padding = '10px 0';
                    label.style.borderBottom = '1px solid #f0f0f0';
                    label.dataset.name = friend.name.toLowerCase();
                    
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.value = friend.id;
                    checkbox.dataset.friendName = friend.name;
                    if (currentSelectedRoles.find(r => r.id === friend.id)) {
                        checkbox.checked = true;
                    }
                    
                    const customCheck = document.createElement('div');
                    customCheck.className = 'round-checkbox';
                    customCheck.innerHTML = '<div class="inner-dot"></div>';
                    
                    const avatar = document.createElement('img');
                    avatar.src = friend.avatar;
                    avatar.style.width = '36px';
                    avatar.style.height = '36px';
                    avatar.style.borderRadius = '4px';
                    avatar.style.objectFit = 'cover';
                    avatar.style.marginLeft = '10px';

                    const span = document.createElement('span');
                    span.textContent = friend.name;
                    
                    label.appendChild(checkbox);
                    label.appendChild(customCheck);
                    label.appendChild(avatar);
                    label.appendChild(span);
                    listContainer.appendChild(label);
                });
            });
        }

        function closeRoleSelectionModal() {
            document.getElementById('role-selection-modal').style.display = 'none';
        }

        function confirmRoleSelection() {
            const checkboxes = document.querySelectorAll('#role-selection-list input[type="checkbox"]:checked');
            currentSelectedRoles = Array.from(checkboxes).map(cb => ({
                id: cb.value,
                name: cb.dataset.friendName
            }));
            
            if (currentSelectedRoles.length === 0 && (currentVisibilityType === '部分可见' || currentVisibilityType === '不给谁看')) {
                showToast('请至少选择一个联系人');
                return;
            }
            
            updateVisibilityDisplay();
            closeRoleSelectionModal();
        }

        function filterRoleSelection() {
            const query = document.getElementById('role-search-input').value.toLowerCase();
            const items = document.querySelectorAll('#role-selection-list .gm-contact-item');
            items.forEach(item => {
                if (item.dataset.name.includes(query)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        }

        function updateVisibilityDisplay() {
            let text = currentVisibilityType;
            // if (currentSelectedRoles.length > 0) {
            //     const names = currentSelectedRoles.map(r => r.name).join(',');
            //     if (names.length > 10) {
            //         text += ` (${names.substring(0, 10)}...)`;
            //     } else {
            //         text += ` (${names})`;
            //     }
            // }
            document.getElementById('post-visibility-text').textContent = text + ' 〉';
        }

        function canBotSeePost(friend, post) {
            if (post.authorId !== 'main_user') return true; 
            if (post.visibility === '公开') return true;
            if (post.visibility === '私密') return false;
            
            const roleIds = post.visibilityRoles.map(r => String(r.id));
            if (post.visibility === '部分可见') {
                return roleIds.includes(String(friend.id));
            }
            if (post.visibility === '不给谁看') {
                return !roleIds.includes(String(friend.id));
            }
            return true;
        }

        async function triggerBotInteractionsForPost(postId) {
            const configStr = localStorage.getItem('globalConfig');
            if (!configStr) return;
            const config = JSON.parse(configStr);
            if (!config.apiKey || !config.model) return;

            dbGet('discover_posts', postId, post => {
                if (!post) return;

                dbGetAll('friends', friends => {
                    const eligibleFriends = friends.filter(f => canBotSeePost(f, post));
                    if (eligibleFriends.length === 0) return;

                    const grouped = {};
                    eligibleFriends.forEach(f => {
                        const g = f.group || '默认分组';
                        if (!grouped[g]) grouped[g] = [];
                        grouped[g].push(f);
                    });

                    for (const groupName in grouped) {
                        const groupFriends = grouped[groupName];
                        processGroupInteractions(postId, groupFriends, config);
                    }
                });
            });
        }

        async function processGroupInteractions(postId, groupFriends, config) {
            // 最多2回合互动，也就是 0, 1, 2，可以跑3遍
            for (let pass = 0; pass < 3; pass++) {
                // 打乱顺序，显得自然
                groupFriends.sort(() => Math.random() - 0.5);

                for (const friend of groupFriends) {
                    // 随机延迟 2 到 6 秒
                    await new Promise(r => setTimeout(r, 2000 + Math.random() * 4000));
                    
                    const post = await new Promise(res => dbGet('discover_posts', postId, res));
                    if (!post) return;

                    const hasLiked = post.likes && (post.likes.includes(friend.id) || post.likes.includes(friend.realName) || post.likes.includes(friend.name));
                    
                    // 计算对特定角色的回复次数
                    const commentAuthors = {};
                    (post.comments || []).forEach(c => commentAuthors[c.id] = c.authorId);

                    const myReplyCounts = {};
                    (post.comments || []).forEach(c => {
                        if (c.authorId === friend.id && c.replyToId) {
                            const targetId = commentAuthors[c.replyToId];
                            if (targetId) {
                                myReplyCounts[targetId] = (myReplyCounts[targetId] || 0) + 1;
                            }
                        }
                    });
                    
                    const friendRootCommentsCount = (post.comments || []).filter(c => c.authorId === friend.id && !c.replyToId).length;
                    
                    // 基本防刷屏限制：根评论最多2条，总回复如果实在太多(比如10条)也可以跳过，但主要是依靠 AI 自身的判断和下方的强制屏蔽
                    if (friendRootCommentsCount >= 2 && hasLiked && (post.comments || []).filter(c => c.authorId === friend.id).length > 10) continue;

                    const history = await new Promise(res => {
                        const tx = db.transaction(['chat_history'], 'readonly');
                        const store = tx.objectStore('chat_history');
                        const idx = store.index('friendId');
                        const req = idx.getAll(friend.id);
                        req.onsuccess = () => res(req.result);
                        req.onerror = () => res([]);
                    });
                    const shortTermCount = parseInt(friend.shortTermMemory || '20', 10);
                    const recentHistory = history.slice(-shortTermCount);

                    let userPersona = null;
                    if (friend.myPersonaId) {
                        userPersona = await new Promise(resolve => dbGet('my_personas', friend.myPersonaId, resolve));
                    }

                    // 暂不传入 visiblePosts 防止无限套娃
                    let prompt = buildSystemPrompt(friend, userPersona, [], []);

                    let chatContextStr = "【与用户的最近聊天记录】\n";
                    if (recentHistory.length === 0) chatContextStr += "无\n";
                    recentHistory.forEach(m => {
                        const sender = m.type === 'sent' ? '用户' : friend.realName;
                        chatContextStr += `${sender}: ${m.isSticker ? '[图片/表情]' : m.text}\n`;
                    });
                    prompt += `\n${chatContextStr}\n`;

                    prompt += `\n【当前场景：朋友圈动态互动】\n用户发布了一条动态：\n内容：${post.text || '无'}\n`;
                    if (post.images && post.images.length > 0) {
                        prompt += `附带了 ${post.images.length} 张图片。\n`;
                    }

                    let groupComments = [];
                    let commentPrompt = `\n动态当前的评论区（你只能看到同分组角色和用户的评论）：\n`;
                    if (post.comments && post.comments.length > 0) {
                        const groupFriendIds = groupFriends.map(f => f.id);
                        groupComments = post.comments.filter(c => groupFriendIds.includes(c.authorId) || c.authorId === 'main_user');
                        if (groupComments.length > 0) {
                            groupComments.forEach((c, idx) => {
                                let replyStr = c.replyTo ? ` 回复 ${c.replyTo}` : '';
                                let canReply = true;
                                if (c.authorId !== 'main_user' && (myReplyCounts[c.authorId] || 0) >= 2) {
                                    canReply = false;
                                }
                                
                                // Dynamically resolve name for prompt context
                                let currentName = c.authorName;
                                if (c.authorId === 'main_user') {
                                    currentName = '用户';
                                } else if (c.authorId) {
                                    const cFriend = groupFriends.find(f => f.id === c.authorId);
                                    if (cFriend) currentName = cFriend.name;
                                }

                                if (canReply) {
                                    commentPrompt += `[评论ID: ${c.id}] ${currentName}${replyStr}: ${c.text}\n`;
                                } else {
                                    commentPrompt += `[评论ID: ${c.id}] ${currentName}${replyStr}: ${c.text} (【系统警告】你与该角色互动已达2次回合上限，强制禁止再回复此人！)\n`;
                                }
                            });
                        } else {
                            commentPrompt += "暂时没有评论。\n";
                        }
                    } else {
                        commentPrompt += "暂时没有评论。\n";
                    }
                    prompt += commentPrompt;

                    prompt += `\n【你的任务】\n决定是否给动态点赞及评论。你可以参考你们的聊天记录。\n你可以无限次回复用户(main_user)的评论。\n但与其他AI角色的互动，你最多只能与同一个角色来回互动2次。\n必须且仅输出 JSON 格式：\n{"like": true/false, "comment": "内容或null", "replyToId": "你想回复的评论ID或null", "replyToName": "被回复人名字或null"}`;
                    
                    try {
                        let responseStr = await callLLM(config, prompt, [{ type: 'sent', text: "请严格输出合法 JSON 格式的内容。" }]);
                        let jsonStr = responseStr.replace(/```json/g, '').replace(/```/g, '').trim();
                        const startIdx = jsonStr.indexOf('{');
                        const endIdx = jsonStr.lastIndexOf('}');
                        if (startIdx !== -1 && endIdx !== -1) {
                            jsonStr = jsonStr.substring(startIdx, endIdx + 1);
                        }
                        const action = JSON.parse(jsonStr);

                        let updated = false;
                        if (action.like && !hasLiked) {
                            if (!post.likes) post.likes = [];
                            post.likes.push(friend.id);
                            updated = true;
                        }

                        if (action.comment && typeof action.comment === 'string' && action.comment.trim() !== '' && action.comment !== 'null') {
                            if (!post.comments) post.comments = [];
                            let depth = 0;
                            let shouldBlock = false;

                            if (action.replyToId && action.replyToId !== 'null') {
                                const targetComment = post.comments.find(c => String(c.id) === String(action.replyToId));
                                if (targetComment) {
                                    // 强制拦截非法回复
                                    if (targetComment.authorId !== 'main_user' && (myReplyCounts[targetComment.authorId] || 0) >= 2) {
                                        shouldBlock = true;
                                    } else {
                                        depth = (targetComment.depth || 0) + 1;
                                    }
                                } else {
                                    action.replyToId = null;
                                    action.replyToName = null;
                                }
                            }
                            
                            if (!shouldBlock) {
                                post.comments.push({
                                    id: Date.now().toString() + Math.floor(Math.random()*1000),
                                    authorId: friend.id,
                                    authorName: friend.realName,
                                    text: action.comment.trim(),
                                    replyTo: action.replyToName && action.replyToName !== 'null' ? action.replyToName : null,
                                    replyToId: action.replyToId,
                                    timestamp: Date.now(),
                                    depth: depth
                                });
                                updated = true;
                            }
                        }

                        if (updated) {
                            await new Promise(res => dbUpdate('discover_posts', post, res));
                            if (document.getElementById('wechat-discover-page').classList.contains('active')) {
                                renderDiscoverFeed();
                            }
                        }
                    } catch(e) {}
                }
            }
        }

        function publishDiscoverPost() {
            const publishBtn = document.querySelector('.post-btn-publish');
            if (publishBtn && publishBtn.disabled) return;

            const text = document.getElementById('post-text-input').value.trim();
            if (!text && !currentPostImageDataUrl) {
                showToast('请填写内容或上传图片');
                return;
            }

            if (publishBtn) {
                publishBtn.disabled = true;
                publishBtn.textContent = '发布中...';
                publishBtn.style.opacity = '0.7';
            }

            dbGet('user_profile', 'main_user', profile => {
                const authorName = profile && profile.name ? profile.name : '未定义';
                const authorAvatar = profile && profile.avatar ? profile.avatar : 'https://via.placeholder.com/150/B5EAD7/ffffff?text=Me';

                const newPost = {
                    id: Date.now().toString(),
                    authorId: 'main_user',
                    authorName: authorName,
                    authorAvatar: authorAvatar,
                    text: text,
                    images: currentPostImageDataUrl ? [currentPostImageDataUrl] : [],
                    visibility: currentVisibilityType,
                    visibilityRoles: currentSelectedRoles,
                    timestamp: Date.now(),
                    likes: [],
                    comments: []
                };

                dbAdd('discover_posts', newPost, () => {
                    closePostDiscoverModal();
                    showToast('发表成功');
                    renderDiscoverFeed();
                    triggerBotInteractionsForPost(newPost.id);
                });
            });
        }

        function renderDiscoverFeed() {
            const container = document.querySelector('#wechat-discover-page .discover-content');
            
            dbGetAll('friends', friends => {
                dbGet('user_profile', 'main_user', profile => {
                    const myName = profile && profile.name ? profile.name : '我';
                    const myAvatar = profile && profile.avatar ? profile.avatar : 'https://via.placeholder.com/150/B5EAD7/ffffff?text=Me';
                    
                    dbGetAll('discover_posts', posts => {
                        container.innerHTML = '';
                        
                        posts.sort((a, b) => b.timestamp - a.timestamp);

                        if (posts.length === 0) {
                            container.innerHTML = '<div style="text-align:center; padding: 30px; color:#999; font-size:14px;">暂无动态</div>';
                            return;
                        }

                        posts.forEach(post => {
                            const postEl = document.createElement('div');
                            postEl.className = 'discover-post';

                            let imagesHtml = '';
                            if (post.images && post.images.length > 0) {
                                imagesHtml = `<div class="discover-post-images">`;
                                post.images.forEach(img => {
                                    imagesHtml += `<img src="${img}" class="discover-post-image" onclick="openImageViewer('${img}')">`;
                                });
                                imagesHtml += `</div>`;
                            }

                            const timeDiff = Date.now() - post.timestamp;
                            let timeStr = '刚刚';
                            if (timeDiff > 86400000) {
                                const d = new Date(post.timestamp);
                                timeStr = `${d.getMonth()+1}-${d.getDate()}`;
                            } else if (timeDiff > 3600000) {
                                timeStr = `${Math.floor(timeDiff/3600000)}小时前`;
                            } else if (timeDiff > 60000) {
                                timeStr = `${Math.floor(timeDiff/60000)}分钟前`;
                            }

                            let deleteHtml = '';
                            if (post.authorId === 'main_user') {
                                deleteHtml = `<span class="discover-post-delete" onclick="deleteDiscoverPost('${post.id}')">删除</span>`;
                            }

                            let interactionsHtml = '';
                            const hasLikes = post.likes && post.likes.length > 0;
                            const hasComments = post.comments && post.comments.length > 0;
                            
                            // Dynamically determine author name and avatar
                            let displayName = post.authorName;
                            let displayAvatar = post.authorAvatar;
                            
                            if (post.authorId === 'main_user') {
                                displayName = myName;
                                displayAvatar = myAvatar;
                            } else if (post.authorId) {
                                const f = friends.find(f => f.id === post.authorId);
                                if (f) {
                                    displayName = f.name;
                                    displayAvatar = f.avatar;
                                }
                            } else {
                                // Old post fallback by name
                                const f = friends.find(f => f.realName === post.authorName || f.name === post.authorName);
                                if (f) {
                                    displayName = f.name;
                                    displayAvatar = f.avatar;
                                }
                            }

                            const isLikedByMe = post.likes && (post.likes.includes('main_user') || post.likes.includes(myName) || post.likes.includes(profile?.name) || post.likes.includes('未定义'));

                            if (hasLikes || hasComments) {
                                interactionsHtml = `<div class="discover-post-interactions">`;
                                
                                if (hasLikes) {
                                    const displayLikes = post.likes.map(likeIdOrName => {
                                        if (likeIdOrName === 'main_user') return myName;
                                        const fById = friends.find(f => f.id === likeIdOrName);
                                        if (fById) return fById.name;
                                        const fByName = friends.find(f => f.realName === likeIdOrName || f.name === likeIdOrName);
                                        if (fByName) return fByName.name;
                                        // Check if it matches old myName
                                        if (likeIdOrName === myName || likeIdOrName === (profile && profile.name) || likeIdOrName === '未定义') return myName;
                                        return likeIdOrName;
                                    });

                                    interactionsHtml += `
                                        <div class="discover-post-likes">
                                            <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                                            ${displayLikes.join('，')}
                                        </div>
                                    `;
                                }

                                if (hasComments) {
                                    interactionsHtml += `<div class="discover-post-comments">`;
                                    post.comments.forEach((comment, index) => {
                                        let cAuthorName = comment.authorName;
                                        if (comment.authorId === 'main_user') {
                                            cAuthorName = myName;
                                        } else if (comment.authorId) {
                                            const cf = friends.find(f => f.id === comment.authorId);
                                            if (cf) cAuthorName = cf.name;
                                        } else {
                                            const cf = friends.find(f => f.realName === comment.authorName || f.name === comment.authorName);
                                            if (cf) cAuthorName = cf.name;
                                        }

                                        let replyText = '';
                                        if (comment.replyTo || comment.replyToId) {
                                            let rName = comment.replyTo;
                                            let targetAuthorId = null;
                                            
                                            // Try to find the target comment to get the authorId
                                            if (comment.replyToId) {
                                                const targetComment = post.comments.find(c => c.id === comment.replyToId);
                                                if (targetComment) {
                                                    targetAuthorId = targetComment.authorId;
                                                }
                                            }

                                            if (targetAuthorId === 'main_user') {
                                                rName = myName;
                                            } else if (targetAuthorId) {
                                                const rf = friends.find(f => f.id === targetAuthorId);
                                                if (rf) rName = rf.realName || rf.name;
                                            } else if (comment.replyTo) {
                                                const rf = friends.find(f => f.realName === comment.replyTo || f.name === comment.replyTo);
                                                if (rf) rName = rf.realName || rf.name;
                                            }
                                            replyText = ` 回复 <span class="discover-comment-name">${rName}</span>`;
                                        }
                                        
                                        // Pass comment.id to openCommentDrawer, and cAuthorName (display name)
                                        interactionsHtml += `
                                            <div class="discover-comment-item" onclick="openCommentDrawer('${post.id}', '${cAuthorName}', '${comment.id || ''}', ${comment.depth || 0})">
                                                <span class="discover-comment-name">${cAuthorName}</span>${replyText}：${comment.text}
                                            </div>
                                        `;
                                    });
                                    interactionsHtml += `</div>`;
                                }
                                
                                interactionsHtml += `</div>`;
                            }

                            postEl.innerHTML = `
                                <img src="${displayAvatar}" class="discover-post-avatar">
                                <div class="discover-post-content">
                                    <div class="discover-post-name">${displayName}</div>
                                    ${post.text ? `<div class="discover-post-text">${post.text.replace(/\\n/g, '<br>')}</div>` : ''}
                                    ${imagesHtml}
                                    <div class="discover-post-footer">
                                        <div class="discover-post-time-delete">
                                            <span>${timeStr}</span>
                                            ${deleteHtml}
                                        </div>
                                        <div class="discover-post-actions">
                                            <svg class="discover-post-action-icon ${isLikedByMe ? 'liked' : ''}" onclick="toggleLikePost('${post.id}')" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                                            <svg class="discover-post-action-icon" onclick="openCommentDrawer('${post.id}', null, null, 0)" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                                        </div>
                                    </div>
                                    ${interactionsHtml}
                                </div>
                            `;
                            container.appendChild(postEl);
                        });
                    });
                });
            });
        }

        function notifyBotsOfDeletion(post) {
            dbGetAll('friends', friends => {
                const eligibleFriends = friends.filter(f => canBotSeePost(f, post));
                if (eligibleFriends.length === 0) return;
                
                let contentDesc = post.text ? post.text.substring(0, 30) : '';
                if (post.images && post.images.length > 0) {
                    contentDesc += ' [附带图片]';
                }
                const sysMsgText = `【系统隐私提示】用户刚刚删除了这条朋友圈动态：“${contentDesc}”。你“看”到了这个动作（但不必直接说出来），请在后续聊天中符合你的人设自然地表现出你已经知道这件事。`;
                
                eligibleFriends.forEach(friend => {
                    const msg = {
                        friendId: friend.id,
                        text: sysMsgText,
                        type: 'system',
                        timestamp: Date.now()
                    };
                    dbAdd('chat_history', msg);
                });
            });
        }

        function deleteDiscoverPost(postId) {
            showCustomConfirm('确定要删除这条动态吗？', () => {
                dbGet('discover_posts', postId, post => {
                    if (post) {
                        notifyBotsOfDeletion(post);
                    }
                    dbDelete('discover_posts', postId, () => {
                        renderDiscoverFeed();
                    });
                });
            }, '删除动态');
        }

        function toggleLikePost(postId) {
            dbGet('discover_posts', postId, post => {
                if (post) {
                    if (!post.likes) post.likes = [];
                    dbGet('user_profile', 'main_user', profile => {
                        const myName = profile && profile.name ? profile.name : '未定义';
                        
                        let foundIndex = -1;
                        if (post.likes.includes('main_user')) {
                            foundIndex = post.likes.indexOf('main_user');
                        } else if (post.likes.includes(myName)) {
                            foundIndex = post.likes.indexOf(myName);
                        } else if (post.likes.includes('我') && myName === '我') {
                            foundIndex = post.likes.indexOf('我');
                        }
                        
                        if (foundIndex > -1) {
                            post.likes.splice(foundIndex, 1);
                        } else {
                            post.likes.push('main_user');
                        }
                        
                        dbUpdate('discover_posts', post, () => {
                            renderDiscoverFeed();
                        });
                    });
                }
            });
        }

        let activeCommentPostId = null;
        let activeCommentReplyTo = null;
        let activeCommentReplyToId = null;
        let activeCommentDepth = 0;

        function openCommentDrawer(postId, replyToName = null, commentId = null, depth = 0) {
            activeCommentPostId = postId;
            activeCommentReplyTo = replyToName;
            activeCommentReplyToId = commentId;
            activeCommentDepth = parseInt(depth) || 0;
            
            const overlay = document.getElementById('comment-drawer-overlay');
            const input = document.getElementById('comment-input');
            
            if (replyToName) {
                input.placeholder = `回复 ${replyToName}:`;
            } else {
                input.placeholder = '评论...';
            }
            
            input.value = '';
            
            overlay.style.display = 'block';
            void overlay.offsetWidth;
            overlay.classList.add('show');
            input.focus();
        }

        function closeCommentDrawer(e) {
            // This check is key. Only close if the click is on the overlay itself.
            if (e && e.target.id !== 'comment-drawer-overlay') {
                return;
            }
            const overlay = document.getElementById('comment-drawer-overlay');
            overlay.classList.remove('show');
            setTimeout(() => {
                overlay.style.display = 'none';
                activeCommentPostId = null;
                activeCommentReplyTo = null;
                activeCommentReplyToId = null;
                activeCommentDepth = 0;
            }, 300);
        }

        function submitComment() {
            const input = document.getElementById('comment-input');
            const text = input.value.trim();
            if (!text || !activeCommentPostId) return;

            dbGet('user_profile', 'main_user', profile => {
                const authorName = profile && profile.name ? profile.name : '未定义';
                
                dbGet('discover_posts', activeCommentPostId, post => {
                    if (post) {
                        if (!post.comments) post.comments = [];
                        post.comments.push({
                            id: Date.now().toString() + Math.floor(Math.random()*1000),
                            authorId: 'main_user',
                            authorName: authorName,
                            text: text,
                            replyTo: activeCommentReplyTo,
                            replyToId: activeCommentReplyToId,
                            timestamp: Date.now(),
                            depth: activeCommentReplyTo ? (activeCommentDepth + 1) : 0
                        });
                        
                        dbUpdate('discover_posts', post, () => {
                            closeCommentDrawer();
                            renderDiscoverFeed();
                        });
                    }
                });
            });
        }

        function handleFileUpload(event, type, id) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                const imageUrl = e.target.result;
                if (type === 'wallpaper') {
                    document.getElementById('main-page').style.backgroundImage = `url(${imageUrl})`;
                    document.getElementById('wallpaper-preview').style.backgroundImage = `url(${imageUrl})`;
                    localStorage.setItem('wallpaper', imageUrl);
                } else if (type === 'chat-wallpaper') {
                    if (currentChatThemeFriendId) {
                        dbGet('friends', currentChatThemeFriendId, friend => {
                            if (friend) {
                                friend.chatWallpaper = imageUrl;
                                dbUpdate('friends', friend, () => {
                                    updateChatThemePreview();
                                    showToast('已保存该角色的专属背景');
                                });
                            }
                        });
                    } else {
                        localStorage.setItem('chat_wallpaper', imageUrl);
                        updateChatThemePreview();
                        showToast('已保存全局聊天背景');
                    }
                } else if (type === 'app-icon' || type === 'dock-icon') {
                    const targetIcons = document.querySelectorAll(`.app-item[data-app-id='${id}'] .app-icon img`);
                    targetIcons.forEach(icon => icon.src = imageUrl);
                    localStorage.setItem(id, imageUrl);
                    generateIconPreviews(); // Refresh previews
                }
            }
            reader.readAsDataURL(file);
        }
        
        function triggerUpload(inputId) {
            let input = document.getElementById(inputId);
            if (!input) {
                input = document.createElement('input');
                input.type = 'file';
                input.id = inputId;
                input.accept = 'image/*';
                input.style.display = 'none';
                if (inputId === 'wallpaper-upload') {
                    input.onchange = (event) => handleFileUpload(event, 'wallpaper');
                } else if (inputId === 'chat-wallpaper-upload') {
                    input.onchange = (event) => handleFileUpload(event, 'chat-wallpaper');
                }
                document.body.appendChild(input);
            }
            input.click();
        }

        function generateIconPreviews() {
            const appGrid = document.getElementById('app-icon-preview');
            const dockGrid = document.getElementById('dock-icon-preview');
            appGrid.innerHTML = '';
            dockGrid.innerHTML = '';

            document.querySelectorAll('#main-page .apps-area .app-item').forEach(item => {
                const clone = item.cloneNode(true);
                const id = item.dataset.appId;
                clone.onclick = () => triggerIndividualUpload(id, 'app-icon');
                appGrid.appendChild(clone);
            });
            document.querySelectorAll('#main-page .dock-bar .app-item').forEach(item => {
                const clone = item.cloneNode(true);
                const id = item.dataset.appId;
                clone.onclick = () => triggerIndividualUpload(id, 'dock-icon');
                dockGrid.appendChild(clone);
            });
        }

        function triggerIndividualUpload(id, type) {
            let input = document.getElementById(`upload-${id}`);
            if (!input) {
                input = document.createElement('input');
                input.type = 'file';
                input.id = `upload-${id}`;
                input.accept = 'image/*';
                input.style.display = 'none';
                input.onchange = (event) => handleFileUpload(event, type, id);
                document.body.appendChild(input);
            }
            input.click();
        }

        function loadTheme() {
            const wallpaper = localStorage.getItem('wallpaper');
            if (wallpaper) {
                document.getElementById('main-page').style.backgroundImage = `url(${wallpaper})`;
                document.getElementById('wallpaper-preview').style.backgroundImage = `url(${wallpaper})`;
            }
            document.querySelectorAll('#main-page .app-item').forEach(item => {
                const id = item.dataset.appId;
                const savedIcon = localStorage.getItem(id);
                const img = item.querySelector('.app-icon img');
                if (savedIcon && img) {
                    img.src = savedIcon;
                } else if (img) {
                    // Set a default or leave as is
                    img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
                }
            });
            dbGet('user_profile', 'main_user', (profile) => {
                if (profile) {
                    if (profile.avatar) {
                        document.getElementById('avatar-display').src = profile.avatar;
                    }
                    if (profile.img1_display) {
                        document.getElementById('img1-display').src = profile.img1_display;
                    }
                    if (profile.img2_display) {
                        document.getElementById('img2-display').src = profile.img2_display;
                    }
                    if (profile.img3_display) {
                        document.getElementById('img3-display').src = profile.img3_display;
                    }
                }
            });
        }

        function updateDate() {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            document.getElementById('current-date').textContent = `${month} / ${day} / ${year}`;
        }

        function updateTime() {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const timeStr = `${hours}:${minutes}`;
            const globalTime = document.querySelector('.status-bar .time');
            if (globalTime) globalTime.textContent = timeStr;
            const discoverTime = document.querySelector('.discover-time');
            if (discoverTime) discoverTime.textContent = timeStr;
        }
        
        function previewImage(input, displayId) {
            if (input.files && input.files[0]) {
                const file = input.files[0];
                if (displayId === 'img1-display' || displayId === 'img2-display' || displayId === 'img3-display') {
                    compressImage(file, 0.7, (compressedSrc) => {
                        document.getElementById(displayId).src = compressedSrc;
                        dbGet('user_profile', 'main_user', profile => {
                            const updatedProfile = profile || { id: 'main_user' };
                            const propName = displayId.replace('-', '_');
                            updatedProfile[propName] = compressedSrc;
                            dbUpdate('user_profile', updatedProfile);
                        });
                    });
                    return;
                }

                const reader = new FileReader();
                reader.onload = function(e) {
                    const imageUrl = e.target.result;
                    document.getElementById(displayId).src = imageUrl;
                    
                     if (displayId === 'avatar-display') {
                        dbGet('user_profile', 'main_user', profile => {
                            const updatedProfile = profile || { id: 'main_user' };
                            updatedProfile.avatar = imageUrl;
                            dbUpdate('user_profile', updatedProfile);
                            
                            // Sync to Me Page
                            const mePageAvatar = document.getElementById('me-page-avatar');
                            if (mePageAvatar) mePageAvatar.src = imageUrl;
                        });
                    }
                }
                reader.readAsDataURL(file);
            }
        }

        document.querySelectorAll('[contenteditable]').forEach(el => {
            const id = el.className || el.id;
            const saved = localStorage.getItem('text-' + id);
            if (saved) el.innerText = saved;
            el.addEventListener('input', () => {
                localStorage.setItem('text-' + id, el.innerText);
            });
        });

        function openApp(appName) {
            console.log('Opening ' + appName);
        }

        // --- WeChat Logic ---
        let longPressTimer = null;
        let activeFriendId = null;
        let friendIdToClear = null; // 专门用于存储待清空记录的好友ID
        let currentChatFriendId = null; // To track the currently open chat
        const contextMenu = document.getElementById('chat-context-menu');
        const clearHistoryModal = document.getElementById('clear-history-modal');

        function toggleWechatMenu() {
            const menu = document.getElementById('wechat-menu');
            menu.classList.toggle('show');
            
            if (menu.classList.contains('show')) {
                const closeMenu = (e) => {
                    if (!e.target.closest('.wechat-actions') && !e.target.closest('.wechat-menu')) {
                        menu.classList.remove('show');
                        document.removeEventListener('click', closeMenu);
                    }
                };
                setTimeout(() => document.addEventListener('click', closeMenu), 0);
            }
        }

        function openAddFriendModal() {
            document.getElementById('add-friend-modal').style.display = 'flex';
            document.getElementById('wechat-menu').classList.remove('show');
            document.getElementById('af-name-input').value = '';
            document.getElementById('af-persona-input').value = '';
            document.getElementById('af-avatar-preview').src = '';
            document.getElementById('af-avatar-container').classList.remove('has-image');
            document.getElementById('af-avatar-input').value = '';

            const groupSelect = document.getElementById('af-group-select');
            if (groupSelect) {
                groupSelect.innerHTML = '';
                contactGroups.forEach(group => {
                    const option = document.createElement('option');
                    option.value = group;
                    option.textContent = group;
                    groupSelect.appendChild(option);
                });
                refreshCustomSelect(groupSelect);
            }
        }

        function closeAddFriendModal() {
            document.getElementById('add-friend-modal').style.display = 'none';
        }

        function triggerAfAvatarUpload() {
            document.getElementById('af-avatar-input').click();
        }

        function previewAfAvatar(input) {
            if (input.files && input.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const preview = document.getElementById('af-avatar-preview');
                    preview.src = e.target.result;
                    document.getElementById('af-avatar-container').classList.add('has-image');
                }
                reader.readAsDataURL(input.files[0]);
            }
        }

        function showToast(message) {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = 'toast-message';
            toast.textContent = message;
            container.appendChild(toast);

            // Remove the toast after the animation ends
            setTimeout(() => {
                toast.remove();
            }, 3000);
        }

        function showToast(message) {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = 'toast-message';
            toast.textContent = message;
            container.appendChild(toast);

            // Remove the toast after the animation ends
            setTimeout(() => {
                toast.remove();
            }, 3000);
        }

        let bannerZIndex = 1000;
        let activeBanners = [];
        let globalBannerTimeout = null;

        function dismissAllBanners() {
            activeBanners.forEach(bannerObj => {
                if (bannerObj.isClosed) return;
                bannerObj.isClosed = true;
                bannerObj.element.classList.remove('show');
                setTimeout(() => {
                    if (bannerObj.element.parentNode) {
                        bannerObj.element.parentNode.removeChild(bannerObj.element);
                    }
                }, 400);
            });
            activeBanners = [];
            if (globalBannerTimeout) {
                clearTimeout(globalBannerTimeout);
                globalBannerTimeout = null;
            }
        }

        function showBannerNotification(friend, text) {
            const chatPage = document.getElementById('chat-interface-page');
            // If user is currently in the chat interface with this friend, don't show banner
            if (chatPage.classList.contains('active') && currentChatFriendId === friend.id) {
                return; 
            }

            // Clean up text for preview
            let previewText = text;
            if (previewText) {
                // Remove thought tags completely
                previewText = previewText.replace(/<thought>[\s\S]*?<\/thought>/g, '');
                previewText = previewText.replace(/<[^>]+>/g, ''); 
                previewText = previewText.trim();
                
                if (!previewText) {
                     if (text.includes('<sticker>') || text.includes('data:image')) previewText = '[图片/表情]';
                     else if (text.includes('dice:')) previewText = '[骰子]';
                     else previewText = '收到一条新消息';
                }
            } else {
                previewText = '收到一条新消息';
            }

            const banner = document.createElement('div');
            banner.className = 'banner-notification';
            bannerZIndex++;
            banner.style.zIndex = bannerZIndex;

            const avatarUrl = friend.avatar || 'https://via.placeholder.com/150/B5EAD7/ffffff?text=Avatar';

            banner.innerHTML = `
                <img class="banner-avatar" src="${avatarUrl}" alt="Avatar">
                <div class="banner-content">
                    <div class="banner-name">${friend.name}</div>
                    <div class="banner-text">${previewText}</div>
                </div>
            `;

            document.querySelector('.phone-container').appendChild(banner);

            const bannerObj = { element: banner, isClosed: false };
            activeBanners.push(bannerObj);

            banner.onclick = () => {
                dismissAllBanners();
                openChat(friend.id);
            };

            // Force reflow to ensure animation triggers
            void banner.offsetWidth; 
            banner.classList.add('show');

            if (globalBannerTimeout) {
                clearTimeout(globalBannerTimeout);
            }
            globalBannerTimeout = setTimeout(() => {
                dismissAllBanners();
            }, 2000); // Show for 2 seconds
        }

        function saveFriend() {
            const name = document.getElementById('af-name-input').value.trim();
            const persona = document.getElementById('af-persona-input').value.trim();
            const avatarSrc = document.getElementById('af-avatar-preview').src;
            const hasAvatar = document.getElementById('af-avatar-container').classList.contains('has-image');
            const groupSelect = document.getElementById('af-group-select');
            const group = groupSelect ? groupSelect.value : '默认分组';

            if (!name) {
                showToast('请输入好友名字');
                return;
            }
            if (!persona) {
                showToast('请输入好友人设');
                return;
            }
            if (!hasAvatar) {
                showToast('请上传好友头像');
                return;
            }

            const newFriend = {
                id: Date.now().toString(),
                name: name,
                realName: name,
                persona: persona,
                avatar: avatarSrc,
                lastMsg: "我已通过你的好友请求，现在我们可以开始聊天了",
                lastTime: getCurrentTimeStr(),
                isPinned: false,
                isHidden: false,
                group: group
            };

            dbAdd('friends', newFriend, () => {
                closeAddFriendModal();
                renderChatList();
            });
        }

        function getCurrentTimeStr() {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            return `${hours}:${minutes}`;
        }

        function handleGlobalSearch(keyword) {
            keyword = keyword.trim().toLowerCase();
            const list = document.getElementById('chat-list');

            // Reset header to default state for search list
            const header = document.getElementById('wechat-page').querySelector('.wechat-header');
            header.querySelector('.wechat-title').textContent = '微信';
            header.querySelector('span:first-child').onclick = () => showPage('main-page');
            const actionsBtn = header.querySelector('.wechat-actions');
            if (actionsBtn) actionsBtn.style.display = 'flex';
            
            if (!keyword) {
                renderChatList();
                return;
            }

            dbGetAll('friends', friends => {
                dbGetAll('chat_history', history => {
                    list.innerHTML = '';
                    
                    const matchedFriends = friends.filter(f => 
                        !f.isHidden && 
                        ((f.name && f.name.toLowerCase().includes(keyword)) || 
                         (f.realName && f.realName.toLowerCase().includes(keyword)))
                    );
                    
                    if (matchedFriends.length > 0) {
                        const groupHeader = document.createElement('div');
                        groupHeader.style.padding = '4px 15px';
                        groupHeader.style.backgroundColor = '#f7f7f7';
                        groupHeader.style.color = '#888';
                        groupHeader.style.fontSize = '13px';
                        groupHeader.textContent = '联系人';
                        list.appendChild(groupHeader);
                        
                        matchedFriends.forEach(friend => {
                            const item = document.createElement('div');
                            item.className = 'chat-item';
                            item.style.cursor = 'pointer';
                            
                            const regex = new RegExp(`(${keyword})`, 'gi');
                            const highlightedName = friend.name.replace(regex, '<span style="color:#07c160">$1</span>');

                            item.innerHTML = `
                                <img class="chat-avatar" src="${friend.avatar}" alt="${friend.name}">
                                <div class="chat-info" style="justify-content: center;">
                                    <span class="chat-name">${highlightedName}</span>
                                </div>
                            `;
                            item.onclick = () => openChat(friend.id);
                            list.appendChild(item);
                        });
                    }

                    const matchedMessages = history.filter(msg => {
                        if (msg.type === 'system' || !msg.text) return false;
                        if (msg.isSticker && !msg.text.startsWith('http') && !msg.text.startsWith('data:')) {
                            // If it's a dice or custom string
                            if (msg.text.toLowerCase().includes(keyword)) return true;
                        }
                        if (msg.stickerDescription && msg.stickerDescription.toLowerCase().includes(keyword)) return true;
                        if (!msg.isSticker && !msg.isTransfer && msg.text.toLowerCase().includes(keyword)) return true;
                        return false;
                    });
                    
                    if (matchedMessages.length > 0) {
                        const groupHeader = document.createElement('div');
                        groupHeader.style.padding = '4px 15px';
                        groupHeader.style.backgroundColor = '#f7f7f7';
                        groupHeader.style.color = '#888';
                        groupHeader.style.fontSize = '13px';
                        groupHeader.textContent = '聊天记录';
                        list.appendChild(groupHeader);
                        
                        // Group messages by friend
                        const msgsByFriend = {};
                        matchedMessages.forEach(msg => {
                            if (!msgsByFriend[msg.friendId]) msgsByFriend[msg.friendId] = [];
                            msgsByFriend[msg.friendId].push(msg);
                        });

                        // Sort friends by newest message
                        const friendIds = Object.keys(msgsByFriend).sort((a, b) => {
                            const lastA = msgsByFriend[a][msgsByFriend[a].length - 1].timestamp;
                            const lastB = msgsByFriend[b][msgsByFriend[b].length - 1].timestamp;
                            return lastB - lastA;
                        });

                        friendIds.forEach(friendId => {
                            const friendMsgs = msgsByFriend[friendId];
                            const friend = friends.find(f => f.id === friendId);
                            if (!friend || friend.isHidden) return;

                            const item = document.createElement('div');
                            item.className = 'chat-item';
                            item.style.cursor = 'pointer';

                            if (friendMsgs.length > 1) {
                                item.innerHTML = `
                                    <img class="chat-avatar" src="${friend.avatar}" alt="${friend.name}">
                                    <div class="chat-info" style="justify-content: center;">
                                        <span class="chat-name">${friend.name}</span>
                                        <div class="chat-preview" style="color: #999; margin-top: 4px;">${friendMsgs.length}条相关的聊天记录</div>
                                    </div>
                                `;
                                item.onclick = () => showInlineSearchDetails(friend.id, keyword);
                            } else {
                                const msg = friendMsgs[0];
                                let previewText = msg.text.replace(/<[^>]+>/g, '');
                                if (msg.isSticker && msg.stickerDescription) previewText = `[表情] ${msg.stickerDescription}`;
                                else if (msg.isSticker && msg.isDice) previewText = `[骰子]`;
                                else if (msg.isSticker) previewText = `[图片/表情]`;
                                
                                const regex = new RegExp(`(${keyword})`, 'gi');
                                const highlightedText = previewText.replace(regex, '<span style="color:#07c160">$1</span>');

                                const msgDate = new Date(msg.timestamp);
                                const timeStr = `${msgDate.getMonth()+1}-${msgDate.getDate()}`;

                                item.innerHTML = `
                                    <img class="chat-avatar" src="${friend.avatar}" alt="${friend.name}">
                                    <div class="chat-info">
                                        <div class="chat-top">
                                            <span class="chat-name">${friend.name}</span>
                                            <span class="chat-time">${timeStr}</span>
                                        </div>
                                        <div class="chat-preview">${highlightedText}</div>
                                    </div>
                                `;
                                item.onclick = () => openChat(friend.id, msg.id || msg.timestamp);
                            }
                            list.appendChild(item);
                        });
                    }
                    
                    if (matchedFriends.length === 0 && matchedMessages.length === 0) {
                        list.innerHTML = '<div style="text-align:center; padding: 30px; color:#999; font-size:14px;">无搜索结果</div>';
                    }
                });
            });
        }

        function showInlineSearchDetails(friendId, keyword) {
            const list = document.getElementById('chat-list');
            list.innerHTML = '';
            
            // Change header for detail view
            const header = document.getElementById('wechat-page').querySelector('.wechat-header');
            const backArrow = header.querySelector('span:first-child');
            backArrow.onclick = () => {
                handleGlobalSearch(keyword); // Go back to search list
            };

            dbGet('user_profile', 'main_user', profile => {
                const myName = profile && profile.name ? profile.name : '我';
                const myAvatar = profile && profile.avatar ? profile.avatar : 'https://via.placeholder.com/150/B5EAD7/ffffff?text=Me';

                dbGet('friends', friendId, friend => {
                    if (!friend) return;
                    
                    header.querySelector('.wechat-title').textContent = `和${friend.name}的聊天记录`;
                    const actionsBtn = header.querySelector('.wechat-actions');
                    if (actionsBtn) actionsBtn.style.display = 'none';
                    
                    dbGetAll('chat_history', history => {
                        const friendHistory = history.filter(m => m.friendId === friendId);
                        const matchedMessages = friendHistory.filter(msg => {
                            if (msg.type === 'system' || !msg.text) return false;
                            if (msg.isSticker && !msg.text.startsWith('http') && !msg.text.startsWith('data:')) {
                                if (msg.text.toLowerCase().includes(keyword.toLowerCase())) return true;
                            }
                            if (msg.stickerDescription && msg.stickerDescription.toLowerCase().includes(keyword.toLowerCase())) return true;
                            if (!msg.isSticker && !msg.isTransfer && msg.text.toLowerCase().includes(keyword.toLowerCase())) return true;
                            return false;
                        });

                        matchedMessages.sort((a, b) => b.timestamp - a.timestamp);

                        matchedMessages.forEach(msg => {
                            const item = document.createElement('div');
                            item.className = 'chat-item';
                            item.style.cursor = 'pointer';
                            
                            let previewText = msg.text.replace(/<[^>]+>/g, '');
                            if (msg.isSticker && msg.stickerDescription) previewText = `[表情] ${msg.stickerDescription}`;
                            else if (msg.isSticker && msg.isDice) previewText = `[骰子]`;
                            else if (msg.isSticker) previewText = `[图片/表情]`;
                            
                            const regex = new RegExp(`(${keyword})`, 'gi');
                            const highlightedText = previewText.replace(regex, '<span style="color:#07c160">$1</span>');

                            const msgDate = new Date(msg.timestamp);
                            const timeStr = `${msgDate.getMonth()+1}-${msgDate.getDate()} ${String(msgDate.getHours()).padStart(2, '0')}:${String(msgDate.getMinutes()).padStart(2, '0')}`;

                            const senderName = msg.type === 'sent' ? myName : friend.name;
                            const senderAvatar = msg.type === 'sent' ? (friend.myAvatar || myAvatar) : friend.avatar;

                            item.innerHTML = `
                                <img class="chat-avatar" src="${senderAvatar}" alt="${senderName}">
                                <div class="chat-info">
                                    <div class="chat-top">
                                        <span class="chat-name">${senderName}</span>
                                        <span class="chat-time">${timeStr}</span>
                                    </div>
                                    <div class="chat-preview">${highlightedText}</div>
                                </div>
                            `;
                            item.onclick = () => openChat(friend.id, msg.id || msg.timestamp);
                            list.appendChild(item);
                        });
                    });
                });
            });
        }

        function renderChatList() {
            dbGetAll('friends', friends => {
                const list = document.getElementById('chat-list');
                list.innerHTML = '';
                
                const visibleFriends = friends.filter(f => !f.isHidden);

                visibleFriends.sort((a, b) => {
                    if (a.isPinned && !b.isPinned) return -1;
                    if (!a.isPinned && b.isPinned) return 1;
                    return b.id.localeCompare(a.id); // Sort by newest first
                });
                
                visibleFriends.forEach(friend => {
                    const item = document.createElement('div');
                    item.className = 'chat-item';
                    item.dataset.friendId = friend.id;
                    if (friend.isPinned) {
                        item.style.backgroundColor = '#f5f5f5';
                    }

                    item.innerHTML = `
                        <img class="chat-avatar" src="${friend.avatar}" alt="${friend.name}">
                        <div class="chat-info">
                            <div class="chat-top">
                                <span class="chat-name">${friend.name}</span>
                                <span class="chat-time">${friend.lastTime}</span>
                            </div>
                            <div class="chat-preview">${friend.lastMsg}</div>
                        </div>
                    `;

                    let pressTimer;
                    let startX, startY;
                    let wasLongPress = false;

                    item.addEventListener('click', () => {
                        if (!wasLongPress) {
                            openChat(friend.id);
                        }
                        // Reset flag after click is handled
                        wasLongPress = false;
                    });

                    const cancelPress = (moveEvent) => {
                        let moveX = moveEvent.type.includes('touch') ? moveEvent.touches[0].clientX : moveEvent.clientX;
                        let moveY = moveEvent.type.includes('touch') ? moveEvent.touches[0].clientY : moveEvent.clientY;
                        if (Math.abs(moveX - startX) > 10 || Math.abs(moveY - startY) > 10) {
                            clearTimeout(pressTimer);
                            item.removeEventListener('mousemove', cancelPress);
                            item.removeEventListener('touchmove', cancelPress);
                        }
                    };

                    const startPress = (e) => {
                        if (e.button === 2) return;
                        wasLongPress = false; // Reset on new press
                        startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
                        startY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
                        
                        pressTimer = setTimeout(() => {
                            wasLongPress = true;
                            e.preventDefault();
                            showContextMenu(e, friend.id, friend.isPinned);
                        }, 500);

                        item.addEventListener('mousemove', cancelPress);
                        item.addEventListener('touchmove', cancelPress);
                    };

                    const endPress = () => {
                        clearTimeout(pressTimer);
                        item.removeEventListener('mousemove', cancelPress);
                        item.removeEventListener('touchmove', cancelPress);
                    };

                    item.addEventListener('mousedown', startPress);
                    item.addEventListener('touchstart', startPress, { passive: true });
                    item.addEventListener('mouseup', endPress);
                    item.addEventListener('mouseleave', endPress);
                    item.addEventListener('touchend', endPress);
                    item.addEventListener('touchcancel', endPress);
                    item.addEventListener('contextmenu', (e) => e.preventDefault());

                    list.appendChild(item);
                });
            });
        }

        // --- Context Menu and Modal Logic ---
        function showContextMenu(e, friendId, isPinned) {
            activeFriendId = friendId;
            
            document.getElementById('ctx-pin-btn').style.display = isPinned ? 'none' : 'block';
            document.getElementById('ctx-unpin-btn').style.display = isPinned ? 'block' : 'none';

            contextMenu.style.display = 'flex';
            
            const phoneContainer = document.querySelector('.phone-container');
            const phoneRect = phoneContainer.getBoundingClientRect();
            
            let top = (e.clientY || e.touches[0].clientY) - phoneRect.top;
            let left = (e.clientX || e.touches[0].clientX) - phoneRect.left;

            // Adjust if menu goes off-screen
            if (top + contextMenu.offsetHeight > phoneContainer.clientHeight) {
                top = phoneContainer.clientHeight - contextMenu.offsetHeight - 10;
            }
            if (left + contextMenu.offsetWidth > phoneContainer.clientWidth) {
                left = phoneContainer.clientWidth - contextMenu.offsetWidth - 10;
            }

            contextMenu.style.top = `${top}px`;
            contextMenu.style.left = `${left}px`;
        }

        function hideContextMenu() {
            if (contextMenu.style.display === 'flex') {
                contextMenu.style.display = 'none';
                activeFriendId = null;
            }
        }

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.chat-context-menu') && !e.target.closest('.chat-item')) {
                hideContextMenu();
            }
        });
        
        document.getElementById('wechat-page').addEventListener('scroll', hideContextMenu);

        document.getElementById('ctx-pin-btn').addEventListener('click', () => {
            if (!activeFriendId) return;
            dbGet('friends', activeFriendId, friend => {
                if (friend) {
                    friend.isPinned = true;
                    dbUpdate('friends', friend, renderChatList);
                }
            });
            hideContextMenu();
        });

        document.getElementById('ctx-unpin-btn').addEventListener('click', () => {
            if (!activeFriendId) return;
            dbGet('friends', activeFriendId, friend => {
                if (friend) {
                    friend.isPinned = false;
                    dbUpdate('friends', friend, renderChatList);
                }
            });
            hideContextMenu();
        });

        document.getElementById('ctx-hide-btn').addEventListener('click', () => {
            if (!activeFriendId) return;
            dbGet('friends', activeFriendId, friend => {
                if (friend) {
                    friend.isHidden = true;
                    dbUpdate('friends', friend, renderChatList);
                }
            });
            hideContextMenu();
        });

        document.getElementById('ctx-clear-btn').addEventListener('click', () => {
            if (!activeFriendId) return;
            friendIdToClear = activeFriendId; // 保存 ID 到临时变量
            clearHistoryModal.style.display = 'flex';
            hideContextMenu();
        });

        document.getElementById('cancel-clear-btn').addEventListener('click', () => {
            clearHistoryModal.style.display = 'none';
            friendIdToClear = null;
        });

        document.getElementById('confirm-clear-btn').addEventListener('click', () => {
            if (!friendIdToClear) return; // 使用临时变量

            // Also clear the chat history from the new store
            const transaction = db.transaction(['chat_history'], 'readwrite');
            const store = transaction.objectStore('chat_history');
            const index = store.index('friendId');
            const request = index.openCursor(IDBKeyRange.only(friendIdToClear));
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                }
            };

            transaction.oncomplete = () => {
                dbGet('friends', friendIdToClear, friend => {
                    if (friend) {
                        friend.lastMsg = '';
                        friend.lastTime = getCurrentTimeStr();
                        dbUpdate('friends', friend, () => {
                            clearHistoryModal.style.display = 'none';
                            friendIdToClear = null;
                            renderChatList();
                            
                            // 如果当前正打开着这个聊天，也需要清空界面
                            if (currentChatFriendId === friend.id && document.getElementById('chat-interface-page').classList.contains('active')) {
                                document.getElementById('chat-messages-container').innerHTML = '';
                            }
                        });
                    } else {
                        clearHistoryModal.style.display = 'none';
                        friendIdToClear = null;
                    }
                });
            };
        });

        // --- Chat Interface Logic ---
        const chatInput = document.getElementById('chat-message-input');
        const sendBtn = document.getElementById('send-message-btn');
        const voiceIcon = document.getElementById('voice-icon');
        const emojiIcon = document.getElementById('emoji-icon');
        const plusIcon = document.getElementById('plus-icon');
        const emojiPanel = document.getElementById('emoji-panel');
        const actionPanel = document.getElementById('action-panel');
        const actionImageInput = document.getElementById('action-image-input');
        let lastMessageTimestamp = null;
        let currentQuote = null;

        function cancelQuote() {
            currentQuote = null;
            document.getElementById('quote-preview-bar').style.display = 'none';
        }

        // --- Sticker Panel Logic ---
        let stickerGroups = JSON.parse(localStorage.getItem('sticker_groups')) || ['全部', '默认'];
        let currentStickerGroup = '全部';

        const stickerGrid = document.getElementById('sticker-grid');
        const stickerGroupsContainer = document.getElementById('sticker-groups');
        const stickerUploadBtn = document.getElementById('sticker-upload-btn');
        const stickerFileInput = document.getElementById('sticker-file-input');
        const addStickerGroupBtn = document.getElementById('add-sticker-group-btn');
        const addStickerUrlBtn = document.getElementById('add-sticker-url-btn');
        const stickerUrlModal = document.getElementById('sticker-url-modal');
        const diceBtn = document.getElementById('dice-btn');

        let isStickerEditMode = false;
        let isGroupEditMode = false;

        function toggleEmojiPanel() {
            const isVisible = emojiPanel.style.display === 'flex';
            emojiPanel.style.display = isVisible ? 'none' : 'flex';
            actionPanel.style.display = 'none'; // Close action panel if open
            if (isVisible) {
                // If closing, reset input focus
                chatInput.focus();
                exitStickerEditMode();
                exitGroupEditMode();
            } else {
                // If opening, render content
                renderStickerGroups();
                renderStickerGrid();
            }
        }

        function toggleActionPanel() {
            const isVisible = actionPanel.style.display === 'flex';
            actionPanel.style.display = isVisible ? 'none' : 'flex';
            emojiPanel.style.display = 'none'; // Close emoji panel if open
            
            if (!isVisible) {
                // If opening
                exitStickerEditMode();
                exitGroupEditMode();
            } else {
                // If closing
                chatInput.focus();
            }
        }

        plusIcon.addEventListener('click', toggleActionPanel);

        function triggerActionImageUpload() {
            actionImageInput.click();
        }

        function dataURLtoFile(dataurl, filename) {
            var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
                bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
            while(n--){
                u8arr[n] = bstr.charCodeAt(n);
            }
            return new File([u8arr], filename, {type:mime});
        }

        async function uploadFileToGemini(file, apiKey) {
            const formData = new FormData();
            formData.append('file', file);

            const uploadUrl = `https://generativelanguage.googleapis.com/v1beta/files?key=${apiKey}`;
            
            try {
                const response = await fetch(uploadUrl, {
                    method: 'POST',
                    body: formData
                });
                if (!response.ok) {
                    const errorBody = await response.text();
                    throw new Error(`File upload failed: ${response.status} ${errorBody}`);
                }
                const data = await response.json();
                return data.file; // { name, uri, mimeType }
            } catch (error) {
                console.error('Error uploading file to Gemini:', error);
                showToast('图片上传失败，请稍后重试。');
                return null;
            }
        }

        actionImageInput.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;

            toggleActionPanel(); // Close panel immediately

            const configStr = localStorage.getItem('globalConfig');
            const config = configStr ? JSON.parse(configStr) : {};
            const isGemini = !config.apiUrl;

            for (const file of Array.from(files)) {
                const compressedSrc = await new Promise(resolve => compressImage(file, 0.7, resolve));
                
                let messagePayload = {
                    friendId: currentChatFriendId,
                    text: compressedSrc, // Fallback for non-Gemini or if upload fails
                    type: 'sent',
                    timestamp: Date.now(),
                    isSticker: true,
                    isPhoto: true,
                    fileUris: []
                };

                if (isGemini && config.apiKey) {
                    const tempFile = dataURLtoFile(compressedSrc, `upload_${Date.now()}.png`);
                    const uploadedFile = await uploadFileToGemini(tempFile, config.apiKey);
                    
                    if (uploadedFile) {
                        messagePayload.fileUris.push({
                            fileUri: uploadedFile.uri,
                            mimeType: uploadedFile.mimeType
                        });
                        // We still keep the compressedSrc in 'text' as a visual fallback for the UI
                    }
                }
                
                addMessageToUI(messagePayload);
                dbAdd('chat_history', messagePayload);

                dbGet('friends', currentChatFriendId, friend => {
                    if (friend) {
                        friend.lastMsg = '[图片]';
                        friend.lastTime = getCurrentTimeStr();
                        dbUpdate('friends', friend, renderChatList);
                    }
                });
            }
            e.target.value = ''; // Reset input
        });

        function enterStickerEditMode() {
            isStickerEditMode = true;
            stickerGrid.classList.add('edit-mode');
            exitGroupEditMode(); // Ensure mutually exclusive
        }

        function exitStickerEditMode() {
            isStickerEditMode = false;
            stickerGrid.classList.remove('edit-mode');
        }

        function enterGroupEditMode() {
            isGroupEditMode = true;
            stickerGroupsContainer.classList.add('edit-mode');
            exitStickerEditMode(); // Ensure mutually exclusive
        }

        function exitGroupEditMode() {
            isGroupEditMode = false;
            stickerGroupsContainer.classList.remove('edit-mode');
        }

        // 点击空白处退出编辑模式
        emojiPanel.addEventListener('click', (e) => {
            if (isStickerEditMode && !e.target.closest('.sticker-item') && !e.target.closest('.sticker-action-btn') && !e.target.closest('.sticker-group-tab')) {
                exitStickerEditMode();
            }
            if (isGroupEditMode && !e.target.closest('.sticker-group-tab')) {
                exitGroupEditMode();
            }
        });

        // 点击聊天内容区域也能退出编辑模式
        document.getElementById('chat-messages-container').addEventListener('click', () => {
            if (isStickerEditMode) exitStickerEditMode();
            if (isGroupEditMode) exitGroupEditMode();

            // Close emoji/action panels when clicking on chat area
            const emojiPanel = document.getElementById('emoji-panel');
            const actionPanel = document.getElementById('action-panel');
            if (emojiPanel.style.display === 'flex') {
                emojiPanel.style.display = 'none';
            }
            if (actionPanel.style.display === 'flex') {
                actionPanel.style.display = 'none';
            }
        });
        
        emojiIcon.addEventListener('click', toggleEmojiPanel);

        function renderStickerGroups() {
            stickerGroupsContainer.innerHTML = '';
            stickerGroups.forEach(group => {
                const tab = document.createElement('div');
                tab.className = 'sticker-group-tab';
                if (group === currentStickerGroup) {
                    tab.classList.add('active');
                }
                
                const span = document.createElement('span');
                span.textContent = group;
                tab.appendChild(span);

                if (group !== '全部' && group !== '默认') {
                    const deleteBtn = document.createElement('div');
                    deleteBtn.className = 'sticker-group-delete-btn';
                    deleteBtn.innerHTML = '&times;';
                    deleteBtn.onclick = (e) => {
                        e.stopPropagation();
                        showCustomConfirm(`确定要删除分组“${group}”吗？`, () => {
                            deleteStickerGroup(group);
                        }, '删除分组');
                    };
                    tab.appendChild(deleteBtn);
                }

                let pressTimer;
                let wasLongPress = false;

                const startPress = (e) => {
                    if (e.button === 2) return;
                    wasLongPress = false;
                    pressTimer = setTimeout(() => {
                        wasLongPress = true;
                        enterGroupEditMode();
                    }, 500);
                };

                const cancelPress = () => {
                    clearTimeout(pressTimer);
                };

                tab.addEventListener('mousedown', startPress);
                tab.addEventListener('touchstart', startPress, { passive: true });
                tab.addEventListener('mouseup', cancelPress);
                tab.addEventListener('mouseleave', cancelPress);
                tab.addEventListener('touchend', cancelPress);
                tab.addEventListener('touchcancel', cancelPress);

                tab.onclick = () => {
                    if (wasLongPress) return;
                    if (isGroupEditMode) {
                        exitGroupEditMode(); // Exit edit mode on click
                        return;
                    }
                    currentStickerGroup = group;
                    renderStickerGroups();
                    renderStickerGrid();
                };
                stickerGroupsContainer.appendChild(tab);
            });
            
            // Re-apply class if needed
            if (isGroupEditMode) {
                stickerGroupsContainer.classList.add('edit-mode');
            }
        }

        function deleteStickerGroup(groupName) {
            stickerGroups = stickerGroups.filter(g => g !== groupName);
            localStorage.setItem('sticker_groups', JSON.stringify(stickerGroups));
            if (currentStickerGroup === groupName) {
                currentStickerGroup = '全部';
            }
            renderStickerGroups();
            renderStickerGrid();
            
            // Also update stickers in DB to point to '默认' or remain as is?
            // Stickers will remain in DB but won't be filterable by the deleted group anymore.
            // They will show up in '全部'.
        }

        function renderStickerGrid() {
            // Clear previous stickers, but keep dice and upload button
            const staticItems = [diceBtn, stickerUploadBtn];
            stickerGrid.innerHTML = '';
            staticItems.forEach(item => stickerGrid.appendChild(item));

            const transaction = db.transaction(['stickers'], 'readonly');
            const store = transaction.objectStore('stickers');
            
            const displayStickers = (stickers) => {
                stickers.forEach(sticker => {
                    const item = document.createElement('div');
                    item.className = 'sticker-item';
                    
                    const img = document.createElement('img');
                    img.src = sticker.src;
                    img.alt = 'sticker';
                    
                    const deleteBtn = document.createElement('div');
                    deleteBtn.className = 'sticker-delete-btn';
                    deleteBtn.innerHTML = '&times;';
                    
                    deleteBtn.onclick = (e) => {
                        e.stopPropagation(); // 防止触发表情主体点击
                        dbDelete('stickers', sticker.id, () => {
                            // 重新渲染以更新视图，保持在编辑模式
                            renderStickerGrid();
                            // 因为 renderStickerGrid 会重新创建 DOM，我们需要重新应用 edit-mode
                            if (isStickerEditMode) {
                                stickerGrid.classList.add('edit-mode');
                            }
                        });
                    };

                    item.appendChild(img);
                    item.appendChild(deleteBtn);

                    let pressTimer;
                    let wasLongPress = false;

                    const startPress = (e) => {
                        if (e.button === 2) return;
                        wasLongPress = false;
                        pressTimer = setTimeout(() => {
                            wasLongPress = true;
                            enterStickerEditMode();
                        }, 500); // 500ms 触发长按
                    };

                    const cancelPress = () => {
                        clearTimeout(pressTimer);
                    };

                    item.addEventListener('mousedown', startPress);
                    item.addEventListener('touchstart', startPress, { passive: true });
                    item.addEventListener('mouseup', cancelPress);
                    item.addEventListener('mouseleave', cancelPress);
                    item.addEventListener('touchend', cancelPress);
                    item.addEventListener('touchcancel', cancelPress);

                    item.onclick = (e) => {
                        if (wasLongPress) return; // 如果是长按松开，不触发点击
                        
                        if (isStickerEditMode) {
                            // 在编辑模式下点击表情主体（非删除按钮），退出编辑模式
                            exitStickerEditMode();
                        } else {
                            // 正常模式下，发送表情
                            sendSticker(sticker.src, sticker.description);
                        }
                    };

                    stickerGrid.appendChild(item);
                });
            };

            if (currentStickerGroup === '全部') {
                store.getAll().onsuccess = (e) => displayStickers(e.target.result);
            } else {
                const index = store.index('group');
                index.getAll(currentStickerGroup).onsuccess = (e) => displayStickers(e.target.result);
            }
        }

        function sendSticker(src, description = null) {
            if (!currentChatFriendId) return;
            const message = {
                friendId: currentChatFriendId,
                text: src,
                type: 'sent',
                timestamp: Date.now(),
                isSticker: true
            };
            if (description) {
                message.stickerDescription = description;
            }
            addMessageToUI(message);
            dbAdd('chat_history', message);
            
            dbGet('friends', currentChatFriendId, friend => {
                if (friend) {
                    friend.lastMsg = '[图片]';
                    friend.lastTime = getCurrentTimeStr();
                    dbUpdate('friends', friend, renderChatList);
                }
            });
        }

        // Helper to create 3D Dice DOM
        function create3DDice(result) {
            const scene = document.createElement('div');
            scene.className = 'dice-scene';
            
            const cube = document.createElement('div');
            cube.className = 'cube';
            if (result) {
                cube.classList.add('show-' + result);
            } else {
                cube.classList.add('rolling');
            }

            // Create 6 faces
            const dotsCount = [1, 2, 3, 4, 5, 6];
            dotsCount.forEach(i => {
                const face = document.createElement('div');
                face.className = `cube__face cube__face--${i}`;
                for (let d = 0; d < i; d++) {
                    const dot = document.createElement('div');
                    dot.className = 'dot';
                    face.appendChild(dot);
                }
                cube.appendChild(face);
            });

            scene.appendChild(cube);
            return scene;
        }

        diceBtn.addEventListener('click', () => {
            if (!currentChatFriendId) {
                showToast('请先选择一个聊天');
                return;
            }

            // 1. Show rolling animation
            const message = {
                friendId: currentChatFriendId,
                text: 'dice:rolling',
                type: 'sent',
                timestamp: Date.now(),
                isSticker: true,
                isDice: true
            };

            const bubble = addMessageToUI(message);
            // bubble contains .dice-scene > .cube.rolling

            // 2. Wait and determine result
            setTimeout(() => {
                const result = Math.floor(Math.random() * 6) + 1;
                
                // Update UI
                const cube = bubble.querySelector('.cube');
                if (cube) {
                    cube.classList.remove('rolling');
                    cube.classList.add('show-' + result);
                }

                // Save to DB
                message.text = 'dice:' + result;
                dbAdd('chat_history', message);
                
                dbGet('friends', currentChatFriendId, friend => {
                    if (friend) {
                        friend.lastMsg = '[骰子]';
                        friend.lastTime = getCurrentTimeStr();
                        dbUpdate('friends', friend, renderChatList);
                    }
                });
            }, 1200);
        });

        let activeMessage = null;
        const msgContextMenu = document.getElementById('message-context-menu');

        document.addEventListener('click', (e) => {
            if (msgContextMenu && msgContextMenu.style.display === 'flex' && !e.target.closest('.message-context-menu')) {
                msgContextMenu.style.display = 'none';
            }
        });

        function showMessageContextMenu(e, msg) {
            activeMessage = msg;
            
            // Toggle buttons based on message type
            document.getElementById('msg-ctx-retry').style.display = (msg.type === 'received') ? 'block' : 'none';
            document.getElementById('msg-ctx-recall').style.display = (msg.type === 'sent') ? 'block' : 'none';
            
            const phoneContainer = document.querySelector('.phone-container');
            const phoneRect = phoneContainer.getBoundingClientRect();
            
            let top = (e.clientY || e.touches[0].clientY) - phoneRect.top;
            let left = (e.clientX || e.touches[0].clientX) - phoneRect.left;

            msgContextMenu.style.display = 'flex'; // Need to display first to get dimensions
            
            if (top + msgContextMenu.offsetHeight > phoneContainer.clientHeight) {
                top = phoneContainer.clientHeight - msgContextMenu.offsetHeight - 10;
            }
            if (left + msgContextMenu.offsetWidth > phoneContainer.clientWidth) {
                left = phoneContainer.clientWidth - msgContextMenu.offsetWidth - 10;
            }

            msgContextMenu.style.top = `${top}px`;
            msgContextMenu.style.left = `${left}px`;
        }

        document.getElementById('msg-ctx-copy').addEventListener('click', () => {
            if (activeMessage && activeMessage.text) {
                navigator.clipboard.writeText(activeMessage.text).then(() => showToast('已复制'));
            }
            msgContextMenu.style.display = 'none';
        });

        document.getElementById('msg-ctx-quote').addEventListener('click', () => {
            if (activeMessage) {
                let senderName = "我";
                if (activeMessage.type === 'received') {
                    const titleEl = document.getElementById('chat-interface-title');
                    if (titleEl) senderName = titleEl.textContent;
                }

                const quoteText = activeMessage.isSticker ? '[图片]' : activeMessage.text;
                
                currentQuote = {
                    text: quoteText,
                    name: senderName
                };

                const previewBar = document.getElementById('quote-preview-bar');
                const previewContent = document.getElementById('quote-preview-content');
                
                previewContent.textContent = `${senderName}: ${quoteText}`;
                previewBar.style.display = 'flex';
                
                document.getElementById('chat-message-input').focus();
            }
            msgContextMenu.style.display = 'none';
        });

        document.getElementById('msg-ctx-delete').addEventListener('click', () => {
            if (activeMessage) {
                showCustomConfirm('确定要删除这条消息吗？', () => {
                    dbGetAll('chat_history', allMsgs => {
                        const dbMsg = allMsgs.find(m => m.friendId === activeMessage.friendId && m.timestamp === activeMessage.timestamp);
                        if (dbMsg) {
                            dbDelete('chat_history', dbMsg.id, () => {
                                renderMessages(currentChatFriendId);
                            });
                        }
                    });
                }, '删除消息');
            }
            msgContextMenu.style.display = 'none';
        });

        document.getElementById('msg-ctx-recall').addEventListener('click', () => {
            if (activeMessage) {
                dbGetAll('chat_history', allMsgs => {
                    const dbMsg = allMsgs.find(m => m.friendId === activeMessage.friendId && m.timestamp === activeMessage.timestamp);
                    if (dbMsg) {
                        dbMsg.isRecalled = true;
                        dbMsg.text = '你撤回了一条消息'; 
                        dbUpdate('chat_history', dbMsg, () => {
                            renderMessages(currentChatFriendId);
                        });
                    }
                });
            }
            msgContextMenu.style.display = 'none';
        });

        document.getElementById('msg-ctx-retry').addEventListener('click', () => {
            if (activeMessage) {
                dbGetAll('chat_history', allMsgs => {
                    const messagesToDelete = allMsgs.filter(m => m.friendId === activeMessage.friendId && m.timestamp >= activeMessage.timestamp);
                    if (messagesToDelete.length > 0) {
                        let deletedCount = 0;
                        messagesToDelete.forEach(msg => {
                            dbDelete('chat_history', msg.id, () => {
                                deletedCount++;
                                if (deletedCount === messagesToDelete.length) {
                                    renderMessages(currentChatFriendId);
                                    triggerAIResponse();
                                }
                            });
                        });
                    }
                });
            }
            msgContextMenu.style.display = 'none';
        });

        document.getElementById('msg-ctx-multiselect').addEventListener('click', () => {
            if (activeMessage) {
                enterSelectionMode(activeMessage);
            }
            msgContextMenu.style.display = 'none';
        });

        document.getElementById('msg-ctx-edit').addEventListener('click', () => {
            if (activeMessage) {
                document.getElementById('edit-message-content').value = activeMessage.text;
                document.getElementById('edit-message-modal').style.display = 'flex';
            }
            msgContextMenu.style.display = 'none';
        });

        // --- Selection Mode Logic ---
        let isSelectionMode = false;
        let selectedMessageIds = new Set();

        function enterSelectionMode(initialMsg) {
            isSelectionMode = true;
            selectedMessageIds.clear();
            
            const container = document.getElementById('chat-messages-container');
            container.classList.add('selection-mode');
            
            document.getElementById('chat-input-container').style.display = 'none';
            document.getElementById('selection-bottom-bar').classList.add('active');

            // Select initial message
            if (initialMsg) {
                const initialId = String(initialMsg.id || initialMsg.timestamp);
                toggleMessageSelection(initialId);
            }
        }

        function exitSelectionMode() {
            isSelectionMode = false;
            selectedMessageIds.clear();
            
            const container = document.getElementById('chat-messages-container');
            container.classList.remove('selection-mode');
            
            // Uncheck all
            container.querySelectorAll('.message-checkbox').forEach(cb => {
                cb.classList.remove('checked');
            });

            document.getElementById('chat-input-container').style.display = 'flex';
            document.getElementById('selection-bottom-bar').classList.remove('active');
        }

        function toggleMessageSelection(msgIdStr) {
            if (!isSelectionMode) return;
            
            const wrapper = document.querySelector(`.message-bubble-wrapper[data-msg-id="${msgIdStr}"]`);
            if (!wrapper) return;
            
            const checkbox = wrapper.querySelector('.message-checkbox');
            if (selectedMessageIds.has(msgIdStr)) {
                selectedMessageIds.delete(msgIdStr);
                if (checkbox) checkbox.classList.remove('checked');
            } else {
                selectedMessageIds.add(msgIdStr);
                if (checkbox) checkbox.classList.add('checked');
            }
        }

        function deleteSelectedMessages() {
            if (selectedMessageIds.size === 0) {
                showToast('请选择要删除的消息');
                return;
            }

            showCustomConfirm(`确定要删除选中的 ${selectedMessageIds.size} 条消息吗？`, () => {
                const idsToDelete = Array.from(selectedMessageIds);
                
                dbGetAll('chat_history', allMsgs => {
                    const msgsToDelete = allMsgs.filter(m => {
                        const mIdStr = String(m.id || m.timestamp);
                        return idsToDelete.includes(mIdStr) && m.friendId === currentChatFriendId;
                    });

                    let deletedCount = 0;
                    if (msgsToDelete.length === 0) {
                        exitSelectionMode();
                        return;
                    }

                    msgsToDelete.forEach(msg => {
                        dbDelete('chat_history', msg.id, () => {
                            deletedCount++;
                            if (deletedCount === msgsToDelete.length) {
                                showToast('删除成功');
                                exitSelectionMode();
                                renderMessages(currentChatFriendId);
                            }
                        });
                    });
                });
            }, '删除消息');
        }

        // Add a back button interceptor for selection mode
        const originalBackArrowClick = document.querySelector('.chat-interface-header .back-arrow').onclick;
        document.querySelector('.chat-interface-header .back-arrow').onclick = (e) => {
            if (isSelectionMode) {
                exitSelectionMode();
            } else {
                if (originalBackArrowClick) originalBackArrowClick(e);
                else showPage('wechat-page');
            }
        };

        function saveEditedMessage() {
            const newText = document.getElementById('edit-message-content').value.trim();
            if (!newText) {
                showToast('消息内容不能为空');
                return;
            }
            if (activeMessage) {
                dbGetAll('chat_history', allMsgs => {
                    const dbMsg = allMsgs.find(m => m.friendId === activeMessage.friendId && m.timestamp === activeMessage.timestamp);
                    if (dbMsg) {
                        dbMsg.text = newText;
                        dbUpdate('chat_history', dbMsg, () => {
                            document.getElementById('edit-message-modal').style.display = 'none';
                            renderMessages(currentChatFriendId);
                        });
                    }
                });
            }
        }

        function sanitizeThoughtTags(text) {
            if (!text) return '';
            // Regex to find various incorrect thought tags and replace them
            // Handles: <thought>, [thought], 【thought】, 〈thought〉, （thought） and their closing tags
            // Also handles variations in casing and whitespace like < Thought >
            let sanitizedText = text
                .replace(/<(\s*)thought(\s*)>/gi, '<thought>')
                .replace(/<\/(\s*)thought(\s*)>/gi, '</thought>')
                .replace(/\[(\s*)thought(\s*)\]/gi, '<thought>')
                .replace(/\[\/(\s*)thought(\s*)\]/gi, '</thought>')
                .replace(/【(\s*)thought(\s*)】/gi, '<thought>')
                .replace(/【\/(\s*)thought(\s*)】/gi, '</thought>')
                .replace(/〈(\s*)thought(\s*)〉/gi, '<thought>')
                .replace(/〈\/(\s*)thought(\s*)〉/gi, '</thought>')
                .replace(/（(\s*)thought(\s*)）/gi, '<thought>')
                .replace(/（\/(\s*)thought(\s*)）/gi, '</thought>');
            return sanitizedText;
        }

        function attachMessageEvents(element, messageObj) {
            let pressTimer;
            let startX, startY;
            let isLongPress = false;
            
            const startPress = (e) => {
                if (e.button === 2) return;
                isLongPress = false;
                startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
                startY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
                
                pressTimer = setTimeout(() => {
                    isLongPress = true;
                    showMessageContextMenu(e, messageObj);
                }, 500);
            };

            const cancelPress = (moveEvent) => {
                let moveX = moveEvent.type.includes('touch') ? moveEvent.touches[0].clientX : moveEvent.clientX;
                let moveY = moveEvent.type.includes('touch') ? moveEvent.touches[0].clientY : moveEvent.clientY;
                if (Math.abs(moveX - startX) > 10 || Math.abs(moveY - startY) > 10) {
                    clearTimeout(pressTimer);
                }
            };

            const endPress = (e) => {
                clearTimeout(pressTimer);
                if (isLongPress) {
                    if (e.cancelable) e.preventDefault();
                }
            };

            const onClick = (e) => {
                if (isSelectionMode) {
                    e.stopImmediatePropagation();
                    e.preventDefault();
                    const wrapper = element.closest('.message-bubble-wrapper');
                    if (wrapper) {
                        toggleMessageSelection(wrapper.dataset.msgId);
                    }
                    return;
                }
                
                if (isLongPress) {
                    e.stopImmediatePropagation();
                    e.preventDefault();
                    isLongPress = false;
                }
            };

            element.addEventListener('mousedown', startPress);
            element.addEventListener('touchstart', startPress, { passive: false });
            element.addEventListener('mouseup', endPress);
            element.addEventListener('mouseleave', endPress);
            element.addEventListener('touchend', endPress);
            element.addEventListener('touchcancel', endPress);
            element.addEventListener('mousemove', cancelPress);
            element.addEventListener('touchmove', cancelPress);
            element.addEventListener('contextmenu', (e) => { 
                e.preventDefault(); 
                showMessageContextMenu(e, messageObj); 
                isLongPress = true;
            });
            element.addEventListener('click', onClick, true);
        }

        function addMessageToUI(msg, shouldScroll = true) {
            if (msg.type === 'system') return; // Hide system messages from UI

            const container = document.getElementById('chat-messages-container');
            const msgDate = new Date(msg.timestamp);

            // New Offline Mode Handling
            if (msg.isOffline) {
                if (lastMessageTimestamp === null || msg.timestamp - lastMessageTimestamp > 5 * 60 * 1000) {
                    const timeDivider = document.createElement('div');
                    timeDivider.className = 'message-time-divider';
                    timeDivider.textContent = `${String(msgDate.getHours()).padStart(2, '0')}:${String(msgDate.getMinutes()).padStart(2, '0')}`;
                    container.appendChild(timeDivider);
                }
                lastMessageTimestamp = msg.timestamp;

                const wrapper = document.createElement('div');
                wrapper.className = `message-bubble-wrapper ${msg.type}`;
                wrapper.dataset.msgId = msg.id || msg.timestamp;

                // Selection Checkbox
                const checkbox = document.createElement('div');
                checkbox.className = 'message-checkbox';
                wrapper.appendChild(checkbox);

                const contentGroup = document.createElement('div');
                contentGroup.className = 'message-content-group';

                const bubble = document.createElement('div');
                bubble.className = `message-bubble ${msg.type}`;

                attachMessageEvents(bubble, msg);
                contentGroup.appendChild(bubble);

                const avatar = document.createElement('img');
                avatar.className = 'chat-avatar-placeholder';

                if (msg.type === 'received') {
                    wrapper.appendChild(avatar);
                    wrapper.appendChild(contentGroup);
                } else {
                    wrapper.appendChild(contentGroup);
                    wrapper.appendChild(avatar);
                }

                container.appendChild(wrapper);

                dbGet('friends', msg.friendId, friend => {
                    if (!friend || !friend.offlineSettings) {
                        bubble.innerHTML = msg.text.replace(/\n/g, '<br>');
                        return; 
                    }

                    // Sanitize and format the text
                    let sanitizedText = sanitizeThoughtTags(msg.text);
                    let formattedHtml = sanitizedText
                        .replace(/<thought>([\s\S]*?)<\/thought>/g, (match, thoughtText) => {
                            if (friend.offlineSettings.showThoughts) {
                                return `<span class="message-thought">${thoughtText}</span>`;
                            }
                            return ''; // Hide if showThoughts is false
                        })
                        .replace(/\n/g, '<br>');

                    bubble.innerHTML = formattedHtml;

                    if (msg.type === 'received') {
                        avatar.src = friend.avatar;
                        if (friend.avatarDisplay === 'hide_other' || friend.avatarDisplay === 'hide_both') {
                            avatar.style.display = 'none';
                        }
                    } else {
                        if (friend.avatarDisplay === 'hide_mine' || friend.avatarDisplay === 'hide_both') {
                            avatar.style.display = 'none';
                        }
                        if (friend.myAvatar) {
                            avatar.src = friend.myAvatar;
                        } else {
                            dbGet('user_profile', 'main_user', profile => {
                                avatar.src = (profile && profile.avatar) ? profile.avatar : 'https://via.placeholder.com/150/B5EAD7/ffffff?text=Me';
                            });
                        }
                    }

                    if (shouldScroll) container.scrollTop = container.scrollHeight;
                });
                
                return; // End execution for this message
            }

            // Time divider logic moved here
            if (lastMessageTimestamp === null || msg.timestamp - lastMessageTimestamp > 5 * 60 * 1000) {
                const timeDivider = document.createElement('div');
                timeDivider.className = 'message-time-divider';
                timeDivider.textContent = `${String(msgDate.getHours()).padStart(2, '0')}:${String(msgDate.getMinutes()).padStart(2, '0')}`;
                container.appendChild(timeDivider);
            }
            lastMessageTimestamp = msg.timestamp;

            if (msg.isRecalled) {
                const recalledWrapper = document.createElement('div');
                recalledWrapper.className = 'message-time-divider';
                recalledWrapper.style.fontSize = '12px';
                recalledWrapper.style.color = '#999';
                recalledWrapper.style.margin = '5px 0';
                recalledWrapper.textContent = msg.text || '消息已撤回';
                container.appendChild(recalledWrapper);
                if (shouldScroll) container.scrollTop = container.scrollHeight;
                return;
            }

            // Handle Transfer messages
            if (msg.isTransfer) {
                const wrapper = document.createElement('div');
                wrapper.className = `message-bubble-wrapper ${msg.type}`;
                wrapper.dataset.msgId = msg.id || msg.timestamp; // Use timestamp as fallback ID if id missing (for new msgs)

                // Selection Checkbox
                const checkbox = document.createElement('div');
                checkbox.className = 'message-checkbox';
                wrapper.appendChild(checkbox);

                const contentGroup = document.createElement('div');
                contentGroup.className = 'message-content-group';

                const bubble = document.createElement('div');
                bubble.className = `message-bubble ${msg.type} transfer-bubble`;
                
                if (msg.transferStatus === 'ACCEPTED') bubble.classList.add('accepted-state');
                if (msg.transferStatus === 'RETURNED') bubble.classList.add('returned-state');

                let iconSvg = `<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
                if (msg.transferStatus === 'ACCEPTED') {
                    iconSvg = `<path d="M5 13l4 4L19 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
                }

                let statusText = msg.transferRemark;
                let topText = `¥${msg.transferAmount}`;
                
                if (msg.transferStatus === 'ACCEPTED') {
                    if (msg.isReceipt) {
                        statusText = '已收款';
                    } else {
                        statusText = msg.type === 'sent' ? '已被接收' : '已收款';
                    }
                } else if (msg.transferStatus === 'RETURNED') {
                    statusText = '已退还';
                }

                bubble.innerHTML = `
                    <div class="transfer-content-top">
                        <div class="transfer-icon-circle">
                            <svg viewBox="0 0 24 24" class="transfer-icon-svg">${iconSvg}</svg>
                        </div>
                        <div class="transfer-info">
                            <span class="transfer-amount">${topText}</span>
                            <span class="transfer-remark">${statusText}</span>
                        </div>
                    </div>
                    <div class="transfer-content-bottom">微信转账</div>
                `;

                attachMessageEvents(bubble, msg);

                if (msg.type === 'received' && msg.transferStatus === 'PENDING') {
                    bubble.onclick = (e) => {
                        e.stopPropagation();
                        openTransferActionModal(msg);
                    };
                }

                contentGroup.appendChild(bubble);

                const avatar = document.createElement('img');
                avatar.className = 'chat-avatar-placeholder';
                
                const targetFriendId = msg.friendId || currentChatFriendId;
                dbGet('friends', targetFriendId, friend => {
                    const hideDisplay = friend ? friend.avatarDisplay : 'show_all';
                    if (msg.type === 'received' && (hideDisplay === 'hide_other' || hideDisplay === 'hide_both')) {
                        avatar.style.display = 'none';
                    } else if (msg.type === 'sent' && (hideDisplay === 'hide_mine' || hideDisplay === 'hide_both')) {
                        avatar.style.display = 'none';
                    }

                    if (msg.type === 'received') {
                        avatar.src = friend ? friend.avatar : '';
                    } else {
                        if (friend && friend.myAvatar) avatar.src = friend.myAvatar;
                        else {
                            dbGet('user_profile', 'main_user', p => { avatar.src = (p && p.avatar) ? p.avatar : 'https://via.placeholder.com/150'; });
                        }
                    }
                });

                if (msg.type === 'received') {
                    wrapper.appendChild(avatar);
                    wrapper.appendChild(contentGroup);
                } else {
                    wrapper.appendChild(contentGroup);
                    wrapper.appendChild(avatar);
                }

                container.appendChild(wrapper);
                if (shouldScroll) container.scrollTop = container.scrollHeight;
                
                return bubble;
            }

            // Handle sticker messages
            if (msg.isSticker) {
                const wrapper = document.createElement('div');
                wrapper.className = `message-bubble-wrapper ${msg.type}`;
                wrapper.dataset.msgId = msg.id || msg.timestamp;

                // Selection Checkbox
                const checkbox = document.createElement('div');
                checkbox.className = 'message-checkbox';
                wrapper.appendChild(checkbox);

                const contentGroup = document.createElement('div');
                contentGroup.className = 'message-content-group';

                const bubble = document.createElement('div');
                bubble.className = `message-bubble ${msg.type} sent-sticker-bubble`;

                // Attach events
                attachMessageEvents(bubble, msg);

                let content;
                if (msg.text && msg.text.startsWith('dice:')) {
                    // New 3D Dice
                    const val = msg.text.split(':')[1];
                    const result = val === 'rolling' ? null : parseInt(val);
                    content = create3DDice(result);
                } else {
                    // Legacy Image Dice or normal sticker
                    content = document.createElement('img');
                    content.src = msg.text;
                    content.className = 'sent-sticker';
                    if (msg.isDice) {
                        content.classList.add('dice-sticker');
                    } else {
                        // Add click to view full size for non-dice images
                        content.onclick = (e) => {
                            e.stopPropagation();
                            openImageViewer(msg.text);
                        };
                    }
                }

                bubble.appendChild(content);
                contentGroup.appendChild(bubble);
                
                const avatar = document.createElement('img');
                avatar.className = 'chat-avatar-placeholder';
                
                const targetFriendId = msg.friendId || currentChatFriendId;
                if (msg.type === 'received') {
                    dbGet('friends', targetFriendId, friend => {
                        if (friend) {
                            avatar.src = friend.avatar;
                            if (friend.avatarDisplay === 'hide_other' || friend.avatarDisplay === 'hide_both') {
                                avatar.style.display = 'none';
                            }
                        }
                    });
                    wrapper.appendChild(avatar);
                    wrapper.appendChild(contentGroup);
                } else { // 'sent'
                    dbGet('friends', targetFriendId, friend => {
                        if (friend && (friend.avatarDisplay === 'hide_mine' || friend.avatarDisplay === 'hide_both')) {
                            avatar.style.display = 'none';
                        }
                        if (friend && friend.myAvatar) {
                            avatar.src = friend.myAvatar;
                        } else {
                            dbGet('user_profile', 'main_user', profile => {
                                if (profile && profile.avatar) avatar.src = profile.avatar;
                                else avatar.src = 'https://via.placeholder.com/150/B5EAD7/ffffff?text=Me';
                            });
                        }
                    });
                    wrapper.appendChild(contentGroup);
                    wrapper.appendChild(avatar);
                }

                container.appendChild(wrapper);
                if (shouldScroll) container.scrollTop = container.scrollHeight;
                
                return bubble; 
            }

            const wrapper = document.createElement('div');
            wrapper.className = `message-bubble-wrapper ${msg.type}`;
            wrapper.dataset.msgId = msg.id || msg.timestamp;

            // Selection Checkbox
            const checkbox = document.createElement('div');
            checkbox.className = 'message-checkbox';
            wrapper.appendChild(checkbox);

            const contentGroup = document.createElement('div');
            contentGroup.className = 'message-content-group';

            const bubble = document.createElement('div');
            bubble.className = `message-bubble ${msg.type}`;
            bubble.textContent = msg.text;

            // Attach events
            attachMessageEvents(bubble, msg);

            contentGroup.appendChild(bubble);

            // Quote content
            if (msg.quote) {
                const quoteBlock = document.createElement('div');
                quoteBlock.className = 'message-quote-block';
                
                const quoteName = document.createElement('span');
                quoteName.className = 'message-quote-name';
                quoteName.textContent = msg.quote.name + ':';
                
                const quoteText = document.createElement('span');
                quoteText.className = 'message-quote-text';
                quoteText.textContent = msg.quote.text;
                
                quoteBlock.appendChild(quoteName);
                quoteBlock.appendChild(quoteText);
                contentGroup.appendChild(quoteBlock);
            }

            const avatar = document.createElement('img');
            avatar.className = 'chat-avatar-placeholder';

            if (msg.type === 'received') {
                dbGet('friends', currentChatFriendId, friend => {
                    if (friend) {
                        avatar.src = friend.avatar;
                        // Handle avatar hiding for received messages
                        if (friend.avatarDisplay === 'hide_other' || friend.avatarDisplay === 'hide_both') {
                            avatar.style.display = 'none';
                        }
                    }
                });
                wrapper.appendChild(avatar);
                wrapper.appendChild(contentGroup);
            } else { // 'sent'
                const targetFriendId = msg.friendId || currentChatFriendId;
                dbGet('friends', targetFriendId, friend => {
                    // Handle avatar hiding for sent messages
                    if (friend && (friend.avatarDisplay === 'hide_mine' || friend.avatarDisplay === 'hide_both')) {
                        avatar.style.display = 'none';
                    }

                    if (friend && friend.myAvatar) {
                        avatar.src = friend.myAvatar;
                    } else {
                        dbGet('user_profile', 'main_user', profile => {
                            if (profile && profile.avatar) {
                                avatar.src = profile.avatar;
                            } else {
                                // A default placeholder if user has no avatar
                                avatar.src = 'https://via.placeholder.com/150/B5EAD7/ffffff?text=Me';
                            }
                        });
                    }
                });
                wrapper.appendChild(contentGroup);
                wrapper.appendChild(avatar);
            }
            
            container.appendChild(wrapper);
            if (shouldScroll) {
                container.scrollTop = container.scrollHeight;
            }
        }

        function openImageViewer(src) {
            document.getElementById('image-viewer-img').src = src;
            document.getElementById('image-viewer-modal').style.display = 'flex';
        }

        function closeImageViewer() {
            document.getElementById('image-viewer-modal').style.display = 'none';
        }

        function compressImage(file, quality = 0.7, callback) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.getElementById('compression-canvas');
                    const ctx = canvas.getContext('2d');
                    
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // For GIFs, we can't really compress them via canvas, so just return the original
                    if (file.type === 'image/gif') {
                        callback(e.target.result);
                        return;
                    }

                    // Determine output format
                    // If it's a PNG, keep it as PNG to preserve transparency. Otherwise use JPEG for better compression.
                    const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';

                    // For other types, compress
                    const dataUrl = canvas.toDataURL(mimeType, quality);
                    callback(dataUrl);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }

        stickerUploadBtn.addEventListener('click', () => stickerFileInput.click());

        stickerFileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;

            let processedCount = 0;
            const totalFiles = files.length;

            Array.from(files).forEach(file => {
                compressImage(file, 0.6, (compressedSrc) => {
                    const newSticker = {
                        src: compressedSrc,
                        group: currentStickerGroup === '全部' ? '默认' : currentStickerGroup
                    };
                    dbAdd('stickers', newSticker, () => {
                        processedCount++;
                        if (processedCount === totalFiles) {
                            renderStickerGrid();
                        }
                    });
                });
            });
            e.target.value = ''; // Reset file input
        });

        function showGenericStickerModal(config) {
            const modal = document.getElementById('generic-sticker-modal');
            const titleEl = document.getElementById('sticker-modal-title');
            const bodyEl = document.getElementById('sticker-modal-body');
            const confirmBtn = document.getElementById('sticker-modal-confirm-btn');
            const cancelBtn = document.getElementById('sticker-modal-cancel-btn');

            titleEl.textContent = config.title;
            bodyEl.innerHTML = config.body;
            
            // Initialize any selects inside the body
            bodyEl.querySelectorAll('select').forEach(select => initCustomSelect(select));

            modal.style.display = 'flex';

            const input = bodyEl.querySelector('input, textarea');
            if(input) input.focus();

            confirmBtn.onclick = () => {
                const value = input ? input.value.trim() : null;
                if (config.onConfirm(value)) {
                    modal.style.display = 'none';
                }
            };

            cancelBtn.onclick = () => {
                modal.style.display = 'none';
                if (config.onCancel) {
                    config.onCancel();
                }
            };
        }

        addStickerGroupBtn.addEventListener('click', () => {
            showGenericStickerModal({
                title: '新建表情包分组',
                body: `<label for="new-group-name">分组名称</label><input type="text" id="new-group-name" placeholder="输入分组名">`,
                onConfirm: (newGroup) => {
                    if (newGroup && !stickerGroups.includes(newGroup)) {
                        stickerGroups.push(newGroup);
                        localStorage.setItem('sticker_groups', JSON.stringify(stickerGroups));
                        currentStickerGroup = newGroup;
                        renderStickerGroups();
                        renderStickerGrid();
                        return true;
                    } else if (!newGroup) {
                        showToast('分组名不能为空');
                        return false;
                    } else {
                        showToast('该分组已存在');
                        return false;
                    }
                }
            });
        });

        addStickerUrlBtn.addEventListener('click', () => {
            showGenericStickerModal({
                title: '批量添加链接表情',
                body: `
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <div>
                            <div style="font-size:12px; color:#666; margin-bottom:5px;">格式：含义 链接 (用空格分隔)</div>
                            <textarea id="chat-sticker-batch-input" placeholder="例如：\n开心 http://example.com/happy.png\n哭泣 http://example.com/sad.jpg" style="height:150px; padding: 10px; border: 1px solid #e0e0e0; border-radius: 8px; width: 100%; resize: none; box-sizing: border-box;"></textarea>
                        </div>
                    </div>
                `,
                onConfirm: () => {
                    const text = document.getElementById('chat-sticker-batch-input').value.trim();
                    if (!text) {
                        showToast('请输入内容');
                        return false;
                    }

                    const lines = text.split('\n');
                    const validStickers = [];

                    lines.forEach(line => {
                        line = line.trim();
                        if (!line) return;

                        const parts = line.split(/\s+/);
                        if (parts.length < 2) return; 
                        
                        const url = parts[parts.length - 1];
                        if (!url.startsWith('http')) return;
                        
                        const desc = parts.slice(0, parts.length - 1).join(' ');
                        
                        validStickers.push({
                            src: url,
                            description: desc,
                            group: currentStickerGroup === '全部' ? '默认' : currentStickerGroup
                        });
                    });

                    if (validStickers.length === 0) {
                        showToast('未识别到有效格式，请确保每行包含“含义”和“http链接”');
                        return false;
                    }

                    const transaction = db.transaction(['stickers'], 'readwrite');
                    const store = transaction.objectStore('stickers');
                    let count = 0;
                    validStickers.forEach(sticker => {
                        const request = store.add(sticker);
                        request.onsuccess = () => {
                            count++;
                            if (count === validStickers.length) {
                                showToast(`成功上传 ${count} 个表情`);
                                renderStickerGrid();
                            }
                        };
                    });
                    return true;
                }
            });
        });


        function openChat(friendId, targetMsgId = null) {
            currentChatFriendId = friendId;
            dbGet('friends', friendId, friend => {
                if (!friend) return;
                document.getElementById('chat-interface-title').textContent = friend.name;
                showPage('chat-interface-page');
                renderMessages(friendId, targetMsgId);
                // Also change status bar color
                document.querySelector('.status-bar').style.backgroundColor = '#ededed';
                
                // Apply Chat Wallpaper
                const chatPage = document.getElementById('chat-interface-page');
                if (friend.chatWallpaper) {
                    chatPage.style.backgroundImage = `url(${friend.chatWallpaper})`;
                    chatPage.style.backgroundSize = 'cover';
                    chatPage.style.backgroundPosition = 'center';
                } else {
                    const globalWallpaper = localStorage.getItem('chat_wallpaper');
                    if (globalWallpaper) {
                        chatPage.style.backgroundImage = `url(${globalWallpaper})`;
                        chatPage.style.backgroundSize = 'cover';
                        chatPage.style.backgroundPosition = 'center';
                    } else {
                        chatPage.style.backgroundImage = 'none';
                        chatPage.style.backgroundColor = '#ededed';
                    }
                }
            });
        }

        function renderMessages(friendId, targetMsgId = null) {
            const container = document.getElementById('chat-messages-container');
            container.innerHTML = '';
            lastMessageTimestamp = null;

            const transaction = db.transaction(['chat_history'], 'readonly');
            const store = transaction.objectStore('chat_history');
            const index = store.index('friendId');
            const request = index.getAll(friendId);

            request.onsuccess = () => {
                const messages = request.result;
                if (messages.length > 0) {
                    messages.forEach(msg => addMessageToUI(msg, false));
                }
                
                if (targetMsgId) {
                    // Slight delay to ensure DOM is ready
                    setTimeout(() => {
                        // Try finding by dataset
                        let targetEl = document.querySelector(`.message-bubble-wrapper[data-msg-id="${targetMsgId}"]`);
                        if (targetEl) {
                            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }, 100);
                } else {
                    container.scrollTop = container.scrollHeight;
                }
            };
        }

        chatInput.addEventListener('input', () => {
            const hasText = chatInput.value.trim() !== '';
            sendBtn.style.display = hasText ? 'block' : 'none';
            voiceIcon.style.display = hasText ? 'none' : 'flex';
            emojiIcon.style.display = hasText ? 'none' : 'flex';
            plusIcon.style.display = hasText ? 'none' : 'flex';
        });

        // 键盘适配逻辑
        function hideAllInputPanels() {
            const emojiPanel = document.getElementById('emoji-panel');
            const actionPanel = document.getElementById('action-panel');
            if (emojiPanel) emojiPanel.style.display = 'none';
            if (actionPanel) actionPanel.style.display = 'none';
        }

        chatInput.addEventListener('focus', () => {
            hideAllInputPanels(); // Immediately hide panels on focus
            // 延迟滚动，等待键盘完全弹出
            setTimeout(() => {
                const container = document.getElementById('chat-messages-container');
                container.scrollTop = container.scrollHeight;
            }, 300);
        });


        function sendMessage() {
            const messageText = chatInput.value.trim();
            if (messageText === '' || !currentChatFriendId) return;

            const message = {
                friendId: currentChatFriendId,
                text: messageText,
                type: 'sent',
                timestamp: Date.now()
            };

            if (currentQuote) {
                message.quote = currentQuote;
                cancelQuote();
            }

            addMessageToUI(message);
            dbAdd('chat_history', message);

            dbGet('friends', currentChatFriendId, friend => {
                if (friend) {
                    friend.lastMsg = messageText;
                    friend.lastTime = getCurrentTimeStr();
                    dbUpdate('friends', friend, () => {
                        if (document.getElementById('wechat-page').classList.contains('active')) {
                            renderChatList();
                        }
                    });
                }
            });

            chatInput.value = '';
            sendBtn.style.display = 'none';
            voiceIcon.style.display = 'flex';
            emojiIcon.style.display = 'flex';
            plusIcon.style.display = 'flex';
        }

        sendBtn.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        let isAITyping = false;

        function showTypingIndicator(friendId) {
            if (currentChatFriendId === friendId) {
                const titleEl = document.getElementById('chat-interface-title');
                if (titleEl) {
                    titleEl.textContent = '对方正在输入...';
                }
            }
        }

        function hideTypingIndicator(friendId) {
            if (currentChatFriendId === friendId) {
                const titleEl = document.getElementById('chat-interface-title');
                if (titleEl) {
                    dbGet('friends', friendId, friend => {
                        if (friend) titleEl.textContent = friend.name;
                    });
                }
            }
        }

        async function triggerAIResponse() {
            if (!currentChatFriendId || isAITyping) return;

            const configStr = localStorage.getItem('globalConfig');
            if (!configStr) {
                showToast('请先在设置页面配置 API 信息');
                return;
            }
            const config = JSON.parse(configStr);
            if (!config.apiKey || !config.model) {
                showToast('请先配置完整的 API Key 和模型');
                return;
            }

            isAITyping = true;
            voiceIcon.style.opacity = '0.5';

            showTypingIndicator(currentChatFriendId);

            try {
                dbGet('friends', currentChatFriendId, async friend => {
                    if (!friend) throw new Error("Friend not found");

                    let userPersona = null;
                    if (friend.myPersonaId) {
                        userPersona = await new Promise(resolve => dbGet('my_personas', friend.myPersonaId, resolve));
                    }

                    // Fetch AI stickers
                    let aiStickers = await new Promise(resolve => {
                        try {
                            const transaction = db.transaction(['ai_stickers'], 'readonly');
                            const store = transaction.objectStore('ai_stickers');
                            const index = store.index('friendId');
                            const req = index.getAll(friend.id);
                            req.onsuccess = () => resolve(req.result);
                            req.onerror = () => resolve([]);
                        } catch(e) {
                            resolve([]);
                        }
                    });

                    let visiblePosts = await new Promise(resolve => {
                        dbGetAll('discover_posts', posts => {
                            const vp = posts.filter(p => canBotSeePost(friend, p)).sort((a,b) => b.timestamp - a.timestamp).slice(0, 3);
                            resolve(vp);
                        });
                    });

                    const systemPrompt = buildSystemPrompt(friend, userPersona, aiStickers, visiblePosts);
                    const shortTermCount = parseInt(friend.shortTermMemory || '20', 10);

                    const transaction = db.transaction(['chat_history'], 'readonly');
                    const store = transaction.objectStore('chat_history');
                    const index = store.index('friendId');
                    const request = index.getAll(currentChatFriendId);

                    request.onsuccess = async () => {
                        let history = request.result;
                        history = history.slice(-shortTermCount);

                    try {
                        let aiResponseText = await callLLM(config, systemPrompt, history);

                        if (aiResponseText) {
                            aiResponseText = await applyRegexRules(aiResponseText, friend.id, friend.group || '默认分组');
                            const isOfflineMode = friend.offlineSettings && friend.offlineSettings.enabled;

                            if (isOfflineMode) {
                                // Offline mode: handle as a single message
                                hideTypingIndicator(friend.id);
                                const responseMsg = {
                                    friendId: friend.id,
                                    text: aiResponseText,
                                    type: 'received',
                                    timestamp: Date.now(),
                                    isOffline: true // Add our new flag
                                };

                                if (currentChatFriendId === friend.id && document.getElementById('chat-interface-page').classList.contains('active')) {
                                    addMessageToUI(responseMsg);
                                }
                                await new Promise(resolve => dbAdd('chat_history', responseMsg, resolve));
                                
                                // Update last message preview
                                const msgPreview = aiResponseText.split('\n')[0].replace(/「|」/g, '');
                                friend.lastMsg = msgPreview; // Use first line as preview, remove quotes
                                friend.lastTime = getCurrentTimeStr();
                                await new Promise(resolve => dbUpdate('friends', friend, resolve));

                                showBannerNotification(friend, msgPreview);

                                if (document.getElementById('wechat-page').classList.contains('active')) {
                                    renderChatList();
                                }
                            } else {
                                // Online mode: split into multiple messages
                                const msgParts = aiResponseText.split('\n').map(s => s.trim()).filter(s => s !== '');
                                
                                for (let i = 0; i < msgParts.length; i++) {
                                    hideTypingIndicator(friend.id);
                                    
                                    let partText = msgParts[i];
                                    let quoteData = null;
                                    let transferData = null;

                                    // New: Parse Avatar Change Command
                                    const avatarChangeRegex = /<change_avatar>(.*?)<\/change_avatar>/;
                                    const avatarChangeMatch = partText.match(avatarChangeRegex);
                                    if (avatarChangeMatch) {
                                        const imageIdOrUrl = avatarChangeMatch[1].trim();
                                        partText = partText.replace(avatarChangeRegex, '').trim();

                                        // Find the image URL from history
                                        const imageMsg = [...history].reverse().find(m => 
                                            (m.timestamp && String(m.timestamp) === imageIdOrUrl) || 
                                            (m.text === imageIdOrUrl)
                                        );
                                        
                                        if (imageMsg) {
                                            const newAvatarUrl = imageMsg.text; // The Data URL is stored in the text field
                                            friend.avatar = newAvatarUrl;
                                            await new Promise(res => dbUpdate('friends', friend, res));
                                            
                                            if (currentChatFriendId === friend.id && document.getElementById('chat-interface-page').classList.contains('active')) {
                                                renderMessages(friend.id);
                                            }
                                            renderChatList();
                                            renderContactsList();
                                            showToast(`${friend.name} 更换了新头像！`);
                                        }
                                    }

                                    // Parse Transfer
                                    const transferRegex = /<transfer amount="([^"]+)">([^<]*)<\/transfer>/;
                                    const transferMatch = partText.match(transferRegex);
                                    if (transferMatch) {
                                        transferData = {
                                            amount: transferMatch[1],
                                            remark: transferMatch[2] || '转账'
                                        };
                                        partText = partText.replace(transferRegex, '').trim();
                                    }

                                // Parse AI Sticker
                                const aiStickerRegex = /<sticker>(.*?)<\/sticker>/;
                                const aiStickerMatch = partText.match(aiStickerRegex);
                                let aiStickerUrl = null;
                                if (aiStickerMatch) {
                                    aiStickerUrl = aiStickerMatch[1].trim();
                                    partText = partText.replace(aiStickerRegex, '').trim();
                                }


                                    // Parse Send Image Command
                                    const sendImageRegex = /<send_image>(.*?)<\/send_image>/;
                                    const sendImageMatch = partText.match(sendImageRegex);
                                    if (sendImageMatch) {
                                        const imageIdOrUrl = sendImageMatch[1].trim();
                                        partText = partText.replace(sendImageRegex, '').trim();

                                        const imageMsg = [...history].reverse().find(m => 
                                            (m.timestamp && String(m.timestamp) === imageIdOrUrl) || 
                                            (m.text === imageIdOrUrl)
                                        );
                                        if (imageMsg) {
                                            aiStickerUrl = imageMsg.text;
                                        } else if (imageIdOrUrl.startsWith('http') || imageIdOrUrl.startsWith('data:image')) {
                                            aiStickerUrl = imageIdOrUrl;
                                        }
                                    }

                                    // Parse Dice
                                    let hasDice = false;
                                    if (partText.includes('<dice></dice>')) {
                                        hasDice = true;
                                        partText = partText.replace(/<dice><\/dice>/g, '').trim();
                                    }

                                    // Parse Commands (Accept/Return Transfer)
                                    let hasAction = false;
                                    let actionText = '';
                                    if (partText.includes('[已接收]') || partText.includes('[已退还]')) {
                                        const isAccept = partText.includes('[已接收]');
                                        const actionStatus = isAccept ? 'ACCEPTED' : 'RETURNED';
                                        hasAction = true;
                                        actionText = isAccept ? '已收款' : '已退还';
                                        partText = partText.replace(/\[(已接收|已退还)\]/g, '').trim();
                                        
                                        transferData = await new Promise((resolve) => {
                                            const transaction = db.transaction(['chat_history'], 'readwrite');
                                            const store = transaction.objectStore('chat_history');
                                            const index = store.index('friendId');
                                            const request = index.getAll(friend.id);
                                            
                                            request.onsuccess = () => {
                                                const msgs = request.result;
                                                const pendingTransfer = [...msgs].reverse().find(m => m.type === 'sent' && m.isTransfer && m.transferStatus === 'PENDING');
                                                
                                                if (pendingTransfer) {
                                                    pendingTransfer.transferStatus = actionStatus;
                                                    store.put(pendingTransfer);
                                                    
                                                    resolve({
                                                        amount: pendingTransfer.transferAmount,
                                                        remark: actionText,
                                                        status: actionStatus,
                                                        isReceipt: true,
                                                        id: pendingTransfer.id || pendingTransfer.timestamp
                                                    });
                                                } else {
                                                    resolve(null);
                                                }
                                            };
                                            request.onerror = () => resolve(null);
                                        });
                                        
                                        if (transferData && currentChatFriendId === friend.id) {
                                            const pendingWrapper = document.querySelector(`.message-bubble-wrapper[data-msg-id="${transferData.id}"]`);
                                            if (pendingWrapper) {
                                                const bubble = pendingWrapper.querySelector('.transfer-bubble');
                                                if (bubble) {
                                                    if (transferData.status === 'ACCEPTED') bubble.classList.add('accepted-state');
                                                    if (transferData.status === 'RETURNED') bubble.classList.add('returned-state');
                                                    const remarkEl = bubble.querySelector('.transfer-remark');
                                                    if (remarkEl) remarkEl.textContent = transferData.remark;
                                                    const iconContainer = bubble.querySelector('.transfer-icon-svg');
                                                    if (iconContainer && transferData.status === 'ACCEPTED') {
                                                        iconContainer.innerHTML = `<path d="M5 13l4 4L19 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    // Parse Quote
                                    const quoteRegex = /<quote>(.*?)<\/quote>/;
                                    const match = partText.match(quoteRegex);
                                    if (match) {
                                        quoteData = {
                                            text: match[1],
                                            name: userPersona ? userPersona.name : '我'
                                        };
                                        partText = partText.replace(quoteRegex, '').trim();
                                    }
                                    
                                    if (partText === '' && !transferData && !aiStickerUrl && !hasDice) {
                                        if (hasAction) {
                                            partText = actionText;
                                        } else if (avatarChangeMatch) {
                                            continue;
                                        }
                                        else {
                                            continue;
                                        }
                                    }

                                    if (transferData) {
                                        if (partText) {
                                            const textMsg = { friendId: friend.id, text: partText, type: 'received', timestamp: Date.now() };
                                            if (quoteData) textMsg.quote = quoteData;
                                            if (currentChatFriendId === friend.id && document.getElementById('chat-interface-page').classList.contains('active')) {
                                                addMessageToUI(textMsg);
                                            } else {
                                                showBannerNotification(friend, partText);
                                            }
                                            await new Promise(resolve => dbAdd('chat_history', textMsg, resolve));
                                        }

                                        const transferMsg = { friendId: friend.id, text: `[转账] ¥${transferData.amount}`, type: 'received', timestamp: Date.now() + 100, isTransfer: true, transferAmount: transferData.amount, transferRemark: transferData.remark, transferStatus: transferData.status || 'PENDING', isReceipt: transferData.isReceipt || false };
                                        if (currentChatFriendId === friend.id && document.getElementById('chat-interface-page').classList.contains('active')) {
                                            addMessageToUI(transferMsg);
                                        } else {
                                            showBannerNotification(friend, `[转账] ¥${transferData.amount}`);
                                        }
                                        await new Promise(resolve => dbAdd('chat_history', transferMsg, resolve));
                                        friend.lastMsg = `[转账]`;
                                    } else if (aiStickerUrl) {
                                        if (partText) {
                                            const textMsg = { friendId: friend.id, text: partText, type: 'received', timestamp: Date.now() };
                                            if (quoteData) textMsg.quote = quoteData;
                                            if (currentChatFriendId === friend.id && document.getElementById('chat-interface-page').classList.contains('active')) {
                                                addMessageToUI(textMsg);
                                            } else {
                                                showBannerNotification(friend, partText);
                                            }
                                            await new Promise(resolve => dbAdd('chat_history', textMsg, resolve));
                                        }

                                        const stickerMsg = { friendId: friend.id, text: aiStickerUrl, type: 'received', timestamp: Date.now() + 100, isSticker: true };
                                        if (currentChatFriendId === friend.id && document.getElementById('chat-interface-page').classList.contains('active')) {
                                            addMessageToUI(stickerMsg);
                                        } else {
                                            showBannerNotification(friend, '[表情]');
                                        }
                                        await new Promise(resolve => dbAdd('chat_history', stickerMsg, resolve));
                                        friend.lastMsg = '[表情]';
                                    } else if (hasDice) {
                                        if (partText) {
                                            const textMsg = { friendId: friend.id, text: partText, type: 'received', timestamp: Date.now() };
                                            if (quoteData) textMsg.quote = quoteData;
                                            if (currentChatFriendId === friend.id && document.getElementById('chat-interface-page').classList.contains('active')) {
                                                addMessageToUI(textMsg);
                                            } else {
                                                showBannerNotification(friend, partText);
                                            }
                                            await new Promise(resolve => dbAdd('chat_history', textMsg, resolve));
                                        }

                                        const diceMsg = { friendId: friend.id, text: 'dice:rolling', type: 'received', timestamp: Date.now() + 100, isSticker: true, isDice: true };
                                        let bubble;
                                        if (currentChatFriendId === friend.id && document.getElementById('chat-interface-page').classList.contains('active')) {
                                            bubble = addMessageToUI(diceMsg);
                                        } else {
                                            showBannerNotification(friend, '[骰子]');
                                        }
                                        
                                        await new Promise(res => setTimeout(res, 1200));
                                        const result = Math.floor(Math.random() * 6) + 1;
                                        if (bubble) {
                                            const cube = bubble.querySelector('.cube');
                                            if (cube) {
                                                cube.classList.remove('rolling');
                                                cube.classList.add('show-' + result);
                                            }
                                        }
                                        diceMsg.text = 'dice:' + result;
                                        await new Promise(resolve => dbAdd('chat_history', diceMsg, resolve));
                                        friend.lastMsg = '[骰子]';
                                    } else {
                                        const responseMsg = { friendId: friend.id, text: partText, type: 'received', timestamp: Date.now() };
                                        if (quoteData) responseMsg.quote = quoteData;

                                        if (currentChatFriendId === friend.id && document.getElementById('chat-interface-page').classList.contains('active')) {
                                            addMessageToUI(responseMsg);
                                        } else {
                                            if (partText) showBannerNotification(friend, partText);
                                        }
                                        await new Promise(resolve => dbAdd('chat_history', responseMsg, resolve));
                                        friend.lastMsg = partText;
                                    }

                                    friend.lastTime = getCurrentTimeStr();
                                    await new Promise(resolve => dbUpdate('friends', friend, resolve));

                                    if (document.getElementById('wechat-page').classList.contains('active')) {
                                        renderChatList();
                                    }

                                    if (i < msgParts.length - 1) {
                                        showTypingIndicator(friend.id);
                                        const delay = Math.min(Math.max(msgParts[i+1].length * 100, 1000), 3000);
                                        await new Promise(res => setTimeout(res, delay));
                                    }
                                }
                            }
                        } else {
                            hideTypingIndicator(friend.id);
                        }
                    } catch (apiError) {
                        console.error(apiError);
                        hideTypingIndicator(currentChatFriendId);
                        showToast('请求失败: ' + apiError.message);
                    } finally {
                        isAITyping = false;
                        voiceIcon.style.opacity = '1';
                    }
                };
            });
        } catch (e) {
            isAITyping = false;
            voiceIcon.style.opacity = '1';
            hideTypingIndicator(currentChatFriendId);
            showToast('发生错误');
        }
        }


        function getHoliday(date) {
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const md = `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            
            const solarHolidays = {
                '01-01': '元旦',
                '02-14': '情人节',
                '03-08': '妇女节',
                '03-12': '植树节',
                '04-01': '愚人节',
                '05-01': '劳动节',
                '05-04': '青年节',
                '06-01': '儿童节',
                '07-01': '建党节',
                '08-01': '建军节',
                '09-10': '教师节',
                '10-01': '国庆节',
                '12-24': '平安夜',
                '12-25': '圣诞节'
            };

            return solarHolidays[md] || '';
        }

        function buildSystemPrompt(friend, userPersona = null, aiStickers = [], visiblePosts = []) {
            let prompt = `你现在的身份是：${friend.realName || friend.name}。\n`;
            const isOfflineMode = friend.offlineSettings && friend.offlineSettings.enabled;

            if (aiStickers && aiStickers.length > 0) {
                prompt += `【你的专属表情包】\n你可以使用以下表情包来表达情感。请根据语境选择合适的表情包，直接输出对应的 XML 标签（不要修改链接）：\n`;
                aiStickers.forEach((sticker, index) => {
                    const desc = sticker.description ? ` (含义：${sticker.description})` : '';
                    prompt += `${index + 1}. <sticker>${sticker.src}</sticker>${desc}\n`;
                });
                prompt += `\n`;
            }

            if (friend.syncReality) {
                const now = new Date();
                const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
                const timeString = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${weekDays[now.getDay()]} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                
                let holiday = getHoliday(now);
                let timePrompt = `【当前现实时间】\n现在是 ${timeString}。`;
                if (holiday) {
                    timePrompt += `\n今天是 ${holiday}。`;
                }
                timePrompt += `\n请感知当前时间，并根据时间调整你的语气、问候语或行为（例如深夜时表现出困意或提醒休息，工作时间表现出忙碌或摸鱼等）。`;
                
                prompt += timePrompt + `\n\n`;
            }

            if (friend.persona) {
                prompt += `【人设设定】\n${friend.persona}\n\n`;
            }
            if (userPersona) {
                prompt += `【对话对象（用户）的人设】\n名字：${userPersona.name}\n设定：${userPersona.content}\n\n`;
            }
            if (friend.boundWorldBooks && friend.boundWorldBooks.length > 0) {
                prompt += `【世界观/设定书】\n`;
                friend.boundWorldBooks.forEach(wbId => {
                    const wb = worldBooks.find(b => b.id === wbId);
                    if (wb) {
                        prompt += `《${wb.title}》：\n${wb.content}\n\n`;
                    }
                });
            }
            if (friend.memories && friend.memories.length > 0) {
                prompt += `【你的长期记忆】\n`;
                friend.memories.forEach((mem, index) => {
                    prompt += `${index + 1}. ${mem.content}\n`;
                });
                prompt += `\n`;
            }

            if (visiblePosts && visiblePosts.length > 0) {
                prompt += `【最近的朋友圈动态】\n这些是你能在朋友圈看到的用户最新动态：\n`;
                visiblePosts.forEach((post, index) => {
                    const date = new Date(post.timestamp);
                    const timeStr = `${date.getMonth()+1}-${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                    prompt += `${index + 1}. [${timeStr}] 用户发布：${post.text || '无文字'}\n`;
                    if (post.images && post.images.length > 0) prompt += `   (附带了 ${post.images.length} 张图片)\n`;
                });
                prompt += `你可以根据这些动态在聊天中主动找话题或顺应聊天。\n\n`;
            }

            if (typeof musicState !== 'undefined' && musicState.isPlaying && musicState.playlist.length > 0) {
                const song = musicState.playlist[musicState.currentIndex];
                if (song) {
                    prompt += `【当前状态：一起听歌】\n你们正在一起听歌，已经听了 ${musicState.togetherMinutes} 分钟。\n正在播放：《${song.name}》 - ${song.artist}\n`;
                    if (musicState.recentLyrics && musicState.recentLyrics.length > 0) {
                        prompt += `当前播放到的最近几句歌词段落：\n“${musicState.recentLyrics.join('\n')}”\n`;
                    } else if (musicState.currentLyric) {
                        prompt += `当前播放到的歌词段落：“${musicState.currentLyric}”\n`;
                    }
                    prompt += `你可以根据当前播放的歌曲或歌词自然地发起话题、发表感想或回应用户。\n\n`;
                }
            }

            if (isOfflineMode) {
                const settings = friend.offlineSettings;
                prompt += `\n【重要：当前为线下模式，请严格遵守以下所有规则】\n`;
                prompt += `1.  **输出格式**: 你的回复必须合并为【一条完整的消息】，不能拆分成多条发送。\n`;
                prompt += `    - **灵活组合**: 在这条消息内，你可以自由组合、穿插【语言】、【动作】和【心理描写】。不需要固定的顺序（如不必须是语言+动作+心理），也不需要各部分字数相当。例如可以是：语言+心理+动作+心理+语言，或者动作+心理+语言等等。\n`;
                prompt += `    - **语言**: 必须用中文引号「」包裹。\n`;
                prompt += `    - **动作**: 直接描述，不要加任何符号。\n`;
                prompt += `    - **心理**: 必须用特殊标签 <thought>...</thought> 包裹。这是你内心的想法，系统会特殊渲染。\n`;
                prompt += `2.  **内容要求**: \n`;
                prompt += `    - 须根据场景自然地包含语言、动作和心理描写。\n`;
                if (settings.showThoughts === false) {
                     prompt += `    - **注意**: 虽然用户设置了不显示心理描写，但你仍然必须生成 <thought>...</thought> 标签，系统会自动隐藏它。\n`;
                }
                const minWords = settings.replyWordCountMin || '无';
                const maxWords = settings.replyWordCountMax || '无';
                prompt += `    - **字数限制**: 你的总回复字数（包括语言、动作、心理）应在 ${minWords} 到 ${maxWords} 字之间。请务必遵守。\n`;
                prompt += `3.  **视角**: \n`;
                prompt += `    - 你的视角是【${settings.characterPerspective === 'first_person' ? '第一人称 (我)' : '第三人称 (他/她)'}】。\n`;
                prompt += `    - 用户的视角是【${settings.yourPerspective === 'second_person' ? '第二人称 (你)' : '第一人称 (我)'}】。\n`;

            } else {
                prompt += `\n【系统提示】重要：请完全模拟真实人类在微信聊天的习惯。根据你的角色性格，灵活决定是否将一段话拆分为多条短消息发送以增加活人感。你可以根据语义、情绪和停顿，在任何地方（如逗号、句号、感叹号后，甚至一句话的中间）使用【换行符（回车）】来分隔消息。系统会自动将每一行识别为一条独立的消息发出。\n\n            【例如】，对于“你好呀，今天天气真不错！吃饭了吗？”，你可以灵活地回复为：\n\n            - **方案一:**\n              你好呀\n              今天天气真不错！\n              吃饭了吗？\n\n            - **方案二:**\n              你好呀，今天天气真不错！\n              吃饭了吗？\n\n            - **方案三:**\n              你好呀\n              今天天气真不错！吃饭了吗？\n\n            请根据你的角色性格和当前对话的节奏，自然地选择如何断句。\n            \n【功能指令】：\n1. 引用回复：如果你想引用对方（用户）的某句话进行针对性回复，请在这条消息中使用格式 <quote>被引用的对方的话</quote>。
2. 发起转账：如果你想给对方（用户）转账，请输出单独的一行：<transfer amount="金额">备注说明</transfer>。例如：<transfer amount="52.00">请你喝奶茶</transfer>。
3. 接收转账：如果对方（用户）给你转账了，你想接收，请在回复中包含：[已接收]。系统会自动将其转换为确认收款的卡片。
4. 退还转账：如果对方（用户）给你转账了，你想退还，请在回复中包含：[已退还]。系统会自动将其转换为退还转账的卡片。
5. 扔骰子：如果你想扔骰子，请在回复中包含：<dice></dice>。系统会自动将其转换为一个随机骰子动画。
6. 识别图片/表情包：对方可能会发送图片或表情包，请你结合图片内容或表情包上的文字/画面情感进行自然的回应，如果图里有梗，请根据人设回应。
7. 更换头像：如果用户发给你一张或多张图片让你换头像，你的反应要符合人设，这可以是一个多回合的互动。你可以同意、拒绝，或者先拉扯几句再同意。例如：\n- **如果你是傲娇型**：你可以先说‘我才不要，这个不好看’，如果用户哄你，你再说‘好吧好吧，真拿你没办法……’，然后输出 <change_avatar>图片ID</change_avatar> 指令。\n- **如果你想提条件**：你可以说‘换倒是可以，不过你得先夸我几句’，等用户夸完你再输出指令。\n- **如果你想马上换**：直接换，说出符合人设的话，并输出指令。\n- **核心**：让互动更真实，你可以先拒绝或嘴硬，等用户哄你或满足条件后，再输出 <change_avatar>图片ID或图片链接</change_avatar> 指令来完成更换。如果就是不想换，也可以根据人设坚持拒绝。
8. 发送图片：如果用户发给你图片并希望你把它发出来（例如玩梗等），你可以根据人设直接答应或者进行多回合互动。当你决定要发这张照片时，请输出 <send_image>图片ID或图片链接</send_image> 指令，系统会自动帮你把那张图发出去。`;
            }
            prompt += `\n请根据上述人设和记忆，以${friend.name}的口吻进行自然地回复。`;
            return prompt;
        }

        async function callLLM(config, systemPrompt, history) {
            const isGeminiDirect = !config.apiUrl;
            const temperature = parseFloat(config.temperature || 0.8);

            const processContent = (msg) => {
                let text = msg.text || '';
                let images = [];
                let fileUris = msg.fileUris || [];

                if (msg.isSticker) {
                    const src = msg.text;
                    const desc = msg.stickerDescription ? ` (含义: ${msg.stickerDescription})` : '';
                    const idTag = msg.timestamp ? ` (ID: ${msg.timestamp})` : '';
                    
                    if (src.startsWith('dice:')) {
                         text = `[骰子结果: ${src.split(':')[1]}]`;
                    } else if (msg.isPhoto) {
                        if (fileUris.length === 0) { // Only use inline data if no file URI
                            if (src.startsWith('data:image')) {
                                images.push(src);
                                text = `[发送了一张图片${idTag}${desc}]`; 
                            } else {
                                if (isGeminiDirect) {
                                    text = `[发送了一张图片${idTag}: ${src} ${desc}]`;
                                } else {
                                    images.push(src);
                                    text = `[发送了一张图片${idTag}${desc}]`;
                                }
                            }
                        } else {
                             text = `[发送了一张图片${idTag}${desc}]`;
                        }
                    } else {
                        text = `[发送了一张表情包${desc}]`;
                    }
                } else if (msg.isTransfer) {
                     if (msg.isReceipt) {
                        const action = msg.transferStatus === 'ACCEPTED' ? '已收款' : '已退还';
                        text = `[转账回执：${action} ¥${msg.transferAmount}]`;
                    } else {
                        text = `[发起转账 ¥${msg.transferAmount}，备注：${msg.transferRemark}。当前状态：${msg.transferStatus}]`;
                    }
                }
                return { text, images, fileUris };
            };

            if (isGeminiDirect) {
                const contents = [];
                
                // Gemini requires a specific alternating order.
                // Start with a user prompt (system prompt) and a model confirmation.
                contents.push({
                    role: 'user',
                    parts: [{ text: systemPrompt }]
                });
                contents.push({
                    role: 'model',
                    parts: [{ text: '好的，我明白了。' }]
                });

                for (const msg of history) {
                    const { text, images, fileUris } = processContent(msg);
                    const parts = [];
                    if (text) parts.push({ text: text });
                    
                    // Prefer fileUris
                    if (fileUris && fileUris.length > 0) {
                        for (const fileData of fileUris) {
                            parts.push({
                                fileData: {
                                    fileUri: fileData.fileUri,
                                    mimeType: fileData.mimeType
                                }
                            });
                        }
                    } 
                    // Fallback to inlineData for smaller images
                    else if (images && images.length > 0) {
                        for (const img of images) {
                            if (img.startsWith('data:')) {
                                const base64Size = Math.ceil((img.length * 3) / 4);
                                if (base64Size < 4000000) { // Keep under Gemini's 4MB limit
                                    const [meta, data] = img.split(',');
                                    const mimeMatch = meta.match(/:(.*?);/);
                                    if (mimeMatch) {
                                        parts.push({
                                            inlineData: {
                                                mimeType: mimeMatch[1],
                                                data: data
                                            }
                                        });
                                    }
                                } else {
                                    parts.push({ text: `[图片过大，已省略]` });
                                }
                            }
                        }
                    }
                    
                    if (parts.length > 0) {
                        let role = msg.type === 'sent' ? 'user' : 'model';
                        if (msg.type === 'system') role = 'user'; // Treat system hints as user context injections in Gemini
                        contents.push({
                            role: role,
                            parts: parts
                        });
                    }
                }

                const body = {
                    contents: contents,
                    generationConfig: { temperature: temperature }
                };
                
                // Ensure there's at least one user message if history is empty
                if (history.length === 0) {
                     body.contents.push({ role: 'user', parts: [{text: '你好'}] });
                }

                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`Gemini Error: ${response.status} ${errText}`);
                }
                const data = await response.json();
                if (!data.candidates || data.candidates.length === 0) {
                    console.warn("Gemini response blocked or empty:", data);
                    return "（由于安全设置，我的回复被屏蔽了。）";
                }
                return data.candidates[0].content.parts[0].text;
            } else {
                const messages = [
                    { role: 'system', content: systemPrompt }
                ];
                
                for (const msg of history) {
                    const { text, images } = processContent(msg);
                    
                    let role = msg.type === 'sent' ? 'user' : 'assistant';
                    if (msg.type === 'system') role = 'system';

                    if (images.length > 0) {
                        const content = [{ type: 'text', text: text }];
                        images.forEach(img => {
                            content.push({
                                type: 'image_url',
                                image_url: { url: img }
                            });
                        });
                        messages.push({
                            role: role,
                            content: content
                        });
                    } else {
                        messages.push({
                            role: role,
                            content: text
                        });
                    }
                }

                if (history.length === 0) {
                     messages.push({ role: 'user', content: '你好' });
                }

                let url = config.apiUrl;
                if (!url.endsWith('/')) url += '/';
                
                if (!url.includes('chat/completions')) {
                    if (url.endsWith('v1/')) {
                        url += 'chat/completions';
                    } else {
                        url += 'v1/chat/completions';
                    }
                }

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${config.apiKey}`
                    },
                    body: JSON.stringify({
                        model: config.model,
                        messages: messages,
                        temperature: temperature
                    })
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`Proxy Error: ${response.status} ${errText}`);
                }
                const data = await response.json();
                return data.choices[0].message.content;
            }
        }

        voiceIcon.addEventListener('click', triggerAIResponse);

        function checkActiveChats() {
            const configStr = localStorage.getItem('globalConfig');
            if (!configStr) return;
            const config = JSON.parse(configStr);
            if (!config.apiKey || !config.model) return;

            dbGetAll('friends', friends => {
                friends.forEach(friend => {
                    if (friend.activeChat && friend.messageInterval) {
                        const intervalMs = parseInt(friend.messageInterval) * 60 * 1000;
                        if (intervalMs <= 0) return;

                        const transaction = db.transaction(['chat_history'], 'readonly');
                        const store = transaction.objectStore('chat_history');
                        const index = store.index('friendId');
                        const request = index.getAll(friend.id);

                        request.onsuccess = () => {
                            const history = request.result;
                            let lastTs = 0;
                            if (history.length > 0) {
                                lastTs = history[history.length - 1].timestamp;
                            }
                            
                            if (Date.now() - lastTs >= intervalMs) {
                                generateProactiveMessage(friend, config);
                            }
                        };
                    }
                });
            });
        }

        async function generateProactiveMessage(friend, config, customPrompt = null) {
            try {
                let userPersona = null;
                if (friend.myPersonaId) {
                    userPersona = await new Promise(resolve => dbGet('my_personas', friend.myPersonaId, resolve));
                }

                // Fetch AI stickers
                let aiStickers = await new Promise(resolve => {
                    try {
                        const transaction = db.transaction(['ai_stickers'], 'readonly');
                        const store = transaction.objectStore('ai_stickers');
                        const index = store.index('friendId');
                        const req = index.getAll(friend.id);
                        req.onsuccess = () => resolve(req.result);
                        req.onerror = () => resolve([]);
                    } catch(e) {
                        resolve([]);
                    }
                });

                let visiblePosts = await new Promise(resolve => {
                    dbGetAll('discover_posts', posts => {
                        const vp = posts.filter(p => canBotSeePost(friend, p)).sort((a,b) => b.timestamp - a.timestamp).slice(0, 3);
                        resolve(vp);
                    });
                });

                const promptSuffix = customPrompt || "\n【系统提示】对方已经有一段时间没说话了，请你主动找个话题开启聊天。不要显得生硬，自然一点。";
                const systemPrompt = buildSystemPrompt(friend, userPersona, aiStickers, visiblePosts) + promptSuffix;
                const shortTermCount = parseInt(friend.shortTermMemory || '20', 10);

                const transaction = db.transaction(['chat_history'], 'readonly');
                const store = transaction.objectStore('chat_history');
                const index = store.index('friendId');
                const request = index.getAll(friend.id);

                request.onsuccess = async () => {
                    let history = request.result;
                    history = history.slice(-shortTermCount);

                    try {
                        let aiResponseText = await callLLM(config, systemPrompt, history);

                        if (aiResponseText) {
                            aiResponseText = await applyRegexRules(aiResponseText, friend.id, friend.group || '默认分组');
                            const msgParts = aiResponseText.split('\n').map(s => s.trim()).filter(s => s !== '');
                            
                            for (let i = 0; i < msgParts.length; i++) {
                                let partText = msgParts[i];
                                let quoteData = null;
                                let transferData = null;

                                const transferRegex = /<transfer amount="([^"]+)">([^<]*)<\/transfer>/;
                                const transferMatch = partText.match(transferRegex);
                                if (transferMatch) {
                                    transferData = { amount: transferMatch[1], remark: transferMatch[2] || '转账' };
                                    partText = partText.replace(transferRegex, '').trim();
                                }

                                // Parse AI Sticker
                                const aiStickerRegex = /<sticker>(.*?)<\/sticker>/;
                                const aiStickerMatch = partText.match(aiStickerRegex);
                                let aiStickerUrl = null;
                                if (aiStickerMatch) {
                                    aiStickerUrl = aiStickerMatch[1].trim();
                                    partText = partText.replace(aiStickerRegex, '').trim();
                                }

                                // Parse Send Image Command
                                const sendImageRegex = /<send_image>(.*?)<\/send_image>/;
                                const sendImageMatch = partText.match(sendImageRegex);
                                if (sendImageMatch) {
                                    const imageIdOrUrl = sendImageMatch[1].trim();
                                    partText = partText.replace(sendImageRegex, '').trim();

                                    const imageMsg = [...history].reverse().find(m => 
                                        (m.timestamp && String(m.timestamp) === imageIdOrUrl) || 
                                        (m.text === imageIdOrUrl)
                                    );
                                    if (imageMsg) {
                                        aiStickerUrl = imageMsg.text;
                                    } else if (imageIdOrUrl.startsWith('http') || imageIdOrUrl.startsWith('data:image')) {
                                        aiStickerUrl = imageIdOrUrl;
                                    }
                                }

                                // Parse Dice
                                let hasDice = false;
                                if (partText.includes('<dice></dice>')) {
                                    hasDice = true;
                                    partText = partText.replace(/<dice><\/dice>/g, '').trim();
                                }

                                // Parse Commands (Accept/Return Transfer)
                                let hasAction = false;
                                let actionText = '';
                                if (partText.includes('[已接收]') || partText.includes('[已退还]')) {
                                    const isAccept = partText.includes('[已接收]');
                                    const actionStatus = isAccept ? 'ACCEPTED' : 'RETURNED';
                                    hasAction = true;
                                    actionText = isAccept ? '已收款' : '已退还';
                                    
                                    // Remove the command tag from displayed text
                                    partText = partText.replace(/\[(已接收|已退还)\]/g, '').trim();
                                    
                                    // Update the latest PENDING sent transfer
                                    transferData = await new Promise((resolve) => {
                                        const transaction = db.transaction(['chat_history'], 'readwrite');
                                        const store = transaction.objectStore('chat_history');
                                        const index = store.index('friendId');
                                        const request = index.getAll(friend.id);
                                        
                                        request.onsuccess = () => {
                                            const msgs = request.result;
                                            const pendingTransfer = [...msgs].reverse().find(m => m.type === 'sent' && m.isTransfer && m.transferStatus === 'PENDING');
                                            
                                            if (pendingTransfer) {
                                                pendingTransfer.transferStatus = actionStatus;
                                                store.put(pendingTransfer);
                                                
                                                resolve({
                                                    amount: pendingTransfer.transferAmount,
                                                    remark: actionText,
                                                    status: actionStatus,
                                                    isReceipt: true,
                                                    id: pendingTransfer.id || pendingTransfer.timestamp
                                                });
                                            } else {
                                                resolve(null);
                                            }
                                        };
                                        request.onerror = () => resolve(null);
                                    });
                                    
                                    if (transferData && currentChatFriendId === friend.id) {
                                        const pendingWrapper = document.querySelector(`.message-bubble-wrapper[data-msg-id="${transferData.id}"]`);
                                        if (pendingWrapper) {
                                            const bubble = pendingWrapper.querySelector('.transfer-bubble');
                                            if (bubble) {
                                                if (transferData.status === 'ACCEPTED') bubble.classList.add('accepted-state');
                                                if (transferData.status === 'RETURNED') bubble.classList.add('returned-state');
                                                const remarkEl = bubble.querySelector('.transfer-remark');
                                                if (remarkEl) remarkEl.textContent = transferData.remark;
                                                const iconContainer = bubble.querySelector('.transfer-icon-svg');
                                                if (iconContainer && transferData.status === 'ACCEPTED') {
                                                    iconContainer.innerHTML = `<path d="M5 13l4 4L19 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
                                                }
                                            }
                                        }
                                    }
                                }

                                const quoteRegex = /<quote>(.*?)<\/quote>/;
                                const match = partText.match(quoteRegex);
                                if (match) {
                                    quoteData = { text: match[1], name: userPersona ? userPersona.name : '我' };
                                    partText = partText.replace(quoteRegex, '').trim();
                                }
                                
                                if (partText === '' && !transferData && !aiStickerUrl && !hasDice) {
                                    if (hasAction) {
                                        partText = actionText;
                                    } else {
                                        continue;
                                    }
                                }

                                if (transferData) {
                                    if (partText) {
                                        const textMsg = {
                                            friendId: friend.id,
                                            text: partText,
                                            type: 'received',
                                            timestamp: Date.now()
                                        };
                                        if (quoteData) textMsg.quote = quoteData;
                                        await new Promise(resolve => dbAdd('chat_history', textMsg, resolve));
                                        if (currentChatFriendId === friend.id && document.getElementById('chat-interface-page').classList.contains('active')) addMessageToUI(textMsg);
                                        else showBannerNotification(friend, partText);
                                    }
                                    
                                    const transferMsg = {
                                        friendId: friend.id,
                                        text: `[转账] ¥${transferData.amount}`,
                                        type: 'received',
                                        timestamp: Date.now() + 100,
                                        isTransfer: true,
                                        transferAmount: transferData.amount,
                                        transferRemark: transferData.remark,
                                        transferStatus: transferData.status || 'PENDING',
                                        isReceipt: transferData.isReceipt || false
                                    };
                                    await new Promise(resolve => dbAdd('chat_history', transferMsg, resolve));
                                    if (currentChatFriendId === friend.id && document.getElementById('chat-interface-page').classList.contains('active')) addMessageToUI(transferMsg);
                                    else showBannerNotification(friend, `[转账] ¥${transferData.amount}`);
                                    friend.lastMsg = `[转账]`;
                                } else if (aiStickerUrl) {
                                    if (partText) {
                                        const textMsg = {
                                            friendId: friend.id,
                                            text: partText,
                                            type: 'received',
                                            timestamp: Date.now()
                                        };
                                        if (quoteData) textMsg.quote = quoteData;
                                        await new Promise(resolve => dbAdd('chat_history', textMsg, resolve));
                                        if (currentChatFriendId === friend.id && document.getElementById('chat-interface-page').classList.contains('active')) addMessageToUI(textMsg);
                                        else showBannerNotification(friend, partText);
                                    }

                                    const stickerMsg = {
                                        friendId: friend.id,
                                        text: aiStickerUrl,
                                        type: 'received',
                                        timestamp: Date.now() + 100,
                                        isSticker: true
                                    };
                                    await new Promise(resolve => dbAdd('chat_history', stickerMsg, resolve));
                                    if (currentChatFriendId === friend.id && document.getElementById('chat-interface-page').classList.contains('active')) addMessageToUI(stickerMsg);
                                    else showBannerNotification(friend, '[表情]');
                                    friend.lastMsg = '[表情]';
                                } else if (hasDice) {
                                    if (partText) {
                                        const textMsg = {
                                            friendId: friend.id,
                                            text: partText,
                                            type: 'received',
                                            timestamp: Date.now()
                                        };
                                        if (quoteData) textMsg.quote = quoteData;
                                        await new Promise(resolve => dbAdd('chat_history', textMsg, resolve));
                                        if (currentChatFriendId === friend.id && document.getElementById('chat-interface-page').classList.contains('active')) addMessageToUI(textMsg);
                                        else showBannerNotification(friend, partText);
                                    }

                                    const diceMsg = {
                                        friendId: friend.id,
                                        text: 'dice:rolling',
                                        type: 'received',
                                        timestamp: Date.now() + 100,
                                        isSticker: true,
                                        isDice: true
                                    };
                                    let bubble;
                                    if (currentChatFriendId === friend.id && document.getElementById('chat-interface-page').classList.contains('active')) {
                                        bubble = addMessageToUI(diceMsg);
                                    } else {
                                        showBannerNotification(friend, '[骰子]');
                                    }
                                    
                                    await new Promise(res => setTimeout(res, 1200));
                                    const result = Math.floor(Math.random() * 6) + 1;
                                    if (bubble) {
                                        const cube = bubble.querySelector('.cube');
                                        if (cube) {
                                            cube.classList.remove('rolling');
                                            cube.classList.add('show-' + result);
                                        }
                                    }
                                    diceMsg.text = 'dice:' + result;
                                    await new Promise(resolve => dbAdd('chat_history', diceMsg, resolve));
                                    friend.lastMsg = '[骰子]';
                                } else if (partText !== '') {
                                    const responseMsg = {
                                        friendId: friend.id,
                                        text: partText,
                                        type: 'received',
                                        timestamp: Date.now()
                                    };
                                    if (quoteData) responseMsg.quote = quoteData;
                                    await new Promise(resolve => dbAdd('chat_history', responseMsg, resolve));
                                    if (currentChatFriendId === friend.id && document.getElementById('chat-interface-page').classList.contains('active')) addMessageToUI(responseMsg);
                                    else showBannerNotification(friend, partText);
                                    friend.lastMsg = partText;
                                }

                                friend.lastTime = getCurrentTimeStr();
                                await new Promise(resolve => dbUpdate('friends', friend, resolve));
                                
                                if (currentChatFriendId === friend.id && document.getElementById('chat-interface-page').classList.contains('active')) {
                                    // addMessageToUI(responseMsg); // Removed redundancy
                                }
                                if (document.getElementById('wechat-page').classList.contains('active') || 
                                    document.getElementById('wechat-contacts-page').classList.contains('active')) {
                                    renderChatList();
                                }
                                
                                if (config.notifications && Notification.permission === "granted") {
                                     new Notification(friend.name, { body: partText, icon: friend.avatar || 'https://via.placeholder.com/150/B5EAD7/ffffff?text=Me' });
                                }

                                if (i < msgParts.length - 1) {
                                    if (currentChatFriendId === friend.id && document.getElementById('chat-interface-page').classList.contains('active')) {
                                        showTypingIndicator(friend.id);
                                    }
                                    const delay = Math.min(Math.max(msgParts[i+1].length * 100, 800), 3000);
                                    await new Promise(res => setTimeout(res, delay));
                                    if (currentChatFriendId === friend.id && document.getElementById('chat-interface-page').classList.contains('active')) {
                                        hideTypingIndicator(friend.id);
                                    }
                                }
                            }
                        }
                    } catch (apiError) {
                        console.error('Proactive chat error for', friend.name, apiError);
                    }
                };
            } catch (e) {
                console.error(e);
            }
        }

        function runAutoSummarization() {
            const configStr = localStorage.getItem('globalConfig');
            if (!configStr) return;
            const config = JSON.parse(configStr);
            if (!config.apiKey || !config.model) return;

            dbGetAll('friends', friends => {
                friends.forEach(friend => {
                    if (friend.autoSummarizeMemory) {
                        const transaction = db.transaction(['chat_history'], 'readwrite');
                        const store = transaction.objectStore('chat_history');
                        const index = store.index('friendId');
                        const request = index.getAll(friend.id);

                        request.onsuccess = async () => {
                            let history = request.result;
                            history.sort((a, b) => a.timestamp - b.timestamp);
                            
                            let unsummarized = history.filter(msg => !msg.isSummarized);
                            
                            const CHUNK_SIZE = parseInt(friend.summarizeInterval || '20', 10);
                            if (unsummarized.length >= CHUNK_SIZE) {
                                if (friend._isSummarizing) return;
                                friend._isSummarizing = true;
                                
                                const toSummarize = unsummarized.slice(0, CHUNK_SIZE);
                                
                                let historyText = toSummarize.map(msg => {
                                    const date = new Date(msg.timestamp);
                                    const timeStr = `${date.getMonth()+1}-${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                                    const sender = msg.type === 'sent' ? '用户' : friend.realName;
                                    const content = msg.isSticker ? '[图片/表情]' : msg.text;
                                    return `[${timeStr}] ${sender}: ${content}`;
                                }).join('\n');

                                const summarizePrompt = `你是一个负责提取记忆的助手。请将以下对话历史总结为一条简短的长期记忆（50-100字）。
要求：
1. 以第一人称视角（作为“${friend.realName}”）来记录。
2. 只提取关键事件、新得知的信息或情感变化，忽略无意义的闲聊。
${friend.syncReality ? '3. 总结的开头或内容中必须包含这件事发生的具体时间背景（根据提供的对话时间戳推断是哪天、上午下午或具体时间段），这是最重要的要求。\n' : '\n'}
对话内容如下：
${historyText}`;

                                try {
                                    const summaryText = await callLLM(config, "严格按照要求总结，不要输出多余的解释。", [{ type: 'sent', text: summarizePrompt, isSticker: false }]);
                                    
                                    if (summaryText) {
                                        if (!friend.memories) friend.memories = [];
                                        friend.memories.push({
                                            id: Date.now().toString(),
                                            content: summaryText.trim(),
                                            createdAt: Date.now()
                                        });
                                        
                                        await new Promise(res => dbUpdate('friends', friend, res));
                                        
                                        const tx2 = db.transaction(['chat_history'], 'readwrite');
                                        const store2 = tx2.objectStore('chat_history');
                                        toSummarize.forEach(msg => {
                                            msg.isSummarized = true;
                                            store2.put(msg);
                                        });
                                        
                                        if (document.getElementById('memory-management-page').classList.contains('active') && currentChatFriendId === friend.id) {
                                            renderMemoryList();
                                        }
                                    }
                                } catch (e) {
                                    console.error("Summarization failed:", e);
                                } finally {
                                    friend._isSummarizing = false;
                                }
                            }
                        };
                    }
                });
            });
        }

        // --- Regex App Logic ---
        let currentEditingRegexId = null;

        function openRegexRuleModal(id = null) {
            currentEditingRegexId = id;
            document.getElementById('regex-rule-modal-title').textContent = id ? '编辑规则' : '新建规则';
            
            const nameInput = document.getElementById('regex-name-input');
            const patternInput = document.getElementById('regex-pattern-input');
            const replacementInput = document.getElementById('regex-replacement-input');
            const flagGlobal = document.getElementById('regex-flag-global');
            const flagMultiline = document.getElementById('regex-flag-multiline');
            const flagCase = document.getElementById('regex-flag-case');
            const scopeType = document.getElementById('regex-scope-type');
            
            if (id) {
                dbGet('regex_rules', id, rule => {
                    if (rule) {
                        nameInput.value = rule.name || '';
                        patternInput.value = rule.pattern || '';
                        replacementInput.value = rule.replacement || '';
                        flagGlobal.checked = rule.flags ? rule.flags.includes('g') : true;
                        flagMultiline.checked = rule.flags ? rule.flags.includes('m') : false;
                        flagCase.checked = rule.flags ? rule.flags.includes('i') : false;
                        scopeType.value = rule.scopeType || 'all';
                        
                        refreshCustomSelect('regex-scope-type');
                        handleRegexScopeChange(() => {
                            const scopeTarget = document.getElementById('regex-scope-target');
                            scopeTarget.value = rule.scopeTarget || '';
                            refreshCustomSelect('regex-scope-target');
                        });
                    }
                });
            } else {
                nameInput.value = '';
                patternInput.value = '';
                replacementInput.value = '';
                flagGlobal.checked = true;
                flagMultiline.checked = false;
                flagCase.checked = false;
                scopeType.value = 'all';
                refreshCustomSelect('regex-scope-type');
                handleRegexScopeChange();
            }
            
            document.getElementById('regex-rule-modal').style.display = 'flex';
        }

        function closeRegexRuleModal() {
            document.getElementById('regex-rule-modal').style.display = 'none';
        }

        function handleRegexScopeChange(callback) {
            const scopeType = document.getElementById('regex-scope-type').value;
            const targetContainer = document.getElementById('regex-scope-target-container');
            const targetSelect = document.getElementById('regex-scope-target');
            
            if (scopeType === 'all') {
                targetContainer.style.display = 'none';
                if (callback) callback();
            } else if (scopeType === 'group') {
                targetContainer.style.display = 'block';
                targetSelect.innerHTML = '';
                contactGroups.forEach(group => {
                    const option = document.createElement('option');
                    option.value = group;
                    option.textContent = group;
                    targetSelect.appendChild(option);
                });
                refreshCustomSelect('regex-scope-target');
                if (callback) callback();
            } else if (scopeType === 'character') {
                targetContainer.style.display = 'block';
                targetSelect.innerHTML = '';
                dbGetAll('friends', friends => {
                    if (!friends || friends.length === 0) {
                        const option = document.createElement('option');
                        option.value = '';
                        option.textContent = '暂无角色';
                        targetSelect.appendChild(option);
                    } else {
                        friends.forEach(friend => {
                            const option = document.createElement('option');
                            option.value = friend.id;
                            option.textContent = friend.name;
                            targetSelect.appendChild(option);
                        });
                    }
                    refreshCustomSelect('regex-scope-target');
                    if (callback) callback();
                });
            }
        }

        function saveRegexRule() {
            const name = document.getElementById('regex-name-input').value.trim();
            const pattern = document.getElementById('regex-pattern-input').value;
            const replacement = document.getElementById('regex-replacement-input').value;
            const flagGlobal = document.getElementById('regex-flag-global').checked;
            const flagMultiline = document.getElementById('regex-flag-multiline').checked;
            const flagCase = document.getElementById('regex-flag-case').checked;
            const scopeType = document.getElementById('regex-scope-type').value;
            const scopeTarget = document.getElementById('regex-scope-target').value;

            if (!name) {
                showToast('请输入规则名称');
                return;
            }
            if (!pattern) {
                showToast('请输入查找模式');
                return;
            }
            
            let flags = '';
            if (flagGlobal) flags += 'g';
            if (flagMultiline) flags += 'm';
            if (flagCase) flags += 'i';
            
            try {
                new RegExp(pattern, flags);
            } catch (e) {
                showToast('正则表达式语法错误');
                return;
            }

            const rule = {
                id: currentEditingRegexId || Date.now().toString(),
                name,
                pattern,
                replacement,
                flags,
                scopeType,
                scopeTarget: scopeType === 'all' ? null : scopeTarget,
                createdAt: currentEditingRegexId ? undefined : Date.now()
            };

            if (currentEditingRegexId) {
                dbGet('regex_rules', currentEditingRegexId, existingRule => {
                    if (existingRule) rule.createdAt = existingRule.createdAt;
                    dbUpdate('regex_rules', rule, () => {
                        closeRegexRuleModal();
                        renderRegexRules();
                    });
                });
            } else {
                dbAdd('regex_rules', rule, () => {
                    closeRegexRuleModal();
                    renderRegexRules();
                });
            }
        }

        function renderRegexRules() {
            const listContainer = document.getElementById('regex-rule-list');
            listContainer.innerHTML = '';

            dbGetAll('regex_rules', rules => {
                if (rules.length === 0) {
                    listContainer.innerHTML = '<div style="text-align:center; color:#999; margin-top:50px; font-size:14px;">暂无正则规则，点击右上角添加</div>';
                    return;
                }

                rules.sort((a, b) => b.createdAt - a.createdAt);

                rules.forEach(rule => {
                    const card = document.createElement('div');
                    card.className = 'persona-card';
                    card.style.height = 'auto';
                    card.style.minHeight = '120px';
                    
                    card.onclick = (e) => {
                        if (!e.target.closest('.persona-card-delete')) {
                            openRegexRuleModal(rule.id);
                        }
                    };
                    
                    const deleteIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

                    let scopeText = '全部角色';
                    if (rule.scopeType === 'group') scopeText = `分组: ${rule.scopeTarget}`;
                    if (rule.scopeType === 'character') {
                        scopeText = `特定角色`; // fallback
                    }

                    card.innerHTML = `
                        <div class="persona-card-header">
                            <span class="persona-card-title">${rule.name}</span>
                            <span class="wb-card-tag" style="margin-right: 20px;">${scopeText}</span>
                        </div>
                        <div class="persona-card-content" style="font-family: monospace; font-size: 13px; color: #555;">
                            查找: /${rule.pattern}/${rule.flags}<br>
                            替换: ${rule.replacement || '<i>(空)</i>'}
                        </div>
                        <div class="persona-card-delete" onclick="confirmDeleteRegexRule(event, '${rule.id}')">${deleteIcon}</div>
                    `;
                    
                    if (rule.scopeType === 'character') {
                        dbGet('friends', rule.scopeTarget, friend => {
                            if (friend) {
                                const tag = card.querySelector('.wb-card-tag');
                                if (tag) tag.textContent = `角色: ${friend.name}`;
                            }
                        });
                    }

                    listContainer.appendChild(card);
                });
            });
        }

        function confirmDeleteRegexRule(e, id) {
            if(e) e.stopPropagation();
            showCustomConfirm('确定要删除这条正则规则吗？', () => {
                dbDelete('regex_rules', id, () => {
                    renderRegexRules();
                });
            }, '删除规则');
        }

        async function applyRegexRules(text, friendId, friendGroup) {
            return new Promise(resolve => {
                dbGetAll('regex_rules', rules => {
                    if (!rules || rules.length === 0) {
                        resolve(text);
                        return;
                    }

                    let processedText = text;
                    rules.forEach(rule => {
                        let isMatch = false;
                        if (rule.scopeType === 'all') isMatch = true;
                        else if (rule.scopeType === 'group' && rule.scopeTarget === friendGroup) isMatch = true;
                        else if (rule.scopeType === 'character' && rule.scopeTarget === friendId) isMatch = true;

                        if (isMatch) {
                            try {
                                const regex = new RegExp(rule.pattern, rule.flags);
                                const replacement = rule.replacement.replace(/\\n/g, '\n');
                                processedText = processedText.replace(regex, replacement);
                            } catch (e) {
                                console.error('Regex rule error:', e);
                            }
                        }
                    });
                    resolve(processedText);
                });
            });
        }

        // --- World Book Logic ---
        let worldBooks = JSON.parse(localStorage.getItem('worldBooks')) || [];
        
        // Remove default "恋爱日常" if present
        const wbInitialLen = worldBooks.length;
        worldBooks = worldBooks.filter(wb => wb.title !== '恋爱日常');
        if (worldBooks.length !== wbInitialLen) {
            localStorage.setItem('worldBooks', JSON.stringify(worldBooks));
        }

        let worldBookGroups = JSON.parse(localStorage.getItem('worldBookGroups')) || ['默认'];
        let currentWbGroup = '全部';
        let editingWbId = null;
        let deletingWbId = null;

        function renderWbTabs() {
            const container = document.getElementById('wb-group-tabs');
            container.innerHTML = '';
            let longPressTimer;
            let wasLongPress = false; // Flag to distinguish long press from click

            const createTab = (groupName, isSpecial = false) => {
                const tab = document.createElement('div');
                tab.className = `wb-tab ${currentWbGroup === groupName ? 'active' : ''}`;
                
                const tabText = document.createElement('span');
                tabText.textContent = groupName;
                tab.appendChild(tabText);

                if (isSpecial) {
                    tab.onclick = () => {
                        hideAllDeleteButtons();
                        switchWbGroup(groupName);
                    };
                } else {
                    const deleteBtn = document.createElement('span');
                    deleteBtn.className = 'wb-tab-delete-btn';
                    deleteBtn.innerHTML = '&times;';
                    deleteBtn.onclick = (e) => {
                        e.stopPropagation(); // Prevent tab's onclick from firing
                        requestDeleteWbGroup(groupName);
                    };
                    tab.appendChild(deleteBtn);

                    const startPress = (e) => {
                        wasLongPress = false;
                        if (e.button === 2) return; // Ignore right-click
                        longPressTimer = setTimeout(() => {
                            wasLongPress = true;
                            e.preventDefault();
                            hideAllDeleteButtons(); // Hide others before showing new one
                            deleteBtn.classList.add('visible');
                        }, 500);
                    };

                    const endPress = () => {
                        clearTimeout(longPressTimer);
                    };
                    
                    tab.addEventListener('mousedown', startPress);
                    tab.addEventListener('touchstart', startPress, { passive: true });
                    tab.addEventListener('mouseup', endPress);
                    tab.addEventListener('mouseleave', endPress);
                    tab.addEventListener('touchend', endPress);
                    tab.addEventListener('touchcancel', endPress);

                    tab.onclick = () => {
                        // This click event fires after mouseup. We need to ignore it if it was a long press.
                        if (wasLongPress) {
                            wasLongPress = false; // Consume the flag
                            return;
                        }

                        // This is a genuine short click
                        if (deleteBtn.classList.contains('visible')) {
                            hideAllDeleteButtons();
                        } else {
                            switchWbGroup(groupName);
                        }
                    };
                }
                return tab;
            };

            // "All" tab
            container.appendChild(createTab('全部', true));

            // Group tabs
            worldBookGroups.forEach(group => {
                container.appendChild(createTab(group, group === '默认'));
            });

            // Add Group button
            const addBtn = document.createElement('div');
            addBtn.className = 'wb-tab-add';
            addBtn.textContent = '+';
            addBtn.onclick = () => {
                hideAllDeleteButtons();
                openWbGroupModal();
            };
            container.appendChild(addBtn);
        }

        function hideAllDeleteButtons() {
            document.querySelectorAll('.wb-tab-delete-btn.visible').forEach(btn => {
                btn.classList.remove('visible');
            });
        }

        // Hide delete buttons when clicking outside the tabs area
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.wb-tabs')) {
                hideAllDeleteButtons();
            }
        });

        function switchWbGroup(group) {
            currentWbGroup = group;
            renderWbTabs();
            renderWbList();
        }

        function renderWbList() {
            const container = document.getElementById('wb-list');
            container.innerHTML = '';
            
            const filteredBooks = currentWbGroup === '全部' 
                ? worldBooks 
                : worldBooks.filter(book => book.group === currentWbGroup);

            if (filteredBooks.length === 0) {
                container.innerHTML = '<div style="text-align:center; color:#999; margin-top:50px; font-size:14px;">暂无内容</div>';
                return;
            }

            filteredBooks.forEach(book => {
                const card = document.createElement('div');
                card.className = 'wb-card';
                card.onclick = (e) => {
                    // Prevent clicking card when clicking delete
                    if (!e.target.closest('.wb-card-delete')) {
                        openWorldBookModal(book.id);
                    }
                };
                
                const deleteIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

                card.innerHTML = `
                    <div class="wb-card-content">
                        <div class="wb-card-header">
                            <span class="wb-card-title">${book.title}</span>
                            <span class="wb-card-tag">${book.group}</span>
                        </div>
                        <div class="wb-card-desc">${book.content}</div>
                    </div>
                    <div class="wb-card-delete" onclick="openWbDeleteModal('${book.id}')">${deleteIcon}</div>
                `;
                container.appendChild(card);
            });
        }

        function openWorldBookModal(id = null) {
            const modal = document.getElementById('wb-modal');
            const titleInput = document.getElementById('wb-title-input');
            const groupSelect = document.getElementById('wb-group-select');
            const contentInput = document.getElementById('wb-content-input');
            const modalTitle = document.getElementById('wb-modal-title');

            // Populate groups
            groupSelect.innerHTML = '';
            worldBookGroups.forEach(group => {
                const option = document.createElement('option');
                option.value = group;
                option.textContent = group;
                groupSelect.appendChild(option);
            });

            if (id) {
                // Edit mode
                const book = worldBooks.find(b => b.id === id);
                if (book) {
                    editingWbId = id;
                    modalTitle.textContent = '编辑世界书';
                    titleInput.value = book.title;
                    groupSelect.value = book.group;
                    contentInput.value = book.content;
                }
            } else {
                // Create mode
                editingWbId = null;
                modalTitle.textContent = '新建世界书';
                titleInput.value = '';
                groupSelect.value = currentWbGroup !== '全部' ? currentWbGroup : worldBookGroups[0];
                contentInput.value = '';
            }

            modal.style.display = 'flex';
        }

        function closeWbModal() {
            document.getElementById('wb-modal').style.display = 'none';
        }

        function saveWorldBook() {
            const title = document.getElementById('wb-title-input').value.trim();
            const group = document.getElementById('wb-group-select').value;
            const content = document.getElementById('wb-content-input').value.trim();

            if (!title) {
                showToast('请输入标题');
                return;
            }

            if (editingWbId) {
                // Update existing
                const index = worldBooks.findIndex(b => b.id === editingWbId);
                if (index !== -1) {
                    worldBooks[index] = { ...worldBooks[index], title, group, content };
                }
            } else {
                // Create new
                const newBook = {
                    id: Date.now().toString(),
                    title,
                    group,
                    content
                };
                worldBooks.unshift(newBook); // Add to top
            }

            localStorage.setItem('worldBooks', JSON.stringify(worldBooks));
            closeWbModal();
            renderWbList();
        }

        function openWbGroupModal() {
            document.getElementById('wb-new-group-input').value = '';
            document.getElementById('wb-group-modal').style.display = 'flex';
        }

        function closeWbGroupModal() {
            document.getElementById('wb-group-modal').style.display = 'none';
        }

        function saveWbGroup() {
            const name = document.getElementById('wb-new-group-input').value.trim();
            if (!name) return;
            
            if (!worldBookGroups.includes(name)) {
                worldBookGroups.push(name);
                localStorage.setItem('worldBookGroups', JSON.stringify(worldBookGroups));
                renderWbTabs();
            }
            closeWbGroupModal();
        }

        function requestDeleteWbGroup(groupName) {
            showCustomConfirm(
                `确定要删除分组 "<b>${groupName}</b>" 吗？<br><small>该分组下的所有条目将被移至“默认”分组。</small>`,
                () => deleteWbGroup(groupName),
                '删除分组'
            );
        }

        function deleteWbGroup(groupName) {
            // Move books to default group
            worldBooks.forEach(book => {
                if (book.group === groupName) {
                    book.group = '默认';
                }
            });
            localStorage.setItem('worldBooks', JSON.stringify(worldBooks));

            // Remove group from list
            worldBookGroups = worldBookGroups.filter(g => g !== groupName);
            localStorage.setItem('worldBookGroups', JSON.stringify(worldBookGroups));

            // If the deleted group was the active one, switch to "All"
            if (currentWbGroup === groupName) {
                currentWbGroup = '全部';
            }

            // Re-render UI
            renderWbTabs();
            renderWbList();
            showToast(`分组 "${groupName}" 已删除。`);
        }

        function openWbDeleteModal(id) {
            deletingWbId = id;
            document.getElementById('wb-delete-modal').style.display = 'flex';
            
            // Bind confirm button
            document.getElementById('wb-confirm-delete-btn').onclick = () => {
                if (deletingWbId) {
                    worldBooks = worldBooks.filter(b => b.id !== deletingWbId);
                    localStorage.setItem('worldBooks', JSON.stringify(worldBooks));
                    renderWbList();
                }
                closeWbDeleteModal();
            };
        }

        function closeWbDeleteModal() {
            document.getElementById('wb-delete-modal').style.display = 'none';
            deletingWbId = null;
        }

        // --- Contacts Page & Group Management Logic ---
        let contactGroups = JSON.parse(localStorage.getItem('contact_groups')) || ['默认分组'];
        
        function switchWechatTab(tabName) {
            const pages = {
                'wechat': 'wechat-page',
                'contacts': 'wechat-contacts-page',
                'discover': 'wechat-discover-page',
                'me': 'wechat-me-page'
            };

            // Update footer active state on all footers
            document.querySelectorAll('.wechat-footer').forEach(footer => {
                footer.querySelectorAll('.footer-item').forEach((item, index) => {
                    const currentTabName = ['wechat', 'contacts', 'discover', 'me'][index];
                    if (currentTabName === tabName) {
                        item.classList.add('active');
                    } else {
                        item.classList.remove('active');
                    }
                });
            });

            // Show the correct page
            if (pages[tabName]) {
                showPage(pages[tabName]);
            } else {
                // If page not implemented, default to wechat page but keep icon active
                showPage('wechat-page');
            }
            
            // Special handling for contacts page
            if (tabName === 'contacts') {
                renderContactsList();
            }
        }

        function showCustomConfirm(message, onConfirm, title = '确认操作', isAlert = false) {
            const modal = document.getElementById('custom-confirm-modal');
            const titleEl = document.getElementById('custom-confirm-title');
            const messageEl = document.getElementById('custom-confirm-message');
            const confirmBtn = document.getElementById('custom-confirm-confirm-btn');
            const cancelBtn = document.getElementById('custom-confirm-cancel-btn');

            titleEl.textContent = title;
            messageEl.innerHTML = message; // Use innerHTML to support potential formatting
            modal.style.display = 'flex';

            if (isAlert) {
                cancelBtn.style.display = 'none';
                confirmBtn.textContent = '确定';
            } else {
                cancelBtn.style.display = 'block';
                confirmBtn.textContent = '确定';
            }

            // Use .onclick to ensure old listeners are replaced
            confirmBtn.onclick = () => {
                if (onConfirm) onConfirm();
                hide();
            };

            const hide = () => {
                modal.style.display = 'none';
            };
            
            cancelBtn.onclick = hide;
            
            modal.onclick = (e) => {
                if (e.target === modal) {
                    hide();
                }
            };
        }

        function renderContactsList() {
            const listContainer = document.getElementById('contacts-list');
            listContainer.innerHTML = ''; // Clear existing list
            
            dbGetAll('friends', friends => {
                const groupedFriends = {};
                friends.forEach(friend => {
                    const group = friend.group || '默认分组';
                    if (!groupedFriends[group]) {
                        groupedFriends[group] = [];
                    }
                    groupedFriends[group].push(friend);
                });

                contactGroups.forEach(groupName => {
                    if (groupedFriends[groupName] && groupedFriends[groupName].length > 0) {
                        const groupHeader = document.createElement('div');
                        groupHeader.style.padding = '4px 15px';
                        groupHeader.style.backgroundColor = '#f7f7f7';
                        groupHeader.style.color = '#888';
                        groupHeader.style.fontSize = '13px';
                        groupHeader.textContent = groupName;
                        listContainer.appendChild(groupHeader);

                        groupedFriends[groupName].forEach(friend => {
                            const item = document.createElement('div');
                            item.className = 'chat-item';

                            const nameStyle = friend.isHidden ? 'color: #999;' : '';
                            const hiddenIndicator = friend.isHidden ? ' (已隐藏)' : '';

                            item.innerHTML = `
                                <img class="chat-avatar" src="${friend.avatar}" alt="${friend.name}">
                                <div class="chat-info" style="justify-content: center;">
                                    <span class="chat-name" style="${nameStyle}">${friend.name}${hiddenIndicator}</span>
                                </div>
                            `;

                            if (friend.isHidden) {
                                item.style.cursor = 'pointer';
                                
                                let pressTimer;
                                let startX, startY;
                                let wasLongPress = false;

                                const startPress = (e) => {
                                    if (e.button === 2) return;
                                    wasLongPress = false;
                                    startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
                                    startY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
                                    
                                    pressTimer = setTimeout(() => {
                                        wasLongPress = true;
                                        showCustomConfirm(`要将好友 "<b>${friend.name}</b>" 恢复到聊天列表吗？`, () => {
                                            friend.isHidden = false;
                                            dbUpdate('friends', friend, renderContactsList);
                                        }, '恢复好友');
                                    }, 500);

                                    item.addEventListener('mousemove', cancelPress);
                                    item.addEventListener('touchmove', cancelPress);
                                };

                                const cancelPress = (moveEvent) => {
                                    let moveX = moveEvent.type.includes('touch') ? moveEvent.touches[0].clientX : moveEvent.clientX;
                                    let moveY = moveEvent.type.includes('touch') ? moveEvent.touches[0].clientY : moveEvent.clientY;
                                    if (Math.abs(moveX - startX) > 10 || Math.abs(moveY - startY) > 10) {
                                        clearTimeout(pressTimer);
                                        item.removeEventListener('mousemove', cancelPress);
                                        item.removeEventListener('touchmove', cancelPress);
                                    }
                                };

                                const endPress = () => {
                                    clearTimeout(pressTimer);
                                    item.removeEventListener('mousemove', cancelPress);
                                    item.removeEventListener('touchmove', cancelPress);
                                };

                                item.addEventListener('mousedown', startPress);
                                item.addEventListener('touchstart', startPress, { passive: true });
                                item.addEventListener('mouseup', endPress);
                                item.addEventListener('mouseleave', endPress);
                                item.addEventListener('touchend', endPress);
                                item.addEventListener('touchcancel', endPress);
                                item.addEventListener('contextmenu', (e) => e.preventDefault());

                                item.addEventListener('click', () => {
                                    if (!wasLongPress) {
                                        openFriendProfile(friend.id);
                                    }
                                });
                            } else {
                                item.style.cursor = 'pointer';
                                item.addEventListener('click', () => {
                                    openFriendProfile(friend.id);
                                });
                            }
                            listContainer.appendChild(item);
                        });
                    }
                });
            });
        }

        function openFriendProfile(friendId) {
            dbGet('friends', friendId, friend => {
                if (friend) {
                    currentChatFriendId = friendId;
                    document.getElementById('fp-avatar').src = friend.avatar;
                    document.getElementById('fp-remark').textContent = friend.name;
                    document.getElementById('fp-realname').textContent = friend.realName || friend.name;
                    showPage('friend-profile-page');
                }
            });
        }

        function openGroupManagementModal() {
            const modal = document.getElementById('group-management-modal');
            modal.style.display = 'flex';
            renderGroupManagementModal();
        }

        function closeGroupManagementModal() {
            document.getElementById('group-management-modal').style.display = 'none';
        }

        function openDeleteGroupModal() {
            const modal = document.getElementById('delete-group-modal');
            const select = document.getElementById('delete-group-select');
            select.innerHTML = '';

            const groupsToDelete = contactGroups.filter(g => g !== '默认分组');
            
            if (groupsToDelete.length === 0) {
                showToast('没有可删除的分组。');
                return;
            }

            groupsToDelete.forEach(group => {
                const option = document.createElement('option');
                option.value = group;
                option.textContent = group;
                select.appendChild(option);
            });

            refreshCustomSelect(select);

            modal.style.display = 'flex';
        }

        function closeDeleteGroupModal() {
            document.getElementById('delete-group-modal').style.display = 'none';
        }

        function renderGroupManagementModal() {
            const fromSelect = document.getElementById('move-from-group-select');
            const toSelect = document.getElementById('move-to-group-select');
            
            fromSelect.innerHTML = '';
            toSelect.innerHTML = '';

            contactGroups.forEach(group => {
                const option1 = document.createElement('option');
                option1.value = group;
                option1.textContent = group;
                fromSelect.appendChild(option1);

                const option2 = document.createElement('option');
                option2.value = group;
                option2.textContent = group;
                toSelect.appendChild(option2);
            });

            fromSelect.onchange = () => populateContactsToMove(fromSelect.value);
            
            refreshCustomSelect(fromSelect);
            refreshCustomSelect(toSelect);

            populateContactsToMove(fromSelect.value);
        }

        function populateContactsToMove(groupName) {
            const contactsListDiv = document.getElementById('gm-contacts-list');
            contactsListDiv.innerHTML = '';
            
            dbGetAll('friends', friends => {
                const friendsInGroup = friends.filter(f => (f.group || '默认分组') === groupName);

                if (friendsInGroup.length === 0) {
                    contactsListDiv.innerHTML = '<div style="text-align:center; color:#999; font-size:13px;">该分组下没有角色</div>';
                    return;
                }

                friendsInGroup.forEach(friend => {
                    const item = document.createElement('label');
                    item.className = 'gm-contact-item';
                    item.innerHTML = `
                        <input type="checkbox" value="${friend.id}">
                        <div class="round-checkbox"><div class="inner-dot"></div></div>
                        <span>${friend.name}</span>
                    `;
                    contactsListDiv.appendChild(item);
                });
            });
        }

        document.getElementById('add-new-group-btn').addEventListener('click', () => {
            const input = document.getElementById('new-group-name-input');
            const newGroupName = input.value.trim();
            if (newGroupName && !contactGroups.includes(newGroupName)) {
                contactGroups.push(newGroupName);
                localStorage.setItem('contact_groups', JSON.stringify(contactGroups));
                input.value = '';
                renderGroupManagementModal(); // Re-render to update dropdowns
            } else if (!newGroupName) {
                showToast('分组名不能为空');
            } else {
                showToast('分组已存在');
            }
        });

        document.getElementById('confirm-move-btn').addEventListener('click', () => {
            const toGroup = document.getElementById('move-to-group-select').value;
            const selectedCheckboxes = document.querySelectorAll('#gm-contacts-list input:checked');

            if (selectedCheckboxes.length === 0) {
                showToast('请选择要移动的角色');
                return;
            }

            const selectedIds = Array.from(selectedCheckboxes).map(cb => cb.value);
            
            dbGetAll('friends', friends => {
                const updates = [];
                friends.forEach(friend => {
                    if (selectedIds.includes(friend.id)) {
                        friend.group = toGroup;
                        updates.push(new Promise(resolve => dbUpdate('friends', friend, resolve)));
                    }
                });
                Promise.all(updates).then(() => {
                    closeGroupManagementModal();
                    if (document.getElementById('wechat-contacts-page').classList.contains('active')) {
                        renderContactsList();
                    }
                });
            });
        });

        document.getElementById('confirm-delete-group-btn').addEventListener('click', () => {
            const select = document.getElementById('delete-group-select');
            const groupToDelete = select.value;

            if (!groupToDelete) {
                showToast('请选择一个要删除的分组。');
                return;
            }

            // Move friends to default group
            dbGetAll('friends', friends => {
                const updates = [];
                friends.forEach(friend => {
                    if (friend.group === groupToDelete) {
                        friend.group = '默认分组';
                        updates.push(new Promise(resolve => dbUpdate('friends', friend, resolve)));
                    }
                });
                Promise.all(updates).then(() => {
                    // Remove group from list
                    contactGroups = contactGroups.filter(g => g !== groupToDelete);
                    localStorage.setItem('contact_groups', JSON.stringify(contactGroups));

                    // Re-render and close modals
                    closeDeleteGroupModal();
                    renderGroupManagementModal();
                    if (document.getElementById('wechat-contacts-page').classList.contains('active')) {
                        renderContactsList();
                    }
                });
            });
        });

        // --- Settings Page Logic ---
        const temperatureSlider = document.getElementById('temperature-slider');
        const temperatureValue = document.getElementById('temperature-value');
        const notificationsToggle = document.getElementById('notifications-toggle');
        const fetchModelsBtn = document.getElementById('fetch-models-btn');
        const modelSelect = document.getElementById('model-select');
        const apiUrlInput = document.getElementById('api-url');
        const apiKeyInput = document.getElementById('api-key');
        const savePresetBtn = document.getElementById('save-preset-btn');
        const deletePresetBtn = document.getElementById('delete-preset-btn');
        const presetSelect = document.getElementById('preset-select');
        const presetModal = document.getElementById('preset-modal');
        const cancelPresetBtn = document.getElementById('cancel-preset-btn');
        const confirmSavePresetBtn = document.getElementById('confirm-save-preset-btn');
        const presetNameInput = document.getElementById('preset-name-input');
        const saveConfigBtn = document.querySelector('.save-config-button');

        // Delete Preset Modal Elements
        const deletePresetModal = document.getElementById('delete-preset-modal');
        const deletePresetList = document.getElementById('delete-preset-list');
        const cancelDeletePresetBtn = document.getElementById('cancel-delete-preset-btn');
        const confirmDeletePresetBtn = document.getElementById('confirm-delete-preset-btn');

        temperatureSlider.addEventListener('input', (e) => {
            temperatureValue.textContent = parseFloat(e.target.value).toFixed(1);
        });

        notificationsToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                if (Notification.permission === 'granted') {
                    console.log('Notification permission already granted.');
                } else if (Notification.permission !== 'denied') {
                    Notification.requestPermission().then(permission => {
                        if (permission === 'granted') {
                            new Notification('蒜皮叽', { body: '后台消息通知已开启！', icon: 'https://via.placeholder.com/128' });
                        }
                    });
                }
            }
        });

        fetchModelsBtn.addEventListener('click', async () => {
            const apiUrl = apiUrlInput.value.trim();
            const apiKey = apiKeyInput.value.trim();
            if (!apiKey) { // API Key is always required
                showToast('请输入 API Key');
                return;
            }

            modelSelect.innerHTML = '<option>正在拉取...</option>';
            
            try {
                let models = [];
                // If API URL is empty, assume official Gemini
                if (!apiUrl) {
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
                    if (!response.ok) {
                        throw new Error(`Gemini API error! status: ${response.status}`);
                    }
                    const data = await response.json();
                    models = data.models.map(m => m.name).sort();
                } else { // Otherwise, assume a proxy (OpenAI-compatible)
                    // Construct the models URL correctly
                    let modelsUrl;
                    const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl; // Normalize URL by removing trailing slash

                    if (baseUrl.endsWith('/v1')) {
                        // If user provided '.../v1', just add '/models'
                        modelsUrl = `${baseUrl}/models`;
                    } else {
                        // Otherwise, append the full '/v1/models' path
                        modelsUrl = `${baseUrl}/v1/models`;
                    }

                    const response = await fetch(modelsUrl, {
                        headers: { 'Authorization': `Bearer ${apiKey}` }
                    });

                    if (!response.ok) {
                        throw new Error(`Proxy API error! status: ${response.status}`);
                    }
                    const data = await response.json();
                    // Handle different possible structures for model list
                    if (data.data && Array.isArray(data.data)) {
                        models = data.data.map(model => model.id).sort();
                    } else if (Array.isArray(data)) {
                        models = data.map(model => model.id).sort();
                    } else {
                        models = [];
                    }
                }

                modelSelect.innerHTML = '';
                if (models.length === 0) {
                    modelSelect.innerHTML = '<option>未找到模型</option>';
                    return;
                }
                
                models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model;
                    option.textContent = model;
                    modelSelect.appendChild(option);
                });

                // Restore saved model selection if available
                const savedConfig = JSON.parse(localStorage.getItem('globalConfig'));
                if (savedConfig && savedConfig.model && models.includes(savedConfig.model)) {
                    modelSelect.value = savedConfig.model;
                }
                
                refreshCustomSelect(modelSelect);

                showToast('模型列表拉取成功！');

            } catch (error) {
                console.error('Error fetching models:', error);
                modelSelect.innerHTML = '<option>拉取失败</option>';
                showToast('无法拉取模型列表，请检查网络和API信息。');
            }
        });

        savePresetBtn.addEventListener('click', () => {
            presetModal.style.display = 'flex';
        });

        cancelPresetBtn.addEventListener('click', () => {
            presetModal.style.display = 'none';
            presetNameInput.value = '';
        });

        confirmSavePresetBtn.addEventListener('click', () => {
            const name = presetNameInput.value.trim();
            if (!name) {
                showToast('请输入预设名称');
                return;
            }
            const presetData = {
                apiUrl: apiUrlInput.value,
                apiKey: apiKeyInput.value
            };
            localStorage.setItem(`preset_${name}`, JSON.stringify(presetData));
            
            // Avoid adding duplicate options
            if (!presetSelect.querySelector(`option[value="${name}"]`)) {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                presetSelect.appendChild(option);
            }
            
            presetSelect.value = name;
            presetNameInput.value = '';
            presetModal.style.display = 'none';
        });

        deletePresetBtn.addEventListener('click', () => {
            deletePresetList.innerHTML = '';
            let hasPresets = false;
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('preset_')) {
                    hasPresets = true;
                    const name = key.replace('preset_', '');
                    const item = document.createElement('label');
                    item.className = 'preset-checkbox-item';
                    
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.value = name;
                    
                    const indicator = document.createElement('div');
                    indicator.className = 'custom-checkbox';

                    const span = document.createElement('span');
                    span.textContent = name;
                    
                    item.appendChild(checkbox);
                    item.appendChild(indicator);
                    item.appendChild(span);
                    deletePresetList.appendChild(item);
                }
            }

            if (!hasPresets) {
                deletePresetList.innerHTML = '<div style="text-align:center; color:#999; padding:10px;">暂无预设</div>';
            }
            
            deletePresetModal.style.display = 'flex';
        });

        cancelDeletePresetBtn.addEventListener('click', () => {
            deletePresetModal.style.display = 'none';
        });

        confirmDeletePresetBtn.addEventListener('click', () => {
            const checkboxes = deletePresetList.querySelectorAll('input[type="checkbox"]:checked');
            if (checkboxes.length === 0) {
                showToast('请选择要删除的预设');
                return;
            }
            
            // confirm(`确定要删除选中的 ${checkboxes.length} 个预设吗？`)
            checkboxes.forEach(cb => {
                const name = cb.value;
                localStorage.removeItem(`preset_${name}`);
                const option = presetSelect.querySelector(`option[value="${name}"]`);
                if (option) option.remove();
            });
            
            // Reset fields if current selected was deleted
            const currentVal = presetSelect.value;
            if (currentVal !== '选择预设...' && !presetSelect.querySelector(`option[value="${currentVal}"]`)) {
                presetSelect.value = '选择预设...';
                apiUrlInput.value = '';
                apiKeyInput.value = '';
            }

            deletePresetModal.style.display = 'none';
        });

        presetSelect.addEventListener('change', () => {
            const selectedPreset = presetSelect.value;
            if (selectedPreset === '选择预设...') {
                apiUrlInput.value = '';
                apiKeyInput.value = '';
                return;
            }
            const presetData = JSON.parse(localStorage.getItem(`preset_${selectedPreset}`));
            if (presetData) {
                apiUrlInput.value = presetData.apiUrl || '';
                apiKeyInput.value = presetData.apiKey || '';
            }
        });

        saveConfigBtn.addEventListener('click', () => {
            const config = {
                apiUrl: apiUrlInput.value,
                apiKey: apiKeyInput.value,
                model: modelSelect.value,
                temperature: temperatureSlider.value,
                notifications: notificationsToggle.checked,
                selectedPreset: presetSelect.value
            };
            localStorage.setItem('globalConfig', JSON.stringify(config));
            showToast('配置已保存！');
        });

        function loadSettings() {
            // Load presets first
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('preset_')) {
                    const name = key.replace('preset_', '');
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    presetSelect.appendChild(option);
                }
            }

            // Load global config
            const globalConfig = JSON.parse(localStorage.getItem('globalConfig'));
            if (globalConfig) {
                apiUrlInput.value = globalConfig.apiUrl || '';
                apiKeyInput.value = globalConfig.apiKey || '';
                temperatureSlider.value = globalConfig.temperature || 0.8;
                temperatureValue.textContent = parseFloat(globalConfig.temperature || 0.8).toFixed(1);
                notificationsToggle.checked = globalConfig.notifications || false;
                
                if (globalConfig.selectedPreset) {
                    presetSelect.value = globalConfig.selectedPreset;
                }
                
                if (globalConfig.model) {
                    const option = document.createElement('option');
                    option.value = globalConfig.model;
                    option.textContent = globalConfig.model;
                    modelSelect.appendChild(option);
                    modelSelect.value = globalConfig.model;
                }
            }

            // Initialize custom selects
            initCustomSelect(presetSelect);
            initCustomSelect(modelSelect);
        }

        // Chat Info Logic
        function openChatInfo() {
            if (!currentChatFriendId) return;
            
            dbGet('friends', currentChatFriendId, friend => {
                if (friend) {
                    // Update UI with friend details
                    document.getElementById('chat-info-avatar').src = friend.avatar;
                    document.getElementById('chat-info-remark').value = friend.name;
                    
                    // If realName doesn't exist (legacy data), default to name
                    if (!friend.realName) {
                        friend.realName = friend.name;
                        // Silently update DB to migrate data
                        dbUpdate('friends', friend);
                    }
                    document.getElementById('chat-info-realname').value = friend.realName;

                    document.getElementById('chat-info-persona').value = friend.persona || '';

                    // My Avatar in this chat
                    if (friend.myAvatar) {
                        document.getElementById('my-chat-avatar').src = friend.myAvatar;
                    } else {
                        // Default to global avatar
                        dbGet('user_profile', 'main_user', profile => {
                            if (profile && profile.avatar) {
                                document.getElementById('my-chat-avatar').src = profile.avatar;
                            } else {
                                document.getElementById('my-chat-avatar').src = 'https://via.placeholder.com/150/B5EAD7/ffffff?text=Me';
                            }
                        });
                    }

                    // My Persona in this chat
                    if (friend.myPersonaId) {
                        dbGet('my_personas', friend.myPersonaId, persona => {
                            document.getElementById('my-chat-persona-text').textContent = persona ? persona.name : '默认人设';
                        });
                    } else {
                        document.getElementById('my-chat-persona-text').textContent = '默认人设';
                    }
                    
                    // Bound World Books
                    updateBindWorldBookText(friend.boundWorldBooks);
                    
                    // Avatar Display
                    const avatarDisplaySelect = document.getElementById('avatar-display-select');
                    avatarDisplaySelect.value = friend.avatarDisplay || 'show_all';
                    refreshCustomSelect(avatarDisplaySelect);
                    
                    // AI Behavior Settings
                    const isActiveChat = friend.activeChat || false;
                    document.getElementById('active-chat-toggle').checked = isActiveChat;
                    
                    const intervalContainer = document.getElementById('active-chat-interval-container');
                    if (intervalContainer) {
                        intervalContainer.style.display = isActiveChat ? 'block' : 'none';
                    }

                    document.getElementById('sync-reality-toggle').checked = friend.syncReality || false;
                    document.getElementById('message-interval-input').value = friend.messageInterval || '';
                    document.getElementById('short-term-memory-input').value = friend.shortTermMemory || '';
                    
                    const autoSummarize = friend.autoSummarizeMemory || false;
                    document.getElementById('auto-summarize-memory-toggle').checked = autoSummarize;
                    const summarizeContainer = document.getElementById('auto-summarize-interval-container');
                    if (summarizeContainer) {
                        summarizeContainer.style.display = autoSummarize ? 'block' : 'none';
                    }
                    document.getElementById('summarize-interval-input').value = friend.summarizeInterval || '';

                    showPage('chat-info-page');
                }
            });
        }

        function triggerMyChatAvatarUpload() {
            document.getElementById('my-chat-avatar-input').click();
        }

        function handleMyChatAvatarChange(input) {
            if (input.files && input.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const imageUrl = e.target.result;
                    document.getElementById('my-chat-avatar').src = imageUrl;
                    
                    if (currentChatFriendId) {
                        dbGet('friends', currentChatFriendId, friend => {
                            if (friend) {
                                friend.myAvatar = imageUrl;
                                dbUpdate('friends', friend, () => {
                                    // Refresh messages to show new avatar
                                    // But we are in chat info page, so we don't see them yet.
                                    // When we go back, they will re-render if we call renderMessages then?
                                    // Or we can rely on renderMessages called in openChat.
                                    // But messages are already in DOM. We should probably clear them or update them?
                                    // Simplest is to assume they will be correct next time chat opens.
                                    // But if I go "Back", showPage('chat-interface-page') doesn't auto re-render.
                                    // I should probably force a re-render of messages if I'm currently editing the active chat.
                                    renderMessages(currentChatFriendId); 
                                });
                            }
                        });
                    }
                }
                reader.readAsDataURL(input.files[0]);
            }
        }

        function openBindWorldBookModal() {
            if (!currentChatFriendId) return;
            const modal = document.getElementById('bind-world-book-modal');
            const listContainer = document.getElementById('bind-world-book-list');
            listContainer.innerHTML = '';
            
            dbGet('friends', currentChatFriendId, friend => {
                if (!friend) return;
                const boundIds = friend.boundWorldBooks || [];
                
                // Get world books from localStorage
                let allWorldBooks = JSON.parse(localStorage.getItem('worldBooks')) || [];
                
                if (allWorldBooks.length === 0) {
                    listContainer.innerHTML = '<div style="text-align:center; color:#999; padding: 20px 0; font-size:14px;">暂无世界书，请先在世界书页面创建</div>';
                } else {
                    allWorldBooks.forEach(wb => {
                        const label = document.createElement('label');
                        label.className = 'preset-checkbox-item';
                        
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.value = wb.id;
                        if (boundIds.includes(wb.id)) {
                            checkbox.checked = true;
                        }
                        
                        const customCheck = document.createElement('div');
                        customCheck.className = 'custom-checkbox';
                        
                        const span = document.createElement('span');
                        span.textContent = wb.title;
                        span.style.flex = "1";
                        span.style.overflow = "hidden";
                        span.style.textOverflow = "ellipsis";
                        span.style.whiteSpace = "nowrap";

                        const groupTag = document.createElement('span');
                        groupTag.textContent = wb.group;
                        groupTag.style.fontSize = "10px";
                        groupTag.style.padding = "2px 6px";
                        groupTag.style.backgroundColor = "#f0f0f0";
                        groupTag.style.color = "#666";
                        groupTag.style.borderRadius = "4px";
                        groupTag.style.marginLeft = "5px";
                        
                        label.appendChild(checkbox);
                        label.appendChild(customCheck);
                        label.appendChild(span);
                        label.appendChild(groupTag);
                        listContainer.appendChild(label);
                    });
                }
                modal.style.display = 'flex';
            });
        }

        function closeBindWorldBookModal() {
            document.getElementById('bind-world-book-modal').style.display = 'none';
        }

        function saveBoundWorldBooks() {
            if (!currentChatFriendId) return;
            const checkboxes = document.querySelectorAll('#bind-world-book-list input[type="checkbox"]:checked');
            const selectedIds = Array.from(checkboxes).map(cb => cb.value);
            
            dbGet('friends', currentChatFriendId, friend => {
                if (friend) {
                    friend.boundWorldBooks = selectedIds;
                    dbUpdate('friends', friend, () => {
                        closeBindWorldBookModal();
                        updateBindWorldBookText(selectedIds);
                        showToast('世界书绑定已更新');
                    });
                }
            });
        }

        function updateBindWorldBookText(boundIds) {
            const textEl = document.getElementById('bind-world-book-text');
            if (!boundIds || boundIds.length === 0) {
                textEl.textContent = '未绑定';
            } else {
                let allWorldBooks = JSON.parse(localStorage.getItem('worldBooks')) || [];
                const boundTitles = allWorldBooks.filter(wb => boundIds.includes(wb.id)).map(wb => wb.title);
                if (boundTitles.length === 1) {
                    textEl.textContent = boundTitles[0];
                } else if (boundTitles.length > 1) {
                    textEl.textContent = `已绑定 ${boundTitles.length} 个`;
                } else {
                    textEl.textContent = '未绑定';
                }
            }
        }

        function openMyPersonaModal() {
            if (!currentChatFriendId) return;
            dbGet('friends', currentChatFriendId, friend => {
                if (!friend) return;
                
                dbGetAll('my_personas', personas => {
                    let optionsHtml = `<option value="">默认人设</option>`;
                    personas.forEach(p => {
                        const selected = (friend.myPersonaId === p.id) ? 'selected' : '';
                        optionsHtml += `<option value="${p.id}" ${selected}>${p.name}</option>`;
                    });

                    showGenericStickerModal({
                        title: '选择我在本聊天的人设',
                        body: `<select id="my-persona-select" style="width: 100%; padding: 10px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 14px; background: white;">
                                ${optionsHtml}
                               </select>`,
                        onConfirm: () => {
                            const selectEl = document.getElementById('my-persona-select');
                            const selectedId = selectEl.value;
                            const selectedName = selectEl.options[selectEl.selectedIndex].text;

                            friend.myPersonaId = selectedId;
                            
                            dbUpdate('friends', friend, () => {
                                document.getElementById('my-chat-persona-text').textContent = selectedId ? selectedName : '默认人设';
                            });
                            return true;
                        }
                    });
                });
            });
        }

        function triggerChatInfoAvatarUpload() {
            document.getElementById('chat-info-avatar-input').click();
        }

        function handleChatInfoAvatarChange(input) {
            if (input.files && input.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const imageUrl = e.target.result;
                    document.getElementById('chat-info-avatar').src = imageUrl;
                    
                    if (currentChatFriendId) {
                        dbGet('friends', currentChatFriendId, friend => {
                            if (friend) {
                                friend.avatar = imageUrl;
                                dbUpdate('friends', friend, () => {
                                    // Update Chat List and Chat Interface if needed
                                    // Chat interface doesn't show avatar in header, but messages do.
                                    // We should refresh the messages to show new avatar
                                    renderMessages(currentChatFriendId);
                                });
                            }
                        });
                    }
                }
                reader.readAsDataURL(input.files[0]);
            }
        }

        function toggleActiveChatConfig(isChecked) {
            updateFriendInfo('activeChat', isChecked);
            const container = document.getElementById('active-chat-interval-container');
            if (container) {
                container.style.display = isChecked ? 'block' : 'none';
            }
        }

        function toggleAutoSummarizeConfig(isChecked) {
            updateFriendInfo('autoSummarizeMemory', isChecked);
            const container = document.getElementById('auto-summarize-interval-container');
            if (container) {
                container.style.display = isChecked ? 'block' : 'none';
            }
        }

        function updateFriendInfo(field, value) {
            if (!currentChatFriendId) return;
            
            dbGet('friends', currentChatFriendId, friend => {
                if (friend) {
                    if (field === 'name') {
                        friend.name = value;
                        // Update Chat Interface Title immediately
                        document.getElementById('chat-interface-title').textContent = value;
                    } else if (field === 'realName') {
                        friend.realName = value;
                    } else if (field === 'persona') {
                        friend.persona = value;
                    } else if (field === 'activeChat') {
                        friend.activeChat = value;
                    } else if (field === 'syncReality') {
                        friend.syncReality = value;
                    } else if (field === 'messageInterval') {
                        friend.messageInterval = value;
                    } else if (field === 'avatarDisplay') {
                        friend.avatarDisplay = value;
                    } else if (field === 'shortTermMemory') {
                        friend.shortTermMemory = value;
                    } else if (field === 'autoSummarizeMemory') {
                        friend.autoSummarizeMemory = value;
                    } else if (field === 'summarizeInterval') {
                        friend.summarizeInterval = value;
                    }
                    
                    dbUpdate('friends', friend, () => {
                        // Refresh contact list to reflect name changes
                        if (field === 'name') {
                            // If we are looking at contacts page, refresh it
                            // But usually we are in chat info page
                            // No immediate action needed other than DB update
                        }
                        renderMessages(currentChatFriendId);
                    });
                }
            });
        }

        document.getElementById('save-chat-info-btn').addEventListener('click', () => {
            if (!currentChatFriendId) return;
            dbGet('friends', currentChatFriendId, friend => {
                if (friend) {
                    friend.name = document.getElementById('chat-info-remark').value.trim();
                    friend.realName = document.getElementById('chat-info-realname').value.trim();
                    friend.persona = document.getElementById('chat-info-persona').value.trim();
                    friend.shortTermMemory = document.getElementById('short-term-memory-input').value;
                    friend.autoSummarizeMemory = document.getElementById('auto-summarize-memory-toggle').checked;
                    dbUpdate('friends', friend, () => {
                        showToast('保存成功');
                        document.getElementById('chat-interface-title').textContent = friend.name;
                        renderMessages(currentChatFriendId);
                        showPage('chat-interface-page');
                    });
                }
            });
        });

        function deleteCurrentFriend() {
            if (!currentChatFriendId) return;
            showCustomConfirm('确定要删除该好友并清空所有聊天记录吗？<br>此操作不可恢复。', () => {
                const friendId = currentChatFriendId;
                
                // Delete from friends
                dbDelete('friends', friendId, () => {
                    // Delete chat history
                    const transaction = db.transaction(['chat_history'], 'readwrite');
                    const store = transaction.objectStore('chat_history');
                    const index = store.index('friendId');
                    const request = index.openCursor(IDBKeyRange.only(friendId));
                    
                    request.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor) {
                            cursor.delete();
                            cursor.continue();
                        }
                    };

                    transaction.oncomplete = () => {
                        showToast('好友已删除');
                        currentChatFriendId = null;
                        renderChatList();
                        renderContactsList();
                        switchWechatTab('contacts');
                    };
                });
            }, '删除好友');
        }

        document.getElementById('delete-friend-btn').addEventListener('click', deleteCurrentFriend);

        // --- Memory Management Logic ---
        let currentEditingMemoryId = null;

        function openMemoryManagement() {
            if (!currentChatFriendId) return;
            renderMemoryList();
            showPage('memory-management-page');
        }

        function renderMemoryList() {
            const listContainer = document.getElementById('memory-list');
            listContainer.innerHTML = '';
            
            dbGet('friends', currentChatFriendId, friend => {
                if (!friend) return;
                const memories = friend.memories || [];
                
                if (memories.length === 0) {
                    listContainer.innerHTML = '<div style="text-align:center; color:#999; margin-top:50px; font-size:14px;">暂无长期记忆</div>';
                    return;
                }

                // Sort by timestamp if available, else standard order
                // memories are likely appended, so reversing shows newest first
                [...memories].reverse().forEach(mem => {
                    const card = document.createElement('div');
                    card.className = 'persona-card';
                    card.style.height = 'auto'; // allow expansion
                    card.style.minHeight = '100px';
                    
                    const deleteIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

                    card.innerHTML = `
                        <div class="persona-card-content" style="-webkit-line-clamp: 10; font-size: 15px;">${mem.content}</div>
                        <div class="persona-card-delete" onclick="confirmDeleteMemory(event, '${mem.id}')">${deleteIcon}</div>
                    `;
                    
                    card.onclick = (e) => {
                        if (!e.target.closest('.persona-card-delete')) {
                            openAddMemoryModal(mem.id, mem.content);
                        }
                    };

                    listContainer.appendChild(card);
                });
            });
        }

        function openAddMemoryModal(id = null, content = '') {
            currentEditingMemoryId = id;
            document.getElementById('new-memory-content').value = content;
            document.getElementById('add-memory-modal-title').textContent = id ? '编辑记忆' : '添加记忆';
            document.getElementById('add-memory-modal').style.display = 'flex';
        }

        function closeAddMemoryModal() {
            document.getElementById('add-memory-modal').style.display = 'none';
        }

        function saveNewMemory() {
            const content = document.getElementById('new-memory-content').value.trim();
            if (!content) {
                showToast('请输入记忆内容');
                return;
            }

            dbGet('friends', currentChatFriendId, friend => {
                if (friend) {
                    if (!friend.memories) friend.memories = [];
                    
                    if (currentEditingMemoryId) {
                        // Edit
                        const index = friend.memories.findIndex(m => m.id === currentEditingMemoryId);
                        if (index !== -1) {
                            friend.memories[index].content = content;
                            friend.memories[index].updatedAt = Date.now();
                        }
                    } else {
                        // Add
                        friend.memories.push({
                            id: Date.now().toString(),
                            content: content,
                            createdAt: Date.now()
                        });
                    }
                    
                    dbUpdate('friends', friend, () => {
                        closeAddMemoryModal();
                        renderMemoryList();
                    });
                }
            });
        }

        function confirmDeleteMemory(e, id) {
            if(e) e.stopPropagation();
            showCustomConfirm('确定要删除这条记忆吗？', () => {
                dbGet('friends', currentChatFriendId, friend => {
                    if (friend && friend.memories) {
                        friend.memories = friend.memories.filter(m => m.id !== id);
                        dbUpdate('friends', friend, () => {
                            showToast('记忆已删除');
                            renderMemoryList();
                        });
                    }
                });
            }, '删除记忆');
        }

        // --- Me Page Logic ---
        function renderMePage() {
            dbGet('user_profile', 'main_user', profile => {
                const avatar = document.getElementById('me-page-avatar');
                const name = document.getElementById('me-page-name');
                const wechatId = document.getElementById('me-page-wechat-id');
                
                if (profile) {
                    if (profile.avatar) {
                        avatar.src = profile.avatar;
                    }
                    if (profile.name) {
                        name.textContent = profile.name;
                    } else {
                        name.textContent = '点击编辑姓名';
                    }
                    if (profile.wechatId) {
                        wechatId.textContent = profile.wechatId;
                    }
                } else {
                    name.textContent = '点击编辑姓名';
                }
            });
        }

        function triggerMePageAvatarUpload() {
            document.getElementById('me-page-avatar-input').click();
        }

        function handleMePageAvatarUpload(input) {
            if (input.files && input.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const imageUrl = e.target.result;
                    document.getElementById('me-page-avatar').src = imageUrl;
                    
                    // Sync to main page avatar
                    const mainAvatar = document.getElementById('avatar-display');
                    if (mainAvatar) mainAvatar.src = imageUrl;

                    dbGet('user_profile', 'main_user', profile => {
                        const updatedProfile = profile || { id: 'main_user' };
                        updatedProfile.avatar = imageUrl;
                        dbUpdate('user_profile', updatedProfile);
                    });
                }
                reader.readAsDataURL(input.files[0]);
            }
        }

        function saveMePageName() {
            const nameSpan = document.getElementById('me-page-name');
            const newName = nameSpan.textContent.trim();
            if (!newName) {
                nameSpan.textContent = '点击编辑姓名'; // Restore default if empty
                return;
            }
            dbGet('user_profile', 'main_user', profile => {
                const updatedProfile = profile || { id: 'main_user' };
                updatedProfile.name = newName;
                dbUpdate('user_profile', updatedProfile);
            });
        }

        function saveMePageWechatId() {
            const idSpan = document.getElementById('me-page-wechat-id');
            const newId = idSpan.textContent.trim();
            dbGet('user_profile', 'main_user', profile => {
                const updatedProfile = profile || { id: 'main_user' };
                updatedProfile.wechatId = newId;
                dbUpdate('user_profile', updatedProfile);
            });
        }

        // --- Persona Management Logic ---
        let currentEditingPersonaId = null;

        function openAddPersonaModal(id = null, name = '', content = '') {
            currentEditingPersonaId = id;
            document.getElementById('new-persona-name').value = name;
            document.getElementById('new-persona-content').value = content;
            
            const titleEl = document.getElementById('add-persona-modal-title');
            if (titleEl) {
                titleEl.textContent = id ? '编辑人设' : '新建人设';
            }
            
            document.getElementById('add-persona-modal').style.display = 'flex';
        }

        function closeAddPersonaModal() {
            document.getElementById('add-persona-modal').style.display = 'none';
        }

        function saveNewPersona() {
            const name = document.getElementById('new-persona-name').value.trim();
            const content = document.getElementById('new-persona-content').value.trim();

            if (!name) {
                showToast('请输入用户名称');
                return;
            }
            if (!content) {
                showToast('请输入人设内容');
                return;
            }

            if (currentEditingPersonaId) {
                // Update existing
                dbGet('my_personas', currentEditingPersonaId, (persona) => {
                    if (persona) {
                        persona.name = name;
                        persona.content = content;
                        dbUpdate('my_personas', persona, () => {
                            showToast('人设已更新');
                            closeAddPersonaModal();
                            renderPersonaList();
                        });
                    }
                });
            } else {
                // Create new
                const newPersona = {
                    id: Date.now().toString(),
                    name: name,
                    content: content,
                    createdAt: Date.now()
                };

                dbAdd('my_personas', newPersona, () => {
                    showToast('人设添加成功');
                    closeAddPersonaModal();
                    renderPersonaList();
                });
            }
        }

        function renderPersonaList() {
            const listContainer = document.getElementById('persona-list');
            listContainer.innerHTML = '';

            dbGetAll('my_personas', personas => {
                if (personas.length === 0) {
                    listContainer.innerHTML = '<div style="text-align:center; color:#999; margin-top:50px; font-size:14px;">暂无人设，点击右上角添加</div>';
                    return;
                }

                // Sort by newest first
                personas.sort((a, b) => b.createdAt - a.createdAt);

                personas.forEach(persona => {
                    const card = document.createElement('div');
                    card.className = 'persona-card';
                    
                    // Add click event to edit
                    card.onclick = (e) => {
                        // Prevent edit if clicking delete button
                        if (!e.target.closest('.persona-card-delete')) {
                            openAddPersonaModal(persona.id, persona.name, persona.content);
                        }
                    };
                    
                    const deleteIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

                    card.innerHTML = `
                        <div class="persona-card-header">
                            <span class="persona-card-title">${persona.name}</span>
                        </div>
                        <div class="persona-card-content">${persona.content}</div>
                        <div class="persona-card-delete" onclick="confirmDeletePersona(event, '${persona.id}', '${persona.name}')">${deleteIcon}</div>
                    `;
                    listContainer.appendChild(card);
                });
            });
        }

        function confirmDeletePersona(e, id, name) {
            if(e) e.stopPropagation();
            showCustomConfirm(
                `确定要删除人设 "<b>${name}</b>" 吗？`,
                () => {
                    dbDelete('my_personas', id, () => {
                        showToast('人设已删除');
                        renderPersonaList();
                    });
                },
                '删除人设'
            );
        }

        // Custom Select Helper Functions
        function initCustomSelect(selectElement) {
            if (!selectElement) return;
            if (selectElement.nextElementSibling && selectElement.nextElementSibling.classList.contains('custom-select-container')) {
                refreshCustomSelect(selectElement);
                return;
            }

            selectElement.style.display = 'none';

            const container = document.createElement('div');
            container.className = 'custom-select-container';

            const trigger = document.createElement('div');
            trigger.className = 'custom-select-trigger';
            
            const selectedOption = selectElement.options[selectElement.selectedIndex];
            const selectedText = selectedOption ? selectedOption.textContent : '';
            trigger.innerHTML = `<span>${selectedText}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
            
            const optionsContainer = document.createElement('div');
            optionsContainer.className = 'custom-select-options';

            Array.from(selectElement.options).forEach(option => {
                const customOption = document.createElement('div');
                customOption.className = 'custom-select-option';
                if (option.selected) customOption.classList.add('selected');
                customOption.textContent = option.textContent;
                customOption.dataset.value = option.value;
                
                customOption.addEventListener('click', () => {
                    selectElement.value = option.value;
                    selectElement.dispatchEvent(new Event('change'));
                    
                    trigger.querySelector('span').textContent = option.textContent;
                    optionsContainer.querySelectorAll('.custom-select-option').forEach(opt => opt.classList.remove('selected'));
                    customOption.classList.add('selected');
                    optionsContainer.classList.remove('open');
                    container.classList.remove('active');
                });
                
                optionsContainer.appendChild(customOption);
            });

            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.custom-select-options.open').forEach(el => {
                    if (el !== optionsContainer) {
                        el.classList.remove('open');
                        el.parentElement.classList.remove('active');
                    }
                });
                optionsContainer.classList.toggle('open');
                container.classList.toggle('active');
            });

            container.appendChild(trigger);
            container.appendChild(optionsContainer);
            selectElement.parentNode.insertBefore(container, selectElement.nextSibling);

            document.addEventListener('click', (e) => {
                if (!container.contains(e.target)) {
                    optionsContainer.classList.remove('open');
                    container.classList.remove('active');
                }
            });
        }

        function refreshCustomSelect(selectElement) {
            if (typeof selectElement === 'string') {
                selectElement = document.getElementById(selectElement);
            }
            if (!selectElement) return;

            const container = selectElement.nextElementSibling;
            if (!container || !container.classList.contains('custom-select-container')) {
                initCustomSelect(selectElement);
                return;
            }

            const triggerSpan = container.querySelector('.custom-select-trigger span');
            const optionsContainer = container.querySelector('.custom-select-options');
            
            optionsContainer.innerHTML = '';
            
             Array.from(selectElement.options).forEach(option => {
                const customOption = document.createElement('div');
                customOption.className = 'custom-select-option';
                if (option.selected) customOption.classList.add('selected');
                customOption.textContent = option.textContent;
                customOption.dataset.value = option.value;
                
                customOption.addEventListener('click', () => {
                    selectElement.value = option.value;
                    selectElement.dispatchEvent(new Event('change'));
                    
                    triggerSpan.textContent = option.textContent;
                    optionsContainer.querySelectorAll('.custom-select-option').forEach(opt => opt.classList.remove('selected'));
                    customOption.classList.add('selected');
                    optionsContainer.classList.remove('open');
                    container.classList.remove('active');
                });
                
                optionsContainer.appendChild(customOption);
            });
            
            const selectedOption = selectElement.options[selectElement.selectedIndex];
            if (selectedOption) {
                triggerSpan.textContent = selectedOption.textContent;
            }
        }

        // --- Transfer Logic ---
        let currentActiveTransferMsg = null;

        function openTransferModal() {
            if (!currentChatFriendId) {
                showToast('请先选择一个聊天');
                return;
            }
            document.getElementById('transfer-amount-input').value = '';
            document.getElementById('transfer-remark-input').value = '转账给对方';
            document.getElementById('transfer-modal').style.display = 'flex';
            toggleActionPanel(); // Close the + menu
        }

        function sendTransfer() {
            const amount = document.getElementById('transfer-amount-input').value.trim();
            const remark = document.getElementById('transfer-remark-input').value.trim() || '转账给对方';

            if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
                showToast('请输入有效的转账金额');
                return;
            }

            const message = {
                friendId: currentChatFriendId,
                text: `[转账] ¥${amount}`,
                type: 'sent',
                timestamp: Date.now(),
                isTransfer: true,
                transferAmount: parseFloat(amount).toFixed(2),
                transferRemark: remark,
                transferStatus: 'PENDING' // PENDING, ACCEPTED, RETURNED
            };

            addMessageToUI(message);
            dbAdd('chat_history', message);

            dbGet('friends', currentChatFriendId, friend => {
                if (friend) {
                    friend.lastMsg = `[转账]`;
                    friend.lastTime = getCurrentTimeStr();
                    dbUpdate('friends', friend, () => {
                        if (document.getElementById('wechat-page').classList.contains('active')) {
                            renderChatList();
                        }
                    });
                }
            });

            document.getElementById('transfer-modal').style.display = 'none';
            // Do not trigger AI response automatically
        }

        function openTransferActionModal(msg) {
            currentActiveTransferMsg = msg;
            const modal = document.getElementById('transfer-action-modal');
            const titleEl = document.getElementById('transfer-action-title');
            const descEl = document.getElementById('transfer-action-desc');

            titleEl.textContent = '确认收款';
            descEl.textContent = `收到 ¥${msg.transferAmount}`;
            
            modal.style.display = 'flex';
        }

        function handleTransferAction(action) {
            // action: 'ACCEPTED' or 'RETURNED'
            if (!currentActiveTransferMsg) return;
            
            const msgToUpdate = currentActiveTransferMsg;
            msgToUpdate.transferStatus = action;

            // Update in DB
            dbGetAll('chat_history', allMsgs => {
                const dbMsg = allMsgs.find(m => m.friendId === msgToUpdate.friendId && m.timestamp === msgToUpdate.timestamp);
                if (dbMsg) {
                    dbMsg.transferStatus = action;
                    dbUpdate('chat_history', dbMsg, () => {
                        // Close modal
                        document.getElementById('transfer-action-modal').style.display = 'none';
                        currentActiveTransferMsg = null;
                        
                        // If accepted or returned, add an auto-reply from the user
                        const replyText = action === 'ACCEPTED' ? '已收款' : '已退还';
                        
                        const replyMsg = {
                            friendId: currentChatFriendId,
                            text: `[转账] ${replyText}`,
                            type: 'sent', // User sending receipt
                            timestamp: Date.now(),
                            isTransfer: true, // Make it look like a transfer card
                            transferAmount: msgToUpdate.transferAmount,
                            transferRemark: replyText,
                            transferStatus: action,
                            isReceipt: true
                        };
                        
                        dbAdd('chat_history', replyMsg, () => {
                            // Render AFTER adding to DB to ensure persistence and order
                            renderMessages(currentChatFriendId);
                            
                            dbGet('friends', currentChatFriendId, friend => {
                                if (friend) {
                                    friend.lastMsg = `[转账] ${replyText}`;
                                    friend.lastTime = getCurrentTimeStr();
                                    dbUpdate('friends', friend);
                                }
                            });
                        });
                    });
                }
            });
        }

        // --- AI Emoji Library Logic ---
        let lastSelectedEmojiCharacter = "";

        function renderEmojiLibraryCharacters() {
            const select = document.getElementById('emoji-library-character-select');
            
            dbGetAll('friends', friends => {
                select.innerHTML = '';
                
                if (!friends || friends.length === 0) {
                    const defaultOption = document.createElement('option');
                    defaultOption.value = "";
                    defaultOption.textContent = "暂无角色";
                    select.appendChild(defaultOption);
                } else {
                    friends.forEach(friend => {
                        const option = document.createElement('option');
                        option.value = friend.id;
                        option.textContent = friend.name;
                        if (friend.id === lastSelectedEmojiCharacter) {
                            option.selected = true;
                        }
                        select.appendChild(option);
                    });
                    
                    // Auto-select first if no selection restored or valid
                    if ((!lastSelectedEmojiCharacter || !friends.find(f => f.id === lastSelectedEmojiCharacter)) && select.options.length > 0) {
                        select.options[0].selected = true;
                        lastSelectedEmojiCharacter = select.value;
                    }
                }
                
                refreshCustomSelect(select);
                
                // Listen to change
                select.onchange = (e) => {
                    lastSelectedEmojiCharacter = e.target.value;
                    renderAiStickers(e.target.value);
                };
                
                // Render stickers for the restored selection or first one
                renderAiStickers(select.value);
            });
        }

        function renderAiStickers(friendId) {
            const grid = document.getElementById('ai-sticker-grid');
            grid.innerHTML = '';
            if (!friendId) {
                grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; color:#999; margin-top:20px;">请先选择一个角色</div>';
                return;
            }
            
            // Default Dice
            const diceItem = document.createElement('div');
            diceItem.className = 'sticker-item';
            diceItem.innerHTML = `<img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 100 100'><g transform='translate(0, -5)'><rect x='5' y='25' width='50' height='50' rx='10' fill='white' stroke='%23333' stroke-width='3'/><circle cx='20' cy='40' r='5' fill='%23333'/><circle cx='45' cy='40' r='5' fill='%23333'/><circle cx='20' cy='65' r='5' fill='%23333'/><circle cx='45' cy='65' r='5' fill='%23333'/><circle cx='32.5' cy='52.5' r='5' fill='%23333'/></g><g transform='translate(35, 25)'><rect x='5' y='25' width='50' height='50' rx='10' fill='white' stroke='%23333' stroke-width='3'/><circle cx='20' cy='40' r='5' fill='%23333'/><circle cx='45' cy='65' r='5' fill='%23333'/></g></svg>" alt="Dice">`;
            grid.appendChild(diceItem);

            try {
                const transaction = db.transaction(['ai_stickers'], 'readonly');
                const store = transaction.objectStore('ai_stickers');
                const index = store.index('friendId');
                const req = index.getAll(friendId);
                
                req.onsuccess = () => {
                    const stickers = req.result;
                    
                    stickers.forEach(sticker => {
                        const item = document.createElement('div');
                        item.className = 'sticker-item';
                        
                        const img = document.createElement('img');
                        img.src = sticker.src;

                        const deleteBtn = document.createElement('div');
                        deleteBtn.className = 'sticker-delete-btn';
                        deleteBtn.innerHTML = '&times;';
                        
                        deleteBtn.onclick = (e) => {
                            e.stopPropagation();
                            dbDelete('ai_stickers', sticker.id, () => {
                                renderAiStickers(friendId);
                            });
                        };

                        let pressTimer;
                        let wasLongPress = false;

                        const startPress = (e) => {
                            if (e.button === 2) return;
                            wasLongPress = false;
                            pressTimer = setTimeout(() => {
                                wasLongPress = true;
                                grid.classList.add('edit-mode');
                            }, 500);
                        };

                        const cancelPress = () => {
                            clearTimeout(pressTimer);
                        };

                        item.addEventListener('mousedown', startPress);
                        item.addEventListener('touchstart', startPress, { passive: true });
                        item.addEventListener('mouseup', cancelPress);
                        item.addEventListener('mouseleave', cancelPress);
                        item.addEventListener('touchend', cancelPress);
                        item.addEventListener('touchcancel', cancelPress);

                        item.onclick = (e) => {
                            if (wasLongPress) return;
                            if (grid.classList.contains('edit-mode')) {
                                grid.classList.remove('edit-mode');
                            }
                        };
                        
                        item.appendChild(img);
                        item.appendChild(deleteBtn);
                        grid.appendChild(item);
                    });
                };
            } catch(e) {
                 grid.innerHTML += '<div style="grid-column: 1 / -1; text-align:center; color:#999; margin-top:20px;">请刷新页面重试</div>';
            }
        }

        function openAiStickerUploadModal() {
            const friendId = document.getElementById('emoji-library-character-select').value;
            if (!friendId) {
                showToast('请先选择一个角色');
                return;
            }
            document.getElementById('ai-sticker-upload-modal').style.display = 'flex';
        }

        function closeAiStickerUploadModal() {
            document.getElementById('ai-sticker-upload-modal').style.display = 'none';
        }

        function handleAiStickerFiles(input) {
            const friendId = document.getElementById('emoji-library-character-select').value;
            if (!friendId) return;
            
            const files = Array.from(input.files);
            if (files.length === 0) return;

            closeAiStickerUploadModal();

            let currentIndex = 0;
            let uploadedCount = 0;

            function processNext() {
                if (currentIndex >= files.length) {
                    if (uploadedCount > 0) {
                        renderAiStickers(friendId);
                        showToast(`成功上传 ${uploadedCount} 个表情`);
                    }
                    input.value = '';
                    return;
                }

                const file = files[currentIndex];
                compressImage(file, 0.6, (compressedSrc) => {
                    const titleText = files.length > 1 ? `添加表情包含义 (${currentIndex + 1}/${files.length})` : '添加表情包含义';
                    
                    showGenericStickerModal({
                        title: titleText,
                        body: `
                            <div style="text-align:center; margin-bottom:15px;">
                                <img src="${compressedSrc}" style="max-width:150px; max-height:150px; border-radius:8px; border:1px solid #eee;">
                            </div>
                            <label>请输入表情包含义 (必填)</label>
                            <input type="text" id="ai-sticker-desc-input" placeholder="例如：开心、哭泣、暗中观察...">
                        `,
                        onConfirm: () => {
                            const desc = document.getElementById('ai-sticker-desc-input').value.trim();
                            if (!desc) {
                                showToast('必须填写含义，否则AI无法理解');
                                return false;
                            }
                            
                            const newSticker = {
                                friendId: friendId,
                                src: compressedSrc,
                                description: desc
                            };
                            
                            dbAdd('ai_stickers', newSticker, () => {
                                uploadedCount++;
                                currentIndex++;
                                processNext();
                            });
                            return true;
                        },
                        onCancel: () => {
                            currentIndex++;
                            processNext();
                        }
                    });
                });
            }

            processNext();
        }

        function openOfflineModeModal() {
            if (!currentChatFriendId) {
                showToast('请先选择一个聊天');
                return;
            }

            const writingStyleSelect = document.getElementById('writing-style-select');
            writingStyleSelect.innerHTML = '<option value="default">默认风格</option>';
            const localWorldBooks = JSON.parse(localStorage.getItem('worldBooks')) || [];
            localWorldBooks.forEach(book => {
                const option = document.createElement('option');
                option.value = book.id;
                option.textContent = book.title;
                writingStyleSelect.appendChild(option);
            });
            
            dbGet('friends', currentChatFriendId, friend => {
                if (friend && friend.offlineSettings) {
                    const settings = friend.offlineSettings;
                    document.getElementById('offline-mode-toggle').checked = settings.enabled || false;
                    document.getElementById('show-thoughts-toggle').checked = settings.showThoughts || false;
                    document.getElementById('your-perspective-select').value = settings.yourPerspective || 'second_person';
                    document.getElementById('character-perspective-select').value = settings.characterPerspective || 'first_person';
                    document.getElementById('reply-word-count-min').value = settings.replyWordCountMin || '';
                    document.getElementById('reply-word-count-max').value = settings.replyWordCountMax || '';
                    writingStyleSelect.value = settings.writingStyle || 'default';
                } else {
                    // Reset to default if no settings found
                    document.getElementById('offline-mode-toggle').checked = false;
                    document.getElementById('show-thoughts-toggle').checked = false;
                    document.getElementById('your-perspective-select').value = 'second_person';
                    document.getElementById('character-perspective-select').value = 'first_person';
                    document.getElementById('reply-word-count-min').value = '';
                    document.getElementById('reply-word-count-max').value = '';
                    writingStyleSelect.value = 'default';
                }
                
                // Init custom selects for the modal
                initCustomSelect(document.getElementById('your-perspective-select'));
                initCustomSelect(document.getElementById('character-perspective-select'));
                refreshCustomSelect(writingStyleSelect);

                document.getElementById('offline-mode-modal').style.display = 'flex';
            });
        }

        function closeOfflineModeModal() {
            document.getElementById('offline-mode-modal').style.display = 'none';
        }

        function saveOfflineModeSettings() {
            if (!currentChatFriendId) return;

            const settings = {
                enabled: document.getElementById('offline-mode-toggle').checked,
                showThoughts: document.getElementById('show-thoughts-toggle').checked,
                yourPerspective: document.getElementById('your-perspective-select').value,
                characterPerspective: document.getElementById('character-perspective-select').value,
                replyWordCountMin: document.getElementById('reply-word-count-min').value,
                replyWordCountMax: document.getElementById('reply-word-count-max').value,
                writingStyle: document.getElementById('writing-style-select').value,
            };

            dbGet('friends', currentChatFriendId, friend => {
                if (friend) {
                    friend.offlineSettings = settings;
                    dbUpdate('friends', friend, () => {
                        showToast('线下模式设置已保存');
                        closeOfflineModeModal();
                    });
                }
            });
        }

        function openAiStickerUrlModal() {
            closeAiStickerUploadModal();
            const friendId = document.getElementById('emoji-library-character-select').value;
            if (!friendId) return;

            showGenericStickerModal({
                title: '批量添加链接表情',
                body: `
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <div>
                            <div style="font-size:12px; color:#666; margin-bottom:5px;">格式：含义 链接 (用空格分隔)</div>
                            <textarea id="ai-sticker-batch-input" placeholder="例如：
开心 http://example.com/happy.png
哭泣 http://example.com/sad.jpg" style="height:150px; padding: 10px; border: 1px solid #e0e0e0; border-radius: 8px; width: 100%; resize: none;"></textarea>
                        </div>
                    </div>
                `,
                onConfirm: () => {
                    const text = document.getElementById('ai-sticker-batch-input').value.trim();
                    if (!text) {
                        showToast('请输入内容');
                        return false;
                    }

                    const lines = text.split('\n');
                    const validStickers = [];

                    lines.forEach(line => {
                        line = line.trim();
                        if (!line) return;

                        const parts = line.split(/\s+/);
                        if (parts.length < 2) return; 
                        
                        const url = parts[parts.length - 1];
                        if (!url.startsWith('http')) return;
                        
                        const desc = parts.slice(0, parts.length - 1).join(' ');
                        
                        validStickers.push({
                            friendId: friendId,
                            src: url,
                            description: desc
                        });
                    });

                    if (validStickers.length === 0) {
                        showToast('未识别到有效格式，请确保每行包含“含义”和“http链接”');
                        return false;
                    }

                    let savedCount = 0;
                    validStickers.forEach(sticker => {
                        dbAdd('ai_stickers', sticker, () => {
                            savedCount++;
                            if (savedCount === validStickers.length) {
                                renderAiStickers(friendId);
                                showToast(`成功上传 ${savedCount} 个表情`);
                            }
                        });
                    });
                    
                    return true;
                }
            });
        }

        document.getElementById('emoji-library-page').addEventListener('click', (e) => {
            if (!e.target.closest('.sticker-item') && !e.target.closest('.sticker-delete-btn')) {
                const grid = document.getElementById('ai-sticker-grid');
                if (grid) grid.classList.remove('edit-mode');
            }
        });

        async function exportData() {
            const data = {
                indexedDB: {},
                localStorage: {}
            };

            // 1. Export LocalStorage
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                data.localStorage[key] = localStorage.getItem(key);
            }

            // 2. Export IndexedDB
            const stores = ['friends', 'chat_history', 'user_profile', 'ai_stickers', 'stickers', 'my_personas', 'discover_posts'];
            
            try {
                for (const storeName of stores) {
                    if (db.objectStoreNames.contains(storeName)) {
                        data.indexedDB[storeName] = await new Promise((resolve, reject) => {
                            const transaction = db.transaction([storeName], 'readonly');
                            const store = transaction.objectStore(storeName);
                            const request = store.getAll();
                            request.onsuccess = () => resolve(request.result);
                            request.onerror = (e) => reject(e.target.error);
                        });
                    }
                }

                // Create and download file
                const jsonStr = JSON.stringify(data);
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const dateStr = new Date().toISOString().split('T')[0];
                a.download = `suanpiji_backup_${dateStr}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showToast('导出成功');
            } catch (error) {
                console.error('Export failed:', error);
                showToast('导出失败');
            }
        }

        function importData(input) {
            const file = input.files[0];
            if (!file) return;

            showCustomConfirm('导入数据将覆盖当前所有数据（包括聊天记录和设置），确认导入吗？', () => {
                const reader = new FileReader();
                reader.onload = async function(e) {
                    try {
                        const data = JSON.parse(e.target.result);
                        
                        // 1. Import LocalStorage
                        if (data.localStorage) {
                            localStorage.clear();
                            for (const key in data.localStorage) {
                                localStorage.setItem(key, data.localStorage[key]);
                            }
                        }

                        // 2. Import IndexedDB
                        if (data.indexedDB) {
                            for (const storeName in data.indexedDB) {
                                if (db.objectStoreNames.contains(storeName)) {
                                    const items = data.indexedDB[storeName];
                                    
                                    // Clear existing store
                                    await new Promise((resolve, reject) => {
                                        const tx = db.transaction([storeName], 'readwrite');
                                        const store = tx.objectStore(storeName);
                                        const clearReq = store.clear();
                                        clearReq.onsuccess = () => resolve();
                                        clearReq.onerror = (err) => reject(err.target.error);
                                    });

                                    // Add new items
                                    if (items && items.length > 0) {
                                        await new Promise((resolve, reject) => {
                                            const tx = db.transaction([storeName], 'readwrite');
                                            const store = tx.objectStore(storeName);
                                            tx.oncomplete = () => resolve();
                                            tx.onerror = (err) => reject(err.target.error);
                                            items.forEach(item => store.put(item));
                                        });
                                    }
                                }
                            }
                        }
                        
                        showToast('导入成功，即将重新加载...');
                        setTimeout(() => location.reload(), 1500);

                    } catch (error) {
                        console.error('Import failed:', error);
                        showToast('导入失败：文件格式错误或数据损坏');
                    }
                };
                reader.readAsText(file);
            }, '确认导入');
            
            input.value = ''; // Reset input
        }

        // --- Music Listen Together Logic ---
        let musicState = {
            playlist: [],
            currentIndex: -1,
            audio: new Audio(),
            isPlaying: false,
            lyricsList: [],
            currentLyric: '',
            togetherMinutes: 0,
            startTime: null,
            timerInterval: null
        };

        function openMusicImportModal() {
            if (!currentChatFriendId) {
                showToast('请先选择一个聊天');
                return;
            }
            toggleActionPanel();
            document.getElementById('music-url-input').value = '';
            document.getElementById('music-import-modal').style.display = 'flex';
        }

        function extractMusicId(url) {
            let server = '';
            let id = '';
            if (url.includes('163.com') || url.includes('126.net')) {
                server = 'netease';
                let match = url.match(/id=(\d+)/);
                if (match) id = match[1];
                else {
                    match = url.match(/playlist\/(\d+)/);
                    if (match) id = match[1];
                }
            } else if (url.includes('qq.com')) {
                server = 'tencent';
                let match = url.match(/id=(\d+)/);
                if (match) id = match[1];
                else {
                    match = url.match(/playlist\/([A-Za-z0-9]+)/);
                    if (match) id = match[1];
                }
            }
            return { server, id };
        }

        async function importMusicPlaylist() {
            const url = document.getElementById('music-url-input').value.trim();
            if (!url) {
                showToast('请输入链接');
                return;
            }
            const info = extractMusicId(url);
            if (!info.server || !info.id) {
                showToast('无法识别该链接');
                return;
            }

            document.getElementById('music-import-modal').style.display = 'none';
            showToast('正在解析歌单...');

            try {
                // Using generic meting api
                const apiUrl = `https://api.i-meto.com/meting/api?server=${info.server}&type=playlist&id=${info.id}`;
                const res = await fetch(apiUrl);
                const data = await res.json();

                if (data && data.length > 0) {
                    musicState.playlist = data;
                    musicState.currentIndex = 0;
                    startListenTogether();
                    showToast(`成功导入 ${data.length} 首歌曲`);
                } else {
                    showToast('获取失败，歌单可能为空或隐私受限');
                }
            } catch (err) {
                console.error(err);
                showToast('网络请求失败');
            }
        }

        function startListenTogether() {
            if (!musicState.startTime) {
                musicState.startTime = Date.now();
                musicState.togetherMinutes = 0;
                if (musicState.timerInterval) clearInterval(musicState.timerInterval);
                musicState.timerInterval = setInterval(() => {
                    musicState.togetherMinutes = Math.floor((Date.now() - musicState.startTime) / 60000);
                    document.getElementById('music-together-time').textContent = `一起听了 ${musicState.togetherMinutes} 分钟`;
                }, 60000);
                document.getElementById('music-together-time').textContent = `一起听了 0 分钟`;
            }
            
            document.getElementById('mini-player-bar').style.display = 'flex';
            
            // Set Avatars
            dbGet('friends', currentChatFriendId, friend => {
                if (friend) {
                    document.getElementById('music-avatar-ai').src = friend.avatar;
                    dbGet('user_profile', 'main_user', p => {
                        const myAvatar = friend.myAvatar || (p && p.avatar ? p.avatar : 'https://via.placeholder.com/150');
                        document.getElementById('music-avatar-user').src = myAvatar;
                    });
                }
            });

            playSong(0);
        }

        async function resolveSongSource(song) {
            // Test if original URL works by loading it
            return new Promise((resolve) => {
                if (song._resolvedUrl) {
                    resolve(true); // Already resolved
                    return;
                }
                const testAudio = new Audio();
                testAudio.preload = 'metadata';
                testAudio.onloadedmetadata = () => {
                    song._resolvedUrl = song.url;
                    song._resolvedLrc = song.lrc;
                    resolve(true);
                };
                testAudio.onerror = async () => {
                    // Try alternative search
                    try {
                        const searchUrl = `https://api.i-meto.com/meting/api?server=kugou&type=search&id=${encodeURIComponent(song.name + ' ' + song.artist)}`;
                        const res = await fetch(searchUrl);
                        const results = await res.json();
                        if (results && results.length > 0) {
                            song._resolvedUrl = results[0].url;
                            song._resolvedLrc = results[0].lrc;
                            resolve(true);
                        } else {
                            song._failed = true;
                            resolve(false);
                        }
                    } catch (e) {
                        song._failed = true;
                        resolve(false);
                    }
                };
                testAudio.src = song.url;
            });
        }

        async function playSong(index) {
            if (index < 0 || index >= musicState.playlist.length) return;
            const song = musicState.playlist[index];
            musicState.currentIndex = index;
            
            // 随机决定这首歌是否要主动发言 (约 15% 概率)
            song._willComment = Math.random() < 0.15;
            song._hasCommented = false;
            // 随机决定在这首歌的什么进度发言 (40% ~ 80% 之间)
            song._commentProgress = 0.4 + Math.random() * 0.4;

            updatePlayerUI(song);
            
            const success = await resolveSongSource(song);
            if (!success) {
                // If current is playing, skip to next silently
                playNextSong();
                return;
            }

            musicState.audio.src = song._resolvedUrl;
            musicState.audio.play().then(() => {
                musicState.isPlaying = true;
                updatePlayStateUI();
                fetchLyrics(song._resolvedLrc);
                // Preload next
                if (index + 1 < musicState.playlist.length) {
                    resolveSongSource(musicState.playlist[index + 1]);
                }
            }).catch(e => {
                console.error("Play error:", e);
                playNextSong();
            });
        }

        function playNextSong(userTriggered = false) {
            let nextIndex = musicState.currentIndex + 1;
            if (nextIndex >= musicState.playlist.length) {
                nextIndex = 0; // Loop
            }
            playSong(nextIndex);
        }

        function playPrevSong() {
            let prevIndex = musicState.currentIndex - 1;
            if (prevIndex < 0) {
                prevIndex = musicState.playlist.length - 1;
            }
            playSong(prevIndex);
        }

        function toggleMusicPlay(e) {
            if (e) e.stopPropagation();
            if (musicState.audio.paused) {
                musicState.audio.play();
                musicState.isPlaying = true;
            } else {
                musicState.audio.pause();
                musicState.isPlaying = false;
            }
            updatePlayStateUI();
        }

        function closeMusicSystem(e) {
            if (e) e.stopPropagation();
            musicState.audio.pause();
            musicState.isPlaying = false;
            document.getElementById('mini-player-bar').style.display = 'none';
            document.getElementById('music-full-page').classList.remove('active');
            if (musicState.timerInterval) clearInterval(musicState.timerInterval);
        }

        function openMusicFullPage() {
            document.getElementById('music-full-page').classList.add('active');
            hideAllInputPanels();
        }

        function minimizeMusicPage() {
            document.getElementById('music-full-page').classList.remove('active');
        }

        function updatePlayerUI(song) {
            const title = song.name;
            const artist = song.artist;
            const pic = song.pic || 'https://via.placeholder.com/150';

            document.getElementById('mini-player-title').textContent = title;
            document.getElementById('mini-player-cover').src = pic;
            
            document.getElementById('full-song-name').textContent = title;
            document.getElementById('full-artist-name').textContent = artist;
            document.getElementById('vinyl-cover').src = pic;
        }

        function updatePlayStateUI() {
            const isPlaying = musicState.isPlaying;
            
            // Mini Player
            const miniCover = document.getElementById('mini-player-cover');
            const miniBtn = document.getElementById('mini-player-play-btn');
            if (isPlaying) {
                miniCover.classList.add('playing');
                miniBtn.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
            } else {
                miniCover.classList.remove('playing');
                miniBtn.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
            }

            // Full Player
            const vinyl = document.getElementById('vinyl-record');
            const fullBtn = document.getElementById('full-play-btn-icon');
            if (isPlaying) {
                vinyl.classList.add('playing');
                fullBtn.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
            } else {
                vinyl.classList.remove('playing');
                fullBtn.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
            }
        }

        // Time logic
        musicState.audio.addEventListener('timeupdate', () => {
            const current = musicState.audio.currentTime;
            const duration = musicState.audio.duration;
            if (duration) {
                document.getElementById('music-time-current').textContent = formatTime(current);
                document.getElementById('music-time-total').textContent = formatTime(duration);
                document.getElementById('music-progress-fill').style.width = `${(current / duration) * 100}%`;
                syncLyric(current);
                
                // 听歌主动发言检测
                if (currentChatFriendId && musicState.playlist[musicState.currentIndex]) {
                    const song = musicState.playlist[musicState.currentIndex];
                    if (song._willComment && !song._hasCommented) {
                        if (current / duration >= song._commentProgress) {
                            song._hasCommented = true;
                            
                            dbGet('friends', currentChatFriendId, friend => {
                                // 检查主动聊天开关是否开启
                                if (friend && friend.activeChat) {
                                    const configStr = localStorage.getItem('globalConfig');
                                    if (configStr) {
                                        const config = JSON.parse(configStr);
                                        if (config.apiKey && config.model) {
                                            const prompt = "\n【系统提示】你们正在一起听歌，这首歌刚好播到了比较有感触的地方。请根据你们的聊天上下文和刚刚听到的这几句歌词，随口发一条消息说一句你的感想或吐槽。就像好朋友在一起听歌时自然地搭话，不要长篇大论。";
                                            generateProactiveMessage(friend, config, prompt);
                                        }
                                    }
                                }
                            });
                        }
                    }
                }
            }
        });

        musicState.audio.addEventListener('ended', () => {
            playNextSong();
        });

        function formatTime(seconds) {
            if (isNaN(seconds)) return '00:00';
            const m = Math.floor(seconds / 60).toString().padStart(2, '0');
            const s = Math.floor(seconds % 60).toString().padStart(2, '0');
            return `${m}:${s}`;
        }

        function seekMusic(e) {
            const bar = document.getElementById('music-progress-bar');
            const rect = bar.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const percentage = clickX / rect.width;
            if (musicState.audio.duration) {
                musicState.audio.currentTime = percentage * musicState.audio.duration;
            }
        }

        // Lyrics logic
        async function fetchLyrics(lrcUrl) {
            musicState.lyricsList = [];
            musicState.currentLyric = '暂无歌词';
            document.getElementById('full-music-lyric').textContent = musicState.currentLyric;
            document.getElementById('mini-player-lyric').textContent = '一起听...';
            if (!lrcUrl) return;

            try {
                const res = await fetch(lrcUrl);
                const text = await res.text();
                const lines = text.split('\n');
                lines.forEach(line => {
                    const match = line.match(/\[(\d+):(\d+\.\d+)\](.*)/);
                    if (match) {
                        const m = parseInt(match[1]);
                        const s = parseFloat(match[2]);
                        const content = match[3].trim();
                        if (content) {
                            musicState.lyricsList.push({
                                time: m * 60 + s,
                                text: content
                            });
                        }
                    }
                });
            } catch (e) {
                console.error("Lyrics fetch failed");
            }
        }

        function syncLyric(currentTime) {
            let currentLineText = '';
            let recentLines = [];
            for (let i = 0; i < musicState.lyricsList.length; i++) {
                if (currentTime >= musicState.lyricsList[i].time) {
                    currentLineText = musicState.lyricsList[i].text;
                    recentLines.push(currentLineText);
                } else {
                    break;
                }
            }
            if (recentLines.length > 5) {
                recentLines = recentLines.slice(-5);
            }
            musicState.recentLyrics = recentLines;

            if (currentLineText && currentLineText !== musicState.currentLyric) {
                musicState.currentLyric = currentLineText;
                document.getElementById('full-music-lyric').textContent = currentLineText;
                document.getElementById('mini-player-lyric').textContent = currentLineText;
            }
        }

        // Music Chat Logic
        function openMusicChatInput() {
            const overlay = document.getElementById('music-chat-input-overlay');
            overlay.style.display = 'flex';
            document.getElementById('music-chat-input').focus();
        }

        document.getElementById('music-chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMusicChatMessage();
        });

        document.getElementById('music-full-page').addEventListener('click', (e) => {
            if (e.target.id === 'music-full-page' || e.target.closest('.vinyl-container')) {
                document.getElementById('music-chat-input-overlay').style.display = 'none';
            }
        });

        function sendMusicChatMessage() {
            const input = document.getElementById('music-chat-input');
            const text = input.value.trim();
            if (!text || !currentChatFriendId) return;

            input.value = '';
            document.getElementById('music-chat-input-overlay').style.display = 'none';

            // Show User Bubble
            showMusicBubble('user', text);

            // Add to Chat History
            const message = {
                friendId: currentChatFriendId,
                text: text,
                type: 'sent',
                timestamp: Date.now()
            };
            addMessageToUI(message);
            dbAdd('chat_history', message);
            
            dbGet('friends', currentChatFriendId, friend => {
                if (friend) {
                    friend.lastMsg = text;
                    friend.lastTime = getCurrentTimeStr();
                    dbUpdate('friends', friend);
                }
            });

            // Trigger AI Response
            triggerAIResponse();
        }

        function showMusicBubble(side, text) {
            if (!document.getElementById('music-full-page').classList.contains('active')) return;
            const bubbleId = side === 'user' ? 'music-bubble-user' : 'music-bubble-ai';
            const bubble = document.getElementById(bubbleId);
            bubble.textContent = text;
            bubble.classList.add('show');
            
            // Clear existing timeout if any
            if (bubble.timeoutId) clearTimeout(bubble.timeoutId);
            
            bubble.timeoutId = setTimeout(() => {
                bubble.classList.remove('show');
            }, 4000);
        }

        // --- End Music Logic ---

        // Initial Load
        initDB(() => {
            // After DB is ready, render the list
            renderChatList();
            loadTheme();
            // The rest of the init can happen in parallel
        });

        // Virtual Keyboard handling via Visual Viewport
        if (window.visualViewport) {
            const handleViewportResize = () => {
                const vvHeight = window.visualViewport.height;
                const isMobile = window.matchMedia('(max-width: 600px)').matches || 
                                 window.matchMedia('(display-mode: fullscreen)').matches || 
                                 window.matchMedia('(display-mode: standalone)').matches;
                
                const container = document.querySelector('.phone-container');
                if (isMobile && container) {
                    container.style.height = `${vvHeight}px`;
                    document.body.style.height = `${vvHeight}px`;
                    window.scrollTo(0, 0); // 防止页面发生整体滚动偏移
                } else if (container) {
                    container.style.height = '812px'; 
                }
            };
            
            window.visualViewport.addEventListener('resize', handleViewportResize);
            // 延迟一点初始化，确保其他全屏/样式逻辑已应用
            setTimeout(handleViewportResize, 100);
        }
        showPage('main-page');
        loadSettings();
        updateDate();
        updateTime();
        setInterval(updateTime, 1000);
        setInterval(() => {
            checkActiveChats();
            runAutoSummarization();
        }, 60000); // Check every minute for active chats & summarization

        // Register Service Worker for PWA
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js').then(registration => {
                    console.log('SW registered: ', registration.scope);
                }).catch(err => {
                    console.log('SW registration failed: ', err);
                });
            });
        }

        // The 'interactive-widget=resizes-content' meta tag now handles keyboard behavior natively.
        // The custom handleViewportResize function has been removed to prevent conflicts and page jumping.

        // 全屏管理逻辑
        const enterFullScreen = async () => {
            const docEl = document.documentElement;
            try {
                if (docEl.requestFullscreen) {
                    await docEl.requestFullscreen({ navigationUI: "hide" });
                } else if (docEl.webkitRequestFullscreen) {
                    await docEl.webkitRequestFullscreen({ navigationUI: "hide" });
                }
            } catch (err) {
                // 忽略非交互触发的错误，等待下一次交互
                console.log("进入全屏失败:", err);
            }
        };

        const setupFullScreenRestorer = () => {
            // 检查是否是 PWA 模式
            if (!(window.matchMedia('(display-mode: standalone)').matches || 
                  window.matchMedia('(display-mode: fullscreen)').matches)) {
                return;
            }

            const restore = () => {
                if (!document.fullscreenElement) {
                    enterFullScreen();
                }
            };

            // 当全屏状态改变且不是全屏时，绑定一次性点击事件来恢复
            document.addEventListener('fullscreenchange', () => {
                if (!document.fullscreenElement) {
                    document.addEventListener('click', restore, { once: true });
                    document.addEventListener('touchstart', restore, { once: true });
                }
            });

            // 当页面重新可见时（比如从相册返回），也尝试恢复
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && !document.fullscreenElement) {
                    // 先尝试直接恢复（有些浏览器允许）
                    enterFullScreen();
                    // 以前失败，绑定点击恢复
                    document.addEventListener('click', restore, { once: true });
                    document.addEventListener('touchstart', restore, { once: true });
                }
            });

            // 页面加载时的初始尝试
            enterFullScreen();
            // 以防万一，初始点击也绑定
            document.addEventListener('click', restore, { once: true });
            document.addEventListener('touchstart', restore, { once: true });
        };

        // 初始化
        document.addEventListener('DOMContentLoaded', () => {
            setupFullScreenRestorer();
            document.getElementById('comment-drawer-overlay').addEventListener('click', closeCommentDrawer);
        });

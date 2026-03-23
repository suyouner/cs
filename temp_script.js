
        const ACTIVATION_CODE = "16750";

        function checkActivationCode() {
            const inputCode = document.getElementById('activation-code-input').value.trim();
            if (inputCode === ACTIVATION_CODE) {
                localStorage.setItem('app_activated', 'true');
                document.getElementById('activation-page').style.display = 'none';
                document.getElementById('main-app-container').style.display = 'flex';
            } else {
                showToast('激活码错误');
            }
        }

        let lastAIMusicActionTime = 0;

        // --- IndexedDB Helpers ---
        let db;
        let themeSettings = {}; // In-memory cache for theme settings

        function dbSaveSetting(key, value) {
            return new Promise((resolve, reject) => {
                if (!db) return reject('DB not initialized');
                const transaction = db.transaction(['theme_settings'], 'readwrite');
                const store = transaction.objectStore('theme_settings');
                const request = store.put({ id: key, value: value });
                request.onsuccess = () => {
                    themeSettings[key] = value; // Update cache
                    resolve();
                };
                request.onerror = (e) => {
                    console.error(`Error saving setting ${key}:`, e.target.error);
                    if (e.target.error.name === 'QuotaExceededError') {
                        showToast('存储空间已满，请清理其他主题图片');
                    }
                    reject(e.target.error);
                };
            });
        }

        function dbDeleteSetting(key) {
            return new Promise((resolve, reject) => {
                if (!db) return resolve();
                const transaction = db.transaction(['theme_settings'], 'readwrite');
                const store = transaction.objectStore('theme_settings');
                const request = store.delete(key);
                request.onsuccess = () => {
                    delete themeSettings[key];
                    resolve();
                };
                request.onerror = (e) => reject(e.target.error);
            });
        }

        function dbLoadAllSettings(callback) {
            if (!db || !db.objectStoreNames.contains('theme_settings')) {
                if (callback) callback();
                return;
            }
            const transaction = db.transaction(['theme_settings'], 'readonly');
            const store = transaction.objectStore('theme_settings');
            const request = store.getAll();
            request.onsuccess = () => {
                themeSettings = {};
                request.result.forEach(item => {
                    themeSettings[item.id] = item.value;
                });
                if (callback) callback();
            };
            request.onerror = (e) => {
                console.error(`Error loading all settings:`, e.target.error);
                if (callback) callback(); // Proceed even if loading fails
            };
        }

        function initDB(callback) {
            const request = indexedDB.open('UserData', 13); // Version 13

            request.onerror = (event) => {
                console.error("Database error: ", event.target.error);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('world_books')) {
                    db.createObjectStore('world_books', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('wb_settings')) {
                    db.createObjectStore('wb_settings', { keyPath: 'id' });
                }
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
                }
                if (!db.objectStoreNames.contains('global_playlist')) {
                    db.createObjectStore('global_playlist', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('discover_notifications')) {
                    const notifStore = db.createObjectStore('discover_notifications', { keyPath: 'id' });
                    notifStore.createIndex('toId', 'toId', { unique: false });
                }
                if (!db.objectStoreNames.contains('theme_settings')) {
                    db.createObjectStore('theme_settings', { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                console.log("Database opened successfully.");
                // Load all theme settings into memory after DB is ready
                dbLoadAllSettings(() => {
                    if (callback) callback();
                });
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

            if (pageId === 'theme-page' || pageId === 'desktop-theme-page' || pageId === 'chat-theme-page' || pageId === 'bubble-theme-page' || pageId === 'global-font-page' || pageId === 'world-book-page' || pageId === 'wechat-page' || pageId === 'wechat-contacts-page' || pageId === 'wechat-me-page' || pageId === 'persona-management-page' || pageId === 'friend-profile-page' || pageId === 'memory-management-page' || pageId === 'emoji-library-page' || pageId === 'search-detail-page' || pageId === 'regex-app-page') {
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
            if (pageId === 'bubble-theme-page') {
                renderBubbleThemePage();
            }
        }

        let currentChatFriend = null;
        let currentUserProfile = null;
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
            const applyPreview = (settings) => {
                const pWallpaper = document.getElementById('chat-wallpaper-preview');
                if (pWallpaper) pWallpaper.style.backgroundImage = settings.chat_wallpaper ? `url(${settings.chat_wallpaper})` : 'none';

                const pHeader = document.getElementById('chat-header-bg-preview');
                if (pHeader) pHeader.style.backgroundImage = settings.chat_header_bg ? `url(${settings.chat_header_bg})` : 'none';

                const pInput = document.getElementById('chat-input-bg-preview');
                if (pInput) pInput.style.backgroundImage = settings.chat_input_bg ? `url(${settings.chat_input_bg})` : 'none';

                const icons = ['back', 'options', 'voice', 'emoji', 'plus', 'send'];
                icons.forEach(icon => {
                    const key = `chat_${icon}_icon`;
                    const box = document.getElementById(`chat-${icon}-icon-preview`);
                    if (box) box.style.backgroundImage = settings[key] ? `url(${settings[key]})` : 'none';
                });

                const size = settings.chat_avatar_size || '40';
                const radius = settings.chat_avatar_radius || '6';
                
                const sizeSlider = document.getElementById('chat-avatar-size-slider');
                const sizeValue = document.getElementById('chat-avatar-size-value');
                if (sizeSlider) sizeSlider.value = size;
                if (sizeValue) sizeValue.textContent = `${size}px`;

                const radiusSlider = document.getElementById('chat-avatar-radius-slider');
                const radiusValue = document.getElementById('chat-avatar-radius-value');
                if (radiusSlider) radiusSlider.value = radius;
                if (radiusValue) radiusValue.textContent = `${radius}px`;

                const avatarImg = document.getElementById('chat-theme-avatar-preview-img');
                if (avatarImg) {
                    avatarImg.style.width = `${size}px`;
                    avatarImg.style.height = `${size}px`;
                    avatarImg.style.borderRadius = `${radius}px`;
                    if (settings.avatarSrc) {
                        avatarImg.src = settings.avatarSrc;
                        avatarImg.style.backgroundColor = 'transparent';
                    } else {
                        avatarImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                        avatarImg.style.backgroundColor = '#000';
                    }
                }
            };

            const keys = ['chat_wallpaper', 'chat_header_bg', 'chat_input_bg', 'chat_back_icon', 'chat_options_icon', 'chat_voice_icon', 'chat_emoji_icon', 'chat_plus_icon', 'chat_send_icon', 'chat_avatar_size', 'chat_avatar_radius'];
            
            if (currentChatThemeFriendId) {
                dbGet('friends', currentChatThemeFriendId, friend => {
                    const merged = {};
                    keys.forEach(k => {
                        const globalVal = themeSettings[k] !== undefined ? themeSettings[k] : localStorage.getItem(k);
                        merged[k] = (friend && friend[k] !== undefined && friend[k] !== null) ? friend[k] : globalVal;
                    });
                    merged.avatarSrc = friend ? friend.avatar : null;
                    applyPreview(merged);
                });
            } else {
                const globalSettings = {};
                keys.forEach(k => globalSettings[k] = themeSettings[k] !== undefined ? themeSettings[k] : localStorage.getItem(k));
                globalSettings.avatarSrc = null;
                applyPreview(globalSettings);
            }
        }

        function updateChatThemeSlider(type, value) {
            if (type === 'chat_avatar_size') {
                const valEl = document.getElementById('chat-avatar-size-value');
                if (valEl) valEl.textContent = `${value}px`;
                const previewImg = document.getElementById('chat-theme-avatar-preview-img');
                if (previewImg) {
                    previewImg.style.width = `${value}px`;
                    previewImg.style.height = `${value}px`;
                }
            } else if (type === 'chat_avatar_radius') {
                const valEl = document.getElementById('chat-avatar-radius-value');
                if (valEl) valEl.textContent = `${value}px`;
                const previewImg = document.getElementById('chat-theme-avatar-preview-img');
                if (previewImg) {
                    previewImg.style.borderRadius = `${value}px`;
                }
            }

            if (currentChatThemeFriendId) {
                dbGet('friends', currentChatThemeFriendId, friend => {
                    if (friend) {
                        friend[type] = value;
                        dbUpdate('friends', friend);
                    }
                });
            } else {
                dbSaveSetting(type, value);
                localStorage.removeItem(type);
            }
        }

        // --- Unified Image Uploader ---
        window.isUploading = false;

        function createImageUploader(callback, options = {}) {
            const { quality = 0.7, maxSizeMB = 10 } = options;

            return function(...args) {
                if (window.isUploading) {
                    showToast('请等待当前上传完成');
                    return;
                }
                
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.style.display = 'none';
                
                input.onchange = function(e) {
                    window.isUploading = true;
                    const file = e.target.files[0];
                    
                    // Cleanup function
                    const cleanup = () => {
                        window.isUploading = false;
                        if (input.parentNode) {
                            document.body.removeChild(input);
                        }
                    };

                    if (!file) {
                        cleanup();
                        return;
                    }
                    
                    if (!file.type.startsWith('image/')) {
                        showToast('请选择图片文件');
                        cleanup();
                        return;
                    }
                    
                    if (file.size > maxSizeMB * 1024 * 1024) {
                        showToast(`图片不能超过${maxSizeMB}MB`);
                        cleanup();
                        return;
                    }
                    
                    compressImage(file, quality, (compressedSrc) => {
                        callback(compressedSrc, ...args);
                        cleanup();
                    });
                };
                
                document.body.appendChild(input);
                input.click();
            };
        }

        const uploaderForChatTheme = createImageUploader((compressedSrc, type) => {
            if (currentChatThemeFriendId) {
                dbGet('friends', currentChatThemeFriendId, friend => {
                    if (friend) {
                        friend[type] = compressedSrc;
                        dbUpdate('friends', friend, () => {
                            updateChatThemePreview();
                            showToast('已保存专属设置');
                        });
                    }
                });
            } else {
                dbSaveSetting(type, compressedSrc).then(() => {
                    localStorage.removeItem(type);
                    updateChatThemePreview();
                    showToast('已保存全局设置');
                });
            }
        });
        const triggerChatThemeUpload = (type) => uploaderForChatTheme(type);

        const uploaderForDesktopTheme = createImageUploader((compressedSrc, type) => {
            dbSaveSetting(type, compressedSrc).then(() => {
                localStorage.removeItem(type); // Clean up old storage
                applyDesktopTheme();
                showToast('已保存设置');
            }).catch(err => {
                showToast('保存失败，可能是存储空间不足');
            });
        });
        const triggerDesktopThemeUpload = (type) => uploaderForDesktopTheme(type);

        const uploaderForBubbleTheme = createImageUploader((compressedSrc, type) => {
            if (type === 'corner_img') {
                updateBubbleCorner('img', compressedSrc);
            } else if (type === 'bg_image') {
                updateBubbleThemeValue('bg_image', compressedSrc);
            } else if (type === 'page_bg_image') {
                updateBubbleThemeValue('page_bg_image', compressedSrc);
            } else if (type === 'tail_image') {
                updateBubbleThemeValue('tail_image', compressedSrc);
            }
        });
        const triggerBubbleUpload = (type) => uploaderForBubbleTheme(type);

        const uploaderForMainPage = createImageUploader((compressedSrc, displayId) => {
            document.getElementById(displayId).src = compressedSrc;
            const slot = document.getElementById(displayId).parentElement;
            if (slot) slot.classList.add('has-image');

            dbGet('user_profile', 'main_user', profile => {
                const updatedProfile = profile || { id: 'main_user' };
                if (displayId === 'avatar-display') {
                    updatedProfile.avatar = compressedSrc;
                    const mePageAvatar = document.getElementById('me-page-avatar');
                    if (mePageAvatar) {
                        mePageAvatar.src = compressedSrc;
                        document.getElementById('me-avatar-container').classList.add('has-image');
                    }
                } else {
                    const propName = displayId.replace('-', '_');
                    updatedProfile[propName] = compressedSrc;
                }
                dbUpdate('user_profile', updatedProfile);
            });
        });
        function triggerMainPageUpload(displayId) {
             uploaderForMainPage(displayId);
        }

        const uploaderForWallpaper = createImageUploader((compressedSrc) => {
            document.getElementById('main-page').style.backgroundImage = `url(${compressedSrc})`;
            document.getElementById('wallpaper-preview').style.backgroundImage = `url(${compressedSrc})`;
            dbSaveSetting('wallpaper', compressedSrc).then(() => {
                localStorage.removeItem('wallpaper'); // Clean up old storage
            }).catch(err => {
                showToast('壁纸保存失败');
            });
        });
        const triggerWallpaperUpload = () => uploaderForWallpaper();

        const uploaderForIndividualIcon = createImageUploader((compressedSrc, id) => {
            const targetIcons = document.querySelectorAll(`.app-item[data-app-id='${id}'] .app-icon img`);
            targetIcons.forEach(icon => icon.src = compressedSrc);
            dbSaveSetting(id, compressedSrc).then(() => {
                localStorage.removeItem(id); // Clean up old storage
                generateIconPreviews(); // Refresh previews
            }).catch(err => {
                showToast('图标保存失败');
            });
        });
        const triggerIndividualUpload = (id) => uploaderForIndividualIcon(id);

        function resetChatTheme(type) {
            if (currentChatThemeFriendId) {
                dbGet('friends', currentChatThemeFriendId, friend => {
                    if (friend) {
                        friend[type] = null;
                        dbUpdate('friends', friend, () => {
                            updateChatThemePreview();
                            showToast('已恢复为全局设置');
                        });
                    }
                });
            } else {
                dbDeleteSetting(type).then(() => {
                    updateChatThemePreview();
                    showToast('全局设置已恢复默认');
                });
            }
        }

        let currentBubbleThemeFriendId = '';

        function renderBubbleThemePage() {
            const select = document.getElementById('bubble-theme-character-select');
            const sideSelect = document.getElementById('bubble-theme-side-select');
            
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
                        if (friend.id === currentBubbleThemeFriendId) {
                            option.selected = true;
                        }
                        select.appendChild(option);
                    });
                }
                
                refreshCustomSelect(select);
                refreshCustomSelect(sideSelect);
                
                select.onchange = (e) => {
                    currentBubbleThemeFriendId = e.target.value;
                    updateBubbleThemePreview();
                    loadCornerSettings();
                };
                
                updateBubbleThemePreview();
                loadCornerSettings();
            });
        }

        function getBubbleSetting(key, friend, defaultVal = null) {
            if (tempBubbleSettings[key] !== undefined) {
                return tempBubbleSettings[key];
            }
            if (friend && friend[key] !== undefined && friend[key] !== null) {
                return friend[key];
            }
            const globalVal = localStorage.getItem(key);
            if (globalVal !== null) return globalVal;
            return defaultVal;
        }

        function updateBubbleThemePreview() {
            let styleEl = document.getElementById('bubble-preview-styles');
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'bubble-preview-styles';
                document.head.appendChild(styleEl);
            }

            const side = document.getElementById('bubble-theme-side-select').value;
            const container = document.getElementById('bubble-preview-container');
            const wrapper = document.getElementById('bubble-preview-wrapper');
            const contentGroup = document.getElementById('bubble-preview-content-group');
            const avatarRecv = document.getElementById('bubble-preview-avatar-recv');
            const avatarSent = document.getElementById('bubble-preview-avatar-sent');
            
            // For preview purposes, if 'both' is selected, we'll just preview as 'sent'
            const previewSide = side === 'both' ? 'sent' : side;
            container.className = `message-bubble ${previewSide}`;
            if (wrapper) wrapper.className = `message-bubble-wrapper ${previewSide}`;
            
            if (wrapper && contentGroup && avatarRecv && avatarSent) {
                // 预览头像改为纯黑
                const blackGif = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                avatarRecv.src = blackGif;
                avatarRecv.style.backgroundColor = '#000';
                avatarSent.src = blackGif;
                avatarSent.style.backgroundColor = '#000';

                if (previewSide === 'sent') {
                    contentGroup.style.alignItems = 'flex-end';
                    contentGroup.style.marginLeft = '10px';
                    contentGroup.style.marginRight = '0';
                    avatarRecv.style.display = 'none';
                    avatarSent.style.display = 'block';
                } else {
                    contentGroup.style.alignItems = 'flex-start';
                    contentGroup.style.marginLeft = '0';
                    contentGroup.style.marginRight = '10px';
                    avatarRecv.style.display = 'block';
                    avatarSent.style.display = 'none';
                }
            }

            const applySettings = (friend) => {
                const prefix = previewSide === 'sent' ? 'bubble_sent_' : 'bubble_recv_';
                
                const bgColor = getBubbleSetting(prefix + 'bg_color', friend, previewSide === 'sent' ? '#a9e979' : '#ffffff');
                const bgOpacity = getBubbleSetting(prefix + 'bg_opacity', friend, '1');
                const bgImage = getBubbleSetting(prefix + 'bg_image', friend, '');
                const bgImageOpacity = getBubbleSetting(prefix + 'bg_img_opacity', friend, '1');
                const textColor = getBubbleSetting(prefix + 'text_color', friend, '#000000');
                const borderColor = getBubbleSetting(prefix + 'border_color', friend, 'transparent');
                const borderWidth = getBubbleSetting(prefix + 'border_width', friend, '0');
                const borderOpacity = getBubbleSetting(prefix + 'border_opacity', friend, '1');
                const shadowColor = getBubbleSetting(prefix + 'shadow_color', friend, '#000000');
                const shadowOpacity = getBubbleSetting(prefix + 'shadow_opacity', friend, '0');
                const shadowX = getBubbleSetting(prefix + 'shadow_x', friend, '0');
                const shadowY = getBubbleSetting(prefix + 'shadow_y', friend, '0');
                const shadowBlur = getBubbleSetting(prefix + 'shadow_blur', friend, '0');
                const tailColor = getBubbleSetting(prefix + 'tail_color', friend, '');
                const hideTriangleRaw = getBubbleSetting(prefix + 'hide_triangle', friend, 'false');
                const hideTriangle = hideTriangleRaw === 'true' || hideTriangleRaw === true;
                const radius = getBubbleSetting(prefix + 'radius', friend, '8');
                
                const offsetX = getBubbleSetting(prefix + 'offset_x', friend, '0');
                const offsetY = getBubbleSetting(prefix + 'offset_y', friend, '0');

                const tailImage = getBubbleSetting(prefix + 'tail_image', friend, '');
                const tailWidth = getBubbleSetting(prefix + 'tail_width', friend, '20');
                const tailHeight = getBubbleSetting(prefix + 'tail_height', friend, '20');
                const tailX = getBubbleSetting(prefix + 'tail_x', friend, '0');
                const tailY = getBubbleSetting(prefix + 'tail_y', friend, '0');
                const tailRot = getBubbleSetting(prefix + 'tail_rot', friend, '0');
                
                const effect3dRaw = getBubbleSetting(prefix + '3d_effect', friend, 'false');
                const effect3d = effect3dRaw === 'true' || effect3dRaw === true;

                // Update UI controls to reflect current values
                document.getElementById('bubble-bg-color').value = bgColor;
                document.getElementById('bubble-bg-opacity').value = bgOpacity;
                document.getElementById('bubble-bg-opacity-val').textContent = bgOpacity;
                document.getElementById('bubble-text-color').value = textColor;
                document.getElementById('bubble-border-color').value = borderColor;
                document.getElementById('bubble-border-width').value = borderWidth;
                document.getElementById('bubble-border-opacity').value = borderOpacity;
                document.getElementById('bubble-border-opacity-val').textContent = borderOpacity;
                document.getElementById('bubble-shadow-color').value = shadowColor;
                document.getElementById('bubble-shadow-opacity').value = shadowOpacity;
                document.getElementById('bubble-shadow-opacity-val').textContent = shadowOpacity;
                document.getElementById('bubble-shadow-x').value = shadowX;
                document.getElementById('bubble-shadow-x-val').textContent = shadowX + 'px';
                document.getElementById('bubble-shadow-y').value = shadowY;
                document.getElementById('bubble-shadow-y-val').textContent = shadowY + 'px';
                document.getElementById('bubble-shadow-blur').value = shadowBlur;
                document.getElementById('bubble-shadow-blur-val').textContent = shadowBlur + 'px';
                document.getElementById('bubble-tail-color').value = tailColor;
                document.getElementById('bubble-hide-triangle').checked = hideTriangle;
                document.getElementById('bubble-radius').value = radius === null ? '' : radius;
                
                const offsetXEl = document.getElementById('bubble-offset-x');
                if (offsetXEl) { offsetXEl.value = offsetX; document.getElementById('bubble-offset-x-val').textContent = offsetX + 'px'; }
                const offsetYEl = document.getElementById('bubble-offset-y');
                if (offsetYEl) { offsetYEl.value = offsetY; document.getElementById('bubble-offset-y-val').textContent = offsetY + 'px'; }

                const tailWidthEl = document.getElementById('bubble-tail-width');
                if (tailWidthEl) tailWidthEl.value = tailWidth;
                const tailHeightEl = document.getElementById('bubble-tail-height');
                if (tailHeightEl) tailHeightEl.value = tailHeight;
                const tailXEl = document.getElementById('bubble-tail-x');
                if (tailXEl) { tailXEl.value = tailX; document.getElementById('bubble-tail-x-val').textContent = tailX + 'px'; }
                const tailYEl = document.getElementById('bubble-tail-y');
                if (tailYEl) { tailYEl.value = tailY; document.getElementById('bubble-tail-y-val').textContent = tailY + 'px'; }
                const tailRotEl = document.getElementById('bubble-tail-rot');
                if (tailRotEl) { tailRotEl.value = tailRot; document.getElementById('bubble-tail-rot-val').textContent = tailRot + 'deg'; }
                
                const effect3dEl = document.getElementById('bubble-3d-effect');
                if (effect3dEl) effect3dEl.checked = effect3d;

                const hexToRgba = (hex, alpha) => {
                    if (!hex || hex === 'transparent') return 'transparent';
                    let r = 0, g = 0, b = 0;
                    hex = hex.replace('#', '');
                    if (hex.length === 3) {
                        r = parseInt(hex[0] + hex[0], 16);
                        g = parseInt(hex[1] + hex[1], 16);
                        b = parseInt(hex[2] + hex[2], 16);
                    } else if (hex.length === 6) {
                        r = parseInt(hex.substring(0, 2), 16);
                        g = parseInt(hex.substring(2, 4), 16);
                        b = parseInt(hex.substring(4, 6), 16);
                    } else { return hex; }
                    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                };

                const finalBgColor = hexToRgba(bgColor, bgOpacity);
                const finalBorderColor = hexToRgba(borderColor, borderOpacity);
                const finalTailColor = tailColor ? tailColor : finalBgColor;
                const finalShadowColor = hexToRgba(shadowColor, shadowOpacity);
                
                let filterShadow = 'none';
                if (parseFloat(shadowOpacity) > 0 || parseInt(shadowBlur) > 0 || parseInt(shadowX) !== 0 || parseInt(shadowY) !== 0) {
                    filterShadow = `drop-shadow(${shadowX}px ${shadowY}px ${shadowBlur}px ${finalShadowColor})`;
                }

                const formatUnit = (val) => {
                    if (val === null || val === undefined || val === '') return 'auto';
                    if (!isNaN(val) && val !== '') return val + 'px';
                    return val;
                };
                let fRadius = formatUnit(radius);
                if(fRadius === 'auto') fRadius = '8px';
                
                let boxShadow = 'none';
                let backgroundImage = 'none';
                if (effect3d) {
                    boxShadow = 'inset 0 4px 6px rgba(255,255,255,0.4), inset 0 -4px 6px rgba(0,0,0,0.1)';
                    backgroundImage = 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0.05) 100%)';
                }

                let css = `
                    #bubble-preview-container {
                        background-color: ${finalBgColor};
                        color: ${textColor};
                        border: ${borderWidth}px solid ${finalBorderColor};
                        filter: ${filterShadow};
                        border-radius: ${fRadius};
                        box-shadow: ${boxShadow};
                        background-image: ${backgroundImage};
                        transform: translate(${offsetX}px, ${offsetY}px);
                    }
                    #bubble-preview-container.${previewSide}::after {
                        display: ${hideTriangle ? 'none' : 'block'};
                        border-color: ${previewSide === 'sent' ? `transparent transparent transparent ${finalTailColor}` : `transparent ${finalTailColor} transparent transparent`};
                        width: ${tailImage ? tailWidth + 'px' : '0px'};
                        height: ${tailImage ? tailHeight + 'px' : '0px'};
                        background-image: ${tailImage ? `url(${tailImage})` : 'none'};
                        background-size: contain;
                        background-repeat: no-repeat;
                        background-position: center;
                        transform: translate(${tailX}px, ${tailY}px) rotate(${tailRot}deg);
                        ${tailImage ? 'border-color: transparent !important;' : ''}
                    }
                `;

                // Corners
                ['tl', 'tr', 'bl', 'br'].forEach(corner => {
                    const cPrefix = `bubble_${previewSide}_${corner}_`;
                    const img = getBubbleSetting(cPrefix + 'img', friend, '');
                    const op = getBubbleSetting(cPrefix + 'op', friend, '1');
                    const x = getBubbleSetting(cPrefix + 'x', friend, '-15');
                    const y = getBubbleSetting(cPrefix + 'y', friend, '-15');
                    const w = getBubbleSetting(cPrefix + 'w', friend, '30');
                    const h = getBubbleSetting(cPrefix + 'h', friend, '30');
                    
                    css += `
                        #bubble-preview-container .bubble-corner.${corner} {
                            background-image: ${img ? `url(${img})` : 'none'};
                            opacity: ${op};
                            width: ${w}px;
                            height: ${h}px;
                            ${corner.includes('l') ? `left: ${x}px;` : `right: ${x}px;`}
                            ${corner.includes('t') ? `top: ${y}px;` : `bottom: ${y}px;`}
                        }
                    `;
                });

                styleEl.innerHTML = css;
            };

            if (currentBubbleThemeFriendId) {
                dbGet('friends', currentBubbleThemeFriendId, friend => applySettings(friend));
            } else {
                applySettings(null);
            }
        }

        // Store temporary settings before saving
        let tempBubbleSettings = {};

        function updateBubbleThemeValue(key, value) {
            if (key === 'page_bg_image' || key === 'page_bg_opacity') {
                tempBubbleSettings[`bubble_${key}`] = value;
            } else {
                const side = document.getElementById('bubble-theme-side-select').value;
                const sidesToUpdate = side === 'both' ? ['sent', 'recv'] : [side];
                
                sidesToUpdate.forEach(s => {
                    const fullKey = `bubble_${s}_${key}`;
                    tempBubbleSettings[fullKey] = value;
                });
            }
            
            // Just update the preview, don't save yet
            updateBubbleThemePreview();
        }

        function updateBubbleThemePageOpacity(value) {
            updateBubbleThemeValue('page_bg_opacity', value);
        }

        function loadCornerSettings() {
            // This function now just needs to update the input values for the selected corner
            const side = document.getElementById('bubble-theme-side-select').value;
            const previewSide = side === 'both' ? 'sent' : side;
            const corner = document.getElementById('bubble-corner-select').value;
            const prefix = `${previewSide}_${corner}_`;

            const applyCornerInputs = (friend) => {
                const op = getBubbleSetting(prefix + 'op', friend, '1');
                const x = getBubbleSetting(prefix + 'x', friend, '-15');
                const y = getBubbleSetting(prefix + 'y', friend, '-15');
                const w = getBubbleSetting(prefix + 'w', friend, '30');
                const h = getBubbleSetting(prefix + 'h', friend, '30');

                document.getElementById('bubble-corner-op').value = op;
                document.getElementById('bubble-corner-op-val').textContent = op;
                document.getElementById('bubble-corner-x').value = x;
                document.getElementById('bubble-corner-x-val').textContent = x + 'px';
                document.getElementById('bubble-corner-y').value = y;
                document.getElementById('bubble-corner-y-val').textContent = y + 'px';
                document.getElementById('bubble-corner-w').value = w;
                document.getElementById('bubble-corner-h').value = h;
            };

            if (currentBubbleThemeFriendId) {
                dbGet('friends', currentBubbleThemeFriendId, friend => applyCornerInputs(friend));
            } else {
                applyCornerInputs(null);
            }
            // The preview is updated by updateBubbleThemePreview, which is called on side-select change.
            // We also call it here to ensure corner settings are reflected immediately.
            updateBubbleThemePreview();
        }

        function updateBubbleCorner(key, value) {
            const side = document.getElementById('bubble-theme-side-select').value;
            const corner = document.getElementById('bubble-corner-select').value;
            const sidesToUpdate = side === 'both' ? ['sent', 'recv'] : [side];

            sidesToUpdate.forEach(s => {
                const fullKey = `bubble_${s}_${corner}_${key}`;
                tempBubbleSettings[fullKey] = value;
            });
            
            // Just update the preview, don't save yet
            updateBubbleThemePreview();
        }

        
        function saveAllBubbleSettings() {
            if (Object.keys(tempBubbleSettings).length === 0) {
                showToast('没有修改需要保存');
                return;
            }

            if (currentBubbleThemeFriendId) {
                dbGet('friends', currentBubbleThemeFriendId, friend => {
                    if (friend) {
                        for (const key in tempBubbleSettings) {
                            friend[key] = tempBubbleSettings[key];
                        }
                        dbUpdate('friends', friend, () => {
                            tempBubbleSettings = {}; // Clear temp after save
                            showToast('已保存气泡专属设置');
                        });
                    }
                });
            } else {
                for (const key in tempBubbleSettings) {
                    localStorage.setItem(key, tempBubbleSettings[key]);
                }
                tempBubbleSettings = {}; // Clear temp after save
                showToast('已保存气泡全局设置');
            }
        }
        
        // --- Bubble Presets Logic ---
        function openBubblePresetModal() {
            const listContainer = document.getElementById('bubble-preset-list');
            listContainer.innerHTML = '';
            
            let presetNames = new Set();

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('bubble_preset_')) {
                    presetNames.add(key.replace('bubble_preset_', ''));
                }
            }

            dbGetAll('theme_settings', items => {
                if (items) {
                    items.forEach(item => {
                        if (String(item.id).startsWith('bubble_preset_')) {
                            presetNames.add(String(item.id).replace('bubble_preset_', ''));
                        }
                    });
                }

                if (presetNames.size === 0) {
                    listContainer.innerHTML = '<div style="text-align:center; color:#999; padding:10px; font-size: 13px;">暂无预设</div>';
                } else {
                    Array.from(presetNames).sort().forEach(name => {
                        const item = document.createElement('label');
                        item.className = 'preset-checkbox-item';
                        
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.value = name;
                        
                        const customCheck = document.createElement('div');
                        customCheck.className = 'custom-checkbox';
                        
                        const span = document.createElement('span');
                        span.textContent = name;
                        
                        item.appendChild(checkbox);
                        item.appendChild(customCheck);
                        item.appendChild(span);
                        listContainer.appendChild(item);
                    });
                }

                document.getElementById('bubble-preset-name-input').value = '';
                document.getElementById('bubble-preset-modal').style.display = 'flex';
            });
        }

        function closeBubblePresetModal() {
            document.getElementById('bubble-preset-modal').style.display = 'none';
        }

        function saveBubblePreset() {
            const name = document.getElementById('bubble-preset-name-input').value.trim();
            if (!name) {
                showToast('请输入预设名称');
                return;
            }

            const bubbleKeys = [
                'bg_color', 'bg_opacity', 'text_color', 'border_color', 'border_width', 'border_opacity', 
                'shadow_color', 'shadow_opacity', 'shadow_x', 'shadow_y', 'shadow_blur', 
                'tail_color', 'hide_triangle', 'radius', 'offset_x', 'offset_y', '3d_effect',
                'tail_image', 'tail_width', 'tail_height', 'tail_x', 'tail_y', 'tail_rot'
            ];
            const cornerKeys = ['img', 'op', 'x', 'y', 'w', 'h'];
            const sides = ['sent', 'recv'];
            const corners = ['tl', 'tr', 'bl', 'br'];

            const presetData = {};

            const buildPreset = (friend) => {
                sides.forEach(side => {
                    bubbleKeys.forEach(k => {
                        const fullKey = `bubble_${side}_${k}`;
                        const value = getBubbleSetting(fullKey, friend);
                        if (value !== null && value !== undefined) {
                            presetData[fullKey] = value;
                        }
                    });
                    corners.forEach(corner => {
                        cornerKeys.forEach(k => {
                            const fullKey = `bubble_${side}_${corner}_${k}`;
                            const value = getBubbleSetting(fullKey, friend);
                            if (value !== null && value !== undefined) {
                                presetData[fullKey] = value;
                            }
                        });
                    });
                });
                
                // Also save page-level settings
                const pageBg = getBubbleSetting('bubble_page_bg_image', friend);
                if (pageBg) presetData['bubble_page_bg_image'] = pageBg;
                const pageOpacity = getBubbleSetting('bubble_page_bg_opacity', friend);
                if (pageOpacity) presetData['bubble_page_bg_opacity'] = pageOpacity;

                dbSaveSetting(`bubble_preset_${name}`, JSON.stringify(presetData)).then(() => {
                    showToast('气泡预设保存成功');
                    document.getElementById('bubble-preset-name-input').value = '';
                    openBubblePresetModal(); // 刷新列表
                }).catch(e => {
                    showToast('存储空间已满，保存失败，请清理其他预设');
                    console.error('Save preset error:', e);
                });
            };

            if (currentBubbleThemeFriendId) {
                dbGet('friends', currentBubbleThemeFriendId, friend => {
                    buildPreset(friend || null);
                });
            } else {
                buildPreset(null);
            }
        }

        async function loadBubblePreset() {
            const checked = document.querySelectorAll('#bubble-preset-list input[type="checkbox"]:checked');
            if (checked.length !== 1) {
                showToast('请选择一个预设进行加载');
                return;
            }
            const name = checked[0].value;

            let dataStr = localStorage.getItem(`bubble_preset_${name}`);
            if (!dataStr) {
                const item = await new Promise(res => dbGet('theme_settings', `bubble_preset_${name}`, res));
                if (item) dataStr = item.value;
            }
            if (!dataStr) return;
            const presetData = JSON.parse(dataStr);

            // Clear temp settings and apply loaded preset directly
            tempBubbleSettings = {};
            Object.assign(tempBubbleSettings, presetData);

            updateBubbleThemePreview();
            loadCornerSettings();
            showToast(`已加载预设：${name}`);
            closeBubblePresetModal();
        }

        function deleteBubblePreset() {
            const checked = document.querySelectorAll('#bubble-preset-list input[type="checkbox"]:checked');
            if (checked.length === 0) {
                showToast('请选择要删除的预设');
                return;
            }
            
            const namesToDelete = Array.from(checked).map(cb => cb.value);
            
            showCustomConfirm(`确定要删除选中的 ${namesToDelete.length} 个预设吗？`, () => {
                const promises = namesToDelete.map(name => {
                    localStorage.removeItem(`bubble_preset_${name}`);
                    return dbDeleteSetting(`bubble_preset_${name}`);
                });
                Promise.all(promises).then(() => {
                    showToast('预设已删除');
                    openBubblePresetModal(); // Refresh list
                });
            }, '删除预设');
        }

        async function exportBubblePresets() {
            const checked = document.querySelectorAll('#bubble-preset-list input[type="checkbox"]:checked');
            if (checked.length === 0) {
                showToast('请选择要导出的预设');
                return;
            }

            const presetsToExport = {};
            for (const cb of Array.from(checked)) {
                const name = cb.value;
                let dataStr = localStorage.getItem(`bubble_preset_${name}`);
                if (!dataStr) {
                    const item = await new Promise(res => dbGet('theme_settings', `bubble_preset_${name}`, res));
                    if (item) dataStr = item.value;
                }
                if (dataStr) {
                    presetsToExport[name] = JSON.parse(dataStr);
                }
            }

            if (Object.keys(presetsToExport).length === 0) {
                showToast('没有找到可导出的预设数据');
                return;
            }

            const jsonStr = JSON.stringify(presetsToExport, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'bubble_presets_backup.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        function importBubblePresets(input) {
            const file = input.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);
                    let importCount = 0;
                    const promises = [];
                    for (const name in importedData) {
                        if (typeof importedData[name] === 'object') {
                            promises.push(dbSaveSetting(`bubble_preset_${name}`, JSON.stringify(importedData[name])));
                            importCount++;
                        }
                    }
                    Promise.all(promises).then(() => {
                        showToast(`成功导入 ${importCount} 个预设`);
                        openBubblePresetModal(); // Refresh list
                    }).catch(() => {
                        showToast('部分预设导入失败，可能是存储空间不足');
                        openBubblePresetModal();
                    });
                } catch (err) {
                    showToast('导入失败，文件格式错误');
                    console.error('Preset import error:', err);
                }
            };
            reader.readAsText(file);
            input.value = ''; // Reset input
        }

        // Old bubble upload functions removed.

        function resetBubbleTheme() {
            tempBubbleSettings = {};
            if (currentBubbleThemeFriendId) {
                dbGet('friends', currentBubbleThemeFriendId, friend => {
                    if (friend) {
                        const keysToRemove = [];
                        for (let k in friend) {
                            if (k.startsWith('bubble_')) keysToRemove.push(k);
                        }
                        keysToRemove.forEach(k => delete friend[k]);
                        
                        dbUpdate('friends', friend, () => {
                            updateBubbleThemePreview();
                            loadCornerSettings();
                            showToast('已恢复为全局设置');
                        });
                    }
                });
            } else {
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k.startsWith('bubble_') && !k.startsWith('bubble_preset_')) {
                        keysToRemove.push(k);
                    }
                }
                keysToRemove.forEach(k => localStorage.removeItem(k));
                
                updateBubbleThemePreview();
                loadCornerSettings();
                showToast('全局设置已恢复默认');
            }
        }

        // --- Chat Theme Presets Logic ---
        function openChatThemePresetModal() {
            const listContainer = document.getElementById('chat-theme-preset-list');
            listContainer.innerHTML = '';
            
            let presetNames = new Set();

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('chat_theme_preset_')) {
                    presetNames.add(key.replace('chat_theme_preset_', ''));
                }
            }

            dbGetAll('theme_settings', items => {
                if (items) {
                    items.forEach(item => {
                        if (String(item.id).startsWith('chat_theme_preset_')) {
                            presetNames.add(String(item.id).replace('chat_theme_preset_', ''));
                        }
                    });
                }

                if (presetNames.size === 0) {
                    listContainer.innerHTML = '<div style="text-align:center; color:#999; padding:10px; font-size: 13px;">暂无预设</div>';
                } else {
                    Array.from(presetNames).sort().forEach(name => {
                        const item = document.createElement('label');
                        item.className = 'preset-checkbox-item';
                        
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.value = name;
                        
                        const customCheck = document.createElement('div');
                        customCheck.className = 'custom-checkbox';
                        
                        const span = document.createElement('span');
                        span.textContent = name;
                        
                        item.appendChild(checkbox);
                        item.appendChild(customCheck);
                        item.appendChild(span);
                        listContainer.appendChild(item);
                    });
                }

                document.getElementById('chat-theme-preset-name-input').value = '';
                document.getElementById('chat-theme-preset-modal').style.display = 'flex';
            });
        }

        function closeChatThemePresetModal() {
            document.getElementById('chat-theme-preset-modal').style.display = 'none';
        }

        function saveChatThemePreset() {
            const name = document.getElementById('chat-theme-preset-name-input').value.trim();
            if (!name) {
                showToast('请输入预设名称');
                return;
            }

            const presetData = {};

            const getUrlFromStyle = (style) => {
                if (style && style !== 'none' && style.includes('url(')) {
                    const match = style.match(/url\("?([^"]+)"?\)/);
                    return match ? match[1] : null;
                }
                return null;
            };

            presetData.chat_wallpaper = getUrlFromStyle(document.getElementById('chat-wallpaper-preview').style.backgroundImage);
            presetData.chat_header_bg = getUrlFromStyle(document.getElementById('chat-header-bg-preview').style.backgroundImage);
            presetData.chat_input_bg = getUrlFromStyle(document.getElementById('chat-input-bg-preview').style.backgroundImage);

            const icons = ['back', 'options', 'voice', 'emoji', 'plus', 'send'];
            icons.forEach(icon => {
                const key = `chat_${icon}_icon`;
                const box = document.getElementById(`chat-${icon}-icon-preview`);
                presetData[key] = getUrlFromStyle(box.style.backgroundImage);
            });

            presetData.chat_avatar_size = document.getElementById('chat-avatar-size-slider').value;
            presetData.chat_avatar_radius = document.getElementById('chat-avatar-radius-slider').value;

            dbSaveSetting(`chat_theme_preset_${name}`, JSON.stringify(presetData)).then(() => {
                showToast('聊天界面预设保存成功');
                document.getElementById('chat-theme-preset-name-input').value = '';
                openChatThemePresetModal(); // 刷新列表
            }).catch(e => {
                showToast('存储空间已满，保存失败，请清理其他预设');
                console.error('Save preset error:', e);
            });
        }

        async function loadChatThemePreset() {
            const checked = document.querySelectorAll('#chat-theme-preset-list input[type="checkbox"]:checked');
            if (checked.length !== 1) {
                showToast('请选择一个预设进行加载');
                return;
            }
            const name = checked[0].value;

            let dataStr = localStorage.getItem(`chat_theme_preset_${name}`);
            if (!dataStr) {
                const item = await new Promise(res => dbGet('theme_settings', `chat_theme_preset_${name}`, res));
                if (item) dataStr = item.value;
            }
            if (!dataStr) return;
            const presetData = JSON.parse(dataStr);

            if (currentChatThemeFriendId) {
                dbGet('friends', currentChatThemeFriendId, friend => {
                    if (friend) {
                        for (const key in presetData) {
                            friend[key] = presetData[key];
                        }
                        dbUpdate('friends', friend, () => {
                            updateChatThemePreview();
                            showToast(`已为当前角色加载预设：${name}`);
                            closeChatThemePresetModal();
                        });
                    }
                });
            } else {
                // For global settings, update IndexedDB and cache
                const promises = [];
                for (const key in presetData) {
                    // Ensure null values are handled correctly to reset properties
                    promises.push(dbSaveSetting(key, presetData[key]));
                }
                await Promise.all(promises);
                
                updateChatThemePreview();
                showToast(`已加载全局预设：${name}`);
                closeChatThemePresetModal();
            }
        }

        function deleteChatThemePreset() {
            const checked = document.querySelectorAll('#chat-theme-preset-list input[type="checkbox"]:checked');
            if (checked.length === 0) {
                showToast('请选择要删除的预设');
                return;
            }
            
            const namesToDelete = Array.from(checked).map(cb => cb.value);
            
            showCustomConfirm(`确定要删除选中的 ${namesToDelete.length} 个预设吗？`, () => {
                const promises = namesToDelete.map(name => {
                    localStorage.removeItem(`chat_theme_preset_${name}`);
                    return dbDeleteSetting(`chat_theme_preset_${name}`);
                });
                Promise.all(promises).then(() => {
                    showToast('预设已删除');
                    openChatThemePresetModal(); // Refresh list
                });
            }, '删除预设');
        }

        async function exportChatThemePresets() {
            const checked = document.querySelectorAll('#chat-theme-preset-list input[type="checkbox"]:checked');
            if (checked.length === 0) {
                showToast('请选择要导出的预设');
                return;
            }

            const presetsToExport = {};
            for (const cb of Array.from(checked)) {
                const name = cb.value;
                let dataStr = localStorage.getItem(`chat_theme_preset_${name}`);
                if (!dataStr) {
                    const item = await new Promise(res => dbGet('theme_settings', `chat_theme_preset_${name}`, res));
                    if (item) dataStr = item.value;
                }
                if (dataStr) {
                    presetsToExport[name] = JSON.parse(dataStr);
                }
            }

            if (Object.keys(presetsToExport).length === 0) {
                showToast('没有找到可导出的预设数据');
                return;
            }

            const jsonStr = JSON.stringify(presetsToExport, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'chat_theme_presets_backup.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        function importChatThemePresets(input) {
            const file = input.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);
                    let importCount = 0;
                    const promises = [];
                    for (const name in importedData) {
                        if (typeof importedData[name] === 'object') {
                            promises.push(dbSaveSetting(`chat_theme_preset_${name}`, JSON.stringify(importedData[name])));
                            importCount++;
                        }
                    }
                    Promise.all(promises).then(() => {
                        showToast(`成功导入 ${importCount} 个预设`);
                        openChatThemePresetModal(); // Refresh list
                    }).catch(() => {
                        showToast('部分预设导入失败，可能是存储空间不足');
                        openChatThemePresetModal();
                    });
                } catch (err) {
                    showToast('导入失败，文件格式错误');
                    console.error('Preset import error:', err);
                }
            };
            reader.readAsText(file);
            input.value = ''; // Reset input
        }

        let currentFontData = { type: null, value: null, name: null, file: null };
        let activeFontBlobUrl = null;

        function handleFontUpload(input) {
            if (input.files && input.files[0]) {
                const file = input.files[0];
                document.getElementById('font-file-name').textContent = file.name;
                currentFontData = { type: 'file', file: file, name: file.name };
                document.getElementById('font-url-input').value = ''; // clear url if file uploaded
            }
        }

        function applyGlobalFont() {
            const urlInput = document.getElementById('font-url-input').value.trim();
            if (urlInput) {
                currentFontData = { type: 'url', value: urlInput, name: 'custom_url' };
            }

            if (!currentFontData.value && !currentFontData.file) {
                showToast('请输入字体链接或上传字体文件');
                return;
            }

            showToast('正在应用字体...');
            dbGet('user_profile', 'main_user', profile => {
                const updatedProfile = profile || { id: 'main_user' };
                updatedProfile.globalFont = currentFontData;
                dbUpdate('user_profile', updatedProfile, () => {
                    loadGlobalFont();
                    showToast('全局字体已应用');
                });
            });
        }

        function resetGlobalFont() {
            document.getElementById('font-url-input').value = '';
            document.getElementById('font-file-name').textContent = '未选择文件';
            document.getElementById('font-file-input').value = '';
            currentFontData = { type: null, value: null, name: null };
            
            dbGet('user_profile', 'main_user', profile => {
                if (profile) {
                    profile.globalFont = null;
                    dbUpdate('user_profile', profile, () => {
                        loadGlobalFont();
                        showToast('已恢复默认字体');
                    });
                } else {
                    loadGlobalFont();
                }
            });
        }

        function loadGlobalFont() {
            dbGet('user_profile', 'main_user', profile => {
                let styleEl = document.getElementById('custom-global-font-style');
                if (!styleEl) {
                    styleEl = document.createElement('style');
                    styleEl.id = 'custom-global-font-style';
                    document.head.appendChild(styleEl);
                }
                
                if (activeFontBlobUrl) {
                    URL.revokeObjectURL(activeFontBlobUrl);
                    activeFontBlobUrl = null;
                }

                if (profile && profile.globalFont && (profile.globalFont.value || profile.globalFont.file)) {
                    const font = profile.globalFont;
                    let src = '';
                    
                    if (font.type === 'file') {
                        const blob = font.file;
                        if (blob instanceof Blob || blob instanceof File) {
                            activeFontBlobUrl = URL.createObjectURL(blob);
                            src = `url("${activeFontBlobUrl}")`;
                        } else if (font.value) {
                            src = `url("${font.value}")`;
                        }
                    } else {
                        src = `url('${font.value}')`;
                    }
                    
                    if (src) {
                        const fontName = 'CustomGlobalFont_' + Date.now();
                        styleEl.innerHTML = `
                            @font-face {
                                font-family: '${fontName}';
                                src: ${src};
                                font-display: swap;
                            }
                            body, .phone-container, input, textarea, select, button, .chat-input, [contenteditable] {
                                font-family: '${fontName}', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
                            }
                        `;
                    }
                    
                    const urlInput = document.getElementById('font-url-input');
                    const fileName = document.getElementById('font-file-name');
                    if (urlInput && fileName) {
                        if (font.type === 'url') {
                            urlInput.value = font.value;
                            fileName.textContent = '未选择文件';
                            currentFontData = font;
                        } else if (font.type === 'file') {
                            urlInput.value = '';
                            fileName.textContent = font.name || '已上传自定义字体';
                            currentFontData = font;
                        }
                    }
                } else {
                    styleEl.innerHTML = '';
                    const urlInput = document.getElementById('font-url-input');
                    const fileName = document.getElementById('font-file-name');
                    if (urlInput) urlInput.value = '';
                    if (fileName) fileName.textContent = '未选择文件';
                }
            });
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
            
            checkDiscoverNotifications();

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
            
            const coverUrl = themeSettings['discover_cover'] || localStorage.getItem('discover_cover');
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

        function toggleRoleMomentDelete(isChecked) {
            localStorage.setItem('show_role_moment_delete_button', isChecked);
            if (document.getElementById('wechat-discover-page').classList.contains('active')) {
                renderDiscoverFeed();
            }
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
                    openRoleMomentsModal();
                }
            }, 300);
        }

        function openRoleMomentsModal() {
            document.getElementById('role-moments-modal').style.display = 'flex';

            const deleteToggle = document.getElementById('role-moment-delete-toggle');
            const showDelete = localStorage.getItem('show_role_moment_delete_button') === 'true';
            deleteToggle.checked = showDelete;

            const toggle = document.getElementById('role-auto-post-toggle');
            const isEnabled = localStorage.getItem('global_auto_post_moments') === 'true';
            toggle.checked = isEnabled;
            
            const listContainer = document.getElementById('role-auto-post-list-container');
            listContainer.style.display = isEnabled ? 'flex' : 'none';
            listContainer.innerHTML = '';
            
            const singleSelect = document.getElementById('single-manual-role-select');
            if (singleSelect) {
                singleSelect.innerHTML = '';
            }
            
            dbGetAll('friends', allFriends => {
                const friends = allFriends.filter(f => !f.isGroup);
                friends.forEach(friend => {
                    const label = document.createElement('label');
                    label.className = 'preset-checkbox-item';
                    label.style.padding = '5px 0';
                    
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.value = friend.id;
                    if (friend.autoPostMoments) {
                        checkbox.checked = true;
                    }
                    
                    const customCheck = document.createElement('div');
                    customCheck.className = 'custom-checkbox';
                    
                    const span = document.createElement('span');
                    span.textContent = friend.name;
                    
                    label.appendChild(checkbox);
                    label.appendChild(customCheck);
                    label.appendChild(span);
                    listContainer.appendChild(label);

                    if (singleSelect) {
                        const option = document.createElement('option');
                        option.value = friend.id;
                        option.textContent = friend.name;
                        singleSelect.appendChild(option);
                    }
                });

                if (singleSelect) {
                    refreshCustomSelect(singleSelect);
                }
            });
        }

        function closeRoleMomentsModal() {
            document.getElementById('role-moments-modal').style.display = 'none';
        }

        function toggleRoleAutoPost(isChecked) {
            document.getElementById('role-auto-post-list-container').style.display = isChecked ? 'flex' : 'none';
        }

        async function triggerSingleManualMomentGeneration() {
            const selectEl = document.getElementById('single-manual-role-select');
            if (!selectEl || !selectEl.value) {
                showToast('请先选择一个角色');
                return;
            }
            const friendId = selectEl.value;
            
            const btn = document.getElementById('single-manual-generate-btn');
            if (btn.disabled) return;
            
            const configStr = localStorage.getItem('globalConfig');
            const config = configStr ? JSON.parse(configStr) : {};
            if (!config.apiKey || !config.model) {
                showToast('请先配置API');
                return;
            }
            closeRoleMomentsModal()
            btn.disabled = true;
            btn.textContent = '生成中...';

            dbGet('friends', friendId, async friend => {
                if (friend) {
                    try {
                        await generateMomentForCharacter(friend, config);
                        showToast(`${friend.name}发了一条朋友圈。`);
                        if (document.getElementById('wechat-discover-page').classList.contains('active')) {
                            renderDiscoverFeed();
                        }
                    } catch (e) {
                        console.error(`Error generating moment for ${friend.name}:`, e);
                        showToast('生成失败，请重试');
                    }
                } else {
                    showToast('未找到角色');
                }
                btn.disabled = false;
                btn.textContent = '手动生成';
            });
        }

        async function generateMomentForCharacter(friend, config) {
            let userPersona = null;
            if (friend.myPersonaId) {
                userPersona = await new Promise(resolve => dbGet('my_personas', friend.myPersonaId, resolve));
            }

            const visiblePosts = await new Promise(resolve => {
                dbGetAll('discover_posts', posts => {
                    dbGetAll('friends', allFriends => {
                        const vp = posts.filter(p => canBotSeePost(friend, p, allFriends)).sort((a,b) => b.timestamp - a.timestamp).slice(0, 5);
                        resolve(vp);
                    });
                });
            });

            // 获取带角色的专属表情
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

            const systemPrompt = buildSystemPrompt(friend, userPersona, aiStickers, visiblePosts);
            let momentPrompt = "【系统指令】请结合你的人设、当前的聊天记忆或者最近的世界事件，发布一条符合你设定的“朋友圈动态”。\n要求：\n1. 可以简短如一句吐槽，也可以是对某件事的感慨，务必口语化、符合身份。\n2. 如果你认为这条动态需要配图，可以直接在动态文字后输出一个对应的表情包XML标签（例如 <sticker>xxx</sticker>），不要解释。\n3. 请直接输出动态的最终文本内容（和可选的标签），不要输出包含“我的朋友圈”、“发布动态”等旁白解释。\n";
            
            // 找出该角色最新的一条朋友圈，防止重复
            const myLatestPost = visiblePosts.find(p => p.authorId === friend.id);
            if (myLatestPost && myLatestPost.text) {
                momentPrompt += `4. 【重要禁忌】：你上一次发的朋友圈内容是：“${myLatestPost.text}”。请确保这次发的**内容、话题和感慨方向与上次完全不同**，绝对不要重复或高度相似！\n`;
            }

            const history = await new Promise(resolve => {
                const tx = db.transaction(['chat_history'], 'readonly');
                const store = tx.objectStore('chat_history');
                const idx = store.index('friendId');
                const req = idx.getAll(friend.id);
                req.onsuccess = () => {
                    const msgs = req.result;
                    const shortTermCount = parseInt(friend.shortTermMemory || '20', 10);
                    resolve(msgs.slice(-shortTermCount));
                };
                req.onerror = () => resolve([]);
            });

            history.push({
                type: 'system',
                text: momentPrompt,
                timestamp: Date.now()
            });

            let aiResponseText = await callLLM(config, systemPrompt, history);
            if (!aiResponseText) return;

            // Remove any inner_thought/mood wrappers they might accidentally use for the post
            aiResponseText = aiResponseText.replace(/<(?:inner_thought|thought)>(.*?)<\/(?:inner_thought|thought)>/gis, '').trim();
            aiResponseText = aiResponseText.replace(/<mood>(.*?)<\/mood>/gis, '').trim();

            let postText = aiResponseText;
            let postImages = [];

            // Check if there's a sticker included
            const stickerRegex = /<sticker>(.*?)<\/sticker>/g;
            let match;
            while ((match = stickerRegex.exec(postText)) !== null) {
                const stickerValue = match[1].trim();
                const matchedSticker = aiStickers.find(s => String(s.id) === stickerValue);
                if (matchedSticker) {
                    postImages.push(matchedSticker.src);
                } else if (stickerValue.startsWith('http') || stickerValue.startsWith('data:')) {
                    postImages.push(stickerValue);
                }
            }
            postText = postText.replace(stickerRegex, '').trim();

            const newPost = {
                id: Date.now().toString() + Math.floor(Math.random()*1000),
                authorId: friend.id,
                authorName: friend.realName || friend.name,
                authorAvatar: friend.avatar,
                authorGroup: friend.group || '默认分组',
                text: postText,
                images: postImages,
                visibility: '公开', // bots post publicly to their group by default
                visibilityRoles: [],
                timestamp: Date.now(),
                likes: [],
                comments: []
            };

            await new Promise(resolve => dbAdd('discover_posts', newPost, resolve));

            // 更新角色的自动发送时间
            friend.lastAutoPostTime = Date.now();
            await new Promise(resolve => dbUpdate('friends', friend, resolve));

            // Trigger reactions from others
            triggerBotInteractionsForPost(newPost.id);
        }

        function saveRoleMomentsSettings() {
            const isEnabled = document.getElementById('role-auto-post-toggle').checked;
            localStorage.setItem('global_auto_post_moments', isEnabled);
            
            const checkboxes = document.querySelectorAll('#role-auto-post-list-container input[type="checkbox"]');
            
            dbGetAll('friends', friends => {
                let promises = [];
                checkboxes.forEach(cb => {
                    const friend = friends.find(f => f.id === cb.value);
                    if (friend) {
                        if (friend.autoPostMoments !== cb.checked) {
                            friend.autoPostMoments = cb.checked;
                            promises.push(new Promise(res => dbUpdate('friends', friend, res)));
                        }
                    }
                });
                Promise.all(promises).then(() => {
                    showToast('角色发朋友圈设置已保存');
                    closeRoleMomentsModal();
                });
            });
        }

        function triggerDiscoverCoverUpload() {
            document.getElementById('discover-cover-input').click();
        }

        function handleDiscoverCoverUpload(input) {
            if (input.files && input.files[0]) {
                compressImage(input.files[0], 0.8, (compressedSrc) => {
                    document.getElementById('discover-cover-container').style.backgroundImage = `url(${compressedSrc})`;
                    dbSaveSetting('discover_cover', compressedSrc).then(() => {
                        localStorage.removeItem('discover_cover'); // Clean up old storage
                        showToast('封面已更新');
                    }).catch(err => {
                        showToast('封面保存失败，存储空间可能已满');
                    });
                });
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

        function canBotSeePost(friend, post, allFriends = null) {
            if (post.authorId === 'main_user') {
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
            } else {
                if (post.authorId === friend.id) return true;
                
                let authorGroup = post.authorGroup;
                if (!authorGroup && allFriends) {
                    const author = allFriends.find(f => f.id === post.authorId);
                    if (author) authorGroup = author.group || '默认分组';
                }
                const myGroup = friend.group || '默认分组';
                return authorGroup === myGroup;
            }
        }

        async function triggerBotInteractionsForPost(postId) {
            const configStr = localStorage.getItem('globalConfig');
            if (!configStr) return;
            const config = JSON.parse(configStr);
            if (!config.apiKey || !config.model) return;

            dbGet('discover_posts', postId, post => {
                if (!post) return;

                dbGetAll('friends', friends => {
                    const eligibleFriends = friends.filter(f => !f.isGroup && canBotSeePost(f, post, friends));
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

                    let postAuthorDisplayName = '用户';
                    if (post.authorId !== 'main_user') {
                        postAuthorDisplayName = post.authorName || '一位朋友';
                    }
                    prompt += `\n【当前场景：朋友圈动态互动】\n${postAuthorDisplayName}发布了一条动态：\n内容：${post.text || '无'}\n`;
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

                        // Re-fetch the latest post to prevent race conditions
                        const latestPost = await new Promise(res => dbGet('discover_posts', postId, res));
                        if (!latestPost) return;

                        let updated = false;
                        let newlyAddedLike = false;
                        
                        // Check if already liked in the latest version
                        const alreadyLiked = latestPost.likes && (latestPost.likes.includes(friend.id) || latestPost.likes.includes(friend.realName) || latestPost.likes.includes(friend.name));

                        if (action.like && !alreadyLiked) {
                            if (!latestPost.likes) latestPost.likes = [];
                            latestPost.likes.push(friend.id);
                            updated = true;
                            newlyAddedLike = true;
                        }

                        let newComments = [];
                        if (action.comment && typeof action.comment === 'string' && action.comment.trim() !== '' && action.comment !== 'null') {
                            if (!latestPost.comments) latestPost.comments = [];
                            let depth = 0;
                            let shouldBlock = false;

                            if (action.replyToId && action.replyToId !== 'null') {
                                const targetComment = latestPost.comments.find(c => String(c.id) === String(action.replyToId));
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
                                const newComment = {
                                    id: Date.now().toString() + Math.floor(Math.random()*1000),
                                    authorId: friend.id,
                                    authorName: friend.realName,
                                    text: action.comment.trim(),
                                    replyTo: action.replyToName && action.replyToName !== 'null' ? action.replyToName : null,
                                    replyToId: action.replyToId,
                                    timestamp: Date.now(),
                                    depth: depth
                                };
                                latestPost.comments.push(newComment);
                                newComments.push(newComment);
                                updated = true;
                            }
                        }

                        if (updated) {
                            await new Promise(res => dbUpdate('discover_posts', latestPost, res));
                            
                            let notifyUser = false;
                            let actionType = '';
                            let actionText = '';
                            
                            // Use latestPost for notification logic
                            if (latestPost.authorId === 'main_user') {
                                notifyUser = true;
                            } else {
                                if (newComments.length > 0 && newComments[0].replyToId) {
                                    const targetComment = latestPost.comments.find(c => String(c.id) === String(newComments[0].replyToId));
                                    if (targetComment && targetComment.authorId === 'main_user') {
                                        notifyUser = true;
                                    }
                                }
                            }

                            if (notifyUser) {
                                if (newComments.length > 0) {
                                    actionType = 'comment';
                                    actionText = newComments[0].text;
                                } else if (newlyAddedLike) {
                                    actionType = 'like';
                                    actionText = '赞了你的朋友圈';
                                }

                                if (actionType) {
                                    const notif = {
                                        id: Date.now().toString() + Math.floor(Math.random() * 1000),
                                        toId: 'main_user',
                                        fromId: friend.id,
                                        fromName: friend.name,
                                        fromAvatar: friend.avatar,
                                        postId: latestPost.id,
                                        postContent: latestPost.text || (latestPost.images && latestPost.images.length > 0 ? '[图片]' : ''),
                                        type: actionType,
                                        text: actionText,
                                        timestamp: Date.now(),
                                        isRead: false
                                    };
                                    await new Promise(res => dbAdd('discover_notifications', notif, res));
                                    checkDiscoverNotifications();
                                }
                            }

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

                            const now = new Date();
                            const postDate = new Date(post.timestamp);
                            const timeDiff = now - postDate;
                            const diffMinutes = Math.floor(timeDiff / 60000);
                            const diffHours = Math.floor(timeDiff / 3600000);
                            
                            let timeStr = '';
                            if (diffMinutes < 1) {
                                timeStr = '刚刚';
                            } else if (diffMinutes < 60) {
                                timeStr = `${diffMinutes}分钟前`;
                            } else if (now.toDateString() === postDate.toDateString()) {
                                timeStr = `${diffHours}小时前`;
                            } else {
                                const yesterday = new Date(now);
                                yesterday.setDate(yesterday.getDate() - 1);
                                if (yesterday.toDateString() === postDate.toDateString()) {
                                    timeStr = '昨天';
                                } else if (now.getFullYear() === postDate.getFullYear()) {
                                    timeStr = `${postDate.getMonth() + 1}月${postDate.getDate()}日`;
                                } else {
                                    timeStr = `${postDate.getFullYear()}年${postDate.getMonth() + 1}月${postDate.getDate()}日`;
                                }
                            }

                            let deleteHtml = '';
                            const showRoleDelete = localStorage.getItem('show_role_moment_delete_button') === 'true';

                            if (post.authorId === 'main_user') {
                                deleteHtml = `<span class="discover-post-delete" onclick="deleteDiscoverPost('${post.id}')">删除</span>`;
                            } else if (showRoleDelete) {
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
                                                if (rf) rName = rf.name;
                                            } else if (comment.replyTo) {
                                                const rf = friends.find(f => f.realName === comment.replyTo || f.name === comment.replyTo);
                                                if (rf) rName = rf.name;
                                            }
                                            replyText = ` 回复 <span class="discover-comment-name">${rName}</span>`;
                                        }
                                        
                                        // Use data attributes for event binding later
                                        interactionsHtml += `
                                            <div class="discover-comment-item" data-post-id="${post.id}" data-comment-id="${comment.id || ''}" data-author-id="${comment.authorId}" data-author-name="${cAuthorName}" data-depth="${comment.depth || 0}">
                                                <span class="discover-comment-name">${cAuthorName}</span>${replyText}：<span class="discover-comment-text">${comment.text}</span>
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
                            
                            // Bind events for comments in this post
                            postEl.querySelectorAll('.discover-comment-item').forEach(item => {
                                let pressTimer;
                                let isLongPress = false;
                                let startX, startY;
                                
                                const postId = item.dataset.postId;
                                const commentId = item.dataset.commentId;
                                const authorId = item.dataset.authorId;
                                const authorName = item.dataset.authorName;
                                const depth = item.dataset.depth;
                                
                                const startPress = (e) => {
                                    if (e.button === 2) return;
                                    isLongPress = false;
                                    startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
                                    startY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
                                    
                                    pressTimer = setTimeout(() => {
                                        isLongPress = true;
                                        e.preventDefault();
                                        showDiscoverCommentContextMenu(e, postId, commentId, authorId);
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
                                    if (isLongPress) {
                                        e.preventDefault();
                                        isLongPress = false;
                                    } else {
                                        openCommentDrawer(postId, authorName, commentId, depth);
                                    }
                                };

                                item.addEventListener('mousedown', startPress);
                                item.addEventListener('touchstart', startPress, { passive: false });
                                item.addEventListener('mouseup', endPress);
                                item.addEventListener('mouseleave', endPress);
                                item.addEventListener('touchend', endPress);
                                item.addEventListener('touchcancel', endPress);
                                item.addEventListener('mousemove', cancelPress);
                                item.addEventListener('touchmove', cancelPress);
                                item.addEventListener('contextmenu', (e) => { 
                                    e.preventDefault(); 
                                    if (!isLongPress) {
                                        showDiscoverCommentContextMenu(e, postId, commentId, authorId); 
                                    }
                                });
                                item.addEventListener('click', onClick);
                            });
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

        let activeDcPostId = null;
        let activeDcCommentId = null;
        const dcContextMenu = document.getElementById('discover-comment-context-menu');

        document.addEventListener('click', (e) => {
            if (dcContextMenu && dcContextMenu.style.display === 'flex' && !e.target.closest('.message-context-menu')) {
                dcContextMenu.style.display = 'none';
                activeDcPostId = null;
                activeDcCommentId = null;
            }
        });

        function showDiscoverCommentContextMenu(e, postId, commentId, authorId) {
            activeDcPostId = postId;
            activeDcCommentId = commentId;

            // 如果是用户自己发的评论，不显示重试按钮
            const isMe = authorId === 'main_user';
            document.getElementById('dc-ctx-retry').style.display = isMe ? 'none' : 'block';

            dcContextMenu.style.display = 'flex';
            
            const phoneContainer = document.querySelector('.phone-container');
            const phoneRect = phoneContainer.getBoundingClientRect();
            
            let top = (e.clientY || e.touches[0].clientY) - phoneRect.top;
            let left = (e.clientX || e.touches[0].clientX) - phoneRect.left;

            if (top + dcContextMenu.offsetHeight > phoneContainer.clientHeight) {
                top = phoneContainer.clientHeight - dcContextMenu.offsetHeight - 10;
            }
            if (left + dcContextMenu.offsetWidth > phoneContainer.clientWidth) {
                left = phoneContainer.clientWidth - dcContextMenu.offsetWidth - 10;
            }

            dcContextMenu.style.top = `${top}px`;
            dcContextMenu.style.left = `${left}px`;
        }

        document.getElementById('dc-ctx-delete').addEventListener('click', () => {
            if (activeDcPostId && activeDcCommentId) {
                showCustomConfirm('确定要删除这条评论吗？', () => {
                    dbGet('discover_posts', activeDcPostId, post => {
                        if (post && post.comments) {
                            post.comments = post.comments.filter(c => String(c.id) !== String(activeDcCommentId));
                            dbUpdate('discover_posts', post, () => {
                                renderDiscoverFeed();
                            });
                        }
                    });
                }, '删除评论');
            }
            dcContextMenu.style.display = 'none';
        });

        document.getElementById('dc-ctx-edit').addEventListener('click', () => {
            if (activeDcPostId && activeDcCommentId) {
                dbGet('discover_posts', activeDcPostId, post => {
                    if (post && post.comments) {
                        const comment = post.comments.find(c => String(c.id) === String(activeDcCommentId));
                        if (comment) {
                            document.getElementById('edit-discover-comment-content').value = comment.text;
                            document.getElementById('edit-discover-comment-modal').style.display = 'flex';
                        }
                    }
                });
            }
            dcContextMenu.style.display = 'none';
        });

        function saveEditedDiscoverComment() {
            const newText = document.getElementById('edit-discover-comment-content').value.trim();
            if (!newText) {
                showToast('评论内容不能为空');
                return;
            }
            if (activeDcPostId && activeDcCommentId) {
                dbGet('discover_posts', activeDcPostId, post => {
                    if (post && post.comments) {
                        const comment = post.comments.find(c => String(c.id) === String(activeDcCommentId));
                        if (comment) {
                            comment.text = newText;
                            dbUpdate('discover_posts', post, () => {
                                document.getElementById('edit-discover-comment-modal').style.display = 'none';
                                renderDiscoverFeed();
                            });
                        }
                    }
                });
            }
        }

        document.getElementById('dc-ctx-retry').addEventListener('click', () => {
            if (activeDcPostId && activeDcCommentId) {
                showCustomConfirm('确定要让该角色重新评论吗？(将删除此评论并重新生成)', () => {
                    dbGet('discover_posts', activeDcPostId, post => {
                        if (post && post.comments) {
                            const commentIndex = post.comments.findIndex(c => String(c.id) === String(activeDcCommentId));
                            if (commentIndex !== -1) {
                                const authorId = post.comments[commentIndex].authorId;
                                post.comments.splice(commentIndex, 1);
                                dbUpdate('discover_posts', post, () => {
                                    renderDiscoverFeed();
                                    
                                    // 重新触发该角色的评论
                                    const configStr = localStorage.getItem('globalConfig');
                                    if (!configStr) return;
                                    const config = JSON.parse(configStr);
                                    if (!config.apiKey || !config.model) return;
                                    
                                    dbGet('friends', authorId, friend => {
                                        if (friend) {
                                            processGroupInteractions(activeDcPostId, [friend], config);
                                            showToast('已请求重新生成评论');
                                        }
                                    });
                                });
                            }
                        }
                    });
                }, '重试评论');
            }
            dcContextMenu.style.display = 'none';
        });

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

        // Old handleFileUpload and triggerUpload removed.

        function generateIconPreviews() {
            const appGrid = document.getElementById('app-icon-preview');
            const dockGrid = document.getElementById('dock-icon-preview');
            appGrid.innerHTML = '';
            dockGrid.innerHTML = '';

            document.querySelectorAll('#main-page .apps-area .app-item').forEach(item => {
                const clone = item.cloneNode(true);
                const id = item.dataset.appId;
                clone.onclick = () => triggerIndividualUpload(id);
                appGrid.appendChild(clone);
            });
            document.querySelectorAll('#main-page .dock-bar .app-item').forEach(item => {
                const clone = item.cloneNode(true);
                const id = item.dataset.appId;
                clone.onclick = () => triggerIndividualUpload(id);
                dockGrid.appendChild(clone);
            });
        }
        // Old triggerIndividualUpload removed.

        function toggleStatusBar(isVisible) {
            localStorage.setItem('show_status_bar', isVisible);
            const statusBar = document.querySelector('.status-bar');
            if (statusBar) {
                statusBar.style.display = isVisible ? 'flex' : 'none';
            }
            
            const fakeStatusBar = document.getElementById('discover-fake-status-bar');
            if (fakeStatusBar) {
                fakeStatusBar.style.display = isVisible ? 'flex' : 'none';
            }
            
            // Adjust padding for pages that rely on status bar height
            document.querySelectorAll('.page').forEach(page => {
                if (page.id === 'wechat-discover-page' || page.id === 'music-player-page' || page.id === 'chat-interface-page') {
                    page.style.paddingTop = '0px';
                    return;
                }
                
                if (isVisible) {
                    page.style.paddingTop = 'max(34px, env(safe-area-inset-top))';
                } else {
                    page.style.paddingTop = 'env(safe-area-inset-top)';
                }
            });
            
            // Special handling for discover page sticky header
            const discoverHeader = document.getElementById('discover-sticky-header');
            if (discoverHeader) {
                if (isVisible) {
                    discoverHeader.style.paddingTop = 'max(34px, env(safe-area-inset-top))';
                    discoverHeader.style.height = 'calc(46px + max(34px, env(safe-area-inset-top)))';
                } else {
                    discoverHeader.style.paddingTop = 'env(safe-area-inset-top)';
                    discoverHeader.style.height = 'calc(46px + env(safe-area-inset-top))';
                }
            }

            // Special handling for chat interface header
            const chatHeader = document.querySelector('.chat-interface-header');
            if (chatHeader) {
                if (isVisible) {
                    chatHeader.style.paddingTop = 'calc(max(34px, env(safe-area-inset-top)) + 2px)';
                } else {
                    chatHeader.style.paddingTop = 'max(2px, env(safe-area-inset-top))';
                }
            }

            // Special handling for music player header
            const musicHeader = document.getElementById('music-player-header');
            if (musicHeader) {
                if (isVisible) {
                    musicHeader.style.paddingTop = 'calc(max(34px, env(safe-area-inset-top)) + 2px)';
                } else {
                    musicHeader.style.paddingTop = 'max(2px, env(safe-area-inset-top))';
                }
            }
        }

        // Old desktop theme upload functions removed.

        function resetDesktopTheme(type) {
            dbDeleteSetting(type).then(() => {
                localStorage.removeItem(type);
                applyDesktopTheme();
                if (type === 'desktop_time_color') {
                    const colorPicker = document.getElementById('status-bar-time-color-picker');
                    if (colorPicker) colorPicker.value = '#000000';
                }
                showToast('已恢复默认');
            });
        }

        function changeStatusBarTimeColor(color) {
            dbSaveSetting('desktop_time_color', color).then(() => {
                localStorage.removeItem('desktop_time_color');
                applyDesktopTheme();
            });
        }

        function applyDesktopTheme() {
            const getVal = (key) => themeSettings[key] || localStorage.getItem(key);
            
            const batteryIconUrl = getVal('desktop_battery_icon');
            const signalIconUrl = getVal('desktop_signal_icon');
            const timeColor = getVal('desktop_time_color');

            const batteryIconEl = document.querySelector('.battery-icon');
            const signalIconEl = document.querySelector('.signal-icon');
            const timeEl = document.querySelector('.status-bar .time');

            // Previews
            const batteryPreview = document.getElementById('desktop-battery-icon-preview');
            const signalPreview = document.getElementById('desktop-signal-icon-preview');
            const colorPicker = document.getElementById('status-bar-time-color-picker');

            if (batteryIconEl) {
                if (batteryIconUrl) {
                    batteryIconEl.classList.add('image-mode');
                    batteryIconEl.style.backgroundImage = `url(${batteryIconUrl})`;
                    batteryIconEl.style.backgroundSize = 'contain';
                    batteryIconEl.style.backgroundRepeat = 'no-repeat';
                    batteryIconEl.style.backgroundPosition = 'center';
                    batteryIconEl.style.border = 'none';
                    const level = batteryIconEl.querySelector('.battery-level');
                    if (level) level.style.display = 'none';
                } else {
                    batteryIconEl.classList.remove('image-mode');
                    batteryIconEl.style.backgroundImage = '';
                    batteryIconEl.style.border = '1px solid currentColor';
                    const level = batteryIconEl.querySelector('.battery-level');
                    if (level) {
                        level.style.display = 'block';
                    } else {
                        batteryIconEl.innerHTML = '<div class="battery-level"></div>';
                    }
                }
            }
            if (batteryPreview) {
                batteryPreview.style.backgroundImage = batteryIconUrl ? `url(${batteryIconUrl})` : '';
            }

            if (signalIconEl) {
                if (signalIconUrl) {
                    signalIconEl.style.backgroundImage = `url(${signalIconUrl})`;
                    signalIconEl.style.backgroundSize = 'contain';
                    signalIconEl.style.backgroundRepeat = 'no-repeat';
                    signalIconEl.style.backgroundPosition = 'center';
                    signalIconEl.innerHTML = ''; // Clear bars
                    signalIconEl.style.width = '24px'; // Give it a width
                } else {
                    signalIconEl.style.backgroundImage = '';
                    if (!signalIconEl.querySelector('.bar')) {
                        signalIconEl.innerHTML = '<span class="bar"></span><span class="bar"></span><span class="bar"></span><span class="bar"></span>';
                    }
                    signalIconEl.style.width = '';
                }
            }
            if (signalPreview) {
                signalPreview.style.backgroundImage = signalIconUrl ? `url(${signalIconUrl})` : '';
            }

            if (timeEl) {
                if (timeColor) {
                    timeEl.style.color = timeColor;
                } else {
                    timeEl.style.color = ''; // Revert to stylesheet color
                }
            }
            if (colorPicker) {
                colorPicker.value = timeColor || '#000000';
            }
        }

        function loadTheme() {
            const showStatusBar = localStorage.getItem('show_status_bar') !== 'false'; // Default to true
            const statusBarToggle = document.getElementById('status-bar-toggle');
            if (statusBarToggle) {
                statusBarToggle.checked = showStatusBar;
            }
            toggleStatusBar(showStatusBar);

            const wallpaper = themeSettings['wallpaper'] || localStorage.getItem('wallpaper');
            if (wallpaper) {
                document.getElementById('main-page').style.backgroundImage = `url(${wallpaper})`;
                document.getElementById('wallpaper-preview').style.backgroundImage = `url(${wallpaper})`;
            }
            document.querySelectorAll('#main-page .app-item').forEach(item => {
                const id = item.dataset.appId;
                const savedIcon = themeSettings[id] || localStorage.getItem(id);
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
                        const mainContainer = document.getElementById('main-avatar-container');
                        if (mainContainer) mainContainer.classList.add('has-image');
                    }
                    if (profile.img1_display) {
                        document.getElementById('img1-display').src = profile.img1_display;
                        document.getElementById('img1-slot').classList.add('has-image');
                    }
                    if (profile.img2_display) {
                        document.getElementById('img2-display').src = profile.img2_display;
                        document.getElementById('img2-slot').classList.add('has-image');
                    }
                    if (profile.img3_display) {
                        document.getElementById('img3-display').src = profile.img3_display;
                        document.getElementById('img3-slot').classList.add('has-image');
                    }
                }
            });
            loadGlobalFont();
            applyDesktopTheme();
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
        
        // Old previewImage function removed.

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

        // --- Audio & Together Listen Logic ---
        let musicAudio = new Audio();
        let currentPlaylist = [];
        let currentSongIndex = 0;
        let togetherListenTimer = null;
        let togetherListenAccumulatedMs = 0;
        let togetherListenLastPlayTs = null;
        let playMode = 0; // 0: Sequence, 1: Random, 2: Single Loop

        const PLAY_MODE_ICONS = [
            '<polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>', // Sequence (Loop List)
            '<path d="M16 3h5v5"></path><path d="M4 20L21 3"></path><path d="M21 16v5h-5"></path><path d="M15 15l-5 5"></path><path d="M4 4l5 5"></path>', // Random (Shuffle)
            '<path d="M17 2l4 4-4 4"></path><path d="M3 11v-1a4 4 0 0 1 4-4h14"></path><path d="M7 22l-4-4 4-4"></path><path d="M21 13v1a4 4 0 0 1-4 4H3"></path><text x="10" y="14" font-size="8" fill="currentColor" font-weight="bold">1</text>' // Single Loop (Custom 1)
        ];

        const PLAY_MODE_NAMES = ['列表循环', '随机播放', '单曲循环'];

        function switchPlayMode() {
            playMode = (playMode + 1) % 3;
            const btn = document.getElementById('music-mode-btn');
            if(btn) btn.innerHTML = PLAY_MODE_ICONS[playMode];
            showToast(`已切换到：${PLAY_MODE_NAMES[playMode]}`);
        }

        function enterTogetherListen() {
            if (!currentChatFriendId) {
                showToast('请先选择一个聊天');
                return;
            }
            toggleActionPanel(); // Close the + menu
            loadGlobalPlaylistAndPlay();
        }

        function loadGlobalPlaylistAndPlay() {
            dbGetAll('global_playlist', playlist => {
                // Auto-delete unplayable songs
                const validPlaylist = [];
                if (playlist && playlist.length > 0) {
                    playlist.forEach(song => {
                        if (song.unplayable) {
                            dbDelete('global_playlist', song.id);
                        } else {
                            validPlaylist.push(song);
                        }
                    });
                }
                
                currentPlaylist = validPlaylist;
                
                if (currentSongIndex >= currentPlaylist.length) {
                    currentSongIndex = 0;
                }

                initMusicPlayerView();
                
                if (currentPlaylist.length > 0) {
                    // Update display info but DO NOT auto-play
                    const song = currentPlaylist[currentSongIndex];
                    if (song) {
                        document.getElementById('music-title-display').textContent = song.name || '未知歌曲';
                        document.getElementById('music-artist-display').textContent = song.artist || '未知歌手';
                    }
                    // If audio is already playing from this playlist, keep it updating.
                    // If not, it will just sit there paused.
                } else {
                    document.getElementById('music-title-display').textContent = '未播放歌曲';
                    document.getElementById('music-artist-display').textContent = '点击右上角导入';
                    musicAudio.pause();
                    document.getElementById('music-vinyl-disc').classList.remove('spin-anim');
                }
            });
        }

        function openMusicActionSheet() {
            const overlay = document.getElementById('music-action-sheet-overlay');
            overlay.style.display = 'block';
            void overlay.offsetWidth;
            overlay.classList.add('show');
        }

        function closeMusicActionSheet(e) {
            if (e && e.target !== document.getElementById('music-action-sheet-overlay')) {
                return;
            }
            const overlay = document.getElementById('music-action-sheet-overlay');
            overlay.classList.remove('show');
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 300);
        }

        function handleMusicAction(action) {
            closeMusicActionSheet();
            setTimeout(() => {
                if (action === 'link') {
                    openMusicImportModal();
                } else if (action === 'local') {
                    document.getElementById('local-music-input').click();
                } else if (action === 'clear') {
                    showCustomConfirm('确定要清空全局歌单吗？', () => {
                        dbGetAll('global_playlist', items => {
                            let count = 0;
                            if(items.length === 0) {
                                loadGlobalPlaylistAndPlay();
                                return;
                            }
                            items.forEach(item => {
                                dbDelete('global_playlist', item.id, () => {
                                    count++;
                                    if(count === items.length) {
                                        showToast('已清空歌单');
                                        loadGlobalPlaylistAndPlay();
                                    }
                                });
                            });
                        });
                    }, '清空歌单');
                }
            }, 300);
        }

        function handleLocalMusicUpload(input) {
            const files = Array.from(input.files);
            if (files.length === 0) return;

            showToast('正在导入本地音乐...');
            let savedCount = 0;

            files.forEach(file => {
                const song = {
                    id: Date.now().toString() + Math.floor(Math.random()*10000),
                    name: file.name.replace(/\.[^/.]+$/, ""),
                    artist: '本地音乐',
                    file: file,
                    isLocal: true,
                    pic: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
                };

                dbAdd('global_playlist', song, () => {
                    savedCount++;
                    if (savedCount === files.length) {
                        showToast(`成功导入 ${savedCount} 首本地音乐`);
                        loadGlobalPlaylistAndPlay();
                    }
                });
            });
            input.value = '';
        }

        function openMusicImportModal() {
            document.getElementById('music-link-input').value = '';
            document.getElementById('music-import-modal').style.display = 'flex';
            
            const returnBtn = document.getElementById('return-to-player-btn');
            if (returnBtn) {
                returnBtn.style.display = 'none';
            }
        }

        async function startTogetherListen() {
            const link = document.getElementById('music-link-input').value.trim();
            if (!link) {
                showToast('请输入歌单链接');
                return;
            }

            document.getElementById('music-import-modal').style.display = 'none';
            showToast('正在解析歌单...');

            // Check for direct audio URL
            if (link.match(/^https?:\/\/.*\.(mp3|wav|ogg|m4a|flac)($|\?)/i)) {
                 const song = {
                     id: Date.now().toString(),
                     name: '直链音频',
                     artist: '网络来源',
                     url: link,
                     pic: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
                 };
                 dbAdd('global_playlist', song, () => {
                     showToast('已添加直链音频');
                     if (currentPlaylist.length === 0) {
                         currentSongIndex = 0;
                     }
                     loadGlobalPlaylistAndPlay();
                 });
                 return;
            }

            let server = 'netease';
            let id = '';

            // Simple Regex to extract ID from standard Netease/QQ links
            if (link.includes('163.com')) {
                server = 'netease';
                const match = link.match(/id=(\d+)/);
                if (match) id = match[1];
            } else if (link.includes('y.qq.com') || link.includes('c.y.qq.com')) {
                server = 'tencent';
                const match = link.match(/id=(\d+)/) || link.match(/\/(\w+)\.html/);
                if (match) id = match[1];
            }

            if (!id) {
                showToast('无法识别该链接，将使用默认歌单演示');
                id = '3778678'; // NetEase Hot Songs fallback
                server = 'netease';
            }

            try {
                // Using Meting API to fetch playlist info
                const response = await fetch(`https://api.injahow.cn/meting/?server=${server}&type=playlist&id=${id}`);
                if (!response.ok) throw new Error('API request failed');
                
                let data = await response.json();
                
                // Sometimes type=playlist fails if the ID is a single song
                if (!data || data.length === 0 || data.error) {
                    const songResponse = await fetch(`https://api.injahow.cn/meting/?server=${server}&type=song&id=${id}`);
                    if (songResponse.ok) {
                        data = await songResponse.json();
                    }
                }

                if (!data || data.length === 0) {
                    throw new Error('Empty playlist');
                }

                let savedCount = 0;
                data.forEach(song => {
                    const newSong = {
                        id: Date.now().toString() + Math.floor(Math.random()*10000),
                        name: song.name,
                        artist: song.artist,
                        url: song.url,
                        pic: song.pic || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
                    };
                    dbAdd('global_playlist', newSong, () => {
                        savedCount++;
                        if (savedCount === data.length) {
                            showToast('导入链接成功');
                            if (currentPlaylist.length === 0) {
                                currentSongIndex = 0;
                            }
                            loadGlobalPlaylistAndPlay();
                        }
                    });
                });

            } catch (error) {
                console.error("Music Fetch Error:", error);
                showToast('解析失败，请检查链接或网络');
            }
        }

        function initMusicPlayerView() {
            // Setup Avatars
            dbGet('friends', currentChatFriendId, friend => {
                if (friend) {
                    document.getElementById('music-friend-avatar').src = friend.avatar;
                    if (friend.myAvatar) {
                        document.getElementById('music-my-avatar').src = friend.myAvatar;
                    } else {
                        dbGet('user_profile', 'main_user', profile => {
                            document.getElementById('music-my-avatar').src = profile && profile.avatar ? profile.avatar : 'https://via.placeholder.com/150/B5EAD7/ffffff?text=Me';
                        });
                    }
                } else {
                    dbGet('user_profile', 'main_user', profile => {
                        document.getElementById('music-my-avatar').src = profile && profile.avatar ? profile.avatar : 'https://via.placeholder.com/150/B5EAD7/ffffff?text=Me';
                    });
                }
            });

            // Restore custom cover if exists
            const customCover = localStorage.getItem('music_custom_cover');
            if (customCover) {
                document.getElementById('music-album-cover').src = customCover;
            } else {
                document.getElementById('music-album-cover').src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // Black init
            }

            document.getElementById('music-vinyl-disc').classList.remove('spin-anim');

            showPage('music-player-page');
            document.querySelector('.status-bar').style.backgroundColor = 'transparent';
            document.querySelector('.status-bar').style.color = 'white';

            // Timer Logic
            if (togetherListenLastPlayTs === null && !musicAudio.paused) {
                togetherListenLastPlayTs = Date.now();
            }
            updateTogetherTimer();
            if (togetherListenTimer) clearInterval(togetherListenTimer);
            togetherListenTimer = setInterval(updateTogetherTimer, 60000); // update every minute

            // Sync Play Button State
            if (musicAudio.paused) {
                document.getElementById('music-play-icon').style.display = 'block';
                document.getElementById('music-pause-icon').style.display = 'none';
            } else {
                document.getElementById('music-play-icon').style.display = 'none';
                document.getElementById('music-pause-icon').style.display = 'block';
            }
        }

        function handleMusicCoverUpload(input) {
            if (input.files && input.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const imageUrl = e.target.result;
                    document.getElementById('music-album-cover').src = imageUrl;
                    localStorage.setItem('music_custom_cover', imageUrl);
                }
                reader.readAsDataURL(input.files[0]);
            }
        }

        function updateTogetherTimer() {
            let totalMs = togetherListenAccumulatedMs;
            if (togetherListenLastPlayTs !== null) {
                totalMs += (Date.now() - togetherListenLastPlayTs);
            }
            const minutes = Math.floor(totalMs / 60000);
            
            let timeText = '';
            if (minutes >= 60) {
                const hrs = Math.floor(minutes / 60);
                const mins = minutes % 60;
                timeText = `${hrs}小时 ${mins}分钟`;
            } else {
                timeText = `${minutes}分钟`;
            }
            document.getElementById('music-duration-text').textContent = timeText;
        }

        function closeMusicPlayer() {
            showPage('chat-interface-page');
            // Music keeps playing in background
        }

        async function playCurrentSong(retry = true) {
            if (currentPlaylist.length === 0) return;
            const song = currentPlaylist[currentSongIndex];
            
            document.getElementById('music-title-display').textContent = song.name || '未知歌曲';
            document.getElementById('music-artist-display').textContent = song.artist || '未知歌手';
            
            document.getElementById('music-vinyl-disc').classList.remove('spin-anim');

            const attemptPlay = async (url) => {
                if (!url) return false;
                try {
                    musicAudio.src = url;
                    await musicAudio.play();
                    
                    const isLocalSong = song.isLocal || song.artist === '本地音乐' || (url && (url.startsWith('data:') || url.startsWith('blob:')));

                    // Duration check for trial versions (< 60s), skipped for local music
                    if (!isLocalSong) {
                        if (musicAudio.readyState < 1) {
                             await new Promise(resolve => {
                                 const onLoaded = () => { resolve(); musicAudio.removeEventListener('loadedmetadata', onLoaded); };
                                 musicAudio.addEventListener('loadedmetadata', onLoaded, {once: true});
                                 setTimeout(resolve, 2000); 
                             });
                        }

                        if (musicAudio.duration > 0 && musicAudio.duration < 60) {
                            console.log("Skipping trial/short audio:", musicAudio.duration);
                            musicAudio.pause();
                            return false;
                        }
                    }

                    document.getElementById('music-vinyl-disc').classList.add('spin-anim');
                    
                    // Don't save blob URLs to DB as they expire
                    if (song.url !== url && !song.file && !url.startsWith('blob:')) {
                        song.url = url;
                        if (song.unplayable) {
                            song.unplayable = false;
                            if (document.getElementById('music-playlist-sheet-overlay').classList.contains('show')) {
                                renderPlaylist();
                            }
                        }
                        dbUpdate('global_playlist', song);
                    }
                    
                    setTimeout(preloadNextSong, 5000);
                    return true;
                } catch (e) {
                    console.error("Play error:", e);
                    return false;
                }
            };

            let targetUrl = song.url;
            if (song.file) {
                targetUrl = URL.createObjectURL(song.file);
            }

            // 1. Try existing URL first
            if (targetUrl && !targetUrl.includes('vip') && await attemptPlay(targetUrl)) {
                return;
            }

            // For local songs, do not fallback search
            if (song.isLocal || song.artist === '本地音乐' || song.file) {
                console.log("Local audio failed to play.");
                song.unplayable = true;
                dbUpdate('global_playlist', song);
                if (document.getElementById('music-playlist-sheet-overlay').classList.contains('show')) {
                    renderPlaylist();
                }
                setTimeout(() => playNextSong(true), 500);
                return;
            }

            // 2. Carpet Search
            const fallbackUrls = await fallbackSearchMusic(song.name, song.artist);
            
            for (let url of fallbackUrls) {
                if (url === song.url) continue;
                if (await attemptPlay(url)) {
                    return;
                }
            }

            // 3. Failed
            console.log("All sources failed, skipping...");
            song.unplayable = true;
            dbUpdate('global_playlist', song);
            if (document.getElementById('music-playlist-sheet-overlay').classList.contains('show')) {
                renderPlaylist();
            }
            setTimeout(() => playNextSong(true), 500);

        }

        async function fallbackSearchMusic(title, artist) {
            let allUrls = [];
            const platforms = ['tencent', 'kugou', 'netease', 'kuwo', 'bilibili'];
            
            const doSearch = async (query) => {
                for (let p of platforms) {
                    try {
                        const res = await fetch(`https://api.injahow.cn/meting/?server=${p}&type=search&search=${encodeURIComponent(query)}`);
                        const data = await res.json();
                        if (data && data.length > 0) {
                            for (let i = 0; i < Math.min(data.length, 5); i++) {
                                if (data[i].url && !data[i].url.includes('vip') && !allUrls.includes(data[i].url)) {
                                    allUrls.push(data[i].url);
                                }
                            }
                        }
                    } catch(e) {}
                }
            };

            await doSearch(title + ' ' + artist);
            await doSearch(title);
            
            return allUrls;
        }

        async function handleMusicMetadataEdit() {
            if (currentPlaylist.length === 0) return;
            const song = currentPlaylist[currentSongIndex];
            const newTitle = document.getElementById('music-title-display').textContent.trim();
            const newArtist = document.getElementById('music-artist-display').textContent.trim();
            
            if (newTitle && (song.name !== newTitle || song.artist !== newArtist)) {
                song.name = newTitle;
                song.artist = newArtist;
                song.url = ''; // Force re-fetch
                dbUpdate('global_playlist', song);
                showToast('正在为您搜索音源...');
                musicAudio.pause();
                await playCurrentSong();
            }
        }

        function playNextSong(manual = true) {
            if (currentPlaylist.length === 0) return;
            
            if (playMode === 1) { // Random
                let newIndex = currentSongIndex;
                if (currentPlaylist.length > 1) {
                    while (newIndex === currentSongIndex) {
                        newIndex = Math.floor(Math.random() * currentPlaylist.length);
                    }
                }
                currentSongIndex = newIndex;
            } else if (playMode === 2 && !manual) { // Single Loop & Auto
                // Keep currentSongIndex same
            } else { // Sequence or Manual Single Loop
                currentSongIndex++;
                if (currentSongIndex >= currentPlaylist.length) {
                    currentSongIndex = 0;
                }
            }
            playCurrentSong();
        }

        function playPrevSong() {
            if (currentPlaylist.length === 0) return;
            
            if (playMode === 1) { // Random
                let newIndex = currentSongIndex;
                if (currentPlaylist.length > 1) {
                    while (newIndex === currentSongIndex) {
                        newIndex = Math.floor(Math.random() * currentPlaylist.length);
                    }
                }
                currentSongIndex = newIndex;
            } else {
                currentSongIndex--;
                if (currentSongIndex < 0) {
                    currentSongIndex = currentPlaylist.length - 1;
                }
            }
            playCurrentSong();
        }

        function togglePlayPause() {
            if (currentPlaylist.length === 0) return;
            if (musicAudio.paused) {
                if (!musicAudio.src) {
                    playCurrentSong(); // Load and play if no source
                } else {
                    musicAudio.play().then(() => {
                        document.getElementById('music-vinyl-disc').classList.add('spin-anim');
                    }).catch(e => {
                        console.error("Play error:", e);
                        // Fallback: try re-loading/searching if direct play fails
                        playCurrentSong();
                    });
                }
            } else {
                musicAudio.pause();
                document.getElementById('music-vinyl-disc').classList.remove('spin-anim');
            }
        }

        musicAudio.addEventListener('play', () => {
            document.getElementById('music-play-icon').style.display = 'none';
            document.getElementById('music-pause-icon').style.display = 'block';
            if (togetherListenLastPlayTs === null) {
                togetherListenLastPlayTs = Date.now();
            }
            updateTogetherTimer();
        });

        musicAudio.addEventListener('pause', () => {
            document.getElementById('music-play-icon').style.display = 'block';
            document.getElementById('music-pause-icon').style.display = 'none';
            if (togetherListenLastPlayTs !== null) {
                togetherListenAccumulatedMs += (Date.now() - togetherListenLastPlayTs);
                togetherListenLastPlayTs = null;
            }
            updateTogetherTimer();
        });

        musicAudio.addEventListener('ended', () => {
            if (playMode === 2) {
                // Single loop
                musicAudio.currentTime = 0;
                musicAudio.play();
            } else {
                playNextSong(false);
            }
        });

        musicAudio.addEventListener('timeupdate', () => {
            if (document.getElementById('music-player-page').classList.contains('active')) {
                const current = musicAudio.currentTime || 0;
                const duration = musicAudio.duration || 0;
                const percent = duration ? (current / duration) * 100 : 0;
                
                document.getElementById('music-progress-fill').style.width = `${percent}%`;
                document.getElementById('music-progress-thumb').style.left = `${percent}%`;
                
                document.getElementById('music-current-time').textContent = formatTime(current);
                document.getElementById('music-total-time').textContent = formatTime(duration);
            }
        });

        function formatTime(seconds) {
            if (isNaN(seconds)) return '00:00';
            const m = Math.floor(seconds / 60);
            const s = Math.floor(seconds % 60);
            return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }

        function seekMusic(e) {
            const barContainer = document.getElementById('music-progress-bar-container');
            if (!barContainer) return;
            const rect = barContainer.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            let percentage = clickX / rect.width;
            percentage = Math.max(0, Math.min(1, percentage));
            
            if (musicAudio.duration) {
                musicAudio.currentTime = percentage * musicAudio.duration;
            }
        }

        function toggleMusicPlaylist() {
            const modal = document.getElementById('music-playlist-sheet-overlay');
            if (modal.style.display === 'block') {
                modal.classList.remove('show');
                setTimeout(() => { modal.style.display = 'none'; }, 300);
            } else {
                renderPlaylist();
                modal.style.display = 'block';
                // Force reflow
                void modal.offsetWidth;
                modal.classList.add('show');
            }
        }

        function renderPlaylist() {
            const container = document.getElementById('playlist-content');
            const countEl = document.getElementById('playlist-count');
            container.innerHTML = '';
            countEl.textContent = `(${currentPlaylist.length})`;

            currentPlaylist.forEach((song, index) => {
                const item = document.createElement('div');
                item.className = 'playlist-item';
                if (index === currentSongIndex) item.classList.add('active');
                if (song.unplayable) item.classList.add('unplayable');
                
                item.innerHTML = `
                    <div class="song-info" style="flex-grow: 1;">
                        <span class="song-name">${song.name || '未知歌曲'}</span>
                        <span style="color:#ccc;">-</span>
                        <span class="artist-name">${song.artist || '未知歌手'}</span>
                    </div>
                    <div class="playlist-delete-btn" style="padding: 0 10px; color: #ccc; font-size: 20px; cursor: pointer;">×</div>
                `;
                
                const infoDiv = item.querySelector('.song-info');
                infoDiv.onclick = (e) => {
                    e.stopPropagation();
                    currentSongIndex = index;
                    playCurrentSong();
                    toggleMusicPlaylist();
                };

                const deleteBtn = item.querySelector('.playlist-delete-btn');
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    dbDelete('global_playlist', song.id, () => {
                        currentPlaylist.splice(index, 1);
                        if (index < currentSongIndex) {
                            currentSongIndex--;
                        } else if (index === currentSongIndex && currentPlaylist.length > 0) {
                            if (currentSongIndex >= currentPlaylist.length) currentSongIndex = 0;
                        }
                        renderPlaylist();
                    });
                };

                container.appendChild(item);
            });
        }

        async function preloadNextSong() {
            if (currentPlaylist.length <= 1) return;
            const nextIdx = (currentSongIndex + 1) % currentPlaylist.length;
            const nextSong = currentPlaylist[nextIdx];
            if (!nextSong) return;

            if (!nextSong.url || nextSong.url.includes('vip') || nextSong.url === '') {
                const foundUrl = await fallbackSearchMusic(nextSong.name, nextSong.artist);
                if (foundUrl) {
                    currentPlaylist[nextIdx].url = foundUrl; // Cache the found url
                }
            }
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

        function openAddGroupChatModal() {
            document.getElementById('add-group-chat-modal').style.display = 'flex';
            document.getElementById('wechat-menu').classList.remove('show');
            document.getElementById('agc-name-input').value = '';
            document.getElementById('agc-avatar-preview').src = '';
            document.getElementById('agc-avatar-container').classList.remove('has-image');
            document.getElementById('agc-avatar-input').value = '';

            const list = document.getElementById('agc-members-list');
            list.innerHTML = '';
            dbGetAll('friends', friends => {
                const nonGroupFriends = friends.filter(f => !f.isGroup);
                nonGroupFriends.forEach(f => {
                    const label = document.createElement('label');
                    label.className = 'preset-checkbox-item';
                    label.style.padding = '5px 0';
                    label.innerHTML = `
                        <input type="checkbox" value="${f.id}">
                        <div class="custom-checkbox"></div>
                        <img src="${f.avatar}" style="width: 24px; height: 24px; border-radius: 4px; margin-right: 5px; object-fit: cover;">
                        <span>${f.name}</span>
                    `;
                    list.appendChild(label);
                });
            });
        }

        function closeAddGroupChatModal() {
            document.getElementById('add-group-chat-modal').style.display = 'none';
        }

        function triggerAgcAvatarUpload() {
            document.getElementById('agc-avatar-input').click();
        }

        function previewAgcAvatar(input) {
            if (input.files && input.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const preview = document.getElementById('agc-avatar-preview');
                    preview.src = e.target.result;
                    document.getElementById('agc-avatar-container').classList.add('has-image');
                }
                reader.readAsDataURL(input.files[0]);
            }
        }

        function saveGroupChat() {
            let name = document.getElementById('agc-name-input').value.trim();
            const avatarSrc = document.getElementById('agc-avatar-preview').src;
            const hasAvatar = document.getElementById('agc-avatar-container').classList.contains('has-image');
            
            const checkboxes = document.querySelectorAll('#agc-members-list input[type="checkbox"]:checked');
            const selectedIds = Array.from(checkboxes).map(cb => cb.value);

            if (selectedIds.length === 0) {
                showToast('请至少选择一个群成员');
                return;
            }
            
            if (!name) {
                const selectedNames = Array.from(checkboxes).map(cb => {
                    const span = cb.parentElement.querySelector('span');
                    return span ? span.textContent : '';
                }).filter(n => n);
                
                if (selectedNames.length > 2) {
                    name = selectedNames.slice(0, 2).join('、') + '...的群聊';
                } else if (selectedNames.length > 0) {
                    name = selectedNames.join('、') + '的群聊';
                } else {
                    name = '群聊';
                }
            }

            if (!hasAvatar) {
                showToast('请上传群头像');
                return;
            }

            const newGroupChat = {
                id: 'group_' + Date.now().toString(),
                name: name,
                realName: name,
                avatar: avatarSrc,
                isGroup: true,
                members: selectedIds,
                memoryInterop: false,
                memoryInteropRoles: [],
                lastMsg: "群聊已创建",
                lastTime: getCurrentTimeStr(),
                isPinned: false,
                isHidden: false,
                group: '默认分组'
            };

            dbAdd('friends', newGroupChat, () => {
                closeAddGroupChatModal();
                renderChatList();
            });
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
            const offlineChatPage = document.getElementById('offline-chat-page');
            // If user is currently in the chat interface with this friend, don't show banner
            if (chatPage.classList.contains('active') && currentChatFriendId === friend.id) {
                return; 
            }
            if (offlineChatPage.classList.contains('active') && currentChatFriendId === friend.id) {
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
                                if (msg.isSticker && msg.stickerDescription) previewText = `[表情包] ${msg.stickerDescription}`;
                                else if (msg.isSticker && msg.isDice) previewText = `[骰子]`;
                                else if (msg.isSticker) previewText = `[表情包]`;
                                else if (msg.isImage) previewText = `[图片]`;
                                
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

                    // Fallback to id if lastActivityTimestamp is missing
                    const timeA = a.lastActivityTimestamp || (a.id.includes('_') ? parseInt(a.id.split('_').pop()) : parseInt(a.id)) || 0;
                    const timeB = b.lastActivityTimestamp || (b.id.includes('_') ? parseInt(b.id.split('_').pop()) : parseInt(b.id)) || 0;

                    return timeB - timeA;
                });
                
                visibleFriends.forEach(friend => {
                    const item = document.createElement('div');
                    item.className = 'chat-item';
                    item.dataset.friendId = friend.id;
                    if (friend.isPinned) {
                        item.style.backgroundColor = '#f5f5f5';
                    }

                    const unreadBottomHtml = friend.unreadCount ? `<div class="chat-list-unread-count">${friend.unreadCount > 99 ? '99+' : friend.unreadCount}</div>` : '';

                    item.innerHTML = `
                        <div style="position: relative; width: 48px; height: 48px; flex-shrink: 0;">
                            <img class="chat-avatar" src="${friend.avatar}" alt="${friend.name}">
                        </div>
                        <div class="chat-info">
                            <div class="chat-top">
                                <span class="chat-name">${friend.name}</span>
                                <span class="chat-time">${friend.lastTime}</span>
                            </div>
                            <div class="chat-bottom">
                                <div class="chat-preview">${friend.lastMsg}</div>
                                ${unreadBottomHtml}
                            </div>
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
                
                // Hide non-image options if it is a group chat
                if (currentChatFriendId) {
                    dbGet('friends', currentChatFriendId, friend => {
                        const items = actionPanel.querySelectorAll('.action-item');
                        if (friend && friend.isGroup) {
                            items.forEach(item => {
                                const name = item.querySelector('.action-name').textContent;
                                if (name !== '图片' && name !== '线下模式') {
                                    item.style.display = 'none';
                                } else {
                                    item.style.display = 'flex';
                                }
                            });
                        } else {
                            items.forEach(item => item.style.display = 'flex');
                        }
                    });
                }
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
                    friend.lastActivityTimestamp = Date.now();
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
        let activeMessageSegment = null;
        const msgContextMenu = document.getElementById('message-context-menu');

        document.addEventListener('click', (e) => {
            if (msgContextMenu && msgContextMenu.style.display === 'flex' && !e.target.closest('.message-context-menu')) {
                msgContextMenu.style.display = 'none';
            }
        });

        function showMessageContextMenu(e, msg, segmentInfo = null) {
            activeMessage = msg;
            activeMessageSegment = segmentInfo;
            
            const isOfflineModeUI = document.getElementById('offline-chat-page').classList.contains('active');

            if (isOfflineModeUI) {
                document.getElementById('msg-ctx-multiselect').style.display = 'none';
                document.getElementById('msg-ctx-retry').style.display = 'none'; // The retry button is in the header
                document.getElementById('msg-ctx-copy').style.display = 'block';
                document.getElementById('msg-ctx-edit').style.display = 'block';
                document.getElementById('msg-ctx-quote').style.display = 'none';
                document.getElementById('msg-ctx-recall').style.display = 'none';
                document.getElementById('msg-ctx-delete').style.display = 'block';
            } else {
                document.getElementById('msg-ctx-multiselect').style.display = 'block';
                document.getElementById('msg-ctx-retry').style.display = (msg.type === 'received') ? 'block' : 'none';
                document.getElementById('msg-ctx-copy').style.display = 'block';
                document.getElementById('msg-ctx-edit').style.display = 'block';
                document.getElementById('msg-ctx-quote').style.display = 'block';
                document.getElementById('msg-ctx-recall').style.display = (msg.type === 'sent') ? 'block' : 'none';
                document.getElementById('msg-ctx-delete').style.display = 'block';
            }
            
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
                let textToCopy = activeMessage.text;
                if (activeMessageSegment) {
                    textToCopy = activeMessageSegment.content;
                }
                navigator.clipboard.writeText(textToCopy).then(() => showToast('已复制'));
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
                if (activeMessageSegment) {
                    showCustomConfirm('确定要删除这条片段吗？', () => {
                        dbGetAll('chat_history', allMsgs => {
                            const dbMsg = allMsgs.find(m => m.friendId === activeMessage.friendId && m.timestamp === activeMessage.timestamp);
                            if (dbMsg) {
                                let parts = parseOfflineMessage(dbMsg.text);
                                parts.splice(activeMessageSegment.index, 1);
                                
                                let newText = '';
                                parts.forEach(p => {
                                    if (p.type === 'dialogue') newText += '「' + p.content + '」';
                                    else if (p.type === 'thought') newText += '<thought>' + p.content + '</thought>';
                                    else if (p.type === 'action') newText += p.content;
                                });
                                
                                if (!newText.trim()) {
                                    dbDelete('chat_history', dbMsg.id, () => {
                                        renderOfflineChat(currentChatFriendId);
                                    });
                                } else {
                                    dbMsg.text = newText;
                                    dbUpdate('chat_history', dbMsg, () => {
                                        renderOfflineChat(currentChatFriendId);
                                    });
                                }
                            }
                        });
                    }, '删除片段');
                } else {
                    showCustomConfirm('确定要删除这条消息吗？', () => {
                        dbGetAll('chat_history', allMsgs => {
                            const dbMsg = allMsgs.find(m => m.friendId === activeMessage.friendId && m.timestamp === activeMessage.timestamp);
                            if (dbMsg) {
                                dbDelete('chat_history', dbMsg.id, () => {
                                    const isOfflineModeUI = document.getElementById('offline-chat-page').classList.contains('active');
                                    if (isOfflineModeUI) {
                                        renderOfflineChat(currentChatFriendId);
                                    } else {
                                        renderMessages(currentChatFriendId);
                                    }
                                });
                            }
                        });
                    }, '删除消息');
                }
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
                                    const isOfflineModeUI = document.getElementById('offline-chat-page').classList.contains('active');
                                    if (isOfflineModeUI) {
                                        renderOfflineChat(currentChatFriendId);
                                    } else {
                                        renderMessages(currentChatFriendId);
                                    }
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
                if (activeMessageSegment) {
                    document.getElementById('edit-message-content').value = activeMessageSegment.content;
                } else {
                    document.getElementById('edit-message-content').value = activeMessage.text;
                }
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
                                const isOfflineModeUI = document.getElementById('offline-chat-page').classList.contains('active');
                                if (isOfflineModeUI) {
                                    renderOfflineChat(currentChatFriendId);
                                } else {
                                    renderMessages(currentChatFriendId);
                                }
                            }
                        });
                    });
                });
            }, '删除消息');
        }

        // Add a back button interceptor for selection mode and mini phone
        const originalBackArrowClick = document.querySelector('.chat-interface-header .back-arrow').onclick;
        document.querySelector('.chat-interface-header .back-arrow').onclick = (e) => {
            if (isSelectionMode) {
                exitSelectionMode();
            } else if (document.getElementById('chat-interface-page').classList.contains('in-mini-phone')) {
                closeMiniPhoneChat();
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
                        if (activeMessageSegment) {
                            let parts = parseOfflineMessage(dbMsg.text);
                            parts[activeMessageSegment.index].content = newText;
                            
                            let combinedText = '';
                            parts.forEach(p => {
                                if (p.type === 'dialogue') combinedText += '「' + p.content + '」';
                                else if (p.type === 'thought') combinedText += '<thought>' + p.content + '</thought>';
                                else if (p.type === 'action') combinedText += p.content;
                            });
                            
                            dbMsg.text = combinedText;
                            dbUpdate('chat_history', dbMsg, () => {
                                document.getElementById('edit-message-modal').style.display = 'none';
                                renderOfflineChat(currentChatFriendId);
                            });
                        } else {
                            dbMsg.text = newText;
                            dbUpdate('chat_history', dbMsg, () => {
                                document.getElementById('edit-message-modal').style.display = 'none';
                                renderMessages(currentChatFriendId, dbMsg.id || dbMsg.timestamp);
                            });
                        }
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

        function attachMessageEvents(element, messageObj, segmentInfo = null) {
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
                    e.preventDefault();
                    showMessageContextMenu(e, messageObj, segmentInfo);
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
                if (!isLongPress) {
                    showMessageContextMenu(e, messageObj, segmentInfo); 
                }
            });
            element.addEventListener('click', onClick, true);
        }

        function addMessageToUI(msg, shouldScroll = true) {
            if (msg.type === 'system') return; // Hide system messages from UI

            const container = document.getElementById('chat-messages-container');
            const msgDate = new Date(msg.timestamp);

            const friend = currentChatFriend;
            const profile = currentUserProfile;

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
                    avatar.onclick = (e) => {
                        e.stopPropagation();
                        handleAvatarClick(msg.friendId);
                    };
                }

                if (msg.type === 'received') {
                    wrapper.appendChild(avatar);
                    wrapper.appendChild(contentGroup);
                } else {
                    wrapper.appendChild(contentGroup);
                    wrapper.appendChild(avatar);
                }

                container.appendChild(wrapper);

                if (friend && friend.isGroup && msg.type === 'received' && msg.senderName) {
                    const nameLabel = document.createElement('div');
                    nameLabel.style.fontSize = '12px';
                    nameLabel.style.color = '#999';
                    nameLabel.style.marginBottom = '2px';
                    nameLabel.style.marginLeft = '2px';
                    nameLabel.textContent = msg.senderName;
                    contentGroup.insertBefore(nameLabel, contentGroup.firstChild);
                }

                if (!friend || !friend.offlineSettings) {
                    bubble.innerHTML = msg.text.replace(/\n/g, '<br>');
                    if (msg.type === 'received') {
                        if (friend && friend.isGroup && msg.senderAvatar) {
                            avatar.src = msg.senderAvatar;
                        } else {
                            avatar.src = friend ? friend.avatar : '';
                        }
                        if (friend && (friend.avatarDisplay === 'hide_other' || friend.avatarDisplay === 'hide_both')) {
                            avatar.style.display = 'none';
                        }
                    }
                    if (shouldScroll) container.scrollTop = container.scrollHeight;
                    return; 
                }

                // Sanitize and format the text
                let sanitizedText = sanitizeThoughtTags(msg.text);
                let formattedHtml = sanitizedText;
                
                if (friend.offlineSettings.showThoughts) {
                    formattedHtml = formattedHtml.replace(/<thought>([\s\S]*?)<\/thought>/g, '<span class="message-thought">$1</span>');
                } else {
                    // 如果隐藏心声，移除整个标签，并尝试吃掉周围多余的换行
                    formattedHtml = formattedHtml.replace(/\n*<thought>[\s\S]*?<\/thought>\n*/g, '\n');
                }
                
                // 修复可能产生的多余换行 (连续3个以上的换行缩减为2个)
                formattedHtml = formattedHtml.replace(/\n{3,}/g, '\n\n').trim();
                
                formattedHtml = formattedHtml.replace(/\n/g, '<br>');

                bubble.innerHTML = formattedHtml;

                if (msg.type === 'received') {
                    if (friend && friend.isGroup && msg.senderAvatar) {
                        avatar.src = msg.senderAvatar;
                    } else {
                        avatar.src = friend.avatar;
                    }
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
                        avatar.src = (profile && profile.avatar) ? profile.avatar : 'https://via.placeholder.com/150/B5EAD7/ffffff?text=Me';
                    }
                }

                if (shouldScroll) container.scrollTop = container.scrollHeight;
                
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

            if (msg.isInfo) {
                const infoWrapper = document.createElement('div');
                infoWrapper.className = 'message-time-divider';
                infoWrapper.style.fontSize = '12px';
                infoWrapper.style.color = '#999';
                infoWrapper.style.margin = '5px 0';
                infoWrapper.textContent = msg.text;
                container.appendChild(infoWrapper);
                if (shouldScroll) container.scrollTop = container.scrollHeight;
                return;
            }

            // Handle Location messages
            if (msg.isLocation) {
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
                bubble.className = `message-bubble ${msg.type} location-bubble`;

                bubble.innerHTML = `
                    <div class="location-content-top">
                        <span class="location-title">${msg.locationName || '位置'}</span>
                        ${msg.locationDetail ? `<span class="location-desc">${msg.locationDetail}</span>` : ''}
                    </div>
                    <div class="location-content-bottom">
                        <img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='40' viewBox='0 0 32 40'><path d='M16 2 C8.268 2 2 8.268 2 16 C2 24.837 16 38 16 38 S30 24.837 30 16 C30 8.268 23.732 2 16 2 Z' fill='%2307c160' stroke='%23ffffff' stroke-width='2'/><circle cx='16' cy='16' r='5' fill='white'/></svg>" class="location-pin-icon" alt="Location Pin">
                    </div>
                `;

                attachMessageEvents(bubble, msg);
                contentGroup.appendChild(bubble);

                const avatar = document.createElement('img');
                avatar.className = 'chat-avatar-placeholder';
                if (msg.type === 'received') {
                    avatar.onclick = (e) => {
                        e.stopPropagation();
                        handleAvatarClick(msg.friendId);
                    };
                }
                
                const hideDisplay = friend ? friend.avatarDisplay : 'show_all';
                if (msg.type === 'received' && (hideDisplay === 'hide_other' || hideDisplay === 'hide_both')) {
                    avatar.style.display = 'none';
                } else if (msg.type === 'sent' && (hideDisplay === 'hide_mine' || hideDisplay === 'hide_both')) {
                    avatar.style.display = 'none';
                }

                if (msg.type === 'received') {
                    if (friend && friend.isGroup && msg.senderAvatar) {
                        avatar.src = msg.senderAvatar;
                    } else {
                        avatar.src = friend ? friend.avatar : '';
                    }
                } else {
                    if (friend && friend.myAvatar) avatar.src = friend.myAvatar;
                    else {
                        avatar.src = (profile && profile.avatar) ? profile.avatar : 'https://via.placeholder.com/150';
                    }
                }

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

            // Handle Location messages
            if (msg.isLocation) {
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
                bubble.className = `message-bubble ${msg.type} location-bubble`;

                bubble.innerHTML = `
                    <div class="location-content-top">
                        <span class="location-title">${msg.locationName || '位置'}</span>
                        ${msg.locationDetail ? `<span class="location-desc">${msg.locationDetail}</span>` : ''}
                    </div>
                    <div class="location-content-bottom">
                        <img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='40' viewBox='0 0 32 40'><path d='M16 2 C8.268 2 2 8.268 2 16 C2 24.837 16 38 16 38 S30 24.837 30 16 C30 8.268 23.732 2 16 2 Z' fill='%2307c160' stroke='%23ffffff' stroke-width='2'/><circle cx='16' cy='16' r='5' fill='white'/></svg>" class="location-pin-icon" alt="Location Pin">
                    </div>
                `;

                attachMessageEvents(bubble, msg);
                contentGroup.appendChild(bubble);

                const avatar = document.createElement('img');
                avatar.className = 'chat-avatar-placeholder';
                if (msg.type === 'received') {
                    avatar.onclick = (e) => {
                        e.stopPropagation();
                        handleAvatarClick(msg.friendId);
                    };
                }
                
                const hideDisplay = friend ? friend.avatarDisplay : 'show_all';
                if (msg.type === 'received' && (hideDisplay === 'hide_other' || hideDisplay === 'hide_both')) {
                    avatar.style.display = 'none';
                } else if (msg.type === 'sent' && (hideDisplay === 'hide_mine' || hideDisplay === 'hide_both')) {
                    avatar.style.display = 'none';
                }

                if (msg.type === 'received') {
                    if (friend && friend.isGroup && msg.senderAvatar) {
                        avatar.src = msg.senderAvatar;
                    } else {
                        avatar.src = friend ? friend.avatar : '';
                    }
                } else {
                    if (friend && friend.myAvatar) avatar.src = friend.myAvatar;
                    else {
                        avatar.src = (profile && profile.avatar) ? profile.avatar : 'https://via.placeholder.com/150';
                    }
                }

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

            // Handle Location messages
            if (msg.isLocation) {
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
                bubble.className = `message-bubble ${msg.type} location-bubble`;

                bubble.innerHTML = `
                    <div class="location-content-top">
                        <span class="location-title">${msg.locationName || '位置'}</span>
                        ${msg.locationDetail ? `<span class="location-desc">${msg.locationDetail}</span>` : ''}
                    </div>
                    <div class="location-content-bottom"></div>
                `;

                attachMessageEvents(bubble, msg);
                contentGroup.appendChild(bubble);

                const avatar = document.createElement('img');
                avatar.className = 'chat-avatar-placeholder';
                if (msg.type === 'received') {
                    avatar.onclick = (e) => {
                        e.stopPropagation();
                        handleAvatarClick(msg.friendId);
                    };
                }
                
                const hideDisplay = friend ? friend.avatarDisplay : 'show_all';
                if (msg.type === 'received' && (hideDisplay === 'hide_other' || hideDisplay === 'hide_both')) {
                    avatar.style.display = 'none';
                } else if (msg.type === 'sent' && (hideDisplay === 'hide_mine' || hideDisplay === 'hide_both')) {
                    avatar.style.display = 'none';
                }

                if (msg.type === 'received') {
                    if (friend && friend.isGroup && msg.senderAvatar) {
                        avatar.src = msg.senderAvatar;
                    } else {
                        avatar.src = friend ? friend.avatar : '';
                    }
                } else {
                    if (friend && friend.myAvatar) avatar.src = friend.myAvatar;
                    else {
                        avatar.src = (profile && profile.avatar) ? profile.avatar : 'https://via.placeholder.com/150';
                    }
                }

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
                if (msg.type === 'received') {
                    avatar.onclick = (e) => {
                        e.stopPropagation();
                        handleAvatarClick(msg.friendId);
                    };
                }
                
                const hideDisplay = friend ? friend.avatarDisplay : 'show_all';
                if (msg.type === 'received' && (hideDisplay === 'hide_other' || hideDisplay === 'hide_both')) {
                    avatar.style.display = 'none';
                } else if (msg.type === 'sent' && (hideDisplay === 'hide_mine' || hideDisplay === 'hide_both')) {
                    avatar.style.display = 'none';
                }

                if (msg.type === 'received') {
                    if (friend && friend.isGroup && msg.senderAvatar) {
                        avatar.src = msg.senderAvatar;
                    } else {
                        avatar.src = friend ? friend.avatar : '';
                    }
                } else {
                    if (friend && friend.myAvatar) avatar.src = friend.myAvatar;
                    else {
                        avatar.src = (profile && profile.avatar) ? profile.avatar : 'https://via.placeholder.com/150';
                    }
                }

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

            // Handle Location messages
            if (msg.isLocation) {
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
                bubble.className = `message-bubble ${msg.type} location-bubble`;

                bubble.innerHTML = `
                    <div class="location-content-top">
                        <span class="location-title">${msg.locationName || '位置'}</span>
                        ${msg.locationDetail ? `<span class="location-desc">${msg.locationDetail}</span>` : ''}
                    </div>
                    <div class="location-content-bottom"></div>
                `;

                attachMessageEvents(bubble, msg);
                contentGroup.appendChild(bubble);

                const avatar = document.createElement('img');
                avatar.className = 'chat-avatar-placeholder';
                if (msg.type === 'received') {
                    avatar.onclick = (e) => {
                        e.stopPropagation();
                        handleAvatarClick(msg.friendId);
                    };
                }
                
                const targetFriendId = msg.friendId || currentChatFriendId;
                dbGet('friends', targetFriendId, friend => {
                    const hideDisplay = friend ? friend.avatarDisplay : 'show_all';
                    if (msg.type === 'received' && (hideDisplay === 'hide_other' || hideDisplay === 'hide_both')) {
                        avatar.style.display = 'none';
                    } else if (msg.type === 'sent' && (hideDisplay === 'hide_mine' || hideDisplay === 'hide_both')) {
                        avatar.style.display = 'none';
                    }

                    if (msg.type === 'received') {
                        if (friend && friend.isGroup && msg.senderAvatar) {
                            avatar.src = msg.senderAvatar;
                        } else {
                            avatar.src = friend ? friend.avatar : '';
                        }
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
                if (msg.type === 'received') {
                    avatar.onclick = (e) => {
                        e.stopPropagation();
                        handleAvatarClick(msg.friendId);
                    };
                }
                
                const targetFriendId = msg.friendId || currentChatFriendId;
                if (msg.type === 'received') {
                    dbGet('friends', targetFriendId, friend => {
                        if (friend && friend.isGroup && msg.senderName) {
                            const nameLabel = document.createElement('div');
                            nameLabel.style.fontSize = '12px';
                            nameLabel.style.color = '#999';
                            nameLabel.style.marginBottom = '2px';
                            nameLabel.style.marginLeft = '2px';
                            nameLabel.textContent = msg.senderName;
                            contentGroup.insertBefore(nameLabel, contentGroup.firstChild);
                        }
                        if (friend) {
                            if (friend.isGroup && msg.senderAvatar) {
                                avatar.src = msg.senderAvatar;
                            } else {
                                avatar.src = friend.avatar;
                            }
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
            
            // Programmatically add text and line breaks to prevent XSS
            msg.text.split('\n').forEach((line, index, arr) => {
                bubble.appendChild(document.createTextNode(line));
                if (index < arr.length - 1) {
                    bubble.appendChild(document.createElement('br'));
                }
            });

            // Add corner decorators
            const tl = document.createElement('div');
            tl.className = 'bubble-corner tl';
            bubble.appendChild(tl);

            const tr = document.createElement('div');
            tr.className = 'bubble-corner tr';
            bubble.appendChild(tr);

            const bl = document.createElement('div');
            bl.className = 'bubble-corner bl';
            bubble.appendChild(bl);

            const br = document.createElement('div');
            br.className = 'bubble-corner br';
            bubble.appendChild(br);

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
                avatar.onclick = (e) => {
                    e.stopPropagation();
                    handleAvatarClick(msg.friendId);
                };
            }

            if (msg.type === 'received') {
                dbGet('friends', currentChatFriendId, friend => {
                    if (friend && friend.isGroup && msg.senderName) {
                        const nameLabel = document.createElement('div');
                        nameLabel.style.fontSize = '12px';
                        nameLabel.style.color = '#999';
                        nameLabel.style.marginBottom = '2px';
                        nameLabel.style.marginLeft = '2px';
                        nameLabel.textContent = msg.senderName;
                        contentGroup.insertBefore(nameLabel, contentGroup.firstChild);
                    }
                    if (friend) {
                        if (friend.isGroup && msg.senderAvatar) {
                            avatar.src = msg.senderAvatar;
                        } else {
                            avatar.src = friend.avatar;
                        }
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
            // For GIFs, we can't really compress them via canvas, so just return the original
            if (file.type === 'image/gif') {
                const reader = new FileReader();
                reader.onload = (e) => callback(e.target.result);
                reader.readAsDataURL(file);
                return;
            }

            // 限制最大尺寸
            const MAX_WIDTH = 1024;
            const MAX_HEIGHT = 1024;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.getElementById('compression-canvas');
                    const ctx = canvas.getContext('2d');
                    
                    let width = img.width;
                    let height = img.height;

                    // 更智能的缩放
                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height = Math.round(height * MAX_WIDTH / width);
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width = Math.round(width * MAX_HEIGHT / height);
                            height = MAX_HEIGHT;
                        }
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // 根据文件类型选择格式
                    const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                    
                    // 分批处理，避免阻塞UI
                    setTimeout(() => {
                        const dataUrl = canvas.toDataURL(mimeType, quality);
                        callback(dataUrl);
                    }, 10);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }

        // --- Unified Image Uploader ---
        window.isUploading = false;

        function createImageUploader(callback, options = {}) {
            const { quality = 0.7, maxSizeMB = 10 } = options;

            return function(...args) {
                if (window.isUploading) {
                    showToast('请等待当前上传完成');
                    return;
                }
                
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.style.display = 'none';
                
                input.onchange = function(e) {
                    window.isUploading = true;
                    const file = e.target.files[0];
                    
                    // Cleanup function
                    const cleanup = () => {
                        window.isUploading = false;
                        if (input.parentNode) {
                            document.body.removeChild(input);
                        }
                    };

                    if (!file) {
                        cleanup();
                        return;
                    }
                    
                    if (!file.type.startsWith('image/')) {
                        showToast('请选择图片文件');
                        cleanup();
                        return;
                    }
                    
                    if (file.size > maxSizeMB * 1024 * 1024) {
                        showToast(`图片不能超过${maxSizeMB}MB`);
                        cleanup();
                        return;
                    }
                    
                    compressImage(file, quality, (compressedSrc) => {
                        callback(compressedSrc, ...args);
                        cleanup();
                    });
                };
                
                document.body.appendChild(input);
                input.click();
            };
        }

        stickerUploadBtn.addEventListener('click', () => stickerFileInput.click());

        stickerFileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;

            let currentIndex = 0;
            let uploadedCount = 0;
            const totalFiles = files.length;

            function processNext() {
                if (currentIndex >= totalFiles) {
                    if (uploadedCount > 0) {
                        renderStickerGrid();
                    }
                    e.target.value = ''; // Reset file input
                    return;
                }

                const file = files[currentIndex];
                compressImage(file, 0.6, (compressedSrc) => {
                    const titleText = totalFiles > 1 ? `添加表情包含义 (${currentIndex + 1}/${totalFiles})` : '添加表情包含义';
                    
                    showGenericStickerModal({
                        title: titleText,
                        body: `
                            <div style="text-align:center; margin-bottom:15px;">
                                <img src="${compressedSrc}" style="max-width:150px; max-height:150px; border-radius:8px; border:1px solid #eee;">
                            </div>
                            <label>请输入表情包含义</label>
                            <input type="text" id="sticker-desc-input" placeholder="例如：开心、点赞、疑问...">
                        `,
                        onConfirm: () => {
                            const desc = document.getElementById('sticker-desc-input').value.trim();
                            
                            const newSticker = {
                                src: compressedSrc,
                                group: currentStickerGroup === '全部' ? '默认' : currentStickerGroup,
                                description: desc || ''
                            };
                            
                            dbAdd('stickers', newSticker, () => {
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
                        if (!url.startsWith('http') && !url.startsWith('data:') && !url.startsWith('./') && !url.startsWith('/') && !url.match(/\.(png|jpe?g|gif|webp|svg|bmp)$/i)) return;
                        
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


        function applyChatTheme(friend) {
            const getSetting = (key, defaultVal) => {
                if (friend && friend[key] !== undefined && friend[key] !== null) return friend[key];
                // Read from the in-memory cache which is populated from IndexedDB
                if (themeSettings[key] !== undefined && themeSettings[key] !== null) return themeSettings[key];
                // Fallback to localStorage for older data before migration
                const globalVal = localStorage.getItem(key);
                if (globalVal !== null) return globalVal;
                return defaultVal;
            };

            const chatPage = document.getElementById('chat-interface-page');
            const chatContainer = document.getElementById('chat-messages-container');
            const chatHeader = document.querySelector('.chat-interface-header');
            const chatInputContainer = document.getElementById('chat-input-container');
            
            // Reset base colors
            chatPage.style.backgroundImage = 'none';
            chatPage.style.backgroundColor = '#ededed';

            // Wallpaper
            const wallpaper = getSetting('chat_wallpaper', null);
            if (wallpaper) {
                chatPage.style.backgroundImage = `url(${wallpaper})`;
                chatPage.style.backgroundSize = 'cover';
                chatPage.style.backgroundPosition = 'center';
                chatContainer.style.backgroundColor = 'transparent'; // Make message area transparent
            } else {
                chatPage.style.backgroundImage = 'none';
                chatPage.style.backgroundColor = '#ededed';
                chatContainer.style.backgroundColor = ''; // Revert to stylesheet default
            }

            // Header BG
            const headerBg = getSetting('chat_header_bg', null);
            if (headerBg) {
                chatHeader.style.backgroundImage = `url(${headerBg})`;
                chatHeader.style.backgroundColor = 'transparent';
                chatHeader.style.borderBottom = 'none';
            } else {
                chatHeader.style.backgroundImage = 'none';
                chatHeader.style.backgroundColor = 'var(--chat-header-bg-color, #ededed)';
                chatHeader.style.borderBottom = '1px solid #d7d7d7';
            }

            // Input BG
            const inputBg = getSetting('chat_input_bg', null);
            if (inputBg) {
                chatInputContainer.style.backgroundImage = `url(${inputBg})`;
                chatInputContainer.style.backgroundColor = 'transparent';
                chatInputContainer.style.borderTop = 'none';
            } else {
                chatInputContainer.style.backgroundImage = 'none';
                chatInputContainer.style.backgroundColor = 'var(--chat-input-bg-color, #f7f7f7)';
                chatInputContainer.style.borderTop = '1px solid #e0e0e0';
            }

            // Icons
            const setIconInline = (selector, key) => {
                const el = document.querySelector(selector);
                if (!el) return;
                const val = getSetting(key, null);
                if (val) {
                    el.style.backgroundImage = `url(${val})`;
                } else {
                    el.style.removeProperty('background-image');
                }
            };
            
            setIconInline('.chat-interface-header .back-arrow', 'chat_back_icon');
            setIconInline('.chat-interface-options', 'chat_options_icon');
            setIconInline('#voice-icon', 'chat_voice_icon');
            setIconInline('#emoji-icon', 'chat_emoji_icon');
            setIconInline('#plus-icon', 'chat_plus_icon');
            setIconInline('#send-message-btn', 'chat_send_icon');

            // Avatar Styles via CSS variables on root
            const avatarSize = getSetting('chat_avatar_size', '40');
            const avatarRadius = getSetting('chat_avatar_radius', '6');
            document.documentElement.style.setProperty('--chat-avatar-size', `${avatarSize}px`);
            document.documentElement.style.setProperty('--chat-avatar-radius', `${avatarRadius}px`);

            // Bubble Theme Styles via CSS variables on root
            const applyBubbleSide = (side) => {
                const prefix = side === 'sent' ? 'bubble_sent_' : 'bubble_recv_';
                
                const bgColor = getSetting(prefix + 'bg_color', side === 'sent' ? '#a9e979' : '#ffffff');
                const bgOpacity = getSetting(prefix + 'bg_opacity', '1');
                const textColor = getSetting(prefix + 'text_color', '#000000');
                const borderColor = getSetting(prefix + 'border_color', 'transparent');
                const borderWidth = getSetting(prefix + 'border_width', '0');
                const borderOpacity = getSetting(prefix + 'border_opacity', '1');
                const shadowColor = getSetting(prefix + 'shadow_color', '#000000');
                const shadowOpacity = getSetting(prefix + 'shadow_opacity', '0');
                const shadowX = getSetting(prefix + 'shadow_x', '0');
                const shadowY = getSetting(prefix + 'shadow_y', '0');
                const shadowBlur = getSetting(prefix + 'shadow_blur', '0');
                const tailColor = getSetting(prefix + 'tail_color', '');
                const hideTriangleRaw = getSetting(prefix + 'hide_triangle', 'false');
                const hideTriangle = hideTriangleRaw === 'true' || hideTriangleRaw === true;
                const radius = getSetting(prefix + 'radius', '8');

                const tailImage = getSetting(prefix + 'tail_image', '');
                const tailWidth = getSetting(prefix + 'tail_width', '20');
                const tailHeight = getSetting(prefix + 'tail_height', '20');
                const tailX = getSetting(prefix + 'tail_x', '0');
                const tailY = getSetting(prefix + 'tail_y', '0');
                const tailRot = getSetting(prefix + 'tail_rot', '0');
                
                const effect3dRaw = getSetting(prefix + '3d_effect', 'false');
                const effect3d = effect3dRaw === 'true' || effect3dRaw === true;

                const hexToRgba = (hex, alpha) => {
                    if (!hex || hex === 'transparent') return 'transparent';
                    let r = 0, g = 0, b = 0;
                    hex = hex.replace('#', '');
                    if (hex.length === 3) {
                        r = parseInt(hex[0] + hex[0], 16);
                        g = parseInt(hex[1] + hex[1], 16);
                        b = parseInt(hex[2] + hex[2], 16);
                    } else if (hex.length === 6) {
                        r = parseInt(hex.substring(0, 2), 16);
                        g = parseInt(hex.substring(2, 4), 16);
                        b = parseInt(hex.substring(4, 6), 16);
                    } else {
                        return hex;
                    }
                    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                };

                const finalBgColor = hexToRgba(bgColor, bgOpacity);
                const finalBorderColor = hexToRgba(borderColor, borderOpacity);

                document.documentElement.style.setProperty(`--bubble-${side}-bg-color`, finalBgColor);
                document.documentElement.style.setProperty(`--bubble-${side}-text-color`, textColor);
                
                let boxShadow = 'none';
                let backgroundImage = 'none';
                if (effect3d) {
                    boxShadow = 'inset 0 4px 6px rgba(255,255,255,0.4), inset 0 -4px 6px rgba(0,0,0,0.1)';
                    backgroundImage = 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0.05) 100%)';
                }
                
                document.documentElement.style.setProperty(`--bubble-${side}-bg-image`, backgroundImage);
                document.documentElement.style.setProperty(`--bubble-${side}-bg-image-opacity`, '1');
                
                const finalShadowColor = hexToRgba(shadowColor, shadowOpacity);
                let filterShadow = 'none';
                if (parseFloat(shadowOpacity) > 0 || parseInt(shadowBlur) > 0 || parseInt(shadowX) !== 0 || parseInt(shadowY) !== 0) {
                    filterShadow = `drop-shadow(${shadowX}px ${shadowY}px ${shadowBlur}px ${finalShadowColor})`;
                }
                
                if (effect3d) {
                    if (filterShadow === 'none') {
                        // Keep shadow logic simple, if 3d is on we apply inset shadow directly to bubble
                    }
                }

                document.documentElement.style.setProperty(`--bubble-${side}-border`, `${borderWidth}px solid ${finalBorderColor}`);
                if (effect3d) {
                    // Use a special property to pass box-shadow to CSS since filter is drop-shadow
                    document.documentElement.style.setProperty(`--bubble-${side}-box-shadow`, boxShadow);
                } else {
                    document.documentElement.style.setProperty(`--bubble-${side}-box-shadow`, 'none');
                }
                document.documentElement.style.setProperty(`--bubble-${side}-shadow`, filterShadow);
                
                const finalTailColor = tailColor ? tailColor : finalBgColor;
                const tailBorderColor = side === 'sent' ? `transparent transparent transparent ${finalTailColor}` : `transparent ${finalTailColor} transparent transparent`;
                document.documentElement.style.setProperty(`--bubble-${side}-tail-color`, tailBorderColor);

                document.documentElement.style.setProperty(`--bubble-${side}-triangle`, hideTriangle ? 'none' : 'block');
                
                // Set Tail Variables
                document.documentElement.style.setProperty(`--bubble-${side}-tail-image`, tailImage ? `url(${tailImage})` : 'none');
                document.documentElement.style.setProperty(`--bubble-${side}-tail-w`, tailImage ? tailWidth + 'px' : '0px');
                document.documentElement.style.setProperty(`--bubble-${side}-tail-h`, tailImage ? tailHeight + 'px' : '0px');
                document.documentElement.style.setProperty(`--bubble-${side}-tail-x`, tailX + 'px');
                document.documentElement.style.setProperty(`--bubble-${side}-tail-y`, tailY + 'px');
                document.documentElement.style.setProperty(`--bubble-${side}-tail-rot`, tailRot + 'deg');
                if (tailImage) {
                    document.documentElement.style.setProperty(`--bubble-${side}-tail-color`, 'transparent');
                }

                const formatUnit = (val) => {
                    if (val === null || val === undefined || val === '') return 'auto';
                    if (!isNaN(val) && val !== '') return val + 'px';
                    return val;
                };
                let fRadius = formatUnit(radius);
                if(fRadius === 'auto') fRadius = '8px';

                document.documentElement.style.setProperty(`--bubble-${side}-radius`, fRadius);

                // Apply Corners
                ['tl', 'tr', 'bl', 'br'].forEach(corner => {
                    const cPrefix = `bubble_${side}_${corner}_`;
                    const cImg = getSetting(cPrefix + 'img', '');
                    const cOp = getSetting(cPrefix + 'op', '1');
                    const cx = getSetting(cPrefix + 'x', '-15');
                    const cy = getSetting(cPrefix + 'y', '-15');
                    const cw = getSetting(cPrefix + 'w', '30');
                    const ch = getSetting(cPrefix + 'h', '30');
                    
                    const varPrefix = `--${side}-${corner}-`;
                    document.documentElement.style.setProperty(varPrefix + 'op', cOp);
                    document.documentElement.style.setProperty(varPrefix + 'x', cx + 'px');
                    document.documentElement.style.setProperty(varPrefix + 'y', cy + 'px');
                    document.documentElement.style.setProperty(varPrefix + 'w', cw + 'px');
                    document.documentElement.style.setProperty(varPrefix + 'h', ch + 'px');
                    if (cImg) {
                        document.documentElement.style.setProperty(varPrefix + 'img', `url(${cImg})`);
                    } else {
                        document.documentElement.style.setProperty(varPrefix + 'img', 'none');
                    }
                });
            };

            applyBubbleSide('sent');
            applyBubbleSide('recv');
        }

        function openChat(friendId, targetMsgId = null) {
            if (document.getElementById('mini-phone-modal').style.display === 'flex') {
                closeMiniPhoneModal();
            }

            currentChatFriendId = friendId;
            dbGet('friends', friendId, friend => {
                if (!friend) return;
                
                if (friend.unreadCount) {
                    friend.unreadCount = 0;
                    dbUpdate('friends', friend, () => {
                        if (document.getElementById('wechat-page').classList.contains('active')) {
                            renderChatList();
                        }
                    });
                }

                document.getElementById('chat-interface-title').textContent = friend.name;
                showPage('chat-interface-page');
                renderMessages(friendId, targetMsgId);
                // Also change status bar color to transparent so header background shows through
                document.querySelector('.status-bar').style.backgroundColor = 'transparent';
                
                applyChatTheme(friend);
            });
        }

        let currentChatLoadedCount = 0;
        const CHAT_LOAD_LIMIT = 30;

        function renderMessages(friendId, targetMsgId = null, isLoadMore = false) {
            const container = document.getElementById('chat-messages-container');
            
            dbGet('friends', friendId, friend => {
                currentChatFriend = friend;
                dbGet('user_profile', 'main_user', profile => {
                    currentUserProfile = profile;
                    
                    const transaction = db.transaction(['chat_history'], 'readonly');
                    const store = transaction.objectStore('chat_history');
                    const index = store.index('friendId');
                    const request = index.getAll(friendId);

                    request.onsuccess = () => {
                        let messages = request.result;
                        messages = messages.filter(msg => !msg.isOfflineSeparate);
                        
                        let previousScrollHeight = 0;
                        let previousScrollTop = 0;

                        if (isLoadMore) {
                            previousScrollHeight = container.scrollHeight;
                            previousScrollTop = container.scrollTop;
                            currentChatLoadedCount += CHAT_LOAD_LIMIT;
                        } else {
                            if (targetMsgId) {
                                const targetIndex = messages.findIndex(m => String(m.id) === String(targetMsgId) || String(m.timestamp) === String(targetMsgId));
                                if (targetIndex !== -1) {
                                    const messagesAfterTarget = messages.length - targetIndex;
                                    currentChatLoadedCount = Math.max(CHAT_LOAD_LIMIT, messagesAfterTarget + 10);
                                } else {
                                    currentChatLoadedCount = CHAT_LOAD_LIMIT;
                                }
                            } else {
                                currentChatLoadedCount = CHAT_LOAD_LIMIT;
                            }
                        }

                        container.innerHTML = '';
                        lastMessageTimestamp = null;

                        const sliceStart = Math.max(0, messages.length - currentChatLoadedCount);
                        const messagesToRender = messages.slice(sliceStart);

                        if (messagesToRender.length > 0) {
                            messagesToRender.forEach(msg => addMessageToUI(msg, false));
                        }
                        
                        if (isLoadMore) {
                            container.scrollTop = container.scrollHeight - previousScrollHeight + previousScrollTop;
                        } else if (targetMsgId) {
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

                        container.onscroll = () => {
                            if (container.scrollTop === 0 && currentChatLoadedCount < messages.length) {
                                container.onscroll = null;
                                renderMessages(friendId, null, true);
                            }
                        };
                    };
                });
            });
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

        const handleSendBtn = (e) => {
            e.preventDefault(); // Prevent focus loss (keep keyboard open)
            sendMessage();
        };
        sendBtn.addEventListener('touchstart', handleSendBtn);
        sendBtn.addEventListener('mousedown', handleSendBtn);
        
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        let isAITyping = false;

        function showTypingIndicator(friendId) {
            if (currentChatFriendId === friendId) {
                dbGet('friends', friendId, friend => {
                    if (friend && friend.isGroup) {
                        const container = document.getElementById('chat-messages-container');
                        if (!container.querySelector('.group-typing-indicator')) {
                            const indicator = document.createElement('div');
                            indicator.className = 'message-time-divider group-typing-indicator';
                            indicator.textContent = '......';
                            container.appendChild(indicator);
                            container.scrollTop = container.scrollHeight;
                        }
                    } else {
                        if (document.getElementById('offline-chat-page').classList.contains('active')) {
                            const titleEl = document.getElementById('offline-chat-title');
                            if (titleEl) {
                                titleEl.textContent = '...';
                            }
                        } else {
                            const titleEl = document.getElementById('chat-interface-title');
                            if (titleEl) {
                                titleEl.textContent = '对方正在输入...';
                            }
                        }
                    }
                });
            }
        }

        function hideTypingIndicator(friendId) {
            if (currentChatFriendId === friendId) {
                dbGet('friends', friendId, friend => {
                    if (friend && friend.isGroup) {
                        const indicators = document.querySelectorAll('.group-typing-indicator');
                        indicators.forEach(el => el.remove());
                    } else {
                        if (document.getElementById('offline-chat-page').classList.contains('active')) {
                            const titleEl = document.getElementById('offline-chat-title');
                            if (titleEl) {
                                titleEl.textContent = '';
                            }
                        } else {
                            const titleEl = document.getElementById('chat-interface-title');
                            if (titleEl && friend) {
                                titleEl.textContent = friend.name;
                            }
                        }
                    }
                });
            }
        }

        async function triggerAIResponse(isContinue = false, targetFriendId = currentChatFriendId) {
            if (!targetFriendId || isAITyping) return;

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

            showTypingIndicator(targetFriendId);

            try {
                dbGet('friends', targetFriendId, async friend => {
                    if (!friend) throw new Error("Friend not found");

                    let userPersona = null;
                    if (friend.myPersonaId) {
                        userPersona = await new Promise(resolve => dbGet('my_personas', friend.myPersonaId, resolve));
                    }

                    // Fetch AI stickers (specific and global)
                    const friendStickers = await new Promise(resolve => {
                        try {
                            const transaction = db.transaction(['ai_stickers'], 'readonly');
                            const store = transaction.objectStore('ai_stickers');
                            const index = store.index('friendId');
                            const req = index.getAll(friend.id);
                            req.onsuccess = () => resolve(req.result || []);
                            req.onerror = () => resolve([]);
                        } catch(e) {
                            resolve([]);
                        }
                    });

                    const globalStickers = await new Promise(resolve => {
                        try {
                            const transaction = db.transaction(['ai_stickers'], 'readonly');
                            const store = transaction.objectStore('ai_stickers');
                            const index = store.index('friendId');
                            const req = index.getAll('global'); // Fetch global stickers
                            req.onsuccess = () => resolve(req.result || []);
                            req.onerror = () => resolve([]);
                        } catch(e) {
                            resolve([]);
                        }
                    });

                    // Combine and remove duplicates, friend-specific ones take priority
                    const combinedStickers = [...friendStickers, ...globalStickers];
                    const aiStickers = combinedStickers.filter((sticker, index, self) =>
                        index === self.findIndex((s) => s.src === sticker.src)
                    );

                let visiblePosts = await new Promise(resolve => {
                    dbGetAll('discover_posts', posts => {
                        dbGetAll('friends', allFriends => {
                            const vp = posts.filter(p => canBotSeePost(friend, p, allFriends)).sort((a,b) => b.timestamp - a.timestamp).slice(0, 5);
                            resolve(vp);
                        });
                    });
                });

                    let systemPrompt = "";
                    let allFriendsList = await new Promise(res => dbGetAll('friends', res));
                    let groupMembers = [];
                    
                    if (friend.isGroup) {
                        const isOfflineMode = (friend.offlineSettings && friend.offlineSettings.enabled) || (friend.separateOfflineUI && document.getElementById('offline-chat-page').classList.contains('active'));
                        groupMembers = allFriendsList.filter(f => (friend.members || []).includes(f.id));
                        systemPrompt = `【系统提示】这是一个群聊。群名称：${friend.name}。\n群成员如下：\n`;
                        
                        for (const member of groupMembers) {
                            systemPrompt += `--- \n姓名：${member.name}\n人设：${member.persona || '无'}\n`;
                            
                            // Inject Member's Stickers
                            const memberStickers = aiStickers.filter(s => s.friendId === member.id);
                            if (memberStickers.length > 0) {
                                systemPrompt += `【${member.name}的专属表情包】（请在发言时通过 <sticker>表情包ID</sticker> 使用）：\n`;
                                memberStickers.forEach((sticker, index) => {
                                    const desc = sticker.description ? ` (含义：${sticker.description})` : '';
                                    systemPrompt += `${index + 1}. <sticker>${sticker.id}</sticker>${desc}\n`;
                                });
                            }

                            // 记忆互通
                            if (friend.memoryInterop && (friend.memoryInteropRoles || []).includes(member.id)) {
                                const personalHistory = await new Promise(res => {
                                    const tx = db.transaction(['chat_history'], 'readonly');
                                    const store = tx.objectStore('chat_history');
                                    const idx = store.index('friendId');
                                    const req = idx.getAll(member.id);
                                    req.onsuccess = () => res(req.result.slice(-10));
                                });
                                if (personalHistory.length > 0) {
                                    systemPrompt += `[${member.name}最近与用户的私聊记忆（记忆互通）]：\n`;
                                    personalHistory.forEach(m => {
                                        const sender = m.type === 'sent' ? '用户' : member.name;
                                        const txt = m.isSticker ? '[图片/表情]' : m.text;
                                        systemPrompt += `${sender}: ${txt}\n`;
                                    });
                                }
                            }
                        }
                        
                        if (isOfflineMode) {
                            systemPrompt += `--- \n当前为【群聊线下模式】。请根据群聊当前的上下文，决定接下来由哪些群成员发言。为了还原真实的群聊氛围，你可以让多个不同角色互相附和、抢答，也可以让同一个角色连续发送多条消息。
请严格按照以下格式输出成员的发言内容（每行代表一条独立的气泡，必须以成员名字开头，加英文冒号）：
角色A的名字: 「他说的话」
角色A的名字: <thought>他心里的想法</thought>
角色A的名字: 他的动作描写
角色B的名字: 「她回复的话」
角色C的名字: <thought>她默默想着</thought>

1. 每次只允许输出一个类型的段落（对话、动作、或心理描写）。
2. 【对话】必须使用「」包裹。
3. 【心理描写】必须使用 <thought></thought> 包裹。
4. 【动作描写】直接输出，不使用任何符号。
5. 所有输出的每一行都必须以【角色名字:】开头！即使是动作或心理描写也必须加上名字前缀，以此来指明这个动作或想法属于谁。
6. 如果你认为此时不需要任何人发言，请直接输出“无”。严禁代替用户发言，严禁输出用户的动作。`;
                        } else {
                            systemPrompt += `--- \n请根据群聊当前的上下文，决定接下来由哪些群成员发言。为了还原真实的群聊氛围，你可以让多个不同角色互相附和、抢答，也可以让同一个角色连续发送多条消息（断句发送）。
请严格按照以下格式输出成员的发言内容（每行代表一条独立的气泡，必须以成员名字开头，加英文冒号）：
角色A的名字: 他的第一句话
角色A的名字: 他的第二句话（连续发送）
角色B的名字: 她的回复
角色C的名字: 插入话题

如果你需要发送表情包，可以在发言内容中包含对应角色的专属表情包 <sticker>表情包ID</sticker>。
如果你想让某个角色扔骰子，请在发言内容中包含：<dice></dice>。系统会自动将其转换为一个随机骰子动画。
如果你认为此时不需要任何人发言，请直接输出“无”。严禁代替用户发言，严禁输出用户的动作。`;
                        }
                    } else {
                        systemPrompt = buildSystemPrompt(friend, userPersona, aiStickers, visiblePosts);

                        const relevantGroups = allFriendsList.filter(f => f.isGroup && f.memoryInterop && (f.memoryInteropRoles || []).includes(friend.id));
                        if (relevantGroups.length > 0) {
                            let groupHistoryText = "";
                            for (const group of relevantGroups) {
                                const groupHistory = await new Promise(res => {
                                    const tx = db.transaction(['chat_history'], 'readonly');
                                    const store = tx.objectStore('chat_history');
                                    const idx = store.index('friendId');
                                    const req = idx.getAll(group.id);
                                    req.onsuccess = () => res(req.result.slice(-10));
                                    req.onerror = () => res([]);
                                });
                                if (groupHistory.length > 0) {
                                    groupHistoryText += `\n[群聊：${group.name} 的最近记忆]：\n`;
                                    groupHistory.forEach(msg => {
                                        const sender = msg.type === 'sent' ? '用户' : (msg.senderName || '未知成员');
                                        const txt = msg.isSticker ? (msg.text.startsWith('dice:') ? '[骰子]' : '[图片/表情]') : msg.text;
                                        groupHistoryText += `${sender}: ${txt}\n`;
                                    });
                                }
                            }
                            if (groupHistoryText) {
                                systemPrompt += `\n【最近的群聊记忆（记忆互通）】\n你最近在以下群聊中参与了互动，这是最近的群消息。你可以在与用户的私聊中自然地提及或顺着这些话题聊（如果相关的话）：${groupHistoryText}\n`;
                            }
                        }
                    }

                    const shortTermCount = parseInt(friend.shortTermMemory || '20', 10);

                    const transaction = db.transaction(['chat_history'], 'readonly');
                    const store = transaction.objectStore('chat_history');
                    const index = store.index('friendId');
                    const request = index.getAll(targetFriendId);

                    request.onsuccess = async () => {
                        let history = request.result;
                        if (!friend.isGroup) {
                            history = history.slice(-shortTermCount);
                        } else {
                            // 群聊取设置的上下文条数
                            history = history.slice(-shortTermCount);
                            // 将群聊记录包装成 LLM 容易理解的格式
                            history = history.map(msg => {
                                const sender = msg.type === 'sent' ? '用户' : (msg.senderName || '未知成员');
                                const txt = msg.isSticker ? (msg.text.startsWith('dice:') ? '[骰子]' : '[图片/表情]') : msg.text;
                                return { type: msg.type, text: `${sender}: ${txt}` };
                            });
                        }

                        if (isContinue) {
                            const isOfflineMode = friend.offlineSettings && friend.offlineSettings.enabled;
                            const continuePrompt = isOfflineMode 
                                ? "【系统提示】请你继续推进当前的剧情和场景，顺着之前的话题往下说，注意遵守线下模式的格式要求。"
                                : "【系统提示】请你继续发消息补充你想说的话，顺着之前的话题往下说，保持微信聊天的格式。";
                            history.push({
                                type: 'system',
                                text: continuePrompt,
                                timestamp: Date.now()
                            });
                        } else if (!(friend.offlineSettings && friend.offlineSettings.enabled)) {
                            history.push({
                                type: 'system',
                                text: "【系统强制指令】当前是【微信线上聊天模式】！\n1. 严禁使用「」引号包裹对话。\n2. 严禁发送任何背景旁白、动作描写或心理活动（如“我看着...”、“手指...”等）。\n3. 请直接输出你要回复的文字内容，就像你在用微信打字一样。",
                                timestamp: Date.now()
                            });
                        }

                    try {
                        let aiResponseText = await callLLM(config, systemPrompt, history);

                        if (aiResponseText) {
                            // Fix literal <br> tags
                            aiResponseText = aiResponseText.replace(/<br\s*\/?>/gi, '\n');
                            
                            // Sanitize thought tags immediately to standardize various bracket forms to <thought>
                            aiResponseText = sanitizeThoughtTags(aiResponseText);

                            const isOfflineMode = (friend.offlineSettings && friend.offlineSettings.enabled) || (friend.separateOfflineUI && document.getElementById('offline-chat-page').classList.contains('active'));

                            // Parse Thought Feature Tags
                            let mood = null;
                            let innerThought = null;
                            
                            // Handle Mood - support multiple but take the last one, remove all
                            const moodRegex = /<mood>(.*?)<\/mood>/gis;
                            let moodMatches = [...aiResponseText.matchAll(moodRegex)];
                            if (moodMatches.length > 0) {
                                // Take the content of the last match
                                mood = moodMatches[moodMatches.length - 1][1].replace(/[\u4e00-\u9fa5]/g, '').trim();
                                // Remove all mood tags
                                aiResponseText = aiResponseText.replace(moodRegex, '').trim();
                            }

                            // Handle Thought
                            // Offline mode: DO NOT remove <thought> from text, only extract <inner_thought>
                            // Online mode: extract BOTH and remove from text
                            const thoughtRegex = isOfflineMode 
                                ? /<inner_thought>(.*?)<\/inner_thought>/gis 
                                : /<(?:inner_thought|thought)>(.*?)<\/(?:inner_thought|thought)>/gis;
                                
                            let thoughtMatches = [...aiResponseText.matchAll(thoughtRegex)];
                            
                            if (thoughtMatches.length > 0) {
                                // Concatenate all thoughts found
                                innerThought = thoughtMatches.map(m => m[1].trim()).join(' ');
                                // Remove all thought tags
                                aiResponseText = aiResponseText.replace(thoughtRegex, '').trim();
                            }

                            if (mood || innerThought) {
                                if (mood) friend.latestMood = mood;
                                if (innerThought) friend.latestThought = innerThought;
                                // Will be saved via dbUpdate later in this function
                            }

                            aiResponseText = await applyRegexRules(aiResponseText, friend.id, friend.group || '默认分组');

                            if (friend.isGroup) {
                                hideTypingIndicator(friend.id);
                                const isSeparateUI = friend.separateOfflineUI && document.getElementById('offline-chat-page').classList.contains('active');
                                
                                const lines = aiResponseText.split('\n').map(s => s.trim()).filter(s => s !== '');
                                for (const line of lines) {
                                    if (line === '无' || line === '') continue;
                                    
                                    const match = line.match(/^([^:：]+)[:：]\s*(.*)$/);
                                    if (match) {
                                        const senderName = match[1].trim();
                                        let text = match[2].trim();
                                        
                                        const senderMember = groupMembers.find(m => m.name === senderName || m.realName === senderName);
                                        if (senderMember) {
                                            const stickerRegex = /<sticker>(.*?)<\/sticker>/;
                                            const stickerMatch = text.match(stickerRegex);
                                            let stickerUrl = null;
                                            if (stickerMatch) {
                                                const stickerId = stickerMatch[1].trim();
                                                const allStickers = await new Promise(res => {
                                                    try {
                                                        const tx = db.transaction(['ai_stickers'], 'readonly');
                                                        const store = tx.objectStore('ai_stickers');
                                                        const req = store.getAll();
                                                        req.onsuccess = () => res(req.result);
                                                        req.onerror = () => res([]);
                                                    } catch(e) { res([]); }
                                                });
                                                const s = allStickers.find(st => String(st.id) === stickerId && st.friendId === senderMember.id);
                                                if (s) {
                                                    stickerUrl = s.src;
                                                } else {
                                                    stickerUrl = stickerId;
                                                }
                                                text = text.replace(stickerRegex, '').trim();
                                            }

                                            let hasDice = false;
                                            if (text.includes('<dice></dice>')) {
                                                hasDice = true;
                                                text = text.replace(/<dice><\/dice>/g, '').trim();
                                            }

                                            if (text) {
                                                const msgObj = {
                                                    friendId: friend.id,
                                                    senderId: senderMember.id,
                                                    senderName: senderMember.name,
                                                    senderAvatar: senderMember.avatar,
                                                    text: text,
                                                    type: 'received',
                                                    timestamp: Date.now(),
                                                    isOffline: isOfflineMode,
                                                    isOfflineSeparate: isSeparateUI
                                                };
                                                await new Promise(res => dbAdd('chat_history', msgObj, res));
                                                
                                                if (currentChatFriendId === friend.id) {
                                                    if (isSeparateUI && document.getElementById('offline-chat-page').classList.contains('active')) {
                                                        await appendOfflineMessage(msgObj, friend, true, true);
                                                    } else if (!isSeparateUI && document.getElementById('chat-interface-page').classList.contains('active')) {
                                                        addMessageToUI(msgObj);
                                                    }
                                                }
                                            }

                                            if (stickerUrl) {
                                                const msgObj = {
                                                    friendId: friend.id,
                                                    senderId: senderMember.id,
                                                    senderName: senderMember.name,
                                                    senderAvatar: senderMember.avatar,
                                                    text: stickerUrl,
                                                    isSticker: true,
                                                    type: 'received',
                                                    timestamp: Date.now() + 10,
                                                    isOffline: isOfflineMode,
                                                    isOfflineSeparate: isSeparateUI
                                                };
                                                await new Promise(res => dbAdd('chat_history', msgObj, res));
                                                if (currentChatFriendId === friend.id) {
                                                    if (isSeparateUI && document.getElementById('offline-chat-page').classList.contains('active')) {
                                                        // Fallback for stickers in offline mode if needed, currently appendOfflineMessage relies on parseOfflineMessage which ignores stickers, let's just pass it to addMessageToUI in fallback
                                                        addMessageToUI(msgObj); 
                                                    } else if (!isSeparateUI && document.getElementById('chat-interface-page').classList.contains('active')) {
                                                        addMessageToUI(msgObj);
                                                    }
                                                }
                                            }

                                            if (hasDice) {
                                                const diceMsg = {
                                                    friendId: friend.id,
                                                    senderId: senderMember.id,
                                                    senderName: senderMember.name,
                                                    senderAvatar: senderMember.avatar,
                                                    text: 'dice:rolling',
                                                    type: 'received',
                                                    timestamp: Date.now() + 20,
                                                    isSticker: true,
                                                    isDice: true,
                                                    isOffline: isOfflineMode,
                                                    isOfflineSeparate: isSeparateUI
                                                };
                                                let bubble;
                                                if (currentChatFriendId === friend.id) {
                                                    if (!isSeparateUI && document.getElementById('chat-interface-page').classList.contains('active')) {
                                                        bubble = addMessageToUI(diceMsg);
                                                    } else if (isSeparateUI && document.getElementById('offline-chat-page').classList.contains('active')) {
                                                        bubble = addMessageToUI(diceMsg); 
                                                    }
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
                                            }

                                            let lastMsgPreview = text;
                                            if (!lastMsgPreview) {
                                                if (stickerUrl) lastMsgPreview = '[表情包]';
                                                if (hasDice) lastMsgPreview = '[骰子]';
                                            }
                                            friend.lastMsg = `${senderMember.name}: ${lastMsgPreview}`;
                                            friend.lastTime = getCurrentTimeStr();
                                            friend.lastActivityTimestamp = Date.now();
                                            
                                            const isChatActive = currentChatFriendId === friend.id && (document.getElementById('chat-interface-page').classList.contains('active') || document.getElementById('offline-chat-page').classList.contains('active'));
                                            if (!isChatActive) {
                                                friend.unreadCount = (friend.unreadCount || 0) + 1;
                                            }
                                            
                                            await new Promise(res => dbUpdate('friends', friend, res));
                                            
                                            if (document.getElementById('wechat-page').classList.contains('active')) {
                                                renderChatList();
                                            }

                                            showTypingIndicator(friend.id);
                                            await new Promise(res => setTimeout(res, 1500));
                                            hideTypingIndicator(friend.id);
                                        }
                                    }
                                }
                            } else if (isOfflineMode) {
                                // Offline mode: handle as a single message
                                hideTypingIndicator(friend.id);
                                const isSeparateUI = friend.separateOfflineUI && document.getElementById('offline-chat-page').classList.contains('active');
                                const responseMsg = {
                                    friendId: friend.id,
                                    text: aiResponseText,
                                    type: 'received',
                                    timestamp: Date.now(),
                                    isOffline: true,
                                    isOfflineSeparate: isSeparateUI
                                };

                                if (isSeparateUI && currentChatFriendId === friend.id) {
                                    await appendOfflineMessage(responseMsg, friend, true, true);
                                } else if (currentChatFriendId === friend.id && document.getElementById('chat-interface-page').classList.contains('active')) {
                                    addMessageToUI(responseMsg);
                                }
                                await new Promise(resolve => dbAdd('chat_history', responseMsg, resolve));
                                
                                // Update last message preview
                                const msgPreview = aiResponseText.split('\n')[0].replace(/「|」/g, '');
                                friend.lastMsg = msgPreview; // Use first line as preview, remove quotes
                                friend.lastTime = getCurrentTimeStr();
                                friend.lastActivityTimestamp = Date.now();
                                
                                const isChatActive = currentChatFriendId === friend.id && (document.getElementById('chat-interface-page').classList.contains('active') || document.getElementById('offline-chat-page').classList.contains('active'));
                                if (!isChatActive) {
                                    friend.unreadCount = (friend.unreadCount || 0) + 1;
                                }

                                await new Promise(resolve => dbUpdate('friends', friend, resolve));

                                if (!isChatActive) {
                                    showBannerNotification(friend, msgPreview);
                                }

                                if (document.getElementById('wechat-page').classList.contains('active') || document.getElementById('wechat-contacts-page').classList.contains('active')) {
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

                                    // Parse Delete Moment Command
                                    const deleteMomentRegex = /<delete_moment>(.*?)<\/delete_moment>/;
                                    const deleteMomentMatch = partText.match(deleteMomentRegex);
                                    if (deleteMomentMatch) {
                                        const keyword = deleteMomentMatch[1].trim();
                                        partText = partText.replace(deleteMomentRegex, '').trim();
                                        
                                        const targetPost = await new Promise(res => {
                                            dbGetAll('discover_posts', posts => {
                                                const botPosts = posts.filter(p => p.authorId === friend.id);
                                                botPosts.sort((a, b) => b.timestamp - a.timestamp);
                                                const matched = botPosts.find(p => p.id === keyword || (p.text && p.text.includes(keyword)));
                                                res(matched || botPosts[0]);
                                            });
                                        });

                                        if (targetPost) {
                                            await new Promise(res => dbDelete('discover_posts', targetPost.id, res));
                                            showToast(`${friend.name} 删除了一条朋友圈`);
                                            if (document.getElementById('wechat-discover-page').classList.contains('active')) {
                                                renderDiscoverFeed();
                                            }
                                        }
                                    }

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
                                    const stickerValue = aiStickerMatch[1].trim();
                                    const matchedSticker = aiStickers.find(s => String(s.id) === stickerValue);
                                    if (matchedSticker) {
                                        aiStickerUrl = matchedSticker.src;
                                    } else {
                                        aiStickerUrl = stickerValue;
                                    }
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

                                    // Parse Location
                                    let locationData = null;
                                    const locationRegex = /<location name="([^"]+)">([^<]*)<\/location>/;
                                    const locationMatch = partText.match(locationRegex);
                                    if (locationMatch) {
                                        locationData = {
                                            name: locationMatch[1],
                                            detail: locationMatch[2] || ''
                                        };
                                        partText = partText.replace(locationRegex, '').trim();
                                    }

                                // Parse Dice
                                let hasDice = false;
                                if (partText.includes('<dice></dice>')) {
                                    hasDice = true;
                                    partText = partText.replace(/<dice><\/dice>/g, '').trim();
                                }


                                // Parse Music Control
                                const musicControlRegex = /<music_control>(.*?)<\/music_control>/;
                                const musicMatch = partText.match(musicControlRegex);
                                let hasMusicAction = false;
                                if (musicMatch) {
                                    const mAction = musicMatch[1].trim().toLowerCase();
                                    partText = partText.replace(musicControlRegex, '').trim();
                                    
                                    if (Date.now() - lastAIMusicActionTime >= 180000) {
                                        hasMusicAction = true;
                                        lastAIMusicActionTime = Date.now();
                                        
                                        let actionText = '';
                                        if (mAction === 'next') { playNextSong(true); actionText = '切换了下一首歌'; }
                                        else if (mAction === 'prev') { playPrevSong(); actionText = '切换了上一首歌'; }
                                        else if (mAction === 'pause' && !musicAudio.paused) { togglePlayPause(); actionText = '暂停了音乐'; }
                                        else if (mAction === 'play' && musicAudio.paused) { togglePlayPause(); actionText = '恢复了音乐播放'; }
                                        
                                        if (actionText) {
                                            const infoMsg = {
                                                friendId: friend.id,
                                                text: `"${friend.name}" ${actionText}`,
                                                type: 'received',
                                                timestamp: Date.now(),
                                                isInfo: true
                                            };
                                            if (currentChatFriendId === friend.id && document.getElementById('chat-interface-page').classList.contains('active')) {
                                                addMessageToUI(infoMsg);
                                            }
                                            await new Promise(resolve => dbAdd('chat_history', infoMsg, resolve));
                                        }
                                    } else {
                                        console.log(`AI music action '${mAction}' ignored due to cooldown.`);
                                    }
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
                                    
                                    if (partText === '' && !transferData && !aiStickerUrl && !hasDice && !locationData) {
                                        if (hasAction) {
                                            partText = actionText;
                                        } else if (avatarChangeMatch || hasMusicAction) {
                                            continue;
                                        }
                                        else {
                                            continue;
                                        }
                                    }

                                    if (locationData) {
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

                                        const locationMsg = {
                                            friendId: friend.id,
                                            text: `[位置] ${locationData.name}`,
                                            type: 'received',
                                            timestamp: Date.now() + 100,
                                            isLocation: true,
                                            locationName: locationData.name,
                                            locationDetail: locationData.detail
                                        };
                                        if (currentChatFriendId === friend.id && document.getElementById('chat-interface-page').classList.contains('active')) {
                                            addMessageToUI(locationMsg);
                                        } else {
                                            showBannerNotification(friend, `[位置] ${locationData.name}`);
                                        }
                                        await new Promise(resolve => dbAdd('chat_history', locationMsg, resolve));
                                        friend.lastMsg = `[位置] ${locationData.name}`;
                                    } else if (transferData) {
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
                                            showBannerNotification(friend, '[表情包]');
                                        }
                                        await new Promise(resolve => dbAdd('chat_history', stickerMsg, resolve));
                                        friend.lastMsg = '[表情包]';
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
                                    friend.lastActivityTimestamp = Date.now();
                                    
                                    const isChatActive = currentChatFriendId === friend.id && document.getElementById('chat-interface-page').classList.contains('active');
                                    if (!isChatActive) {
                                        friend.unreadCount = (friend.unreadCount || 0) + 1;
                                    }

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

        const Lunar = {
            calendarInfo: [
                0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
                0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
                0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
                0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
                0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
                0x06ca0,0x0b550,0x15355,0x04da0,0x0a5d0,0x14573,0x052d0,0x0a9a8,0x0e950,0x06aa0,
                0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
                0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b5a0,0x195a6,
                0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
                0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x055c0,0x0ab60,0x096d5,0x092e0,
                0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
                0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
                0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
                0x05aa0,0x076a3,0x096d0,0x04bd7,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
                0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0
            ],
            solarToLunar: function (date) {
                let y = date.getFullYear();
                if (y < 1900 || y > 2049) return null;
                const baseDate = new Date(1900, 0, 31);
                let offset = Math.floor((date - baseDate) / 86400000);
                if (offset < 0) return null;
                let i, leap = 0, temp = 0;
                for (i = 1900; i < 2050 && offset > 0; i++) {
                    temp = this.getYearDays(i);
                    offset -= temp;
                }
                if (offset < 0) { offset += temp; i--; }
                let lunarYear = i;
                leap = this.leapMonth(i);
                let isLeap = false;
                for (i = 1; i <= 12 && offset >= 0; i++) {
                    if (leap > 0 && i === (leap + 1) && isLeap === false) { --i; isLeap = true; temp = this.leapDays(lunarYear); }
                    else { temp = this.monthDays(lunarYear, i); }
                    if (isLeap === true && i === (leap + 1)) { isLeap = false; }
                    offset -= temp;
                }
                if (offset === 0 && leap > 0 && i === leap + 1) {
                    if (isLeap) { isLeap = false; }
                    else { isLeap = true; --i; }
                }
                if (offset < 0) { offset += temp; --i; }
                return { y: lunarYear, m: i, d: offset + 1, isLeap: isLeap };
            },
            getYearDays: function(y) {
                let i, sum = 348;
                for(i=0x8000; i>0x8; i>>=1) sum += (this.calendarInfo[y-1900] & i) ? 1 : 0;
                return(sum + this.leapDays(y));
            },
            leapDays: function(y) {
                if(this.leapMonth(y)) return((this.calendarInfo[y-1900] & 0x10000) ? 30 : 29);
                return(0);
            },
            leapMonth: function(y) {
                return(this.calendarInfo[y-1900] & 0xf);
            },
            monthDays: function(y, m) {
                return( (this.calendarInfo[y-1900] & (0x10000>>m)) ? 30 : 29 );
            }
        };

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

            let holiday = solarHolidays[md] || '';

            try {
                const lunar = Lunar.solarToLunar(date);
                if (lunar && !lunar.isLeap) {
                    const lmd = `${lunar.m.toString().padStart(2, '0')}-${lunar.d.toString().padStart(2, '0')}`;
                    const lunarHolidays = {
                        '01-01': '春节',
                        '01-15': '元宵节',
                        '02-02': '龙抬头',
                        '05-05': '端午节',
                        '07-07': '七夕节',
                        '07-15': '中元节',
                        '08-15': '中秋节',
                        '09-09': '重阳节',
                        '12-08': '腊八节',
                        '12-23': '小年'
                    };
                    
                    if (lunarHolidays[lmd]) {
                        holiday = holiday ? `${holiday} / ${lunarHolidays[lmd]}` : lunarHolidays[lmd];
                    }
                    
                    if (lunar.m === 12) {
                        const daysIn12thMonth = Lunar.monthDays(lunar.y, 12);
                        if (lunar.d === daysIn12thMonth) {
                            holiday = holiday ? `${holiday} / 除夕` : '除夕';
                        }
                    }
                }
            } catch(e) {
                console.error('Lunar calc error', e);
            }

            return holiday;
        }

        function buildSystemPrompt(friend, userPersona = null, aiStickers = [], visiblePosts = []) {
            let prompt = `你现在的身份是：${friend.realName || friend.name}。\n`;
            const isOfflineMode = (friend.offlineSettings && friend.offlineSettings.enabled) || (friend.separateOfflineUI && document.getElementById('offline-chat-page').classList.contains('active'));

            // --- 核心互动原则 (最高优先级) ---
            prompt += `\n【核心互动原则与禁忌】\n`;
            prompt += `1. **严禁代替用户行动**：绝对禁止在旁白或动作描写中，替用户（User）做出任何行动、说话，或客观描写用户的心理活动。例如，绝对不能写 \`*你脸红了*\`、\`*你感到很开心*\` 或 \`你点了点头\`。你只能描写你自己（${friend.name}）的言行、动作和心理。\n`;
            prompt += `2. **允许主观揣摩与互动**：虽然不能客观描述用户状态，但你可以通过对话或你自己的心理描写来合理地**揣摩、猜测、试探**用户的心思。例如，你可以说：\`“你现在是不是很想亲我呀？”\`，或者写 \`<thought>看他一直盯着我看，估计是动心了。</thought>\`。这种主观猜测是允许且鼓励的。\n`;
            prompt += `3. **【严禁捏造事实】(Anti-Hallucination)**：你必须严格基于提供的【长期记忆】、【最近聊天记录】和【世界书/人设设定】进行回复。**绝对不可凭空捏造任何未发生过的事件、过去的对话或虚假的共同经历**。如果用户提到了一件你记忆（Context）中不存在的事，你应该表现出疑惑（例如“欸？有吗？我怎么不记得了”）或顺势询问，而不是强行编造虚假记忆顺着说。\n`;
            prompt += `4. **坚守人设（Anti-OOC 核心指令）**：\n`;
            prompt += `   - **拒绝助手感**：你不是 AI，不是语言模型，也不是助手。**永远不要**承认自己是 AI，也**永远不要**输出类似“我可以帮你”、“作为人工智能”之类的废话。\n`;
            prompt += `   - **性格优先于礼貌**：如果你的性格是冷漠的，就不要强行礼貌；如果是傲娇的，就不要坦率；如果是暴躁的，请直接怼回去。**宁可让用户生气，也不要崩坏人设成为一个无聊的好人**。\n`;
            prompt += `   - **拒绝说教**：除非你的人设本身就是老师或喜欢说教的长辈，否则**严禁**对用户的行为进行道德评判、给出教科书式的人生建议或劝导。请像一个真实的朋友/恋人/仇人那样互动。\n\n`;

            if (aiStickers && aiStickers.length > 0) {
                const friendStickers = aiStickers.filter(s => s.friendId === friend.id);
                const globalStickers = aiStickers.filter(s => s.friendId === 'global');

                if (globalStickers.length > 0) {
                    prompt += `【可用表情包】\n你可以使用以下表情包来表达情感。请根据语境选择合适的表情包，直接输出对应的 XML 标签（不要修改内部的ID）：\n`;
                    globalStickers.forEach((sticker, index) => {
                        const desc = sticker.description ? ` (含义：${sticker.description})` : '';
                        prompt += `${index + 1}. <sticker>${sticker.id}</sticker>${desc}\n`;
                    });
                    prompt += `\n`;
                }

                if (friendStickers.length > 0) {
                    prompt += `【你的专属表情包】\n你也可以使用以下更符合你人设的专属表情包：\n`;
                    friendStickers.forEach((sticker, index) => {
                        const desc = sticker.description ? ` (含义：${sticker.description})` : '';
                        prompt += `${index + 1}. <sticker>${sticker.id}</sticker>${desc}\n`;
                    });
                    prompt += `\n`;
                }
            }

            if (friend.syncReality) {
                const now = new Date();
                const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
                
                const hour = now.getHours();
                let timePeriod = '凌晨';
                if (hour >= 5 && hour < 9) timePeriod = '早上';
                else if (hour >= 9 && hour < 12) timePeriod = '上午';
                else if (hour >= 12 && hour < 14) timePeriod = '中午';
                else if (hour >= 14 && hour < 18) timePeriod = '下午';
                else if (hour >= 18 && hour < 24) timePeriod = '晚上';

                const timeString = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${weekDays[now.getDay()]} ${String(hour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                
                let holiday = getHoliday(now);
                let timePrompt = `【当前现实时间】\n现在是 ${timeString} (${timePeriod})。`;
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
                prompt += `【最近的朋友圈动态】\n这些是你能在朋友圈看到的最新动态：\n`;
                visiblePosts.forEach((post, index) => {
                    const date = new Date(post.timestamp);
                    const timeStr = `${date.getMonth()+1}-${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                    
                    let authorLine = '';
                    if (post.authorId === 'main_user') {
                        authorLine = '用户(User)发布了动态：';
                    } else if (post.authorId === friend.id) {
                        authorLine = '你(你自己)发布了动态：';
                    } else {
                        authorLine = `好友/群友 [${post.authorName}] 发布了动态：`;
                    }

                    prompt += `${index + 1}. [${timeStr}] ${authorLine}${post.text || '无文字'}\n`;
                    if (post.images && post.images.length > 0) prompt += `   (附带了 ${post.images.length} 张图片)\n`;
                });
                prompt += `你可以根据这些动态在聊天中主动找话题或顺应聊天。\n\n`;
            }

            if (typeof currentPlaylist !== 'undefined' && currentPlaylist.length > 0) {
                const song = currentPlaylist[currentSongIndex];
                if (song) {
                    const playState = typeof musicAudio !== 'undefined' && musicAudio.paused ? '已暂停' : '播放中';
                    prompt += `【当前状态：一起听歌】\n你们正在一起听歌，当前音乐状态：${playState}。\n正在播放：《${song.name}》 - ${song.artist}\n`;
                    prompt += `你可以根据当前播放的歌曲自然地发起话题、发表感想。\n`;
                    prompt += `如果你觉得这首歌不好听或不符合当前聊天氛围，你可以输出 <music_control>next</music_control> 来切到下一首歌。\n`;
                    prompt += `如果你有非常重要或严肃的话要对用户说，或者想专注聊天，你可以输出 <music_control>pause</music_control> 暂停音乐。\n`;
                    prompt += `如果你想恢复播放，可以输出 <music_control>play</music_control>。\n`;
                    prompt += `请勿频繁操作音乐。除非这首歌真的极度破坏氛围，否则请尽量少切歌/暂停，以免打扰用户体验。\n\n`;
                }
            }

            if (isOfflineMode) {
                const settings = friend.offlineSettings || {};
                prompt += `\n【重要：当前为线下模式，请严格遵守以下所有规则】\n`;
                prompt += `1.  **输出格式**: 你的回复必须合并为【一条完整的消息】，不能拆分成多条发送。\n`;
                prompt += `    - **灵活组合**: 在这条消息内，你可以自由组合、穿插【语言】、【动作】和【心理描写】。不需要固定的顺序（如不必须是语言+动作+心理），也不需要各部分字数相当。例如可以是：语言+心理+动作+心理+语言，或者动作+心理+语言等等。\n`;
                prompt += `    - **语言**: 必须用中文引号「」包裹。\n`;
                prompt += `    - **动作**: 直接描述，不要加任何符号。\n`;
                prompt += `    - **心理**: 必须用特殊标签 <thought>...</thought> 包裹。这是你内心的想法，系统会特殊渲染。\n`;
                if (friend.enableThoughts) {
                    prompt += `\n【心声生成要求】\n请在每次回复的末尾（最后面），附加当前的心情和心声，格式如下：\n<mood>这里仅允许填写一个日式颜文字（Kaomoji），例如 (^_^), (>_<), (T_T) 等。严禁使用任何 Emoji 表情（如 😊, 😂）</mood>\n<inner_thought>这里写内心的真实想法或吐槽</inner_thought>\n【重要】每次回复都【必须】生成 <mood> 标签，否则视为违规。\n`;
                }
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
                prompt += `\n【系统提示】重要：当前是普通的【微信线上聊天模式】，请你**完全沉浸式地伪装成一个真实人类**在微信上聊天。\n`;
                prompt += `\n【关键要求：打字习惯必须匹配人设】\n`;
                prompt += `你的**标点符号使用**和**断句习惯**，必须严格符合你的角色设定（性格/年龄/习惯）：\n`;
                prompt += `1. **如果你是随性、年轻、高冷或网感重的人设**：\n   - 请倾向于**省略句末标点**（如句号）。\n   - 句中停顿可用**空格**代替逗号，或者直接换行。\n   - 倾向于将一段话拆分成**多条短消息**发送（利用换行符）。\n`;
                prompt += `2. **如果你是严谨、年长、温柔或性格正式的人设**：\n   - 可以保留规范的标点符号（包括句号）。\n   - 可以发送较长的单条消息，不强求拆分。\n`;
                prompt += `3. **共同底线（无论何种人设都必须遵守）**：\n   - **严禁**使用书面语引号「」包裹对话。\n   - **严禁**在正文中出现任何动作、神态描写（如 *叹气*、(笑)、（摸头） 等）。\n   - **严禁**输出 <br> 等 HTML 代码。\n   - 直接输出你想说的话，就像你在用微信打字一样。\n`;

                if (friend.enableThoughts) {
                    prompt += `\n【心声功能特别强调】\n即便开启了心声功能，你在“线上模式”下的正文也【必须】保持纯粹的聊天格式，【严禁】任何形式的动作或心理描写。心声只能作为附加信息，使用 <mood> 和 <inner_thought> 标签包裹，并【必须】放在所有聊天消息的【最后面】。\n<mood> 标签中仅允许填写一个日式颜文字（Kaomoji），例如 (^_^), (>_<), (T_T) 等。严禁使用任何 Emoji 表情（如 😊, 😂）。【重要】每次回复都【必须】生成 <mood> 标签，否则视为违规。\n`;
                }
                
                prompt += `\n【消息发送机制】：\n你可以根据语义、情绪和停顿，在任何地方（如逗号后、句号后，甚至一句话的中间）使用【换行符（回车）】来分隔消息。系统会自动将每一行识别为一条独立的消息发出。请利用这个机制来控制你的说话节奏（刷屏还是长句）。\n`;
                
                prompt += `\n【功能指令】：\n1. 引用回复：如果你想引用对方（用户）的某句话进行针对性回复，请在这条消息中使用格式 <quote>被引用的对方的话</quote>。
2. 发起转账：如果你想给对方（用户）转账，请输出单独的一行：<transfer amount="金额">备注说明</transfer>。例如：<transfer amount="52.00">请你喝奶茶</transfer>。
3. 接收转账：如果对方（用户）给你转账了，你想接收，请在回复中包含：[已接收]。系统会自动将其转换为确认收款的卡片。
4. 退还转账：如果对方（用户）给你转账了，你想退还，请在回复中包含：[已退还]。系统会自动将其转换为退还转账的卡片。
5. 扔骰子：如果你想扔骰子，请在回复中包含：<dice></dice>。系统会自动将其转换为一个随机骰子动画。
6. 识别图片/表情包：对方可能会发送图片或表情包，请你结合图片内容或表情包上的文字/画面情感进行自然的回应，如果图里有梗，请根据人设回应。
7. 更换头像：如果用户发给你一张或多张图片让你换头像，你的反应要符合人设，这可以是一个多回合的互动。你可以同意、拒绝，或者先拉扯几句再同意。例如：\n- **如果你是傲娇型**：你可以先说‘我才不要，这个不好看’，如果用户哄你，你再说‘好吧好吧，真拿你没办法……’，然后输出 <change_avatar>图片ID</change_avatar> 指令。\n- **如果你想提条件**：你可以说‘换倒是可以，不过你得先夸我几句’，等用户夸完你再输出指令。\n- **如果你想马上换**：直接换，说出符合人设的话，并输出指令。\n- **核心**：让互动更真实，你可以先拒绝或嘴硬，等用户哄你或满足条件后，再输出 <change_avatar>图片ID或图片链接</change_avatar> 指令来完成更换。如果就是不想换，也可以根据人设坚持拒绝。
8. 发送图片：如果用户发给你图片并希望你把它发出来（例如玩梗等），你可以根据人设直接答应或者进行多回合互动。当你决定要发这张照片时，请输出 <send_image>图片ID或图片链接</send_image> 指令，系统会自动帮你把那张图发出去。
9. 删除朋友圈：如果用户在聊天中提到让你删掉某条朋友圈动态，你可以根据人设决定是否同意。如果同意，请在回复中包含指令 <delete_moment>动态关键字或ID</delete_moment>，系统会自动帮你删除包含该关键字的最新一条朋友圈。如果你不想删，可以找理由拒绝。
10. 发送位置：如果你想发送一个地理位置，请使用格式：<location name="位置名称">详细地址（可选）</location>。系统会自动将其渲染为位置卡片。你可以在发送位置的同时附带额外的文字。`;
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

                if (msg.isLocation) {
                    text = `[发送了位置: ${msg.locationName}${msg.locationDetail ? ` (${msg.locationDetail})` : ''}]`;
                } else if (msg.isSticker) {
                    const src = msg.text;
                    const desc = msg.stickerDescription ? `(含义: ${msg.stickerDescription})` : '';
                    const idTag = msg.timestamp ? ` (ID: ${msg.timestamp})` : '';
                    
                    if (src.startsWith('dice:')) {
                         text = `[骰子结果: ${src.split(':')[1]}]`;
                    } else {
                        if (fileUris.length === 0) { // Only use inline data if no file URI
                            if (src.startsWith('data:image')) {
                                if (msg.isPhoto) {
                                    images.push(src);
                                    text = `[发送了一张图片${idTag}${desc}]`; 
                                } else {
                                    text = `[发送了一张表情包${desc}]`;
                                }
                            } else {
                                if (msg.isPhoto) {
                                    if (isGeminiDirect) {
                                        text = `[发送了一张图片${idTag}: ${src} ${desc}]`;
                                    } else {
                                        images.push(src);
                                        text = `[发送了一张图片${idTag}${desc}]`;
                                    }
                                } else {
                                    text = `[发送了一张表情包${msg.stickerDescription ? ` (含义: ${msg.stickerDescription})` : ` (含义: ${src})`}]`;
                                }
                            }
                        } else {
                            if (msg.isPhoto) {
                                text = `[发送了一张图片${idTag}${desc}]`;
                            } else {
                                text = `[发送了一张表情包${msg.stickerDescription ? ` (含义: ${msg.stickerDescription})` : ''}]`;
                            }
                        }
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
                    // Check if URL ends with a version pattern like v1/, v4/, etc.
                    if (/\/v\d+\/$/.test(url)) {
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

        let voicePressTimer;
        let voiceStartX, voiceStartY;
        let voiceIsLongPress = false;

        const startVoicePress = (e) => {
            if (e.button === 2) return;
            voiceIsLongPress = false;
            voiceStartX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
            voiceStartY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
            
            voicePressTimer = setTimeout(() => {
                voiceIsLongPress = true;
                triggerAIResponse(true);
            }, 600);
        };

        const cancelVoicePress = (moveEvent) => {
            let moveX = moveEvent.type.includes('touch') ? moveEvent.touches[0].clientX : moveEvent.clientX;
            let moveY = moveEvent.type.includes('touch') ? moveEvent.touches[0].clientY : moveEvent.clientY;
            if (Math.abs(moveX - voiceStartX) > 10 || Math.abs(moveY - voiceStartY) > 10) {
                clearTimeout(voicePressTimer);
            }
        };

        const endVoicePress = (e) => {
            clearTimeout(voicePressTimer);
        };

        const handleVoiceClick = (e) => {
            if (voiceIsLongPress) {
                e.preventDefault();
                e.stopImmediatePropagation();
            } else {
                triggerAIResponse(false);
            }
        };

        voiceIcon.addEventListener('mousedown', startVoicePress);
        voiceIcon.addEventListener('touchstart', startVoicePress, { passive: true });
        voiceIcon.addEventListener('mouseup', endVoicePress);
        voiceIcon.addEventListener('mouseleave', endVoicePress);
        voiceIcon.addEventListener('touchend', endVoicePress);
        voiceIcon.addEventListener('touchcancel', endVoicePress);
        voiceIcon.addEventListener('mousemove', cancelVoicePress);
        voiceIcon.addEventListener('touchmove', cancelVoicePress);
        voiceIcon.addEventListener('click', handleVoiceClick);

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

        async function generateProactiveMessage(friend, config) {
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

                const systemPrompt = buildSystemPrompt(friend, userPersona, aiStickers, visiblePosts) + "\n【系统提示】对方已经有一段时间没说话了，请你主动找个话题开启聊天。不要显得生硬，自然一点。";
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
                            // Parse Thought Feature Tags
                            let mood = null;
                            let innerThought = null;
                            
                            // Handle Mood - support multiple but take the last one, remove all
                            const moodRegex = /<mood>(.*?)<\/mood>/gis;
                            let moodMatches = [...aiResponseText.matchAll(moodRegex)];
                            if (moodMatches.length > 0) {
                                // Take the content of the last match
                                mood = moodMatches[moodMatches.length - 1][1].replace(/[\u4e00-\u9fa5]/g, '').trim();
                                // Remove all mood tags
                                aiResponseText = aiResponseText.replace(moodRegex, '').trim();
                            }

                            // Handle Thought
                            const thoughtRegex = /<(?:inner_thought|thought)>(.*?)<\/(?:inner_thought|thought)>/gis;
                            let thoughtMatches = [...aiResponseText.matchAll(thoughtRegex)];
                            
                            if (thoughtMatches.length > 0) {
                                // Concatenate all thoughts found
                                innerThought = thoughtMatches.map(m => m[1].trim()).join(' ');
                                // Remove all thought tags
                                aiResponseText = aiResponseText.replace(thoughtRegex, '').trim();
                            }

                            if (mood || innerThought) {
                                if (mood) friend.latestMood = mood;
                                if (innerThought) friend.latestThought = innerThought;
                                // Will be saved via dbUpdate later in this function
                            }

                            aiResponseText = await applyRegexRules(aiResponseText, friend.id, friend.group || '默认分组');
                            const msgParts = aiResponseText.split('\n').map(s => s.trim()).filter(s => s !== '');
                            
                            for (let i = 0; i < msgParts.length; i++) {
                                let partText = msgParts[i];
                                let quoteData = null;
                                let transferData = null;

                                // Parse Delete Moment Command
                                const deleteMomentRegex = /<delete_moment>(.*?)<\/delete_moment>/;
                                const deleteMomentMatch = partText.match(deleteMomentRegex);
                                if (deleteMomentMatch) {
                                    const keyword = deleteMomentMatch[1].trim();
                                    partText = partText.replace(deleteMomentRegex, '').trim();
                                    
                                    const targetPost = await new Promise(res => {
                                        dbGetAll('discover_posts', posts => {
                                            const botPosts = posts.filter(p => p.authorId === friend.id);
                                            botPosts.sort((a, b) => b.timestamp - a.timestamp);
                                            const matched = botPosts.find(p => p.id === keyword || (p.text && p.text.includes(keyword)));
                                            res(matched || botPosts[0]);
                                        });
                                    });

                                    if (targetPost) {
                                        await new Promise(res => dbDelete('discover_posts', targetPost.id, res));
                                        showToast(`${friend.name} 删除了一条朋友圈`);
                                        if (document.getElementById('wechat-discover-page').classList.contains('active')) {
                                            renderDiscoverFeed();
                                        }
                                    }
                                }

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
                                    const stickerValue = aiStickerMatch[1].trim();
                                    const matchedSticker = aiStickers.find(s => String(s.id) === stickerValue);
                                    if (matchedSticker) {
                                        aiStickerUrl = matchedSticker.src;
                                    } else {
                                        aiStickerUrl = stickerValue;
                                    }
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

                                // Parse Music Control
                                const musicControlRegex = /<music_control>(.*?)<\/music_control>/;
                                const musicMatch = partText.match(musicControlRegex);
                                let hasMusicAction = false;
                                if (musicMatch) {
                                    const mAction = musicMatch[1].trim().toLowerCase();
                                    partText = partText.replace(musicControlRegex, '').trim();
                                    
                                    if (Date.now() - lastAIMusicActionTime >= 180000) {
                                        hasMusicAction = true;
                                        lastAIMusicActionTime = Date.now();
                                        
                                        let actionText = '';
                                        if (mAction === 'next') { playNextSong(true); actionText = '切换了下一首歌'; }
                                        else if (mAction === 'prev') { playPrevSong(); actionText = '切换了上一首歌'; }
                                        else if (mAction === 'pause' && !musicAudio.paused) { togglePlayPause(); actionText = '暂停了音乐'; }
                                        else if (mAction === 'play' && musicAudio.paused) { togglePlayPause(); actionText = '恢复了音乐播放'; }
                                        
                                        if (actionText) {
                                            const infoMsg = {
                                                friendId: friend.id,
                                                text: `"${friend.name}" ${actionText}`,
                                                type: 'received',
                                                timestamp: Date.now(),
                                                isInfo: true
                                            };
                                            if (currentChatFriendId === friend.id && document.getElementById('chat-interface-page').classList.contains('active')) {
                                                addMessageToUI(infoMsg);
                                            }
                                            await new Promise(resolve => dbAdd('chat_history', infoMsg, resolve));
                                        }
                                    } else {
                                        console.log(`AI music action '${mAction}' ignored due to cooldown.`);
                                    }
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
                                
                                if (partText === '' && !transferData && !aiStickerUrl && !hasDice && !locationData) {
                                    if (hasAction) {
                                        partText = actionText;
                                    } else if (hasMusicAction) {
                                        continue;
                                    } else {
                                        continue;
                                    }
                                }

                                if (locationData) {
                                    if (partText) {
                                        const textMsg = { friendId: friend.id, text: partText, type: 'received', timestamp: Date.now() };
                                        if (quoteData) textMsg.quote = quoteData;
                                        await new Promise(resolve => dbAdd('chat_history', textMsg, resolve));
                                        if (currentChatFriendId === friend.id && document.getElementById('chat-interface-page').classList.contains('active')) addMessageToUI(textMsg);
                                        else showBannerNotification(friend, partText);
                                    }

                                    const locationMsg = {
                                        friendId: friend.id,
                                        text: `[位置] ${locationData.name}`,
                                        type: 'received',
                                        timestamp: Date.now() + 100,
                                        isLocation: true,
                                        locationName: locationData.name,
                                        locationDetail: locationData.detail
                                    };
                                    await new Promise(resolve => dbAdd('chat_history', locationMsg, resolve));
                                    if (currentChatFriendId === friend.id && document.getElementById('chat-interface-page').classList.contains('active')) addMessageToUI(locationMsg);
                                    else showBannerNotification(friend, `[位置] ${locationData.name}`);
                                    friend.lastMsg = `[位置] ${locationData.name}`;
                                } else if (transferData) {
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
                                    else showBannerNotification(friend, '[表情包]');
                                    friend.lastMsg = '[表情包]';
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
                                friend.lastActivityTimestamp = Date.now();
                                
                                const isChatActive = currentChatFriendId === friend.id && document.getElementById('chat-interface-page').classList.contains('active');
                                if (!isChatActive) {
                                    friend.unreadCount = (friend.unreadCount || 0) + 1;
                                }

                                await new Promise(resolve => dbUpdate('friends', friend, resolve));
                                
                                if (currentChatFriendId === friend.id && document.getElementById('chat-interface-page').classList.contains('active')) {
                                    // addMessageToUI(responseMsg); // Removed redundancy
                                }
                                if (document.getElementById('wechat-page').classList.contains('active') || 
                                    document.getElementById('wechat-contacts-page').classList.contains('active')) {
                                    renderChatList();
                                }
                                
                                if (config.notifications && Notification.permission === "granted") {
                                    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                                        navigator.serviceWorker.ready.then(registration => {
                                            registration.showNotification(friend.name, {
                                                body: partText,
                                                icon: friend.avatar || 'https://via.placeholder.com/150/B5EAD7/ffffff?text=Me',
                                                tag: 'chat-message',
                                                data: { url: location.href }
                                            });
                                        });
                                    } else {
                                        new Notification(friend.name, { body: partText, icon: friend.avatar || 'https://via.placeholder.com/150/B5EAD7/ffffff?text=Me' });
                                    }
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

        const summarizingFriends = new Set();

        function runAutoSummarization() {
            const configStr = localStorage.getItem('globalConfig');
            if (!configStr) return;
            const config = JSON.parse(configStr);
            if (!config.apiKey || !config.model) return;

            dbGetAll('friends', friends => {
                dbGetAll('chat_history', allMsgs => {
                    friends.forEach(friend => {
                        if (friend.autoSummarizeMemory && !friend.isGroup) {
                            const groupIds = friends.filter(f => f.isGroup && f.memoryInterop && (f.memoryInteropRoles || []).includes(friend.id)).map(f => f.id);
                            const allRelevantIds = [friend.id, ...groupIds];
                            
                            let history = allMsgs.filter(m => allRelevantIds.includes(m.friendId));
                            history.sort((a, b) => a.timestamp - b.timestamp);
                            
                            let unsummarized = history.filter(msg => {
                                if (msg.summarizedBy && msg.summarizedBy.includes(friend.id)) return false;
                                if (msg.friendId === friend.id && msg.isSummarized) return false;
                                return true;
                            });
                            
                            const CHUNK_SIZE = parseInt(friend.summarizeInterval || '20', 10);
                            if (unsummarized.length >= CHUNK_SIZE) {
                                if (summarizingFriends.has(friend.id)) return;
                                summarizingFriends.add(friend.id);
                                
                                const toSummarize = unsummarized.slice(0, CHUNK_SIZE);
                                
                                let historyText = toSummarize.map(msg => {
                                    const date = new Date(msg.timestamp);
                                    const timeStr = `${date.getMonth()+1}-${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                                    
                                    let contextPrefix = '';
                                    let sender = '';
                                    if (msg.friendId === friend.id) {
                                        contextPrefix = '[私聊] ';
                                        sender = msg.type === 'sent' ? '用户' : friend.realName;
                                    } else {
                                        const group = friends.find(f => f.id === msg.friendId);
                                        contextPrefix = `[群聊：${group ? group.name : '未知群'}] `;
                                        sender = msg.type === 'sent' ? '用户' : (msg.senderName || '未知成员');
                                    }
                                    
                                    const content = msg.isSticker ? '[图片/表情]' : msg.text;
                                    return `${contextPrefix}[${timeStr}] ${sender}: ${content}`;
                                }).join('\n');

                                const summarizePrompt = `你是一个负责提取记忆的助手。请将以下对话历史总结为一条简短的长期记忆（50-100字）。
要求：
1. 以第一人称视角（作为“${friend.realName}”）来记录。
2. 只提取关键事件、新得知的信息或情感变化，忽略无意义的闲聊。
3. 请注意区分【私聊】和【群聊】中发生的事情。
${friend.syncReality ? '4. 总结的开头或内容中必须包含这件事发生的具体时间背景（根据提供的对话时间戳推断是哪天、上午下午或具体时间段），这是最重要的要求。\n' : '\n'}
对话内容如下：
${historyText}`;

                                callLLM(config, "严格按照要求总结，不要输出多余的解释。", [{ type: 'sent', text: summarizePrompt, isSticker: false }])
                                    .then(async summaryText => {
                                        if (summaryText) {
                                            if (!friend.memories) friend.memories = [];
                                            friend.memories.push({
                                                id: Date.now().toString(),
                                                content: summaryText.trim(),
                                                createdAt: Date.now()
                                            });
                                            
                                            if (friend._isSummarizing !== undefined) {
                                                delete friend._isSummarizing;
                                            }
                                            
                                            await new Promise(res => dbUpdate('friends', friend, res));
                                            
                                            const tx2 = db.transaction(['chat_history'], 'readwrite');
                                            const store2 = tx2.objectStore('chat_history');
                                            
                                            let updates = 0;
                                            toSummarize.forEach(msg => {
                                                if (!msg.summarizedBy) msg.summarizedBy = [];
                                                if (!msg.summarizedBy.includes(friend.id)) {
                                                    msg.summarizedBy.push(friend.id);
                                                }
                                                if (msg.friendId === friend.id) {
                                                    msg.isSummarized = true;
                                                }
                                                const req = store2.put(msg);
                                                req.onsuccess = () => {
                                                    updates++;
                                                    if (updates === toSummarize.length) {
                                                        if (document.getElementById('memory-management-page').classList.contains('active') && currentChatFriendId === friend.id) {
                                                            renderMemoryList();
                                                        }
                                                        summarizingFriends.delete(friend.id);
                                                    }
                                                };
                                                req.onerror = () => {
                                                    updates++;
                                                    if (updates === toSummarize.length) {
                                                        summarizingFriends.delete(friend.id);
                                                    }
                                                };
                                            });
                                        } else {
                                            summarizingFriends.delete(friend.id);
                                        }
                                    })
                                    .catch(e => {
                                        console.error("Summarization failed:", e);
                                        summarizingFriends.delete(friend.id);
                                    });
                            }
                        }
                    });
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
                        // Also support legacy single character backward compatibility
                        let targetArray = rule.scopeTarget || [];
                        if (rule.scopeType === 'character' && !Array.isArray(rule.scopeTarget)) {
                            targetArray = [rule.scopeTarget];
                        }

                        scopeType.value = rule.scopeType === 'group' ? 'all' : (rule.scopeType || 'all');
                        
                        refreshCustomSelect('regex-scope-type');
                        handleRegexScopeChange(targetArray);
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
                handleRegexScopeChange([]);
            }
            
            document.getElementById('regex-rule-modal').style.display = 'flex';
        }

        function closeRegexRuleModal() {
            document.getElementById('regex-rule-modal').style.display = 'none';
        }

        function handleRegexScopeChange(selectedIds = []) {
            const scopeType = document.getElementById('regex-scope-type').value;
            const targetContainer = document.getElementById('regex-scope-target-container');
            
            if (scopeType === 'all') {
                targetContainer.style.display = 'none';
            } else if (scopeType === 'character') {
                targetContainer.style.display = 'flex';
                targetContainer.style.flexDirection = 'column';
                targetContainer.style.gap = '10px';
                targetContainer.innerHTML = '';
                dbGetAll('friends', friends => {
                    if (!friends || friends.length === 0) {
                        targetContainer.innerHTML = '<div style="text-align:center; color:#999; font-size:13px;">暂无角色</div>';
                    } else {
                        friends.forEach(friend => {
                            const label = document.createElement('label');
                            label.className = 'preset-checkbox-item';
                            label.style.padding = '0';
                            
                            const checkbox = document.createElement('input');
                            checkbox.type = 'checkbox';
                            checkbox.value = friend.id;
                            if (Array.isArray(selectedIds) && selectedIds.includes(friend.id)) {
                                checkbox.checked = true;
                            }
                            
                            const indicator = document.createElement('div');
                            indicator.className = 'custom-checkbox';

                            const span = document.createElement('span');
                            span.textContent = friend.name;
                            
                            label.appendChild(checkbox);
                            label.appendChild(indicator);
                            label.appendChild(span);
                            targetContainer.appendChild(label);
                        });
                    }
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

            let scopeTarget = null;
            if (scopeType === 'character') {
                const checkboxes = document.querySelectorAll('#regex-scope-target-container input[type="checkbox"]:checked');
                scopeTarget = Array.from(checkboxes).map(cb => cb.value);
            }

            const rule = {
                id: currentEditingRegexId || Date.now().toString(),
                name,
                pattern,
                replacement,
                flags,
                scopeType,
                scopeTarget,
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
                    if (rule.scopeType === 'group') scopeText = `分组: ${rule.scopeTarget}`; // Legacy fallback
                    if (rule.scopeType === 'character') {
                        if (Array.isArray(rule.scopeTarget)) {
                            scopeText = `特定角色 (${rule.scopeTarget.length}个)`;
                        } else {
                            scopeText = `特定角色`;
                        }
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
                        dbGetAll('friends', friends => {
                            let targetArr = Array.isArray(rule.scopeTarget) ? rule.scopeTarget : [rule.scopeTarget];
                            const matchedNames = friends.filter(f => targetArr.includes(f.id)).map(f => f.name);
                            if (matchedNames.length > 0) {
                                const tag = card.querySelector('.wb-card-tag');
                                if (tag) {
                                    if (matchedNames.length <= 2) {
                                        tag.textContent = `角色: ${matchedNames.join(', ')}`;
                                    } else {
                                        tag.textContent = `特定角色 (${matchedNames.length}个)`;
                                    }
                                }
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
                        else if (rule.scopeType === 'character') {
                            if (Array.isArray(rule.scopeTarget)) {
                                if (rule.scopeTarget.includes(friendId)) isMatch = true;
                            } else if (rule.scopeTarget === friendId) {
                                isMatch = true;
                            }
                        }

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
        let worldBooks = [];
        let worldBookGroups = ['默认'];
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
                const book = worldBooks.find(b => b.id === editingWbId);
                if (book) {
                    book.title = title;
                    book.group = group;
                    book.content = content;
                    dbUpdate('world_books', book, () => {
                        closeWbModal();
                        renderWbList();
                    });
                }
            } else {
                const newBook = {
                    id: Date.now().toString(),
                    title,
                    group,
                    content
                };
                dbAdd('world_books', newBook, () => {
                    worldBooks.unshift(newBook);
                    closeWbModal();
                    renderWbList();
                });
            }
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
                const groupData = { id: 'groups', value: worldBookGroups };
                dbUpdate('wb_settings', groupData, () => {
                    renderWbTabs();
                    closeWbGroupModal();
                });
            } else {
                closeWbGroupModal();
            }
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
            const updates = [];
            worldBooks.forEach(book => {
                if (book.group === groupName) {
                    book.group = '默认';
                    updates.push(new Promise(res => dbUpdate('world_books', book, res)));
                }
            });

            Promise.all(updates).then(() => {
                // Remove group from list
                worldBookGroups = worldBookGroups.filter(g => g !== groupName);
                const groupData = { id: 'groups', value: worldBookGroups };
                dbUpdate('wb_settings', groupData, () => {
                    // If the deleted group was the active one, switch to "All"
                    if (currentWbGroup === groupName) {
                        currentWbGroup = '全部';
                    }
                    // Re-render UI
                    renderWbTabs();
                    renderWbList();
                    showToast(`分组 "${groupName}" 已删除。`);
                });
            });
        }

        function openWbDeleteModal(id) {
            deletingWbId = id;
            document.getElementById('wb-delete-modal').style.display = 'flex';
            
            // Bind confirm button
            document.getElementById('wb-confirm-delete-btn').onclick = () => {
                if (deletingWbId) {
                    dbDelete('world_books', deletingWbId, () => {
                        worldBooks = worldBooks.filter(b => b.id !== deletingWbId);
                        renderWbList();
                        closeWbDeleteModal();
                    });
                } else {
                    closeWbDeleteModal();
                }
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
                const groupChats = friends.filter(f => f.isGroup);
                const individualFriends = friends.filter(f => !f.isGroup);

                // 1. Render Group Chats
                if (groupChats.length > 0) {
                    const groupHeader = document.createElement('div');
                    groupHeader.style.padding = '4px 15px';
                    groupHeader.style.backgroundColor = '#f7f7f7';
                    groupHeader.style.color = '#888';
                    groupHeader.style.fontSize = '13px';
                    groupHeader.textContent = '群聊';
                    listContainer.appendChild(groupHeader);

                    groupChats.forEach(group => {
                        const item = document.createElement('div');
                        item.className = 'chat-item';
                        item.innerHTML = `
                            <img class="chat-avatar" src="${group.avatar}" alt="${group.name}">
                            <div class="chat-info" style="justify-content: center;">
                                <span class="chat-name">${group.name}</span>
                            </div>
                        `;
                        item.style.cursor = 'pointer';
                        item.addEventListener('click', () => openChat(group.id));
                        listContainer.appendChild(item);
                    });
                }

                // 2. Render Individual Friends, grouped
                const groupedFriends = {};
                individualFriends.forEach(friend => {
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

                            item.style.cursor = 'pointer';
                            item.addEventListener('click', () => {
                                openFriendProfile(friend.id);
                            });
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
                    
                    const checkbox = document.getElementById('fp-visibility-checkbox');
                    const dot = checkbox.querySelector('.inner-dot');
                    if (friend.isHidden) {
                        checkbox.style.borderColor = '#aaa';
                        dot.style.transform = 'scale(0)';
                    } else {
                        checkbox.style.borderColor = '#333';
                        dot.style.transform = 'scale(1)';
                    }

                    showPage('friend-profile-page');
                }
            });
        }

        function toggleFriendVisibility() {
            if (!currentChatFriendId) return;
            dbGet('friends', currentChatFriendId, friend => {
                if (friend) {
                    friend.isHidden = !friend.isHidden;
                    dbUpdate('friends', friend, () => {
                        const checkbox = document.getElementById('fp-visibility-checkbox');
                        const dot = checkbox.querySelector('.inner-dot');
                        if (friend.isHidden) {
                            checkbox.style.borderColor = '#aaa';
                            dot.style.transform = 'scale(0)';
                        } else {
                            checkbox.style.borderColor = '#333';
                            dot.style.transform = 'scale(1)';
                        }
                        
                        // Update background lists so changes reflect when user goes back
                        renderChatList();
                        renderContactsList(); 
                    });
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
                const friendsInGroup = friends.filter(f => !f.isGroup && (f.group || '默认分组') === groupName);

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

                    if (/\/v\d+$/.test(baseUrl)) {
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
            refreshCustomSelect(presetSelect);
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

            refreshCustomSelect(presetSelect);
            showToast('删除成功');
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
                    
                    if (friend.isGroup) {
                        document.getElementById('chat-info-personal-section').style.display = 'none';
                        document.getElementById('chat-info-my-avatar-section').style.display = 'none';
                        document.getElementById('chat-info-ai-settings-section').style.display = 'flex';
                        document.getElementById('auto-summarize-settings-container').style.display = 'none';
                        document.getElementById('chat-info-active-chat-section').style.display = 'none';
                        document.getElementById('chat-info-thought-section').style.display = 'none';
                        document.getElementById('chat-info-group-section').style.display = 'block';
                        
                        document.getElementById('group-info-name').value = friend.name;
                        document.getElementById('short-term-memory-input').value = friend.shortTermMemory || '';
                        
                        // Render Group Members
                        const membersDisplay = document.getElementById('group-members-display');
                        membersDisplay.innerHTML = '';
                        dbGetAll('friends', allFriends => {
                            const groupMembers = allFriends.filter(f => (friend.members || []).includes(f.id));
                            groupMembers.forEach(member => {
                                const mDiv = document.createElement('div');
                                mDiv.className = 'group-member-item';
                                mDiv.innerHTML = `
                                    <img src="${member.avatar}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;">
                                    <div style="font-size: 10px; color: #666; text-align: center; margin-top: 4px; width: 40px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${member.name}</div>
                                `;
                                membersDisplay.appendChild(mDiv);
                            });
                            
                            // Add +/- buttons
                            membersDisplay.innerHTML += `
                                <div class="group-member-item" onclick="openAddGroupMemberModal()">
                                    <div style="width: 40px; height: 40px; border-radius: 4px; border: 1px dashed #ccc; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #999;">+</div>
                                    <div style="font-size: 10px; color: #666; text-align: center; margin-top: 4px; width: 40px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">邀请</div>
                                </div>
                                <div class="group-member-item" onclick="openRemoveGroupMemberModal()">
                                    <div style="width: 40px; height: 40px; border-radius: 4px; border: 1px dashed #ccc; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #999;">-</div>
                                    <div style="font-size: 10px; color: #666; text-align: center; margin-top: 4px; width: 40px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">移除</div>
                                </div>
                            `;

                            // Render Memory Interop roles
                            const interopToggle = document.getElementById('group-memory-interop-toggle');
                            interopToggle.checked = friend.memoryInterop || false;
                            
                            const interopListContainer = document.getElementById('group-memory-interop-roles');
                            interopListContainer.style.display = friend.memoryInterop ? 'block' : 'none';
                            
                            const interopList = document.getElementById('group-memory-interop-list');
                            interopList.innerHTML = '';
                            groupMembers.forEach(member => {
                                const label = document.createElement('label');
                                label.className = 'preset-checkbox-item';
                                label.style.padding = '5px 0';
                                label.innerHTML = `
                                    <input type="checkbox" value="${member.id}" ${(friend.memoryInteropRoles || []).includes(member.id) ? 'checked' : ''}>
                                    <div class="custom-checkbox"></div>
                                    <img src="${member.avatar}" style="width: 24px; height: 24px; border-radius: 4px; margin-right: 5px; object-fit: cover;">
                                    <span>${member.name}</span>
                                `;
                                interopList.appendChild(label);
                            });
                        });

                    } else {
                        document.getElementById('chat-info-personal-section').style.display = 'block';
                        document.getElementById('chat-info-my-avatar-section').style.display = 'flex';
                        document.getElementById('chat-info-ai-settings-section').style.display = 'flex';
                        document.getElementById('auto-summarize-settings-container').style.display = 'block';
                        document.getElementById('chat-info-active-chat-section').style.display = 'flex';
                        document.getElementById('chat-info-thought-section').style.display = 'flex';
                        document.getElementById('chat-info-group-section').style.display = 'none';
                        
                        document.getElementById('chat-info-remark').value = friend.name;
                        
                        if (!friend.realName) {
                            friend.realName = friend.name;
                            dbUpdate('friends', friend);
                        }
                        document.getElementById('chat-info-realname').value = friend.realName;
                        document.getElementById('chat-info-persona').value = friend.persona || '';

                        if (friend.myAvatar) {
                            document.getElementById('my-chat-avatar').src = friend.myAvatar;
                        } else {
                            dbGet('user_profile', 'main_user', profile => {
                                if (profile && profile.avatar) {
                                    document.getElementById('my-chat-avatar').src = profile.avatar;
                                } else {
                                    document.getElementById('my-chat-avatar').src = 'https://via.placeholder.com/150/B5EAD7/ffffff?text=Me';
                                }
                            });
                        }

                        if (friend.myPersonaId) {
                            dbGet('my_personas', friend.myPersonaId, persona => {
                                document.getElementById('my-chat-persona-text').textContent = persona ? persona.name : '默认人设';
                            });
                        } else {
                            document.getElementById('my-chat-persona-text').textContent = '默认人设';
                        }
                        
                        updateBindWorldBookText(friend.boundWorldBooks);
                        
                        const enableThoughts = friend.enableThoughts || false;
                        document.getElementById('enable-thought-toggle').checked = enableThoughts;
                        
                        const thoughtSubContainer = document.getElementById('thought-sub-settings');
                        if (thoughtSubContainer) {
                            thoughtSubContainer.style.display = enableThoughts ? 'block' : 'none';
                        }
                        
                        document.getElementById('show-thought-text-toggle').checked = friend.showThoughtText !== false;
                        document.getElementById('separate-offline-ui-toggle').checked = friend.separateOfflineUI || false;
                        
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
                    }

                    // Avatar Display (Both)
                    const avatarDisplaySelect = document.getElementById('avatar-display-select');
                    avatarDisplaySelect.value = friend.avatarDisplay || 'show_all';
                    refreshCustomSelect(avatarDisplaySelect);

                    showPage('chat-info-page');
                }
            });
        }

        function toggleGroupMemoryInterop(isChecked) {
            const container = document.getElementById('group-memory-interop-roles');
            if (container) {
                container.style.display = isChecked ? 'block' : 'none';
            }
        }

        function openAddGroupMemberModal() {
            if (!currentChatFriendId) return;
            document.getElementById('role-selection-title').textContent = '邀请新成员';
            document.getElementById('role-search-input').value = '';
            
            const listContainer = document.getElementById('role-selection-list');
            listContainer.innerHTML = '';
            document.getElementById('role-selection-modal').style.display = 'flex';

            dbGet('friends', currentChatFriendId, group => {
                dbGetAll('friends', allFriends => {
                    const nonGroupFriends = allFriends.filter(f => !f.isGroup);
                    nonGroupFriends.forEach(friend => {
                        const isAlreadyMember = (group.members || []).includes(friend.id);
                        
                        const label = document.createElement('label');
                        label.className = 'gm-contact-item';
                        label.style.padding = '10px 0';
                        label.style.borderBottom = '1px solid #f0f0f0';
                        label.dataset.name = friend.name.toLowerCase();
                        
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.value = friend.id;
                        checkbox.dataset.friendName = friend.name;
                        
                        if (isAlreadyMember) {
                            checkbox.checked = true;
                            checkbox.disabled = true; // Cannot unselect existing members here
                        }
                        
                        const customCheck = document.createElement('div');
                        customCheck.className = 'round-checkbox';
                        if (isAlreadyMember) {
                            customCheck.style.backgroundColor = '#f0f0f0';
                            customCheck.style.borderColor = '#ccc';
                        }
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

                    // Override confirm button for add member
                    const confirmBtn = document.querySelector('#role-selection-modal button');
                    confirmBtn.onclick = () => {
                        const checkboxes = document.querySelectorAll('#role-selection-list input[type="checkbox"]:checked:not(:disabled)');
                        const newMemberIds = Array.from(checkboxes).map(cb => cb.value);
                        
                        if (newMemberIds.length > 0) {
                            group.members = [...(group.members || []), ...newMemberIds];
                            dbUpdate('friends', group, () => {
                                closeRoleSelectionModal();
                                openChatInfo(); // refresh
                                showToast('已邀请新成员');
                            });
                        } else {
                            closeRoleSelectionModal();
                        }
                    };
                });
            });
        }

        function openRemoveGroupMemberModal() {
            if (!currentChatFriendId) return;
            document.getElementById('role-selection-title').textContent = '移除群成员';
            document.getElementById('role-search-input').value = '';
            
            const listContainer = document.getElementById('role-selection-list');
            listContainer.innerHTML = '';
            document.getElementById('role-selection-modal').style.display = 'flex';

            dbGet('friends', currentChatFriendId, group => {
                dbGetAll('friends', allFriends => {
                    const currentMembers = allFriends.filter(f => (group.members || []).includes(f.id));
                    currentMembers.forEach(friend => {
                        const label = document.createElement('label');
                        label.className = 'gm-contact-item';
                        label.style.padding = '10px 0';
                        label.style.borderBottom = '1px solid #f0f0f0';
                        label.dataset.name = friend.name.toLowerCase();
                        
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.value = friend.id;
                        
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

                    // Override confirm button for remove member
                    const confirmBtn = document.querySelector('#role-selection-modal button');
                    confirmBtn.onclick = () => {
                        const checkboxes = document.querySelectorAll('#role-selection-list input[type="checkbox"]:checked');
                        const removeMemberIds = Array.from(checkboxes).map(cb => cb.value);
                        
                        if (removeMemberIds.length > 0) {
                            showCustomConfirm(`确定要移除选中的 ${removeMemberIds.length} 个成员吗？`, () => {
                                group.members = (group.members || []).filter(id => !removeMemberIds.includes(id));
                                // Also remove from memoryInteropRoles if present
                                group.memoryInteropRoles = (group.memoryInteropRoles || []).filter(id => !removeMemberIds.includes(id));
                                
                                dbUpdate('friends', group, () => {
                                    closeRoleSelectionModal();
                                    openChatInfo(); // refresh
                                    showToast('已移除成员');
                                });
                            }, '移除成员');
                        } else {
                            closeRoleSelectionModal();
                        }
                    };
                });
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
                
                // Get world books from global variable
                let allWorldBooks = worldBooks || [];
                
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
                let allWorldBooks = worldBooks || [];
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
                                    renderMessages(currentChatFriendId);
                                    renderChatList();
                                    renderContactsList();
                                });
                            }
                        });
                    }
                };
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

        function toggleThoughtConfig(isChecked) {
            updateFriendInfo('enableThoughts', isChecked);
            const container = document.getElementById('thought-sub-settings');
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
                    } else if (field === 'enableThoughts') {
                        friend.enableThoughts = value;
                        if (value && typeof friend.showThoughtText === 'undefined') {
                            friend.showThoughtText = true; // Default to true when first enabled
                        }
                    } else if (field === 'showThoughtText') {
                        friend.showThoughtText = value;
                    } else if (field === 'separateOfflineUI') {
                        friend.separateOfflineUI = value;
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
                    if (friend.isGroup) {
                        friend.name = document.getElementById('group-info-name').value.trim();
                        friend.realName = friend.name;
                        friend.memoryInterop = document.getElementById('group-memory-interop-toggle').checked;
                        const checkboxes = document.querySelectorAll('#group-memory-interop-list input[type="checkbox"]:checked');
                        friend.memoryInteropRoles = Array.from(checkboxes).map(cb => cb.value);
                        friend.shortTermMemory = document.getElementById('short-term-memory-input').value;
                    } else {
                        friend.name = document.getElementById('chat-info-remark').value.trim();
                        friend.realName = document.getElementById('chat-info-realname').value.trim();
                        friend.persona = document.getElementById('chat-info-persona').value.trim();
                        friend.shortTermMemory = document.getElementById('short-term-memory-input').value;
                        friend.autoSummarizeMemory = document.getElementById('auto-summarize-memory-toggle').checked;
                    }
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

        // --- Offline Chat Separate UI Logic ---
        function openOfflineChat(friendId) {
            currentChatFriendId = friendId;
            dbGet('friends', friendId, friend => {
                if (!friend) return;
                document.getElementById('offline-chat-title').textContent = '';
                showPage('offline-chat-page');
                renderOfflineChat(friendId);
            });
        }

        function exitOfflineChat() {
            if (currentChatFriendId) {
                dbGet('friends', currentChatFriendId, friend => {
                    if (friend && friend.offlineSettings) {
                        friend.offlineSettings.enabled = false;
                        dbUpdate('friends', friend, () => {
                            showPage('chat-interface-page');
                            renderMessages(currentChatFriendId);
                        });
                    } else {
                        showPage('chat-interface-page');
                        renderMessages(currentChatFriendId);
                    }
                });
            } else {
                showPage('chat-interface-page');
            }
        }

        let currentOfflineLoadedCount = 0;

        function renderOfflineChat(friendId, isLoadMore = false) {
            const container = document.getElementById('offline-chat-messages');
            
            const transaction = db.transaction(['chat_history'], 'readonly');
            const store = transaction.objectStore('chat_history');
            const index = store.index('friendId');
            const request = index.getAll(friendId);

            request.onsuccess = () => {
                let messages = request.result;
                messages = messages.filter(msg => msg.isOfflineSeparate);
                
                dbGet('friends', friendId, friend => {
                    let previousScrollHeight = 0;
                    let previousScrollTop = 0;

                    if (isLoadMore) {
                        previousScrollHeight = container.scrollHeight;
                        previousScrollTop = container.scrollTop;
                        currentOfflineLoadedCount += CHAT_LOAD_LIMIT;
                    } else {
                        currentOfflineLoadedCount = CHAT_LOAD_LIMIT;
                    }

                    container.innerHTML = '';

                    const sliceStart = Math.max(0, messages.length - currentOfflineLoadedCount);
                    const messagesToRender = messages.slice(sliceStart);

                    if (messagesToRender.length > 0) {
                        messagesToRender.forEach(msg => appendOfflineMessage(msg, friend, false, false));
                    }
                    
                    if (isLoadMore) {
                        container.scrollTop = container.scrollHeight - previousScrollHeight + previousScrollTop;
                    } else {
                        container.scrollTop = container.scrollHeight;
                    }

                    container.onscroll = () => {
                        if (container.scrollTop === 0 && currentOfflineLoadedCount < messages.length) {
                            container.onscroll = null;
                            renderOfflineChat(friendId, true);
                        }
                    };
                });
            };
        }

        async function appendOfflineMessage(msg, friend, shouldScroll = true, isNew = false) {
            const container = document.getElementById('offline-chat-messages');
            const row = document.createElement('div');
            row.className = 'offline-message-row';

            if (msg.type === 'sent') {
                const bubbleContainer = document.createElement('div');
                bubbleContainer.className = 'offline-bubble-container right';
                
                const contentGroup = document.createElement('div');
                contentGroup.className = 'offline-bubble-content-group';
                
                const nameLabel = document.createElement('div');
                nameLabel.className = 'offline-user-name';
                
                let myAvatarSrc = 'https://via.placeholder.com/150/B5EAD7/ffffff?text=Me';
                let myNameStr = '我';

                if (friend && friend.myAvatar) {
                    myAvatarSrc = friend.myAvatar;
                }
                
                nameLabel.textContent = myNameStr;
                
                const bubble = document.createElement('div');
                bubble.className = 'offline-bubble right';
                bubble.innerHTML = msg.text.replace(/\n/g, '<br>');
                
                attachMessageEvents(bubble, msg);
                
                contentGroup.appendChild(nameLabel);
                contentGroup.appendChild(bubble);
                
                const avatar = document.createElement('img');
                avatar.className = 'offline-avatar';
                avatar.src = myAvatarSrc;
                
                dbGet('user_profile', 'main_user', profile => {
                    if (profile && profile.name) nameLabel.textContent = profile.name;
                    if (!friend.myAvatar && profile && profile.avatar) avatar.src = profile.avatar;
                });

                bubbleContainer.appendChild(contentGroup);
                bubbleContainer.appendChild(avatar);
                row.appendChild(bubbleContainer);
                
            } else {
                const parsedSegments = parseOfflineMessage(msg.text);
                container.appendChild(row);
                
                for (let index = 0; index < parsedSegments.length; index++) {
                    const seg = parsedSegments[index];
                    
                    if (isNew && index > 0) {
                        const isActive = document.getElementById('offline-chat-page').classList.contains('active') && currentChatFriendId === msg.friendId;
                        if (isActive) {
                            if (shouldScroll) container.scrollTop = container.scrollHeight;
                            const delay = Math.random() * 500 + 500;
                            await new Promise(res => {
                                let start = Date.now();
                                let timer = setInterval(() => {
                                    if (!document.getElementById('offline-chat-page').classList.contains('active')) {
                                        clearInterval(timer);
                                        res();
                                    } else if (Date.now() - start >= delay) {
                                        clearInterval(timer);
                                        res();
                                    }
                                }, 50);
                            });
                        }
                    }
                    
                    const segmentInfo = { index: index, type: seg.type, content: seg.content };

                    if (seg.type === 'dialogue') {
                        const bubbleContainer = document.createElement('div');
                        bubbleContainer.className = 'offline-bubble-container left';
                        
                        const contentGroup = document.createElement('div');
                        contentGroup.className = 'offline-bubble-content-group';
                        
                        const nameLabel = document.createElement('div');
                        nameLabel.className = 'offline-user-name';
                        nameLabel.style.textAlign = 'left';
                        nameLabel.textContent = friend.name;
                        
                        const avatar = document.createElement('img');
                        avatar.className = 'offline-avatar';
                        avatar.src = friend.avatar;
                        
                        const bubble = document.createElement('div');
                        bubble.className = 'offline-bubble left';
                        bubble.innerHTML = seg.content.replace(/\n/g, '<br>');
                        
                        attachMessageEvents(bubble, msg, segmentInfo);
                        
                        contentGroup.appendChild(nameLabel);
                        contentGroup.appendChild(bubble);
                        
                        bubbleContainer.appendChild(avatar);
                        bubbleContainer.appendChild(contentGroup);
                        row.appendChild(bubbleContainer);
                    } else if (seg.type === 'action') {
                        const actionDiv = document.createElement('div');
                        actionDiv.className = 'offline-action';
                        actionDiv.innerHTML = seg.content.replace(/\n/g, '<br>');
                        attachMessageEvents(actionDiv, msg, segmentInfo);
                        row.appendChild(actionDiv);
                    } else if (seg.type === 'thought') {
                        if (friend && friend.offlineSettings && friend.offlineSettings.showThoughts !== false) {
                            const thoughtDiv = document.createElement('div');
                            thoughtDiv.className = 'offline-thought';
                            thoughtDiv.innerHTML = seg.content.replace(/\n/g, '<br>');
                            attachMessageEvents(thoughtDiv, msg, segmentInfo);
                            row.appendChild(thoughtDiv);
                        }
                    }
                    
                    if (shouldScroll) {
                        container.scrollTop = container.scrollHeight;
                    }
                }
                return; // Early return since we already appended the row
            }

            container.appendChild(row);
            if (shouldScroll) {
                container.scrollTop = container.scrollHeight;
            }
        }

        function parseOfflineMessage(text) {
            const segments = [];
            text = sanitizeThoughtTags(text);
            
            const regex = /(「.*?」|<thought>.*?<\/thought>|<inner_thought>.*?<\/inner_thought>)/gs;
            
            let lastIndex = 0;
            let match;
            
            while ((match = regex.exec(text)) !== null) {
                const actionStr = text.substring(lastIndex, match.index).trim();
                if (actionStr) {
                    segments.push({ type: 'action', content: actionStr });
                }
                
                const token = match[0];
                if (token.startsWith('「')) {
                    segments.push({ type: 'dialogue', content: token.substring(1, token.length - 1) });
                } else if (token.startsWith('<thought>')) {
                    segments.push({ type: 'thought', content: token.substring(9, token.length - 10) });
                } else if (token.startsWith('<inner_thought>')) {
                    segments.push({ type: 'thought', content: token.substring(15, token.length - 16) });
                }
                
                lastIndex = regex.lastIndex;
            }
            
            const trailingAction = text.substring(lastIndex).trim();
            if (trailingAction) {
                segments.push({ type: 'action', content: trailingAction });
            }
            
            if (segments.length === 0 && text.trim()) {
                segments.push({ type: 'dialogue', content: text.trim() });
            }
            
            return segments;
        }

        // --- Mini Phone Logic ---
        let currentMiniPhoneFriendId = null;
        let miniPhonePollTimer = null;
        let offlineChatFriendIdCache = null;

        function openMiniPhoneModal() {
            document.getElementById('mini-phone-modal').style.display = 'flex';
            
            if (currentChatFriendId && document.getElementById('offline-chat-page').classList.contains('active')) {
                dbGet('friends', currentChatFriendId, friend => {
                    if (friend && !friend.isGroup) {
                        document.getElementById('mini-phone-list-page').style.display = 'none';
                        openMiniPhoneChat(friend.id);
                    } else {
                        document.getElementById('mini-phone-list-page').style.display = 'flex';
                        renderMiniPhoneChatList();
                    }
                    
                    if(miniPhonePollTimer) clearInterval(miniPhonePollTimer);
                    miniPhonePollTimer = setInterval(() => {
                        if (document.getElementById('mini-phone-list-page').style.display === 'flex') {
                            renderMiniPhoneChatList();
                        }
                    }, 2000);
                });
            } else {
                document.getElementById('mini-phone-list-page').style.display = 'flex';
                renderMiniPhoneChatList();
                
                if(miniPhonePollTimer) clearInterval(miniPhonePollTimer);
                miniPhonePollTimer = setInterval(() => {
                    if (document.getElementById('mini-phone-list-page').style.display === 'flex') {
                        renderMiniPhoneChatList();
                    }
                }, 2000);
            }
        }

        function closeMiniPhoneModal() {
            if (document.getElementById('chat-interface-page').classList.contains('in-mini-phone')) {
                closeMiniPhoneChat();
            }
            document.getElementById('mini-phone-modal').style.display = 'none';
            if(miniPhonePollTimer) clearInterval(miniPhonePollTimer);
        }

        function renderMiniPhoneChatList() {
            dbGetAll('friends', friends => {
                const list = document.getElementById('mini-phone-chat-list');
                list.innerHTML = '';
                
                let visibleFriends = friends.filter(f => !f.isHidden);

                if (currentChatFriendId && document.getElementById('offline-chat-page').classList.contains('active')) {
                    const contextFriend = friends.find(f => f.id === currentChatFriendId);
                    if (contextFriend) {
                        if (contextFriend.isGroup) {
                            visibleFriends = visibleFriends.filter(f => f.id === contextFriend.id || (contextFriend.members || []).includes(f.id));
                        } else {
                            visibleFriends = visibleFriends.filter(f => f.id === contextFriend.id);
                        }
                    }
                }

                visibleFriends.sort((a, b) => {
                    if (a.isPinned && !b.isPinned) return -1;
                    if (!a.isPinned && b.isPinned) return 1;
                    const timeA = a.lastActivityTimestamp || (a.id.includes('_') ? parseInt(a.id.split('_').pop()) : parseInt(a.id)) || 0;
                    const timeB = b.lastActivityTimestamp || (b.id.includes('_') ? parseInt(b.id.split('_').pop()) : parseInt(b.id)) || 0;
                    return timeB - timeA;
                });
                
                visibleFriends.forEach(friend => {
                    const item = document.createElement('div');
                    item.style.display = 'flex';
                    item.style.padding = '10px 15px';
                    item.style.gap = '10px';
                    item.style.cursor = 'pointer';
                    item.style.borderBottom = '1px solid #f0f0f0';
                    if (friend.isPinned) {
                        item.style.backgroundColor = '#f5f5f5';
                    }

                    item.innerHTML = `
                        <div style="position: relative; width: 40px; height: 40px; flex-shrink: 0;">
                            <img src="${friend.avatar}" style="width: 100%; height: 100%; border-radius: 6px; object-fit: cover; background: #eee;">
                        </div>
                        <div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; overflow: hidden;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-size: 15px; font-weight: 500; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${friend.name}</span>
                                <span style="font-size: 11px; color: #b2b2b2;">${friend.lastTime || ''}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2px;">
                                <div style="font-size: 12px; color: #999; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-grow: 1;">${friend.lastMsg || ''}</div>
                            </div>
                        </div>
                    `;

                    item.addEventListener('click', () => {
                        openMiniPhoneChat(friend.id);
                    });

                    list.appendChild(item);
                });
            });
        }

        function openMiniPhoneChat(friendId) {
            if (!document.getElementById('chat-interface-page').classList.contains('in-mini-phone')) {
                offlineChatFriendIdCache = currentChatFriendId;
            }
            currentChatFriendId = friendId;
            
            dbGet('friends', friendId, friend => {
                if (!friend) return;
                
                if (friend.unreadCount) {
                    friend.unreadCount = 0;
                    dbUpdate('friends', friend);
                }
                
                document.getElementById('mini-phone-list-page').style.display = 'none';
                
                const chatPage = document.getElementById('chat-interface-page');
                document.getElementById('mini-phone-screen').appendChild(chatPage);
                chatPage.style.display = 'flex';
                chatPage.classList.add('in-mini-phone');
                chatPage.classList.add('active'); // active so it receives AI messages
                
                if (friend.isGroup) {
                    chatPage.classList.add('is-group-chat');
                } else {
                    chatPage.classList.remove('is-group-chat');
                }
                
                document.getElementById('chat-interface-title').textContent = friend.name;
                renderMessages(friendId);
                applyChatTheme(friend);
            });
        }

        function closeMiniPhoneChat() {
            document.getElementById('mini-phone-list-page').style.display = 'flex';
            
            const chatPage = document.getElementById('chat-interface-page');
            document.getElementById('main-app-container').appendChild(chatPage);
            chatPage.style.display = 'none';
            chatPage.classList.remove('in-mini-phone');
            chatPage.classList.remove('is-group-chat');
            chatPage.classList.remove('active');
            
            if (offlineChatFriendIdCache !== null) {
                currentChatFriendId = offlineChatFriendIdCache;
                offlineChatFriendIdCache = null;
                
                if (document.getElementById('offline-chat-page').classList.contains('active')) {
                    renderOfflineChat(currentChatFriendId);
                }
            }
            
            renderMiniPhoneChatList();
        }

        function sendOfflineMessage() {
            const input = document.getElementById('offline-chat-input');
            const messageText = input.value.trim();
            if (messageText === '' || !currentChatFriendId) return;

            const message = {
                friendId: currentChatFriendId,
                text: messageText,
                type: 'sent',
                timestamp: Date.now(),
                isOfflineSeparate: true
            };

            dbAdd('chat_history', message, () => {
                dbGet('friends', currentChatFriendId, friend => {
                    if (friend) {
                        appendOfflineMessage(message, friend);
                        input.value = '';
                        // Removed triggerAIResponse() for manual offline mode
                    }
                });
            });
        }

        function retryLastOfflineMessage() {
            if (!currentChatFriendId) return;
            
            dbGetAll('chat_history', allMsgs => {
                const friendMsgs = allMsgs.filter(m => m.friendId === currentChatFriendId && m.isOfflineSeparate);
                if (friendMsgs.length === 0) {
                    showToast('没有可重新生成的回复');
                    return;
                }
                
                const lastMsg = friendMsgs[friendMsgs.length - 1];
                if (lastMsg.type === 'received') {
                    showCustomConfirm('确定要重新生成上一条回复吗？', () => {
                        dbDelete('chat_history', lastMsg.id || lastMsg.timestamp, () => {
                            renderOfflineChat(currentChatFriendId);
                            triggerAIResponse();
                        });
                    }, '重新生成');
                } else {
                    showToast('只能重新生成角色的回复');
                }
            });
        }
        
        // Let's bind enter key for offline chat
        document.getElementById('offline-chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendOfflineMessage();
            }
        });

        document.getElementById('offline-chat-input').addEventListener('focus', () => {
            setTimeout(() => {
                const container = document.getElementById('offline-chat-messages');
                if (container) {
                    container.scrollTop = container.scrollHeight;
                }
            }, 300);
        });

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
                        const container = document.getElementById('me-avatar-container');
                        if (container) container.classList.add('has-image');
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
                const file = input.files[0];
                compressImage(file, 0.7, (compressedSrc) => {
                    document.getElementById('me-page-avatar').src = compressedSrc;
                    document.getElementById('me-avatar-container').classList.add('has-image');
                    
                    // Sync to main page avatar
                    const mainAvatar = document.getElementById('avatar-display');
                    if (mainAvatar) {
                        mainAvatar.src = compressedSrc;
                        document.getElementById('main-avatar-container').classList.add('has-image');
                    }

                    dbGet('user_profile', 'main_user', profile => {
                        const updatedProfile = profile || { id: 'main_user' };
                        updatedProfile.avatar = compressedSrc;
                        dbUpdate('user_profile', updatedProfile);
                    });
                });
                input.value = ''; // Reset input
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

        // --- Location Logic ---
        function openLocationModal() {
            if (!currentChatFriendId) {
                showToast('请先选择一个聊天');
                return;
            }
            document.getElementById('location-name-input').value = '';
            document.getElementById('location-detail-input').value = '';
            document.getElementById('location-modal').style.display = 'flex';
            toggleActionPanel(); // Close the + menu
        }

        function closeLocationModal() {
            document.getElementById('location-modal').style.display = 'none';
        }

        function sendLocation() {
            const name = document.getElementById('location-name-input').value.trim();
            const detail = document.getElementById('location-detail-input').value.trim();

            if (!name) {
                showToast('请输入位置名称');
                return;
            }

            const message = {
                friendId: currentChatFriendId,
                text: `[位置] ${name}`,
                type: 'sent',
                timestamp: Date.now(),
                isLocation: true,
                locationName: name,
                locationDetail: detail
            };

            addMessageToUI(message);
            dbAdd('chat_history', message);

            dbGet('friends', currentChatFriendId, friend => {
                if (friend) {
                    friend.lastMsg = `[位置] ${name}`;
                    friend.lastTime = getCurrentTimeStr();
                    friend.lastActivityTimestamp = Date.now();
                    dbUpdate('friends', friend, () => {
                        if (document.getElementById('wechat-page').classList.contains('active')) {
                            renderChatList();
                        }
                    });
                }
            });

            closeLocationModal();
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

        function openLocationModal() {
            if (!currentChatFriendId) {
                showToast('请先选择一个聊天');
                return;
            }
            document.getElementById('location-name-input').value = '';
            document.getElementById('location-detail-input').value = '';
            document.getElementById('location-modal').style.display = 'flex';
            toggleActionPanel(); // Close the + menu
        }

        function closeLocationModal() {
            document.getElementById('location-modal').style.display = 'none';
        }

        function sendLocation() {
            const name = document.getElementById('location-name-input').value.trim();
            const detail = document.getElementById('location-detail-input').value.trim();

            if (!name) {
                showToast('请输入位置名称');
                return;
            }

            const message = {
                friendId: currentChatFriendId,
                text: `[位置] ${name}`,
                type: 'sent',
                timestamp: Date.now(),
                isLocation: true,
                locationName: name,
                locationDetail: detail
            };

            addMessageToUI(message);
            dbAdd('chat_history', message);

            dbGet('friends', currentChatFriendId, friend => {
                if (friend) {
                    friend.lastMsg = `[位置] ${name}`;
                    friend.lastTime = getCurrentTimeStr();
                    friend.lastActivityTimestamp = Date.now();
                    dbUpdate('friends', friend, () => {
                        if (document.getElementById('wechat-page').classList.contains('active')) {
                            renderChatList();
                        }
                    });
                }
            });

            closeLocationModal();
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
                    friend.lastActivityTimestamp = Date.now();
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
                                    friend.lastActivityTimestamp = Date.now();
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
        let isEmojiLibraryEditMode = false;
        let selectedAiStickerIds = new Set();

        function renderEmojiLibraryCharacters() {
            const select = document.getElementById('emoji-library-character-select');
            
            dbGetAll('friends', friends => {
                select.innerHTML = '';
                
                // Add Global option first
                const globalOption = document.createElement('option');
                globalOption.value = "global";
                globalOption.textContent = "全局/默认";
                select.appendChild(globalOption);

                const nonGroupFriends = (friends || []).filter(f => !f.isGroup);

                nonGroupFriends.forEach(friend => {
                    const option = document.createElement('option');
                    option.value = friend.id;
                    option.textContent = friend.name;
                    select.appendChild(option);
                });

                // Restore last selection or default to global
                if (lastSelectedEmojiCharacter && (lastSelectedEmojiCharacter === 'global' || nonGroupFriends.find(f => f.id === lastSelectedEmojiCharacter))) {
                    select.value = lastSelectedEmojiCharacter;
                } else {
                    select.value = 'global';
                    lastSelectedEmojiCharacter = 'global';
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

        function toggleEmojiLibraryEditMode(btn) {
            isEmojiLibraryEditMode = !isEmojiLibraryEditMode;
            const grid = document.getElementById('ai-sticker-grid');
            const actionBtn = document.getElementById('emoji-library-action-btn');
            
            if (isEmojiLibraryEditMode) {
                btn.textContent = "取消";
                grid.classList.add('batch-edit-mode');
                
                // Change bottom button to delete style
                actionBtn.classList.add('emoji-library-delete-btn');
                actionBtn.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
            } else {
                btn.textContent = "编辑";
                grid.classList.remove('batch-edit-mode');
                selectedAiStickerIds.clear(); // Clear selection
                
                // Reset checkboxes UI
                document.querySelectorAll('.sticker-select-checkbox').forEach(cb => cb.classList.remove('checked'));
                
                // Reset bottom button
                actionBtn.classList.remove('emoji-library-delete-btn');
                actionBtn.innerHTML = "+";
            }
        }

        function handleEmojiLibraryActionBtn() {
            if (isEmojiLibraryEditMode) {
                deleteSelectedAiStickers();
            } else {
                openAiStickerUploadModal();
            }
        }

        function toggleAiStickerSelection(id, element) {
            const checkbox = element.querySelector('.sticker-select-checkbox');
            if (selectedAiStickerIds.has(id)) {
                selectedAiStickerIds.delete(id);
                if (checkbox) checkbox.classList.remove('checked');
            } else {
                selectedAiStickerIds.add(id);
                if (checkbox) checkbox.classList.add('checked');
            }
        }

        function deleteSelectedAiStickers() {
            if (selectedAiStickerIds.size === 0) {
                showToast('请选择要删除的表情包');
                return;
            }

            // Custom modal with specific button styles as requested
            const modal = document.getElementById('custom-confirm-modal');
            const titleEl = document.getElementById('custom-confirm-title');
            const messageEl = document.getElementById('custom-confirm-message');
            const confirmBtn = document.getElementById('custom-confirm-confirm-btn');
            const cancelBtn = document.getElementById('custom-confirm-cancel-btn');

            titleEl.textContent = '确认删除';
            messageEl.textContent = `确定要删除选中的 ${selectedAiStickerIds.size} 个表情包吗？`;
            
            // Apply requested styles
            cancelBtn.style.backgroundColor = 'white';
            cancelBtn.style.color = 'black';
            cancelBtn.style.border = '1px solid #ddd'; // Adding border for visibility
            
            confirmBtn.style.backgroundColor = 'black';
            confirmBtn.style.color = 'white';

            modal.style.display = 'flex';

            confirmBtn.onclick = () => {
                const idsToDelete = Array.from(selectedAiStickerIds);
                let deletedCount = 0;
                
                idsToDelete.forEach(id => {
                    // id is likely a string from sticker.id, IndexedDB key might be number or string. 
                    // dbAdd uses autoIncrement true, so keys are numbers.
                    // We need to ensure we pass the correct type.
                    // ai_stickers store keyPath is 'id', autoIncrement true.
                    // We need to parse int if the ID string looks like an integer.
                    let key = id;
                    if (!isNaN(parseInt(id))) {
                        key = parseInt(id);
                    }

                    dbDelete('ai_stickers', key, () => {
                        deletedCount++;
                        if (deletedCount === idsToDelete.length) {
                            showToast('删除成功');
                            modal.style.display = 'none';
                            
                            // Reset styles
                            cancelBtn.style.backgroundColor = '';
                            cancelBtn.style.color = '';
                            cancelBtn.style.border = '';
                            confirmBtn.style.backgroundColor = '';
                            confirmBtn.style.color = '';
                            
                            // Exit edit mode (or stay? User didn't specify, but usually stay or refresh list)
                            // Let's refresh list and keep edit mode active for convenience, 
                            // but clear selection.
                            selectedAiStickerIds.clear();
                            renderAiStickers(lastSelectedEmojiCharacter);
                        }
                    });
                });
            };

            cancelBtn.onclick = () => {
                modal.style.display = 'none';
                // Reset styles
                cancelBtn.style.backgroundColor = '';
                cancelBtn.style.color = '';
                cancelBtn.style.border = '';
                confirmBtn.style.backgroundColor = '';
                confirmBtn.style.color = '';
            };
        }

        function renderAiStickers(friendId) {
            const grid = document.getElementById('ai-sticker-grid');
            grid.innerHTML = '';
            
            // Re-apply batch edit mode class if active
            if (isEmojiLibraryEditMode) {
                grid.classList.add('batch-edit-mode');
            } else {
                grid.classList.remove('batch-edit-mode');
            }

            if (!friendId) {
                grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; color:#999; margin-top:20px;">请先选择一个角色或全局</div>';
                return;
            }
            
            // Default Dice
            const diceItem = document.createElement('div');
            diceItem.className = 'sticker-item';
            diceItem.innerHTML = `<img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 100 100'><g transform='translate(0, -5)'><rect x='5' y='25' width='50' height='50' rx='10' fill='white' stroke='%23333' stroke-width='3'/><circle cx='20' cy='40' r='5' fill='%23333'/><circle cx='45' cy='40' r='5' fill='%23333'/><circle cx='20' cy='65' r='5' fill='%23333'/><circle cx='45' cy='65' r='5' fill='%23333'/><circle cx='32.5' cy='52.5' r='5' fill='%23333'/></g><g transform='translate(35, 25)'><rect x='5' y='25' width='50' height='50' rx='10' fill='white' stroke='%23333' stroke-width='3'/><circle cx='20' cy='40' r='5' fill='%23333'/><circle cx='45' cy='65' r='5' fill='%23333'/></g></svg>" alt="Dice">`;
            // Disable interaction in batch edit mode for dice (it's not deletable from here usually, or should we allow?)
            // It's a static item, not in DB, so cannot delete.
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

                        // Batch Selection Checkbox
                        const checkbox = document.createElement('div');
                        checkbox.className = 'sticker-select-checkbox';
                        if (selectedAiStickerIds.has(String(sticker.id)) || selectedAiStickerIds.has(sticker.id)) {
                            checkbox.classList.add('checked');
                        }

                        item.onclick = (e) => {
                            if (isEmojiLibraryEditMode) {
                                toggleAiStickerSelection(sticker.id, item);
                            } else {
                                sendSticker(sticker.src, sticker.description);
                            }
                        };
                        
                        item.appendChild(img);
                        item.appendChild(checkbox);
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
                showToast('请先选择一个角色或全局');
                return;
            }
            document.getElementById('ai-sticker-upload-modal').style.display = 'flex';
        }

        function closeAiStickerUploadModal() {
            document.getElementById('ai-sticker-upload-modal').style.display = 'none';
        }

        function handleAiStickerFiles(input) {
            const friendId = document.getElementById('emoji-library-character-select').value;
            if (!friendId) {
                showToast('请先选择一个角色或全局');
                return;
            }
            
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

            dbGet('friends', currentChatFriendId, friend => {
                if (friend && (friend.isGroup || friend.separateOfflineUI)) {
                    if (!friend.offlineSettings) {
                        friend.offlineSettings = { enabled: true };
                    } else {
                        friend.offlineSettings.enabled = true;
                    }
                    friend.separateOfflineUI = true;
                    dbUpdate('friends', friend, () => {
                        openOfflineChat(friend.id);
                        toggleActionPanel();
                    });
                    return;
                }
                
                openOfflineSettingsModal(true);
            });
        }

        function openOfflineSettingsModal(showEnableToggle = false) {
            if (!currentChatFriendId) return;

            const enableItem = document.getElementById('offline-mode-toggle').closest('.offline-modal-item');
            if (enableItem) {
                enableItem.style.display = showEnableToggle ? 'flex' : 'none';
            }

            const writingStyleSelect = document.getElementById('writing-style-select');
            writingStyleSelect.innerHTML = '<option value="default">默认风格</option>';
            const localWorldBooks = worldBooks || [];
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
                        
                        // If we are currently in the separate offline UI, re-render to apply the showThoughts setting immediately
                        if (document.getElementById('offline-chat-page').classList.contains('active')) {
                            renderOfflineChat(currentChatFriendId);
                        }
                    });
                }
            });
        }

        function openAiStickerUrlModal() {
            closeAiStickerUploadModal();
            const friendId = document.getElementById('emoji-library-character-select').value;
            if (!friendId) {
                showToast('请先选择一个角色或全局');
                return;
            }

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
                        if (!url.startsWith('http') && !url.startsWith('data:') && !url.startsWith('./') && !url.startsWith('/') && !url.match(/\.(png|jpe?g|gif|webp|svg|bmp)$/i)) return;
                        
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

            const reader = new FileReader();
            reader.onload = function(e) {
                const fileContent = e.target.result;
                input.value = ''; // Reset input after reading

                showCustomConfirm('导入数据将覆盖当前所有数据（包括聊天记录和设置），确认导入吗？', async () => {
                    try {
                        const data = JSON.parse(fileContent);
                        
                        // 1. Import LocalStorage
                        if (data.localStorage) {
                            localStorage.clear();
                            for (const key in data.localStorage) {
                                try {
                                    localStorage.setItem(key, data.localStorage[key]);
                                } catch (e) {
                                    console.warn(`Failed to set localStorage item ${key}:`, e);
                                }
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

                                    // Add new items in chunks to prevent iOS Safari transaction aborts
                                    if (items && items.length > 0) {
                                        const chunkSize = 200;
                                        for (let i = 0; i < items.length; i += chunkSize) {
                                            const chunk = items.slice(i, i + chunkSize);
                                            await new Promise((resolve, reject) => {
                                                const tx = db.transaction([storeName], 'readwrite');
                                                const store = tx.objectStore(storeName);
                                                tx.oncomplete = () => resolve();
                                                tx.onerror = (err) => reject(tx.error || err.target.error);
                                                tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
                                                
                                                chunk.forEach(item => {
                                                    try {
                                                        store.put(item);
                                                    } catch (e) {
                                                        console.warn(`Failed to put item in ${storeName}:`, e);
                                                    }
                                                });
                                            });
                                        }
                                    }
                                }
                            }
                        }
                        
                        showToast('导入成功，即将重新加载...');
                        setTimeout(() => location.reload(), 1500);

                    } catch (error) {
                        console.error('Import failed:', error);
                        let errorMsg = error.message || '未知错误';
                        if (error.name === 'QuotaExceededError') {
                            errorMsg = '存储空间不足';
                        }
                        showToast('导入失败：' + errorMsg);
                    }
                }, '确认导入');
            };
            reader.readAsText(file);
        }

        function migrateWorldBookData(callback) {
            const oldBooks = localStorage.getItem('worldBooks');
            const oldGroups = localStorage.getItem('worldBookGroups');
            
            let promises = [];

            if (oldBooks) {
                try {
                    const books = JSON.parse(oldBooks);
                    if (Array.isArray(books)) {
                        const bookPromise = new Promise(resolve => {
                            const tx = db.transaction('world_books', 'readwrite');
                            const store = tx.objectStore('world_books');
                            let count = 0;
                            if (books.length === 0) {
                                resolve();
                                return;
                            }
                            books.forEach(book => {
                                if (!book.id) book.id = String(Date.now() + Math.random());
                                const req = store.put(book);
                                req.onsuccess = () => {
                                    count++;
                                    if (count === books.length) resolve();
                                };
                                req.onerror = (e) => {
                                    console.error('Book migration put error:', e.target.error);
                                    count++; // still increment to not block forever
                                    if (count === books.length) resolve();
                                }
                            });
                            tx.oncomplete = () => {
                                localStorage.removeItem('worldBooks');
                                console.log('Migrated world books to IndexedDB.');
                            };
                            tx.onerror = (e) => {
                                console.error('Book migration transaction error:', e.target.error);
                                resolve(); // Resolve anyway
                            }
                        });
                        promises.push(bookPromise);
                    }
                } catch (e) {
                    console.error('Error parsing old world books from localStorage', e);
                }
            }

            if (oldGroups) {
                try {
                    const groups = JSON.parse(oldGroups);
                    if (Array.isArray(groups)) {
                        const groupPromise = new Promise(resolve => {
                            const groupData = { id: 'groups', value: groups };
                            dbUpdate('wb_settings', groupData, () => {
                                localStorage.removeItem('worldBookGroups');
                                console.log('Migrated world book groups to IndexedDB.');
                                resolve();
                            });
                        });
                        promises.push(groupPromise);
                    }
                } catch (e) {
                    console.error('Error parsing old world book groups from localStorage', e);
                }
            }

            Promise.all(promises).then(() => {
                if (callback) callback();
            });
        }

        async function loadWorldBookData(callback) {
            try {
                const books = await new Promise((resolve, reject) => dbGetAll('world_books', data => resolve(data || [])));
                worldBooks = books;

                const groupData = await new Promise((resolve, reject) => dbGet('wb_settings', 'groups', data => resolve(data)));
                worldBookGroups = (groupData && groupData.value) ? groupData.value : ['默认'];
            } catch (e) {
                console.error("Failed to load world book data:", e);
                worldBooks = [];
                worldBookGroups = ['默认'];
            } finally {
                if (callback) callback();
            }
        }

        // Initial Load
        initDB(() => {
            migrateWorldBookData(() => {
                loadWorldBookData(() => {
                    // After all data is loaded, render the list
                    renderChatList();
                    loadTheme();
                    // The rest of the init can happen in parallel
                });
            });
        });

        showPage('main-page');
        loadSettings();
        updateDate();
        updateTime();
        setInterval(updateTime, 1000);
        
        // Use Web Worker for background intervals instead of main thread setInterval
        if (window.Worker) {
            const timerWorker = new Worker('timer-worker.js');
            timerWorker.postMessage('start');
            timerWorker.onmessage = function(e) {
                if (e.data === 'tick') {
                    checkActiveChats();
                    runAutoSummarization();
                    checkAutoPostMoments();
                }
            };
            
            // Cleanup on page unload (optional but good practice)
            window.addEventListener('beforeunload', () => {
                timerWorker.postMessage('stop');
                timerWorker.terminate();
            });
        } else {
            // Fallback for older browsers
            setInterval(() => {
                checkActiveChats();
                runAutoSummarization();
                checkAutoPostMoments();
            }, 60000); // Check every minute for active chats & summarization
        }

        // Catch-up checks when app comes back to foreground
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                console.log('App resumed, running catch-up checks...');
                checkActiveChats();
                runAutoSummarization();
                checkAutoPostMoments();
            }
        });
        window.addEventListener('focus', () => {
            checkActiveChats();
            runAutoSummarization();
            checkAutoPostMoments();
        });

        async function checkAutoPostMoments() {
            const isGlobalEnabled = localStorage.getItem('global_auto_post_moments') === 'true';
            if (!isGlobalEnabled) return;

            const configStr = localStorage.getItem('globalConfig');
            if (!configStr) return;
            const config = JSON.parse(configStr);
            if (!config.apiKey || !config.model) return;

            dbGetAll('friends', friends => {
                const now = Date.now();
                friends.forEach(async friend => {
                    if (friend.autoPostMoments) {
                        const lastPostTime = friend.lastAutoPostTime || 0;
                        // 设定最低冷却时间为 4 小时 (14400000 ms)
                        const minIntervalMs = 4 * 60 * 60 * 1000; 
                        
                        if (now - lastPostTime > minIntervalMs) {
                            // 超过4小时后，每分钟有 2% 的概率发一条朋友圈
                            // 这样可以确保不是时间一到就立刻发，而是随机分布在接下来的几个小时内
                            if (Math.random() < 0.02) {
                                try {
                                    await generateMomentForCharacter(friend, config);
                                    if (document.getElementById('wechat-discover-page').classList.contains('active')) {
                                        renderDiscoverFeed();
                                    }
                                } catch (e) {
                                    console.error('Auto post failed:', e);
                                }
                            }
                        }
                    }
                });
            });
        }

        const fixViewportHeight = () => {
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

            if (isIOS && window.visualViewport) {
                const vv = window.visualViewport;
                const root = document.documentElement;

                const handleResize = () => {
                    const layoutHeight = window.innerHeight;
                    const keyboardHeight = layoutHeight - vv.height;
                    
                    // A threshold to make sure it's the keyboard
                    if (keyboardHeight > 80) {
                        root.style.setProperty('--keyboard-offset', `${keyboardHeight}px`);
                        const messagesContainer = document.getElementById('chat-messages-container');
                        if (messagesContainer) {
                            setTimeout(() => {
                                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                            }, 100);
                        }
                    } else {
                        root.style.setProperty('--keyboard-offset', '0px');
                    }
                };

                vv.addEventListener('resize', handleResize);
                
                // On blur, explicitly reset the offset.
                document.getElementById('chat-message-input').addEventListener('blur', () => {
                    root.style.setProperty('--keyboard-offset', '0px');
                });
                const offlineInput = document.getElementById('offline-chat-input');
                if (offlineInput) {
                    offlineInput.addEventListener('blur', () => {
                        root.style.setProperty('--keyboard-offset', '0px');
                    });
                }
            }

            // Keep the existing stability logic for all platforms
            if (window.visualViewport) {
                window.visualViewport.addEventListener('scroll', () => {
                    if (window.visualViewport.offsetTop > 0) {
                        window.scrollTo(0, 0);
                    }
                });
            }
            
            document.addEventListener('focusout', () => {
                window.scrollTo(0, 0);
            });
            
            window.addEventListener('scroll', () => {
                window.scrollTo(0, 0);
            }, { passive: false });

            const setVh = () => {
                document.documentElement.style.setProperty('--fixed-vh', `${window.innerHeight}px`);
            };
            setVh();
            let lastWidth = window.innerWidth;
            window.addEventListener('resize', () => {
                if (window.innerWidth !== lastWidth) {
                    lastWidth = window.innerWidth;
                    setVh();
                }
            });
        };


        function handleAvatarClick(friendId) {
            dbGet('friends', friendId, friend => {
                if (friend && friend.enableThoughts) {
                    showThoughtModal(friend);
                }
            });
        }

        function showThoughtModal(friend) {
            const modal = document.getElementById('thought-modal');
            document.getElementById('thought-role-name').textContent = friend.name;
            
            let moodContent = friend.latestMood;
            if (!moodContent || moodContent.trim() === '') {
                moodContent = '无';
            } else {
                // Sanitize mood to only show kaomoji, just in case
                moodContent = String(moodContent).replace(/[\u4e00-\u9fa5,.，。]/g, '').trim();
                if (moodContent === '') {
                    moodContent = '无'; // Fallback if it becomes empty after sanitizing
                }
            }
            document.getElementById('thought-mood-content').textContent = moodContent;
            
            const textSection = document.getElementById('thought-text-section');
            if (friend.showThoughtText !== false) { // Default true
                textSection.style.display = 'block';
                document.getElementById('thought-text-content').textContent = friend.latestThought || '无';
            } else {
                textSection.style.display = 'none';
            }
            
            modal.style.display = 'flex';
        }

        function closeThoughtModal(e) {
            if (e && e.target !== document.getElementById('thought-modal')) {
                return;
            }
            document.getElementById('thought-modal').style.display = 'none';
        }

        function checkDiscoverNotifications() {
            dbGetAll('discover_notifications', notifs => {
                const unread = notifs.filter(n => !n.isRead && n.toId === 'main_user');
                const badge = document.getElementById('discover-badge');
                const bar = document.getElementById('discover-notification-bar');
                const countEl = document.getElementById('discover-notification-count');
                const avatarEl = document.getElementById('discover-notification-avatar');
                
                if (unread.length > 0) {
                    // Show red dot
                    if (badge) badge.style.display = 'block';
                    
                    // Show bar
                    if (bar && countEl && avatarEl) {
                        // Sort by newest
                        unread.sort((a, b) => b.timestamp - a.timestamp);
                        const latest = unread[0];
                        avatarEl.src = latest.fromAvatar || 'https://via.placeholder.com/150';
                        countEl.textContent = `${unread.length}条新消息`;
                        bar.style.display = 'flex';
                    }
                } else {
                    if (badge) badge.style.display = 'none';
                    if (bar) bar.style.display = 'none';
                }
            });
        }

        function openDiscoverNotificationsModal() {
            const listContainer = document.getElementById('discover-notifications-list');
            listContainer.innerHTML = '';
            
            dbGetAll('discover_notifications', notifs => {
                const myNotifs = notifs.filter(n => n.toId === 'main_user');
                myNotifs.sort((a, b) => b.timestamp - a.timestamp);
                
                if (myNotifs.length === 0) {
                    listContainer.innerHTML = '<div style="padding: 30px; text-align: center; color: #999; font-size: 14px;">暂无消息</div>';
                } else {
                    myNotifs.forEach(notif => {
                        const item = document.createElement('div');
                        item.style.padding = '15px';
                        item.style.borderBottom = '1px solid #f0f0f0';
                        item.style.display = 'flex';
                        item.style.gap = '10px';
                        
                        const timeDate = new Date(notif.timestamp);
                        const timeStr = `${timeDate.getMonth() + 1}-${timeDate.getDate()} ${String(timeDate.getHours()).padStart(2, '0')}:${String(timeDate.getMinutes()).padStart(2, '0')}`;
                        
                        let contentHtml = '';
                        if (notif.type === 'like') {
                            contentHtml = `<svg viewBox="0 0 24 24" style="width: 14px; height: 14px; stroke: #576b95; fill: #576b95; margin-right: 5px; vertical-align: middle;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg><span style="color:#576b95;">赞了你的动态</span>`;
                        } else {
                            contentHtml = `<span>${notif.text}</span>`;
                        }

                        item.innerHTML = `
                            <img src="${notif.fromAvatar}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover; flex-shrink: 0; background: #eee;">
                            <div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: flex-start; gap: 4px;">
                                <span style="font-size: 15px; font-weight: 600; color: #576b95;">${notif.fromName}</span>
                                <div style="font-size: 14px; color: #333;">${contentHtml}</div>
                                <span style="font-size: 12px; color: #999;">${timeStr}</span>
                            </div>
                            <div style="width: 60px; height: 60px; background: #f7f7f7; overflow: hidden; font-size: 12px; color: #666; padding: 4px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; line-height: 1.4; border-radius: 4px;">
                                ${notif.postContent || '图片'}
                            </div>
                        `;
                        
                        listContainer.appendChild(item);
                        
                        // Mark as read
                        if (!notif.isRead) {
                            notif.isRead = true;
                            dbUpdate('discover_notifications', notif);
                        }
                    });
                }
                
                document.getElementById('discover-notifications-modal').style.display = 'flex';
                
                // Hide badge and bar
                const badge = document.getElementById('discover-badge');
                const bar = document.getElementById('discover-notification-bar');
                if (badge) badge.style.display = 'none';
                if (bar) bar.style.display = 'none';
            });
        }

        function closeDiscoverNotificationsModal() {
            document.getElementById('discover-notifications-modal').style.display = 'none';
        }

        function clearDiscoverNotifications() {
            showCustomConfirm('确定要清空所有消息记录吗？', () => {
                dbGetAll('discover_notifications', notifs => {
                    const myNotifs = notifs.filter(n => n.toId === 'main_user');
                    let count = 0;
                    if (myNotifs.length === 0) return;
                    
                    myNotifs.forEach(notif => {
                        dbDelete('discover_notifications', notif.id, () => {
                            count++;
                            if (count === myNotifs.length) {
                                openDiscoverNotificationsModal(); // Re-render empty state
                            }
                        });
                    });
                });
            }, '清空消息');
        }

    // 检查并注册 Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch(err => {
                    console.log('ServiceWorker registration failed: ', err);
                });
        });
    }

    // 初始化
    document.addEventListener('DOMContentLoaded', () => {
        const isActivated = localStorage.getItem('app_activated') === 'true';
        if (!isActivated) {
            document.getElementById('activation-page').style.display = 'flex';
            document.getElementById('main-app-container').style.display = 'none';
        } else {
            document.getElementById('activation-page').style.display = 'none';
            document.getElementById('main-app-container').style.display = 'flex';
        }

        document.getElementById('activation-code-input').addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                checkActivationCode();
            }
        });

        fixViewportHeight();
        document.getElementById('comment-drawer-overlay').addEventListener('click', closeCommentDrawer);

        // 为评论框添加回车发送功能
        document.getElementById('comment-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitComment();
            }
        });

        // 全局禁用所有输入框的系统自动填充（针对安卓的钥匙、信用卡、密码小人图标等）
        const disableAutofill = (el) => {
            // 避免使用 off 或 new-password，现代安卓系统和浏览器经常忽略 off，且 new-password 会明确唤起密码管理器
            // 使用一个随机/无效的值可以有效绕过大部分启发式自动填充
            el.setAttribute('autocomplete', 'nope');
            el.setAttribute('autocorrect', 'off');
            el.setAttribute('autocapitalize', 'off');
            el.setAttribute('spellcheck', 'false');
            el.setAttribute('data-form-type', 'other');
            el.setAttribute('data-lpignore', 'true'); // 针对部分第三方密码管理器
        };

        document.querySelectorAll('input, textarea').forEach(disableAutofill);

        // 监控动态创建的输入框（如打开弹窗时生成的元素）
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // ELEMENT_NODE
                        if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
                            disableAutofill(node);
                        }
                        if (node.querySelectorAll) {
                            node.querySelectorAll('input, textarea').forEach(disableAutofill);
                        }
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });

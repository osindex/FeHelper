/**
 * FE-Helper后台运行程序
 * @author zhaoxianlie@baidu.com
 */
var BgPageInstance = (function () {

    // debug cache，主要记录每个tab的ajax debug 开关
    var ajaxDbgCache = {};

    //各种元素的就绪情况
    var _readyState = {
        css: false,
        js: false,
        html: true,
        allDone: false
    };

    /**
     * 文本格式，可以设置一个图标和标题
     * @param {Object} options
     * @config {string} type notification的类型，可选值：html、text
     * @config {string} icon 图标
     * @config {string} title 标题
     * @config {string} message 内容
     */
    var notifyText = function (options) {
        if (!window.Notification) {
            return;
        }
        if (!options.icon) {
            options.icon = "static/img/fe-48.png";
        }
        if (!options.title) {
            options.title = "温馨提示";
        }

        return browser.notifications.create('', {
            type: 'basic',
            title: options.title,
            iconUrl: browser.runtime.getURL(options.icon),
            message: options.message
        });

    };

    //侦测就绪情况
    var _detectReadyState = function (callback) {
        if (_readyState.css && _readyState.js && _readyState.html) {
            _readyState.allDone = true;
        }
        if (_readyState.allDone && typeof callback == 'function') {
            callback();
        }
    };


    var _fcp_detect_interval = [];
    /**
     * 执行前端FCPHelper检测
     */
    var _doFcpDetect = function (tab) {
        //所有元素都准备就绪
        if (_readyState.allDone) {
            clearInterval(_fcp_detect_interval[tab.id]);
            browser.tabs.sendMessage(tab.id, {
                type: MSG_TYPE.BROWSER_CLICKED,
                event: MSG_TYPE.FCP_HELPER_DETECT
            });
        } else if (_fcp_detect_interval[tab.id] === undefined) {
            browser.tabs.sendMessage(tab.id, {
                type: MSG_TYPE.BROWSER_CLICKED,
                event: MSG_TYPE.FCP_HELPER_INIT
            });
            //显示桌面提醒
            notifyText({
                message: "正在准备数据，请稍等..."
            });
            _fcp_detect_interval[tab.id] = setInterval(function () {
                _doFcpDetect(tab);
            }, 200);
        }
    };

    /**
     * 查看页面wpo信息
     */
    var _showPageWpoInfo = function (wpoInfo) {
        browser.tabs.query({active: true, currentWindow: true}, function (tabs) {
            if (!wpoInfo) {
                notifyText({
                    message: "对不起，检测失败"
                });
            } else {
                browser.tabs.create({
                    url: "template/fehelper_wpo.html?" + btoa(encodeURIComponent(JSON.stringify(wpoInfo))),
                    active: true
                });
            }
        });
    };

    /**
     * 获取页面wpo信息
     * @return {[type]}
     */
    var _getPageWpoInfo = function () {
        browser.tabs.query({active: true, currentWindow: true}, function (tabs) {
            var tab = tabs[0];
            //显示桌面提醒
            browser.tabs.sendMessage(tab.id, {
                type: MSG_TYPE.GET_PAGE_WPO_INFO
            });
        });
    };

    /**
     * 代码压缩工具
     * @private
     */
    var _goCompressTool = function () {
        var url = "http://www.baidufe.com/fehelper/codecompress.html";
        browser.tabs.query({windowId: browser.windows.WINDOW_ID_CURRENT}, function (tabs) {
            var isOpened = false;
            var tabId;
            var reg = new RegExp("fehelper.*codecompress.html$", "i");
            for (var i = 0, len = tabs.length; i < len; i++) {
                if (reg.test(tabs[i].url)) {
                    isOpened = true;
                    tabId = tabs[i].id;
                    break;
                }
            }
            if (!isOpened) {
                browser.tabs.create({
                    url: url,
                    active: true
                });
            } else {
                browser.tabs.update(tabId, {highlighted: true});
            }
        });
    };

    /**
     * 创建或更新成功执行的动作
     * @param evt
     * @param content
     * @private
     */
    var _tabUpdatedCallback = function (evt, content) {
        return function (newTab) {
            if (content) {
                setTimeout(function () {
                    browser.tabs.sendMessage(newTab.id, {
                        type: MSG_TYPE.TAB_CREATED_OR_UPDATED,
                        content: content,
                        event: evt
                    });
                }, 300)
            }
        };
    };

    /**
     * 打开对应文件，运行该Helper
     * @param tab
     * @param file
     * @param txt
     * @private
     */
    var _openFileAndRun = function (tab, file, txt) {
        browser.tabs.query({windowId: browser.windows.WINDOW_ID_CURRENT}, function (tabs) {
            var isOpened = false;
            var tabId;
            var reg = new RegExp("^browser.*" + file + ".html$", "i");
            for (var i = 0, len = tabs.length; i < len; i++) {
                if (reg.test(tabs[i].url)) {
                    isOpened = true;
                    tabId = tabs[i].id;
                    break;
                }
            }
            if (!isOpened) {
                browser.tabs.create({
                    url: 'template/fehelper_' + file + '.html',
                    active: true
                }, _tabUpdatedCallback(file, txt));
            } else {
                browser.tabs.update(tabId, {highlighted: true}, _tabUpdatedCallback(file, txt));
            }
        });
    };

    /**
     * ajax debugger 开关切换
     * @private
     */
    var _debuggerSwitchOn = function () {
        browser.tabs.query({active: true, currentWindow: true}, function (tabs) {
            var tab = tabs[0];
            ajaxDbgCache[tab.id] = !ajaxDbgCache[tab.id];

            browser.tabs.executeScript(tab.id, {
                code: 'console.info("FeHelper提醒：Ajax Debugger开关已' + (ajaxDbgCache[tab.id] ? '开启' : '关闭') + '！");',
                allFrames: false
            });
        });
    };

    /**
     * 告诉DevTools页面，当前的debug开关是否打开
     * @param callback
     * @private
     */
    var _tellDevToolsDbgSwitchOn = function (callback) {

        browser.tabs.query({active: true, currentWindow: true}, function (tabs) {
            var tab = tabs[0];
            callback && callback(ajaxDbgCache[tab.id]);
        });
    };

    /**
     * 根据给定参数，运行对应的Helper
     */
    var _runHelper = function (config) {
        browser.tabs.query({active: true, currentWindow: true}, function (tabs) {
            var tab = tabs[0];
            // 如果是采用独立文件方式访问，直接打开该页面即可
            if (config.useFile == '1') {
                var content = config.msgType == MSG_TYPE.QR_CODE ? tab.url : '';
                _openFileAndRun(tab, config.msgType, content);
            } else {
                switch (config.msgType) {
                    //fcphelper检测
                    case MSG_TYPE.FCP_HELPER_DETECT:
                        _doFcpDetect(tab);
                        break;
                    //查看网页加载时间
                    case MSG_TYPE.SHOW_PAGE_LOAD_TIME:
                        _getPageWpoInfo();
                        break;
                    //代码压缩
                    case MSG_TYPE.CODE_COMPRESS:
                        _goCompressTool();
                        break;
                    //Ajax调试
                    case MSG_TYPE.AJAX_DEBUGGER:
                        _debuggerSwitchOn();
                        break;
                    default :
                        break;
                }
            }
        });
    };

    /**
     * 创建扩展专属的右键菜单
     */
    var _createContextMenu = function () {
        _removeContextMenu();
        baidu.contextMenuId = browser.contextMenus.create({
            title: "FeHelper",
            contexts: ['page', 'selection', 'editable', 'link','image'],
            documentUrlPatterns: ['http://*/*', 'https://*/*', 'file://*/*']
        });
        browser.contextMenus.create({
            title: "二维码生成",
            contexts: ['page', 'selection', 'editable', 'link'],
            parentId: baidu.contextMenuId,
            onclick: function (info, tab) {
                browser.tabs.executeScript(tab.id, {
                    code: '(' + (function () {
                        return window.getSelection().toString() || location.href;
                    }).toString() + ')()',
                    allFrames: false
                }, function (txt) {
                    _openFileAndRun(tab, 'qrcode', txt);
                });
            }
        });

        browser.contextMenus.create({
            type: 'separator',
            contexts: ['image'],
            parentId: baidu.contextMenuId
        });
        browser.contextMenus.create({
            title: "二维码解码",
            contexts: ['image'],
            parentId: baidu.contextMenuId,
            onclick: function (info, tab) {
                _qrDecode(info,tab);
            }
        });


        browser.contextMenus.create({
            type: 'separator',
            contexts: ['all'],
            parentId: baidu.contextMenuId
        });
        browser.contextMenus.create({
            title: "页面取色器",
            contexts: ['page', 'selection', 'editable'],
            parentId: baidu.contextMenuId,
            onclick: function (info, tab) {
                _showColorPicker();
            }
        });
        browser.contextMenus.create({
            type: 'separator',
            contexts: ['all'],
            parentId: baidu.contextMenuId
        });
        browser.contextMenus.create({
            title: "字符串编解码",
            contexts: ['page', 'selection', 'editable'],
            parentId: baidu.contextMenuId,
            onclick: function (info, tab) {
                browser.tabs.executeScript(tab.id, {
                    code: '(' + (function () {
                        return window.getSelection().toString();
                    }).toString() + ')()',
                    allFrames: false
                }, function (txt) {
                    _openFileAndRun(tab, 'endecode', txt);
                });
            }
        });
        browser.contextMenus.create({
            type: 'separator',
            contexts: ['all'],
            parentId: baidu.contextMenuId
        });
        browser.contextMenus.create({
            title: "JSON格式化",
            contexts: ['page', 'selection', 'editable'],
            parentId: baidu.contextMenuId,
            onclick: function (info, tab) {
                browser.tabs.executeScript(tab.id, {
                    code: '(' + (function () {
                        return window.getSelection().toString();
                    }).toString() + ')()',
                    allFrames: false
                }, function (txt) {
                    _openFileAndRun(tab, 'jsonformat', txt);
                });
            }
        });
        browser.contextMenus.create({
            type: 'separator',
            contexts: ['all'],
            parentId: baidu.contextMenuId
        });
        browser.contextMenus.create({
            title: "代码格式化",
            contexts: ['page', 'selection', 'editable'],
            parentId: baidu.contextMenuId,
            onclick: function (info, tab) {
                browser.tabs.executeScript(tab.id, {
                    code: '(' + (function () {
                        return window.getSelection().toString();
                    }).toString() + ')()',
                    allFrames: false
                }, function (txt) {
                    _openFileAndRun(tab, 'codebeautify', txt);
                });
            }
        });

    };

    /**
     * 移除扩展专属的右键菜单
     */
    var _removeContextMenu = function () {
        if (!baidu.contextMenuId) return;
        browser.contextMenus.remove(baidu.contextMenuId);
        baidu.contextMenuId = null;
    };

    /**
     * 创建或移除扩展专属的右键菜单
     */
    var _createOrRemoveContextMenu = function () {

        //管理右键菜单
        if (baidu.feOption.getOptionItem('opt_item_contextMenus') !== 'false') {
            _createContextMenu();
        } else {
            _removeContextMenu();
        }
    };

    /**
     * 二维码转码
     * @param info
     * @param tab
     * @private
     */
    var _qrDecode = function(info,tab){
        qrcode.callback = function (text) {
            if ((text || '').indexOf('error decoding QR Code') !== -1) {
                var image = new Image();
                image.src = info.srcUrl;
                image.onload = function () {
                    var width = this.naturalWidth;
                    var height = this.naturalHeight;

                    // url方式解码失败，再转换成data uri后继续解码
                    (function createCanvasContext(img, t, l, w, h) {
                        var canvas = document.createElement('canvas');
                        canvas.setAttribute('id', 'qr-canvas');
                        canvas.height = h + 100;
                        canvas.width = w + 100;
                        var context = canvas.getContext('2d');
                        context.fillStyle = 'rgb(255,255,255)';
                        context.fillRect(0, 0, canvas.width, canvas.height);
                        context.drawImage(img, l, t, w, h, 50, 50, w, h);
                        qrcode.callback = function (txt) {
                            browser.tabs.sendMessage(tab.id, {
                                type: MSG_TYPE.QR_DECODE,
                                result: txt
                            });
                        };
                        qrcode.decode(canvas.toDataURL());
                    })(image, 0, 0, width, height);
                }
            } else {
                browser.tabs.sendMessage(tab.id, {
                    type: MSG_TYPE.QR_DECODE,
                    result: text
                });
            }
        };
        qrcode.decode(info.srcUrl);
    };

    /**
     * 显示color picker
     * @private
     */
    var _showColorPicker = function () {
        browser.tabs.query({active: true, currentWindow: true}, function (tabs) {
            var tab = tabs[0];
            var tabid = tab.id;
            var port = browser.tabs.connect(tabid, {name: "popupshown"});
            browser.tabs.sendMessage(tabid, {enableColorPicker: true}, function (response) {
                browser.tabs.sendMessage(tabid, {doPick: true}, function (r) {
                });
            });
        });
    };

    /**
     * 将网页截成一张图，实现取色
     * @param callback
     * @private
     */
    var _drawColorPicker = function (callback) {
        browser.tabs.query({active: true, currentWindow: true}, function (tabs) {
            var tab = tabs[0];
            var tabid = tab.id;
            browser.tabs.captureVisibleTab(null, {format: 'png'}, function (dataUrl) {
                browser.tabs.sendMessage(tabid, {
                    setPickerImage: true,
                    pickerImage: dataUrl
                }, function (response) {
                    callback && callback();
                });
            });
        });
    };

    /**
     * 在当前页面的控制台输出console
     * @param request
     * @private
     */
    var _ajaxDebugger = function (request) {

        browser.tabs.query({active: true, currentWindow: true}, function (tabs) {
            var tab = tabs[0];
            browser.tabs.executeScript(tab.id, {
                code: "(" + (function (jsonStr) {
                    var args = JSON.parse(unescape(jsonStr));
                    console[args[0]].apply(console, Array.prototype.slice.call(args, 1));
                }).toString() + ")('" + request.content + "');"
            });
        });
    };

    /**
     * 接收来自content_scripts发来的消息
     */
    var _addExtensionListener = function () {
        browser.runtime.onMessage.addListener(function (request, sender, callback) {
            //处理CSS的请求
            if (request.type == MSG_TYPE.GET_CSS) {
                //直接AJAX获取CSS文件内容
                baidu.network.readFileContent(request.link, callback);
            }
            //处理JS的请求
            else if (request.type == MSG_TYPE.GET_JS) {
                //直接AJAX获取JS文件内容
                baidu.network.readFileContent(request.link, callback);
            }
            //处理HTML的请求
            else if (request.type == MSG_TYPE.GET_HTML) {
                //直接AJAX获取JS文件内容
                baidu.network.readFileContent(request.link, callback);
            }
            //处理cookie
            else if (request.type == MSG_TYPE.GET_COOKIE) {
                baidu.network.getCookies(request, callback);
            }
            //移除cookie
            else if (request.type == MSG_TYPE.REMOVE_COOKIE) {
                baidu.network.removeCookie(request, callback);
            }
            //设置cookie
            else if (request.type == MSG_TYPE.SET_COOKIE) {
                baidu.network.setCookie(request, callback);
            }
            //CSS准备就绪
            else if (request.type == MSG_TYPE.CSS_READY) {
                _readyState.css = true;
                _detectReadyState(callback);
            }
            //JS准备就绪
            else if (request.type == MSG_TYPE.JS_READY) {
                _readyState.js = true;
                _detectReadyState(callback);
            }
            //HTML准备就绪
            else if (request.type == MSG_TYPE.HTML_READY) {
                _readyState.html = true;
                _detectReadyState(callback);
            }
            //提取配置项
            else if (request.type == MSG_TYPE.GET_OPTIONS) {
                baidu.feOption.doGetOptions(request.items, callback);
            }
            //保存配置项
            else if (request.type == MSG_TYPE.SET_OPTIONS) {
                baidu.feOption.doSetOptions(request.items, callback);
                //管理右键菜单
                _createOrRemoveContextMenu();
            }
            //保存当前网页加载时间
            else if (request.type == MSG_TYPE.CALC_PAGE_LOAD_TIME) {
                _showPageWpoInfo(request.wpo);
            }
            // 从popup中点过来的
            else if (request.type == MSG_TYPE.FROM_POPUP) {
                _runHelper(request.config);
            }
            // color picker
            else if (request.type == MSG_TYPE.COLOR_PICKER) {
                _drawColorPicker(callback);
            }
            // console switch
            else if (request.type == MSG_TYPE.AJAX_DEBUGGER_SWITCH) {
                _tellDevToolsDbgSwitchOn(callback);
            }
            // console show
            else if (request.type == MSG_TYPE.AJAX_DEBUGGER_CONSOLE) {
                _ajaxDebugger(request);
            }

            return true;
        });
    };

    /**
     * 初始化
     */
    var _init = function () {
        console.log('init');
        _addExtensionListener();
        _createOrRemoveContextMenu();
    };

    return {
        init: _init,
        runHelper: _runHelper,
        showColorPicker: _showColorPicker,
        tellMeAjaxDbgSwitch: _tellDevToolsDbgSwitchOn
    };
})();

//初始化
BgPageInstance.init();

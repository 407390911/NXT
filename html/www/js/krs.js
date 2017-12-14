/******************************************************************************
 * Copyright © 2013-2016 The Kpl Core Developers.                             *
 * Copyright © 2016-2017 Jelurida IP B.V.                                     *
 *                                                                            *
 * See the LICENSE.txt file at the top-level directory of this distribution   *
 * for licensing information.                                                 *
 *                                                                            *
 * Unless otherwise agreed in a custom licensing agreement with Jelurida B.V.,*
 * no part of the Kpl software, including this file, may be copied, modified, *
 * propagated, or distributed except according to the terms contained in the  *
 * LICENSE.txt file.                                                          *
 *                                                                            *
 * Removal or modification of this copyright notice is prohibited.            *
 *                                                                            *
 ******************************************************************************/

/**
 * @depends {3rdparty/jquery-2.1.0.js}
 * @depends {3rdparty/bootstrap.js}
 * @depends {3rdparty/big.js}
 * @depends {3rdparty/jsbn.js}
 * @depends {3rdparty/jsbn2.js}
 * @depends {3rdparty/pako.js}
 * @depends {3rdparty/webdb.js}
 * @depends {3rdparty/growl.js}
 * @depends {crypto/curve25519.js}
 * @depends {crypto/curve25519_.js}
 * @depends {crypto/passphrasegenerator.js}
 * @depends {crypto/sha256worker.js}
 * @depends {crypto/3rdparty/cryptojs/aes.js}
 * @depends {crypto/3rdparty/cryptojs/sha256.js}
 * @depends {crypto/3rdparty/jssha256.js}
 * @depends {util/converters.js}
 * @depends {util/extensions.js}
 * @depends {util/kpladdress.js}
 */
var KRS = (function(KRS, $, undefined) {
	"use strict";

	KRS.client = "";
	KRS.state = {};
	KRS.blocks = [];
	KRS.account = KRS.account ? KRS.account : "";
	KRS.accountRS = KRS.accountRS ? KRS.accountRS : "";
	KRS.publicKey = "";
	KRS.accountInfo = {};

	KRS.database = null;
	KRS.databaseSupport = false;
	KRS.databaseFirstStart = false;

	// Legacy database, don't use this for data storage
	KRS.legacyDatabase = null;
	KRS.legacyDatabaseWithData = false;

	KRS.serverConnect = false;
	KRS.peerConnect = false;

	KRS.settings = {};
	KRS.mobileSettings = {
	    is_check_remember_me: false,
		is_store_remembered_passphrase: (window["cordova"] !== undefined), // too early to use feature detection
	    is_simulate_app: false,
        is_testnet: false,
        remote_node_address: "",
        remote_node_port: 7876,
        is_remote_node_ssl: false,
        validators_count: 3,
        bootstrap_nodes_count: 5
    };
	KRS.contacts = {};

	KRS.isTestNet = KRS.isTestNet ? KRS.isTestNet : false;
	KRS.forgingStatus = KRS.constants.UNKNOWN;
	KRS.isAccountForging = false;
	KRS.isLeased = false;
	KRS.needsAdminPassword = true;
    KRS.upnpExternalAddress = null;
	KRS.ledgerTrimKeep = 0;

	KRS.lastBlockHeight = 0;
	KRS.lastLocalBlockHeight = 0;
	KRS.downloadingBlockchain = false;

	KRS.rememberPassword = false;
	KRS.selectedContext = null;

	KRS.currentPage = "dashboard";
	KRS.currentSubPage = "";
	KRS.pageNumber = 1;
	//KRS.itemsPerPage = 50;  /* Now set in krs.settings.js */

	KRS.pages = {};
	KRS.incoming = {};
	KRS.setup = {};

	KRS.appVersion = "";
	KRS.appPlatform = "";
	KRS.assetTableKeys = [];

	KRS.lastProxyBlock = 0;
	KRS.lastProxyBlockHeight = 0;
    KRS.spinner = null;

    var stateInterval;
	var stateIntervalSeconds = 30;
	var isScanning = false;

	KRS.loadMobileSettings = function () {
		if (!window["localStorage"]) {
			return;
		}
		var mobileSettings = KRS.getJSONItem("mobile_settings");
		if (mobileSettings) {
            for (var setting in mobileSettings) {
                if (!mobileSettings.hasOwnProperty(setting)) {
                    continue;
                }
                KRS.mobileSettings[setting] = mobileSettings[setting];
            }
		}
        for (setting in KRS.mobileSettings) {
            if (!KRS.mobileSettings.hasOwnProperty(setting)) {
                continue;
            }
            KRS.logConsole("KRS.mobileSettings." + setting + " = " + KRS.mobileSettings[setting]);
        }
	};

	function initSpinner() {
        var opts = {
            lines: 13 // The number of lines to draw
            , length: 10 // The length of each line
            , width: 4 // The line thickness
            , radius: 20 // The radius of the inner circle
            , scale: 1 // Scales overall size of the spinner
            , corners: 1 // Corner roundness (0..1)
            , color: '#ffffff' // #rgb or #rrggbb or array of colors
            , opacity: 0.25 // Opacity of the lines
            , rotate: 0 // The rotation offset
            , direction: 1 // 1: clockwise, -1: counterclockwise
            , speed: 1 // Rounds per second
            , trail: 60 // Afterglow percentage
            , fps: 20 // Frames per second when using setTimeout() as a fallback for CSS
            , zIndex: 2e9 // The z-index (defaults to 2000000000)
            , className: 'spinner' // The CSS class to assign to the spinner
            , top: '50%' // Top position relative to parent
            , left: '50%' // Left position relative to parent
            , shadow: false // Whether to render a shadow
            , hwaccel: false // Whether to use hardware acceleration
            , position: 'absolute' // Element positioning
        };
        KRS.spinner = new Spinner(opts);
		console.log("Spinner initialized");
    }

    KRS.init = function() {
        i18next.use(i18nextXHRBackend)
            .use(i18nextLocalStorageCache)
            .use(i18nextBrowserLanguageDetector)
            .use(i18nextSprintfPostProcessor)
            .init({
                fallbackLng: "en",
                fallbackOnEmpty: true,
                lowerCaseLng: true,
                detectLngFromLocalStorage: true,
                resGetPath: "locales/__lng__/translation.json",
                compatibilityJSON: 'v1',
                compatibilityAPI: 'v1',
                debug: true
            }, function() {
                KRS.initSettings();

                jqueryI18next.init(i18next, $, {
                    handleName: "i18n"
                });

                initSpinner();
                KRS.spinner.spin($("#center")[0]);
                KRS.loadMobileSettings();
                if (KRS.isMobileApp()) {
                    $('body').css('overflow-x', 'auto');
                    initMobile();
                } else {
                    initImpl();
                }

                $("[data-i18n]").i18n();
                KRS.initClipboard();
                hljs.initHighlightingOnLoad();
            });
    };

    function initMobile() {
        var promise = new Promise(function(resolve, reject) {
            KRS.initRemoteNodesMgr(KRS.mobileSettings.is_testnet, resolve, reject);
        });
        promise.then(function() {
            KRS.remoteNodesMgr.findMoreNodes(true);
            initImpl();
        }).catch(function() {
            var msg = $.t("cannot_find_remote_nodes");
            console.log(msg);
            $.growl(msg);
			var loadConstantsPromise = new Promise(function(resolve) {
				console.log("load server constants");
				KRS.loadServerConstants(resolve);
			});
			loadConstantsPromise.then(function() {
				var mobileSettingsModal = $("#mobile_settings_modal");
				mobileSettingsModal.find("input[name=is_offline]").val("true");
				mobileSettingsModal.modal("show");
			});
        })
    }

    function initImpl() {
		var loadConstantsPromise = new Promise(function(resolve) {
			console.log("load server constants");
			KRS.loadServerConstants(resolve);
		});
		loadConstantsPromise.then(function() {
			var getStatePromise = new Promise(function(resolve) {
				console.log("calling getState");
				KRS.sendRequest("getState", {
					"includeCounts": "false"
				}, function (response) {
					console.log("getState response received");
					var isTestnet = false;
					var isOffline = false;
                    var customLoginWarning;
					var peerPort = 0;
					for (var key in response) {
						if (!response.hasOwnProperty(key)) {
							continue;
						}
						if (key == "isTestnet") {
							isTestnet = response[key];
						}
						if (key == "isOffline") {
							isOffline = response[key];
						}
						if (key == "customLoginWarning") {
                            customLoginWarning = response[key];
						}
						if (key == "peerPort") {
							peerPort = response[key];
						}
						if (key == "needsAdminPassword") {
							KRS.needsAdminPassword = response[key];
						}
						if (key == "upnpExternalAddress") {
							KRS.upnpExternalAddress = response[key];
						}
						if (key == "version") {
							KRS.appVersion = response[key];
						}
					}

					if (!isTestnet) {
						$(".testnet_only").hide();
					} else {
						KRS.isTestNet = true;
						var testnetWarningDiv = $("#testnet_warning");
						var warningText = testnetWarningDiv.text() + " The testnet peer port is " + peerPort + (isOffline ? ", the peer is working offline." : ".");
						KRS.logConsole(warningText);
						testnetWarningDiv.text(warningText);
						$(".testnet_only, #testnet_login, #testnet_warning").show();
					}
                    var customLoginWarningDiv = $(".custom_login_warning");
                    if (customLoginWarning) {
                        customLoginWarningDiv.text(customLoginWarning);
                        customLoginWarningDiv.show();
					} else {
						customLoginWarningDiv.hide();
					}

					if (KRS.isInitializePlugins()) {
						KRS.initializePlugins();
					}
					KRS.printEnvInfo();
					KRS.spinner.stop();
					console.log("getState response processed");
					resolve();
				});
			});

			getStatePromise.then(function() {
				console.log("continue initialization");
				var hasLocalStorage = false;
				try {
					//noinspection BadExpressionStatementJS
					window.localStorage && localStorage;
					hasLocalStorage = checkLocalStorage();
				} catch (err) {
					KRS.logConsole("localStorage is disabled, error " + err.message);
					hasLocalStorage = false;
				}

				if (!hasLocalStorage) {
					KRS.logConsole("localStorage is disabled, cannot load wallet");
					// TODO add visible warning
					return; // do not load client if local storage is disabled
				}

				if (!(navigator.userAgent.indexOf('Safari') != -1 &&
					navigator.userAgent.indexOf('Chrome') == -1) &&
					navigator.userAgent.indexOf('JavaFX') == -1) {
					// Don't use account based DB in Safari due to a buggy indexedDB implementation (2015-02-24)
					KRS.createLegacyDatabase();
				}

				if (KRS.mobileSettings.is_check_remember_me) {
					$("#remember_me").prop("checked", true);
				}
				KRS.getSettings(false);

				KRS.getState(function () {
					setTimeout(function () {
						KRS.checkAliasVersions();
					}, 5000);
				});

				$("body").popover({
					"selector": ".show_popover",
					"html": true,
					"trigger": "hover"
				});

				var savedPassphrase = KRS.getStrItem("savedPassphrase");
				if (!savedPassphrase) {
					KRS.showLockscreen();
				}
				KRS.setStateInterval(30);

				setInterval(KRS.checkAliasVersions, 1000 * 60 * 60);

				KRS.allowLoginViaEnter();
				KRS.automaticallyCheckRecipient();

				$("#dashboard_table, #transactions_table").on("mouseenter", "td.confirmations", function () {
					$(this).popover("show");
				}).on("mouseleave", "td.confirmations", function () {
					$(this).popover("destroy");
					$(".popover").remove();
				});

				_fix();

				$(window).on("resize", function () {
					_fix();

					if (KRS.currentPage == "asset_exchange") {
						KRS.positionAssetSidebar();
					}
				});
				// Enable all static tooltip components
				// tooltip components generated dynamically (for tables cells for example)
				// has to be enabled by activating this code on the specific widget
				$("[data-toggle='tooltip']").tooltip();

				$("#dgs_search_account_center").mask("KPL-****-****-****-*****");
				console.log("done initialization");
				if (KRS.getUrlParameter("account")) {
					KRS.login(false, KRS.getUrlParameter("account"));
				} else if (savedPassphrase) {
					$("#remember_me").prop("checked", true);
					KRS.login(true, savedPassphrase, null, false, true);
				}
			});
		});
	}

    KRS.initClipboard = function() {
        var clipboard = new Clipboard('#copy_account_id');
        function onCopySuccess(e) {
            $.growl($.t("success_clipboard_copy"), {
                "type": "success"
            });
            e.clearSelection();
        }
        clipboard.on('success', onCopySuccess);
        clipboard.on('error', function(e) {
            if (window.java) {
                if (window.java.copyText(e.text)) {
                    onCopySuccess(e);
                    return;
                }
            }
            KRS.logConsole('Copy failed. Action: ' + e.action + '; Text: ' + e.text);

        });
    };

	function _fix() {
		var height = $(window).height() - $("body > .header").height();
		var content = $(".wrapper").height();

		$(".content.content-stretch:visible").width($(".page:visible").width());
		if (content > height) {
			$(".left-side, html, body").css("min-height", content + "px");
		} else {
			$(".left-side, html, body").css("min-height", height + "px");
		}
	}

	KRS.setStateInterval = function(seconds) {
		if (!KRS.isPollGetState()) {
			return;
		}
		if (seconds == stateIntervalSeconds && stateInterval) {
			return;
		}
		if (stateInterval) {
			clearInterval(stateInterval);
		}
		stateIntervalSeconds = seconds;
		stateInterval = setInterval(function() {
			KRS.getState(null);
			KRS.updateForgingStatus();
		}, 1000 * seconds);
	};

	var _firstTimeAfterLoginRun = false;
	var _prevLastProxyBlock = "0";

	KRS.getLastBlock = function() {
		return KRS.state.apiProxy ? KRS.lastProxyBlock : KRS.state.lastBlock;
	};

	KRS.handleBlockchainStatus = function(response, callback) {
		var firstTime = !("lastBlock" in KRS.state);
		var previousLastBlock = (firstTime ? "0" : KRS.state.lastBlock);

		KRS.state = response;
		var lastBlock = KRS.state.lastBlock;
		var height = response.apiProxy ? KRS.lastProxyBlockHeight : KRS.state.numberOfBlocks - 1;

		KRS.serverConnect = true;
		KRS.ledgerTrimKeep = response.ledgerTrimKeep;
		$("#sidebar_block_link").html(KRS.getBlockLink(height));
		if (firstTime) {
			$("#krs_version").html(KRS.state.version).removeClass("loading_dots");
			KRS.getBlock(lastBlock, KRS.handleInitialBlocks);
		} else if (KRS.state.isScanning) {
			//do nothing but reset KRS.state so that when isScanning is done, everything is reset.
			isScanning = true;
		} else if (isScanning) {
			//rescan is done, now we must reset everything...
			isScanning = false;
			KRS.blocks = [];
			KRS.tempBlocks = [];
			KRS.getBlock(lastBlock, KRS.handleInitialBlocks);
			if (KRS.account) {
				KRS.getInitialTransactions();
				KRS.getAccountInfo();
			}
		} else if (previousLastBlock != lastBlock) {
			KRS.tempBlocks = [];
			if (KRS.account) {
				KRS.getAccountInfo();
			}
			KRS.getBlock(lastBlock, KRS.handleNewBlocks);
			if (KRS.account) {
				KRS.getNewTransactions();
				KRS.updateApprovalRequests();
			}
		} else {
			if (KRS.account) {
				KRS.getUnconfirmedTransactions(function(unconfirmedTransactions) {
					KRS.handleIncomingTransactions(unconfirmedTransactions, false);
				});
			}
		}
		if (KRS.account && !_firstTimeAfterLoginRun) {
			//Executed ~30 secs after login, can be used for tasks needing this condition state
			_firstTimeAfterLoginRun = true;
		}

		if (callback) {
			callback();
		}
	};

    KRS.connectionError = function(errorDescription) {
        KRS.serverConnect = false;
        var msg = $.t("error_server_connect", {url: KRS.getRequestPath()}) +
            (errorDescription ? " " + KRS.escapeRespStr(errorDescription) : "");
        $.growl(msg, {
            "type": "danger",
            "offset": 10
        });
        KRS.logConsole(msg);
    };

    KRS.getState = function(callback, msg) {
		if (msg) {
			KRS.logConsole("getState event " + msg);
		}
		KRS.sendRequest("getBlockchainStatus", {}, function(response) {
			if (response.errorCode) {
                KRS.connectionError(response.errorDescription);
			} else {
				var clientOptionsLink = $("#header_client_options_link");
                if (KRS.isMobileApp()) {
                    clientOptionsLink.html($.t("mobile_client"));
                }
				if (response.apiProxy) {
                    if (!KRS.isMobileApp()) {
                        if (response.isLightClient) {
                            clientOptionsLink.html($.t("light_client"));
                        } else {
                            clientOptionsLink.html($.t("roaming_client"));
                        }
                    }
					KRS.sendRequest("getBlocks", {
						"firstIndex": 0, "lastIndex": 0
					}, function(proxyBlocksResponse) {
						if (proxyBlocksResponse.errorCode) {
                            KRS.connectionError(proxyBlocksResponse.errorDescription);
						} else {
							_prevLastProxyBlock = KRS.lastProxyBlock;
							var prevHeight = KRS.lastProxyBlockHeight;
							KRS.lastProxyBlock = proxyBlocksResponse.blocks[0].block;
							KRS.lastProxyBlockHeight = proxyBlocksResponse.blocks[0].height;
							KRS.lastBlockHeight = KRS.lastProxyBlockHeight;
							KRS.incoming.updateDashboardBlocks(KRS.lastProxyBlockHeight - prevHeight);
							KRS.updateDashboardLastBlock(proxyBlocksResponse.blocks[0]);
							KRS.handleBlockchainStatus(response, callback);
                            KRS.updateDashboardMessage();
						}
					}, { isAsync: false });
					if (!KRS.isMobileApp()) {
						console.log("look for remote confirmation nodes");
						KRS.initRemoteNodesMgr(KRS.isTestnet);
					}
				} else {
					KRS.handleBlockchainStatus(response, callback);
				}
                var clientOptions = $(".client_options");
                if (KRS.isShowClientOptionsLink()) {
                    clientOptions.show();
                } else {
                    clientOptions.hide();
                }
				if (KRS.isShowRemoteWarning()) {
					$(".remote_warning").show();
				}
			}
			/* Checks if the client is connected to active peers */
			KRS.checkConnected();
			//only done so that download progress meter updates correctly based on lastFeederHeight
			if (KRS.downloadingBlockchain) {
				KRS.updateBlockchainDownloadProgress();
			}
		});
	};

	$("#logo, .sidebar-menu").on("click", "a", function(e, data) {
		if ($(this).hasClass("ignore")) {
			$(this).removeClass("ignore");
			return;
		}

		e.preventDefault();

		if ($(this).data("toggle") == "modal") {
			return;
		}

		var page = $(this).data("page");

		if (page == KRS.currentPage) {
			if (data && data.callback) {
				data.callback();
			}
			return;
		}

		$(".page").hide();

		$(document.documentElement).scrollTop(0);

		$("#" + page + "_page").show();

		$(".content-header h1").find(".loading_dots").remove();

        var $newActiveA;
        if ($(this).attr("id") && $(this).attr("id") == "logo") {
            $newActiveA = $("#dashboard_link").find("a");
		} else {
			$newActiveA = $(this);
		}
		var $newActivePageLi = $newActiveA.closest("li.treeview");

		$("ul.sidebar-menu > li.active").each(function(key, elem) {
			if ($newActivePageLi.attr("id") != $(elem).attr("id")) {
				$(elem).children("a").first().addClass("ignore").click();
			}
		});

		$("ul.sidebar-menu > li.sm_simple").removeClass("active");
		if ($newActiveA.parent("li").hasClass("sm_simple")) {
			$newActiveA.parent("li").addClass("active");
		}

		$("ul.sidebar-menu li.sm_treeview_submenu").removeClass("active");
		if($(this).parent("li").hasClass("sm_treeview_submenu")) {
			$(this).closest("li").addClass("active");
		}

		if (KRS.currentPage != "messages") {
			$("#inline_message_password").val("");
		}

		//KRS.previousPage = KRS.currentPage;
		KRS.currentPage = page;
		KRS.currentSubPage = "";
		KRS.pageNumber = 1;
		KRS.showPageNumbers = false;

		if (KRS.pages[page]) {
			KRS.pageLoading();
			KRS.resetNotificationState(page);
            var callback;
            if (data) {
				if (data.callback) {
					callback = data.callback;
				} else {
					callback = data;
				}
			} else {
				callback = undefined;
			}
            var subpage;
            if (data && data.subpage) {
                subpage = data.subpage;
			} else {
				subpage = undefined;
			}
			KRS.pages[page](callback, subpage);
		}
	});

	$("button.goto-page, a.goto-page").click(function(event) {
		event.preventDefault();
		KRS.goToPage($(this).data("page"), undefined, $(this).data("subpage"));
	});

	KRS.loadPage = function(page, callback, subpage) {
		KRS.pageLoading();
		KRS.pages[page](callback, subpage);
	};

    KRS.languageAuto = function(){
        var type = navigator.appName;
        var lang = type=="Netscape"?navigator.language:navigator.userLanguage;
        lang = lang.escapeHTML();//lang.substr(0,5);
        var set_lang = '';
        if(!lang){
            KRS.sendRequest("appLanguage", {}, function(data) {
                var _data = data;
                switch(_data["language"].toUpperCase()){
                    case "ZH":
                    case "ZH-CN":
                    case "CN":
                        set_lang = "zh-cn";
                        break;
                    default:
                        set_lang = "en";
                }
                KRS.updateSettings("language",set_lang);
            });
        }else{
            if(lang.toUpperCase() === "ZH-CN") {
                set_lang = "zh-cn";
            }else{
                set_lang = "en";
            }
            KRS.updateSettings("language",set_lang);
        }
    }

	KRS.goToPage = function(page, callback, subpage) {
		var $link = $("ul.sidebar-menu a[data-page=" + page + "]");

		if ($link.length > 1) {
			if ($link.last().is(":visible")) {
				$link = $link.last();
			} else {
				$link = $link.first();
			}
		}

		if ($link.length == 1) {
			$link.trigger("click", [{
				"callback": callback,
				"subpage": subpage
			}]);
			KRS.resetNotificationState(page);
		} else {
			KRS.currentPage = page;
			KRS.currentSubPage = "";
			KRS.pageNumber = 1;
			KRS.showPageNumbers = false;

			$("ul.sidebar-menu a.active").removeClass("active");
			$(".page").hide();
			$("#" + page + "_page").show();
			if (KRS.pages[page]) {
				KRS.pageLoading();
				KRS.resetNotificationState(page);
				KRS.pages[page](callback, subpage);
			}
		}
	};

	KRS.pageLoading = function() {
		KRS.hasMorePages = false;

		var $pageHeader = $("#" + KRS.currentPage + "_page .content-header h1");
		$pageHeader.find(".loading_dots").remove();
		$pageHeader.append("<span class='loading_dots'><span>.</span><span>.</span><span>.</span></span>");
	};

	KRS.pageLoaded = function(callback) {
		var $currentPage = $("#" + KRS.currentPage + "_page");

		$currentPage.find(".content-header h1 .loading_dots").remove();

		if ($currentPage.hasClass("paginated")) {
			KRS.addPagination();
		}

		if (callback) {
			try {
                callback();
            } catch(e) { /* ignore since sometimes callback is not a function */ }
		}
	};

	KRS.addPagination = function () {
        var firstStartNr = 1;
		var firstEndNr = KRS.itemsPerPage;
		var currentStartNr = (KRS.pageNumber-1) * KRS.itemsPerPage + 1;
		var currentEndNr = KRS.pageNumber * KRS.itemsPerPage;

		var prevHTML = '<span style="display:inline-block;width:48px;text-align:right;">';
		var firstHTML = '<span style="display:inline-block;min-width:48px;text-align:right;vertical-align:top;margin-top:4px;">';
		var currentHTML = '<span style="display:inline-block;min-width:48px;text-align:left;vertical-align:top;margin-top:4px;">';
		var nextHTML = '<span style="display:inline-block;width:48px;text-align:left;">';

		if (KRS.pageNumber > 1) {
			prevHTML += "<a href='#' data-page='" + (KRS.pageNumber - 1) + "' title='" + $.t("previous") + "' style='font-size:20px;'>";
			prevHTML += "<i class='fa fa-arrow-circle-left'></i></a>";
		} else {
			prevHTML += '&nbsp;';
		}

		if (KRS.hasMorePages) {
			currentHTML += currentStartNr + "-" + currentEndNr + "&nbsp;";
			nextHTML += "<a href='#' data-page='" + (KRS.pageNumber + 1) + "' title='" + $.t("next") + "' style='font-size:20px;'>";
			nextHTML += "<i class='fa fa-arrow-circle-right'></i></a>";
		} else {
			if (KRS.pageNumber > 1) {
				currentHTML += currentStartNr + "+";
			} else {
				currentHTML += "&nbsp;";
			}
			nextHTML += "&nbsp;";
		}
		if (KRS.pageNumber > 1) {
			firstHTML += "&nbsp;<a href='#' data-page='1'>" + firstStartNr + "-" + firstEndNr + "</a>&nbsp;|&nbsp;";
		} else {
			firstHTML += "&nbsp;";
		}

		prevHTML += '</span>';
		firstHTML += '</span>';
		currentHTML += '</span>';
		nextHTML += '</span>';

		var output = prevHTML + firstHTML + currentHTML + nextHTML;
		var $paginationContainer = $("#" + KRS.currentPage + "_page .data-pagination");

		if ($paginationContainer.length) {
			$paginationContainer.html(output);
		}
	};

	$(document).on("click", ".data-pagination a", function(e) {
		e.preventDefault();
		KRS.goToPageNumber($(this).data("page"));
	});

	KRS.goToPageNumber = function(pageNumber) {
		/*if (!pageLoaded) {
			return;
		}*/
		KRS.pageNumber = pageNumber;

		KRS.pageLoading();

		KRS.pages[KRS.currentPage]();
	};

	function initUserDB() {
		KRS.storageSelect("data", [{
			"id": "asset_exchange_version"
		}], function(error, result) {
			if (!result || !result.length) {
				KRS.storageDelete("assets", [], function(error) {
					if (!error) {
						KRS.storageInsert("data", "id", {
							"id": "asset_exchange_version",
							"contents": 2
						});
					}
				});
			}
		});

		KRS.storageSelect("data", [{
			"id": "closed_groups"
		}], function(error, result) {
			if (result && result.length) {
				KRS.setClosedGroups(result[0].contents.split("#"));
			} else {
				KRS.storageInsert("data", "id", {
					id: "closed_groups",
					contents: ""
				});
			}
		});
		KRS.loadContacts();
		KRS.getSettings(true);
		KRS.updateNotifications();
		KRS.setUnconfirmedNotifications();
		KRS.setPhasingNotifications();
        KRS.setShufflingNotifications();
		var page = KRS.getUrlParameter("page");
		if (page) {
			page = page.escapeHTML();
			if (KRS.pages[page]) {
				KRS.goToPage(page);
			} else {
				$.growl($.t("page") + " " + page + " " + $.t("does_not_exist"), {
					"type": "danger",
					"offset": 50
				});
			}
		}
		if (KRS.getUrlParameter("modal")) {
			var urlParams = [];
			if (window.location.search && window.location.search.length > 1) {
				urlParams = window.location.search.substring(1).split('&');
			}
			var modalId = "#" + KRS.getUrlParameter("modal").escapeHTML();
			var modal = $(modalId);
			var attributes = {};
			if (modal[0]) {
				var isValidParams = true;
				for (var i = 0; i < urlParams.length; i++) {
					var paramKeyValue = urlParams[i].split('=');
					if (paramKeyValue.length != 2) {
						continue;
					}
					var key = paramKeyValue[0].escapeHTML();
					if (key == "account" || key == "modal") {
						continue;
					}
					var value = paramKeyValue[1].escapeHTML();
                    var input = modal.find("input[name=" + key + "]");
                    if (input[0]) {
						if (input.attr("type") == "text") {
							input.val(value);
						} else if (input.attr("type") == "checkbox") {
							var isChecked = false;
							if (value != "true" && value != "false") {
								isValidParams = false;
								$.growl($.t("value") + " " + value + " " + $.t("must_be_true_or_false") + " " + $.t("for") + " " + key, {
									"type": "danger",
									"offset": 50
								});
							} else if (value == "true") {
								isChecked = true;
							}
							if (isValidParams) {
								input.prop('checked', isChecked);
							}
						}
					} else if (modal.find("textarea[name=" + key + "]")[0]) {
						modal.find("textarea[name=" + key + "]").val(decodeURI(value));
					} else {
						attributes["data-" + key.toLowerCase().escapeHTML()] = String(value).escapeHTML();
					}
				}
				if (isValidParams) {
					var a = $('<a />');
					a.attr('href', '#');
					a.attr('data-toggle', 'modal');
					a.attr('data-target', modalId);
					Object.keys(attributes).forEach(function (key) {
						a.attr(key, attributes[key]);
					});
					$('body').append(a);
					a.click();
				}
			} else {
				$.growl($.t("modal") + " " + modalId + " " + $.t("does_not_exist"), {
					"type": "danger",
					"offset": 50
				});
			}
		}
	}

	KRS.initUserDBSuccess = function() {
		KRS.databaseSupport = true;
		initUserDB();
        KRS.logConsole("IndexedDB initialized");
    };

	KRS.initUserDBWithLegacyData = function() {
		var legacyTables = ["contacts", "assets", "data"];
		$.each(legacyTables, function(key, table) {
			KRS.legacyDatabase.select(table, null, function(error, results) {
				if (!error && results && results.length >= 0) {
					KRS.database.insert(table, results, function(error, inserts) {});
				}
			});
		});
		setTimeout(function(){ KRS.initUserDBSuccess(); }, 1000);
	};

	KRS.initLocalStorage = function() {
		KRS.database = null;
		KRS.databaseSupport = false;
		initUserDB();
        KRS.logConsole("local storage initialized");
    };

	KRS.createLegacyDatabase = function() {
		var schema = {};
		var versionLegacyDB = 2;

		// Legacy DB before switching to account based DBs, leave schema as is
		schema["contacts"] = {
			id: {
				"primary": true,
				"autoincrement": true,
				"type": "NUMBER"
			},
			name: "VARCHAR(100) COLLATE NOCASE",
			email: "VARCHAR(200)",
			account: "VARCHAR(25)",
			accountRS: "VARCHAR(25)",
			description: "TEXT"
		};
		schema["assets"] = {
			account: "VARCHAR(25)",
			accountRS: "VARCHAR(25)",
			asset: {
				"primary": true,
				"type": "VARCHAR(25)"
			},
			description: "TEXT",
			name: "VARCHAR(10)",
			decimals: "NUMBER",
			quantityQNT: "VARCHAR(15)",
			groupName: "VARCHAR(30) COLLATE NOCASE"
		};
		schema["data"] = {
			id: {
				"primary": true,
				"type": "VARCHAR(40)"
			},
			contents: "TEXT"
		};
		if (versionLegacyDB == KRS.constants.DB_VERSION) {
			try {
				KRS.legacyDatabase = new WebDB("KRS_USER_DB", schema, versionLegacyDB, 4, function(error) {
					if (!error) {
						KRS.legacyDatabase.select("data", [{
							"id": "settings"
						}], function(error, result) {
							if (result && result.length > 0) {
								KRS.legacyDatabaseWithData = true;
							}
						});
					}
				});
			} catch (err) {
                KRS.logConsole("error creating database " + err.message);
			}
		}
	};

	function createSchema(){
		var schema = {};

		schema["contacts"] = {
			id: {
				"primary": true,
				"autoincrement": true,
				"type": "NUMBER"
			},
			name: "VARCHAR(100) COLLATE NOCASE",
			email: "VARCHAR(200)",
			account: "VARCHAR(25)",
			accountRS: "VARCHAR(25)",
			description: "TEXT"
		};
		schema["assets"] = {
			account: "VARCHAR(25)",
			accountRS: "VARCHAR(25)",
			asset: {
				"primary": true,
				"type": "VARCHAR(25)"
			},
			description: "TEXT",
			name: "VARCHAR(10)",
			decimals: "NUMBER",
			quantityQNT: "VARCHAR(15)",
			groupName: "VARCHAR(30) COLLATE NOCASE"
		};
		schema["polls"] = {
			account: "VARCHAR(25)",
			accountRS: "VARCHAR(25)",
			name: "VARCHAR(100)",
			description: "TEXT",
			poll: "VARCHAR(25)",
			finishHeight: "VARCHAR(25)"
		};
		schema["data"] = {
			id: {
				"primary": true,
				"type": "VARCHAR(40)"
			},
			contents: "TEXT"
		};
		return schema;
	}

	function initUserDb(){
		KRS.logConsole("Database is open");
		KRS.database.select("data", [{
			"id": "settings"
		}], function(error, result) {
			if (result && result.length > 0) {
				KRS.logConsole("Settings already exist");
				KRS.databaseFirstStart = false;
				KRS.initUserDBSuccess();
			} else {
				KRS.logConsole("Settings not found");
				KRS.databaseFirstStart = true;
				if (KRS.legacyDatabaseWithData) {
					KRS.initUserDBWithLegacyData();
				} else {
					KRS.initUserDBSuccess();
				}
			}
		});
	}

	KRS.createDatabase = function (dbName) {
		if (!KRS.isIndexedDBSupported()) {
			KRS.logConsole("IndexedDB not supported by the rendering engine, using localStorage instead");
			KRS.initLocalStorage();
			return;
		}
		var schema = createSchema();
		KRS.assetTableKeys = ["account", "accountRS", "asset", "description", "name", "position", "decimals", "quantityQNT", "groupName"];
		KRS.pollsTableKeys = ["account", "accountRS", "poll", "description", "name", "finishHeight"];
		try {
			KRS.logConsole("Opening database " + dbName);
            KRS.database = new WebDB(dbName, schema, KRS.constants.DB_VERSION, 4, function(error, db) {
                if (!error) {
                    KRS.indexedDB = db;
                    initUserDb();
                } else {
                    KRS.logConsole("Error opening database " + error);
                    KRS.initLocalStorage();
                }
            });
            KRS.logConsole("Opening database " + KRS.database);
		} catch (e) {
			KRS.logConsole("Exception opening database " + e.message);
			KRS.initLocalStorage();
		}
	};

	/* Display connected state in Sidebar */
	KRS.checkConnected = function() {
		KRS.sendRequest("getPeers+", {
			"state": "CONNECTED"
		}, function(response) {
            var connectedIndicator = $("#connected_indicator");
            if (response.peers && response.peers.length) {
				KRS.peerConnect = true;
				connectedIndicator.addClass("connected");
                connectedIndicator.find("span").html($.t("Connected")).attr("data-i18n", "connected");
				connectedIndicator.show();
			} else {
				KRS.peerConnect = false;
				connectedIndicator.removeClass("connected");
				connectedIndicator.find("span").html($.t("Not Connected")).attr("data-i18n", "not_connected");
				connectedIndicator.show();
			}
		});
	};

	KRS.getRequestPath = function (noProxy) {
		var url = KRS.getRemoteNodeUrl();
		if (!KRS.state.apiProxy || noProxy) {
			return url + "/kpl";
		} else {
			return url + "/kpl-proxy";
		}
	};

	KRS.getAccountInfo = function(firstRun, callback, isAccountSwitch) {
		KRS.sendRequest("getAccount", {
			"account": KRS.account,
			"includeAssets": true,
			"includeCurrencies": true,
			"includeLessors": true,
			"includeEffectiveBalance": true
		}, function(response) {
			var previousAccountInfo = KRS.accountInfo;
			KRS.accountInfo = response;
			if (response.errorCode) {
				KRS.logConsole("Get account info error (" + response.errorCode + ") " + response.errorDescription);
				$("#account_balance, #account_balance_sidebar, #account_currencies_balance, #account_nr_currencies, #account_purchase_count, #account_pending_sale_count, #account_completed_sale_count, #account_message_count, #account_alias_count").html("0");
                KRS.updateDashboardMessage();
			} else {
				if (KRS.accountRS && KRS.accountInfo.accountRS != KRS.accountRS) {
					$.growl("Generated Reed Solomon address different from the one in the blockchain!", {
						"type": "danger"
					});
					KRS.accountRS = KRS.accountInfo.accountRS;
				}
                KRS.updateDashboardMessage();
                $("#account_balance, #account_balance_sidebar").html(KRS.formatStyledAmount(response.unconfirmedBalanceNQT));
                $("#account_forged_balance").html(KRS.formatStyledAmount(response.forgedBalanceNQT));

                if (KRS.isDisplayOptionalDashboardTiles()) {
                    // only show if happened within last week and not during account switch
                    var showAssetDifference = !isAccountSwitch &&
                        ((!KRS.downloadingBlockchain || (KRS.blocks && KRS.blocks[0] && KRS.state && KRS.state.time - KRS.blocks[0].timestamp < 60 * 60 * 24 * 7)));

                    // When switching account this query returns error
                    if (!isAccountSwitch) {
                        KRS.storageSelect("data", [{
                            "id": "asset_balances"
                        }], function (error, asset_balance) {
                            if (asset_balance && asset_balance.length) {
                                var previous_balances = asset_balance[0].contents;
                                if (!KRS.accountInfo.assetBalances) {
                                    KRS.accountInfo.assetBalances = [];
                                }
                                var current_balances = JSON.stringify(KRS.accountInfo.assetBalances);
                                if (previous_balances != current_balances) {
                                    if (previous_balances != "undefined" && typeof previous_balances != "undefined") {
                                        previous_balances = JSON.parse(previous_balances);
                                    } else {
                                        previous_balances = [];
                                    }
                                    KRS.storageUpdate("data", {
                                        contents: current_balances
                                    }, [{
                                        id: "asset_balances"
                                    }]);
                                    if (showAssetDifference) {
                                        KRS.checkAssetDifferences(KRS.accountInfo.assetBalances, previous_balances);
                                    }
                                }
                            } else {
                                KRS.storageInsert("data", "id", {
                                    id: "asset_balances",
                                    contents: JSON.stringify(KRS.accountInfo.assetBalances)
                                });
                            }
                        });
                    }

                    var i;
                    if ((firstRun || isAccountSwitch) && response.assetBalances) {
                        var assets = [];
                        var assetBalances = response.assetBalances;
                        var assetBalancesMap = {};
                        for (i = 0; i < assetBalances.length; i++) {
                            if (assetBalances[i].balanceQNT != "0") {
                                assets.push(assetBalances[i].asset);
                                assetBalancesMap[assetBalances[i].asset] = assetBalances[i].balanceQNT;
                            }
                        }
                        KRS.sendRequest("getLastTrades", {
                            "assets": assets
                        }, function (response) {
                            if (response.trades && response.trades.length) {
                                var assetTotal = 0;
                                for (i = 0; i < response.trades.length; i++) {
                                    var trade = response.trades[i];
                                    assetTotal += assetBalancesMap[trade.asset] * trade.priceNQT / 100000000;
                                }
                                $("#account_assets_balance").html(KRS.formatStyledAmount(new Big(assetTotal).toFixed(8)));
                                $("#account_nr_assets").html(response.trades.length);
                            } else {
                                $("#account_assets_balance").html(0);
                                $("#account_nr_assets").html(0);
                            }
                        });
                    } else {
                        if (!response.assetBalances) {
                            $("#account_assets_balance").html(0);
                            $("#account_nr_assets").html(0);
                        }
                    }

                    if (response.accountCurrencies) {
                        var currencies = [];
                        var currencyBalances = response.accountCurrencies;
                        var numberOfCurrencies = currencyBalances.length;
                        $("#account_nr_currencies").html(numberOfCurrencies);
                        var currencyBalancesMap = {};
                        for (i = 0; i < numberOfCurrencies; i++) {
                            if (currencyBalances[i].units != "0") {
                                currencies.push(currencyBalances[i].currency);
                                currencyBalancesMap[currencyBalances[i].currency] = currencyBalances[i].units;
                            }
                        }
                        KRS.sendRequest("getLastExchanges", {
                            "currencies": currencies
                        }, function (response) {
                            if (response.exchanges && response.exchanges.length) {
                                var currencyTotal = 0;
                                for (i = 0; i < response.exchanges.length; i++) {
                                    var exchange = response.exchanges[i];
                                    currencyTotal += currencyBalancesMap[exchange.currency] * exchange.rateNQT / 100000000;
                                }
                                $("#account_currencies_balance").html(KRS.formatStyledAmount(new Big(currencyTotal).toFixed(8)));
                            } else {
                                $("#account_currencies_balance").html(0);
                            }
                        });
                    } else {
                        $("#account_currencies_balance").html(0);
                        $("#account_nr_currencies").html(0);
                    }

                    /* Display message count in top and limit to 100 for now because of possible performance issues*/
                    KRS.sendRequest("getBlockchainTransactions+", {
                        "account": KRS.account,
                        "type": 1,
                        "subtype": 0,
                        "firstIndex": 0,
                        "lastIndex": 99
                    }, function (response) {
                        if (response.transactions && response.transactions.length) {
                            if (response.transactions.length > 99)
                                $("#account_message_count").empty().append("99+");
                            else
                                $("#account_message_count").empty().append(response.transactions.length);
                        } else {
                            $("#account_message_count").empty().append("0");
                        }
                    });

                    KRS.sendRequest("getAliasCount+", {
                        "account": KRS.account
                    }, function (response) {
                        if (response.numberOfAliases != null) {
                            $("#account_alias_count").empty().append(response.numberOfAliases);
                        }
                    });

                    KRS.sendRequest("getDGSPurchaseCount+", {
                        "buyer": KRS.account
                    }, function (response) {
                        if (response.numberOfPurchases != null) {
                            $("#account_purchase_count").empty().append(response.numberOfPurchases);
                        }
                    });

                    KRS.sendRequest("getDGSPendingPurchases+", {
                        "seller": KRS.account
                    }, function (response) {
                        if (response.purchases && response.purchases.length) {
                            $("#account_pending_sale_count").empty().append(response.purchases.length);
                        } else {
                            $("#account_pending_sale_count").empty().append("0");
                        }
                    });

                    KRS.sendRequest("getDGSPurchaseCount+", {
                        "seller": KRS.account,
                        "completed": true
                    }, function (response) {
                        if (response.numberOfPurchases != null) {
                            $("#account_completed_sale_count").empty().append(response.numberOfPurchases);
                        }
                    });
                    $(".optional_dashboard_tile").show();
                } else {
                    // Hide the optional tiles and move the block info tile to the first row
                    $(".optional_dashboard_tile").hide();
                    var blockInfoTile = $(".block_info_dashboard_tile").detach();
                    blockInfoTile.appendTo($(".dashboard_first_row"));
                }

                var leasingChange = false;
				if (KRS.lastBlockHeight) {
					var isLeased = KRS.lastBlockHeight >= KRS.accountInfo.currentLeasingHeightFrom;
					if (isLeased != KRS.IsLeased) {
						leasingChange = true;
						KRS.isLeased = isLeased;
					}
				}

				if (leasingChange ||
					(response.currentLeasingHeightFrom != previousAccountInfo.currentLeasingHeightFrom) ||
					(response.lessors && !previousAccountInfo.lessors) ||
					(!response.lessors && previousAccountInfo.lessors) ||
					(response.lessors && previousAccountInfo.lessors && response.lessors.sort().toString() != previousAccountInfo.lessors.sort().toString())) {
					KRS.updateAccountLeasingStatus();
				}

				KRS.updateAccountControlStatus();

				if (response.name) {
					$("#account_name").html(KRS.addEllipsis(KRS.escapeRespStr(response.name), 17)).removeAttr("data-i18n");
				} else {
					$("#account_name").html($.t("set_account_info"));
				}
			}

			if (firstRun) {
				$("#account_balance, #account_balance_sidebar, #account_assets_balance, #account_nr_assets, #account_currencies_balance, #account_nr_currencies, #account_purchase_count, #account_pending_sale_count, #account_completed_sale_count, #account_message_count, #account_alias_count").removeClass("loading_dots");
			}

			if (callback) {
				callback();
			}
		});
	};

    KRS.updateDashboardMessage = function() {
        if (KRS.accountInfo.errorCode) {
            if (KRS.accountInfo.errorCode == 5) {
                if (KRS.downloadingBlockchain && !(KRS.state && KRS.state.apiProxy) && !KRS.state.isLightClient) {
                    if (KRS.newlyCreatedAccount) {
                        $("#dashboard_message").addClass("alert-success").removeClass("alert-danger").html($.t("status_new_account", {
                                "account_id": KRS.escapeRespStr(KRS.accountRS),
                                "public_key": KRS.escapeRespStr(KRS.publicKey)
                            }) +
                            KRS.getPassphraseValidationLink() +
							"<br/><br/>" + KRS.blockchainDownloadingMessage() +
                            "<br/><br/>" + KRS.getFundAccountLink()).show();
                    } else {
                        $("#dashboard_message").addClass("alert-success").removeClass("alert-danger").html(KRS.blockchainDownloadingMessage()).show();
                    }
                } else if (KRS.state && KRS.state.isScanning) {
                    $("#dashboard_message").addClass("alert-danger").removeClass("alert-success").html($.t("status_blockchain_rescanning")).show();
                } else {
                    var message;
                    if (KRS.publicKey == "") {
                        message = $.t("status_new_account_no_pk_v2", {
                            "account_id": KRS.escapeRespStr(KRS.accountRS)
                        });
                        message += KRS.getPassphraseValidationLink();
                        if (KRS.downloadingBlockchain) {
                            message += "<br/><br/>" + KRS.blockchainDownloadingMessage();
                        }
                    } else {
                        message = $.t("status_new_account", {
                            "account_id": KRS.escapeRespStr(KRS.accountRS),
                            "public_key": KRS.escapeRespStr(KRS.publicKey)
                        });
                        message += KRS.getPassphraseValidationLink();
                        if (KRS.downloadingBlockchain) {
                            message += "<br/><br/>" + KRS.blockchainDownloadingMessage();
                        }
                        message += "<br/><br/>" + KRS.getFundAccountLink();
                    }
                    $("#dashboard_message").addClass("alert-success").removeClass("alert-danger").html(message).show();
                }
            } else {
                $("#dashboard_message").addClass("alert-danger").removeClass("alert-success").html(KRS.accountInfo.errorDescription ? KRS.escapeRespStr(KRS.accountInfo.errorDescription) : $.t("error_unknown")).show();
            }
        } else {
            if (KRS.downloadingBlockchain) {
                $("#dashboard_message").addClass("alert-success").removeClass("alert-danger").html(KRS.blockchainDownloadingMessage()).show();
            } else if (KRS.state && KRS.state.isScanning) {
                $("#dashboard_message").addClass("alert-danger").removeClass("alert-success").html($.t("status_blockchain_rescanning")).show();
            } else if (!KRS.accountInfo.publicKey) {
                var warning = KRS.publicKey != 'undefined' ? $.t("public_key_not_announced_warning", { "public_key": KRS.publicKey }) : $.t("no_public_key_warning");
                $("#dashboard_message").addClass("alert-danger").removeClass("alert-success").html(warning + " " + $.t("public_key_actions")).show();
            } else if (KRS.state.isLightClient) {
                $("#dashboard_message").addClass("alert-success").removeClass("alert-danger").html(KRS.blockchainDownloadingMessage()).show();
            } else {
                $("#dashboard_message").hide();
            }
        }
    };

	KRS.updateAccountLeasingStatus = function() {
		var accountLeasingLabel = "";
		var accountLeasingStatus = "";
		var nextLesseeStatus = "";
		if (KRS.accountInfo.nextLeasingHeightFrom < KRS.constants.MAX_INT_JAVA) {
			nextLesseeStatus = $.t("next_lessee_status", {
				"start": KRS.escapeRespStr(KRS.accountInfo.nextLeasingHeightFrom),
				"end": KRS.escapeRespStr(KRS.accountInfo.nextLeasingHeightTo),
				"account": String(KRS.convertNumericToRSAccountFormat(KRS.accountInfo.nextLessee)).escapeHTML()
			})
		}

		if (KRS.lastBlockHeight >= KRS.accountInfo.currentLeasingHeightFrom) {
			accountLeasingLabel = $.t("leased_out");
			accountLeasingStatus = $.t("balance_is_leased_out", {
				"blocks": String(KRS.accountInfo.currentLeasingHeightTo - KRS.lastBlockHeight).escapeHTML(),
				"end": KRS.escapeRespStr(KRS.accountInfo.currentLeasingHeightTo),
				"account": KRS.escapeRespStr(KRS.accountInfo.currentLesseeRS)
			});
			$("#lease_balance_message").html($.t("balance_leased_out_help"));
		} else if (KRS.lastBlockHeight < KRS.accountInfo.currentLeasingHeightTo) {
			accountLeasingLabel = $.t("leased_soon");
			accountLeasingStatus = $.t("balance_will_be_leased_out", {
				"blocks": String(KRS.accountInfo.currentLeasingHeightFrom - KRS.lastBlockHeight).escapeHTML(),
				"start": KRS.escapeRespStr(KRS.accountInfo.currentLeasingHeightFrom),
				"end": KRS.escapeRespStr(KRS.accountInfo.currentLeasingHeightTo),
				"account": KRS.escapeRespStr(KRS.accountInfo.currentLesseeRS)
			});
			$("#lease_balance_message").html($.t("balance_leased_out_help"));
		} else {
			accountLeasingStatus = $.t("balance_not_leased_out");
			$("#lease_balance_message").html($.t("balance_leasing_help"));
		}
		if (nextLesseeStatus != "") {
			accountLeasingStatus += "<br>" + nextLesseeStatus;
		}

		//no reed solomon available? do it myself? todo
        var accountLessorTable = $("#account_lessor_table");
        if (KRS.accountInfo.lessors) {
			if (accountLeasingLabel) {
				accountLeasingLabel += ", ";
				accountLeasingStatus += "<br /><br />";
			}

			accountLeasingLabel += $.t("x_lessor", {
				"count": KRS.accountInfo.lessors.length
			});
			accountLeasingStatus += $.t("x_lessor_lease", {
				"count": KRS.accountInfo.lessors.length
			});

			var rows = "";

			for (var i = 0; i < KRS.accountInfo.lessorsRS.length; i++) {
				var lessor = KRS.accountInfo.lessorsRS[i];
				var lessorInfo = KRS.accountInfo.lessorsInfo[i];
				var blocksLeft = lessorInfo.currentHeightTo - KRS.lastBlockHeight;
				var blocksLeftTooltip = "From block " + lessorInfo.currentHeightFrom + " to block " + lessorInfo.currentHeightTo;
				var nextLessee = "Not set";
				var nextTooltip = "Next lessee not set";
				if (lessorInfo.nextLesseeRS == KRS.accountRS) {
					nextLessee = "You";
					nextTooltip = "From block " + lessorInfo.nextHeightFrom + " to block " + lessorInfo.nextHeightTo;
				} else if (lessorInfo.nextHeightFrom < KRS.constants.MAX_INT_JAVA) {
					nextLessee = "Not you";
					nextTooltip = "Account " + KRS.getAccountTitle(lessorInfo.nextLesseeRS) +" from block " + lessorInfo.nextHeightFrom + " to block " + lessorInfo.nextHeightTo;
				}
				rows += "<tr>" +
					"<td>" + KRS.getAccountLink({ lessorRS: lessor }, "lessor") + "</td>" +
					"<td>" + KRS.escapeRespStr(lessorInfo.effectiveBalanceKPL) + "</td>" +
					"<td><label>" + String(blocksLeft).escapeHTML() + " <i class='fa fa-question-circle show_popover' data-toggle='tooltip' title='" + blocksLeftTooltip + "' data-placement='right' style='color:#4CAA6E'></i></label></td>" +
					"<td><label>" + String(nextLessee).escapeHTML() + " <i class='fa fa-question-circle show_popover' data-toggle='tooltip' title='" + nextTooltip + "' data-placement='right' style='color:#4CAA6E'></i></label></td>" +
				"</tr>";
			}

			accountLessorTable.find("tbody").empty().append(rows);
			$("#account_lessor_container").show();
			accountLessorTable.find("[data-toggle='tooltip']").tooltip();
		} else {
			accountLessorTable.find("tbody").empty();
			$("#account_lessor_container").hide();
		}

		if (accountLeasingLabel) {
			$("#account_leasing").html(accountLeasingLabel).show();
		} else {
			$("#account_leasing").hide();
		}

		if (accountLeasingStatus) {
			$("#account_leasing_status").html(accountLeasingStatus).show();
		} else {
			$("#account_leasing_status").hide();
		}
	};

	KRS.updateAccountControlStatus = function() {
		var onNoPhasingOnly = function() {
			$("#setup_mandatory_approval").show();
			$("#mandatory_approval_details").hide();
			delete KRS.accountInfo.phasingOnly;
		};
		if (KRS.accountInfo.accountControls && $.inArray('PHASING_ONLY', KRS.accountInfo.accountControls) > -1) {
			KRS.sendRequest("getPhasingOnlyControl", {
				"account": KRS.account
			}, function (response) {
				if (response && response.votingModel >= 0) {
					$("#setup_mandatory_approval").hide();
					$("#mandatory_approval_details").show();

					KRS.accountInfo.phasingOnly = response;
					var infoTable = $("#mandatory_approval_info_table");
					infoTable.find("tbody").empty();
					var data = {};
					var params = KRS.phasingControlObjectToPhasingParams(response);
					params.phasingWhitelist = params.phasingWhitelisted;
					KRS.getPhasingDetails(data, params);
					delete data.full_hash_formatted_html;
					if (response.minDuration) {
						data.minimum_duration_short = response.minDuration;
					}
					if (response.maxDuration) {
						data.maximum_duration_short = response.maxDuration;
					}
					if (response.maxFees) {
						data.maximum_fees = KRS.convertToKPL(response.maxFees);
					}
					infoTable.find("tbody").append(KRS.createInfoTable(data));
					infoTable.show();
				} else {
					onNoPhasingOnly();
				}
			});
		} else {
			onNoPhasingOnly();
		}
	};

	KRS.checkAssetDifferences = function(current_balances, previous_balances) {
		var current_balances_ = {};
		var previous_balances_ = {};

		if (previous_balances && previous_balances.length) {
			for (var k in previous_balances) {
                if (!previous_balances.hasOwnProperty(k)) {
                    continue;
                }
				previous_balances_[previous_balances[k].asset] = previous_balances[k].balanceQNT;
			}
		}

		if (current_balances && current_balances.length) {
			for (k in current_balances) {
                if (!current_balances.hasOwnProperty(k)) {
                    continue;
                }
				current_balances_[current_balances[k].asset] = current_balances[k].balanceQNT;
			}
		}

		var diff = {};

		for (k in previous_balances_) {
            if (!previous_balances_.hasOwnProperty(k)) {
                continue;
            }
			if (!(k in current_balances_)) {
				diff[k] = "-" + previous_balances_[k];
			} else if (previous_balances_[k] !== current_balances_[k]) {
                diff[k] = (new BigInteger(current_balances_[k]).subtract(new BigInteger(previous_balances_[k]))).toString();
			}
		}

		for (k in current_balances_) {
            if (!current_balances_.hasOwnProperty(k)) {
                continue;
            }
			if (!(k in previous_balances_)) {
				diff[k] = current_balances_[k]; // property is new
			}
		}

		var nr = Object.keys(diff).length;
		if (nr == 0) {
        } else if (nr <= 3) {
			for (k in diff) {
                if (!diff.hasOwnProperty(k)) {
                    continue;
                }
				KRS.sendRequest("getAsset", {
					"asset": k,
					"_extra": {
						"asset": k,
						"difference": diff[k]
					}
				}, function(asset, input) {
					if (asset.errorCode) {
						return;
					}
					asset.difference = input["_extra"].difference;
					asset.asset = input["_extra"].asset;
                    var quantity;
					if (asset.difference.charAt(0) != "-") {
						quantity = KRS.formatQuantity(asset.difference, asset.decimals);

						if (quantity != "0") {
							if (parseInt(quantity) == 1) {
								$.growl($.t("you_received_assets", {
									"name": KRS.escapeRespStr(asset.name)
								}), {
									"type": "success"
								});
							} else {
								$.growl($.t("you_received_assets_plural", {
									"name": KRS.escapeRespStr(asset.name),
									"count": quantity
								}), {
									"type": "success"
								});
							}
							KRS.loadAssetExchangeSidebar();
						}
					} else {
						asset.difference = asset.difference.substring(1);
						quantity = KRS.formatQuantity(asset.difference, asset.decimals);
						if (quantity != "0") {
							if (parseInt(quantity) == 1) {
								$.growl($.t("you_sold_assets", {
									"name": KRS.escapeRespStr(asset.name)
								}), {
									"type": "success"
								});
							} else {
								$.growl($.t("you_sold_assets_plural", {
									"name": KRS.escapeRespStr(asset.name),
									"count": quantity
								}), {
									"type": "success"
								});
							}
							KRS.loadAssetExchangeSidebar();
						}
					}
				});
			}
		} else {
			$.growl($.t("multiple_assets_differences"), {
				"type": "success"
			});
		}
	};

	KRS.updateBlockchainDownloadProgress = function() {
		var lastNumBlocks = 5000;
        var downloadingBlockchain = $('#downloading_blockchain');
        downloadingBlockchain.find('.last_num_blocks').html($.t('last_num_blocks', { "blocks": lastNumBlocks }));

		if (KRS.state.isLightClient) {
			downloadingBlockchain.find(".db_active").hide();
			downloadingBlockchain.find(".db_halted").hide();
			downloadingBlockchain.find(".db_light").show();
		} else if (!KRS.serverConnect || !KRS.peerConnect) {
			downloadingBlockchain.find(".db_active").hide();
			downloadingBlockchain.find(".db_halted").show();
			downloadingBlockchain.find(".db_light").hide();
		} else {
			downloadingBlockchain.find(".db_halted").hide();
			downloadingBlockchain.find(".db_active").show();
			downloadingBlockchain.find(".db_light").hide();

			var percentageTotal = 0;
			var blocksLeft;
			var percentageLast = 0;
			if (KRS.state.lastBlockchainFeederHeight && KRS.state.numberOfBlocks <= KRS.state.lastBlockchainFeederHeight) {
				percentageTotal = parseInt(Math.round((KRS.state.numberOfBlocks / KRS.state.lastBlockchainFeederHeight) * 100), 10);
				blocksLeft = KRS.state.lastBlockchainFeederHeight - KRS.state.numberOfBlocks;
				if (blocksLeft <= lastNumBlocks && KRS.state.lastBlockchainFeederHeight > lastNumBlocks) {
					percentageLast = parseInt(Math.round(((lastNumBlocks - blocksLeft) / lastNumBlocks) * 100), 10);
				}
			}
			if (!blocksLeft || blocksLeft < parseInt(lastNumBlocks / 2)) {
				downloadingBlockchain.find(".db_progress_total").hide();
			} else {
				downloadingBlockchain.find(".db_progress_total").show();
				downloadingBlockchain.find(".db_progress_total .progress-bar").css("width", percentageTotal + "%");
				downloadingBlockchain.find(".db_progress_total .sr-only").html($.t("percent_complete", {
					"percent": percentageTotal
				}));
			}
			if (!blocksLeft || blocksLeft >= (lastNumBlocks * 2) || KRS.state.lastBlockchainFeederHeight <= lastNumBlocks) {
				downloadingBlockchain.find(".db_progress_last").hide();
			} else {
				downloadingBlockchain.find(".db_progress_last").show();
				downloadingBlockchain.find(".db_progress_last .progress-bar").css("width", percentageLast + "%");
				downloadingBlockchain.find(".db_progress_last .sr-only").html($.t("percent_complete", {
					"percent": percentageLast
				}));
			}
			if (blocksLeft) {
				downloadingBlockchain.find(".blocks_left_outer").show();
				downloadingBlockchain.find(".blocks_left").html($.t("blocks_left", { "numBlocks": blocksLeft }));
			}
		}
	};

	KRS.checkIfOnAFork = function() {
		if (!KRS.downloadingBlockchain) {
			var isForgingAllBlocks = true;
			if (KRS.blocks && KRS.blocks.length >= 10) {
				for (var i = 0; i < 10; i++) {
					if (KRS.blocks[i].generator != KRS.account) {
						isForgingAllBlocks = false;
						break;
					}
				}
			} else {
				isForgingAllBlocks = false;
			}

			if (isForgingAllBlocks) {
				$.growl($.t("fork_warning"), {
					"type": "danger"
				});
			}

            if (KRS.blocks && KRS.blocks.length > 0 && KRS.baseTargetPercent(KRS.blocks[0]) > 1000 && !KRS.isTestNet) {
                $.growl($.t("fork_warning_base_target"), {
                    "type": "danger"
                });
            }
		}
	};

    KRS.printEnvInfo = function() {
        KRS.logProperty("navigator.userAgent");
        KRS.logProperty("navigator.platform");
        KRS.logProperty("navigator.appVersion");
        KRS.logProperty("navigator.appName");
        KRS.logProperty("navigator.appCodeName");
        KRS.logProperty("navigator.hardwareConcurrency");
        KRS.logProperty("navigator.maxTouchPoints");
        KRS.logProperty("navigator.languages");
        KRS.logProperty("navigator.language");
        KRS.logProperty("navigator.userLanguage");
        KRS.logProperty("navigator.cookieEnabled");
        KRS.logProperty("navigator.onLine");
		if (window["cordova"]) {
			KRS.logProperty("device.model");
			KRS.logProperty("device.platform");
			KRS.logProperty("device.version");
		}
        KRS.logProperty("KRS.isTestNet");
        KRS.logProperty("KRS.needsAdminPassword");
    };

	$("#id_search").on("submit", function(e) {
		e.preventDefault();

		var id = $.trim($("#id_search").find("input[name=q]").val());

		if (/KPL\-/i.test(id)) {
			KRS.sendRequest("getAccount", {
				"account": id
			}, function(response, input) {
				if (!response.errorCode) {
					response.account = input.account;
					KRS.showAccountModal(response);
				} else {
					$.growl($.t("error_search_no_results"), {
						"type": "danger"
					});
				}
			});
		} else {
			if (!/^\d+$/.test(id)) {
				$.growl($.t("error_search_invalid"), {
					"type": "danger"
				});
				return;
			}
			KRS.sendRequest("getTransaction", {
				"transaction": id
			}, function(response, input) {
				if (!response.errorCode) {
					response.transaction = input.transaction;
					KRS.showTransactionModal(response);
				} else {
					KRS.sendRequest("getAccount", {
						"account": id
					}, function(response, input) {
						if (!response.errorCode) {
							response.account = input.account;
							KRS.showAccountModal(response);
						} else {
							KRS.sendRequest("getBlock", {
								"block": id,
                                "includeTransactions": "true",
								"includeExecutedPhased": "true"
							}, function(response) {
								if (!response.errorCode) {
									KRS.showBlockModal(response);
								} else {
                                    KRS.sendRequest("getBlock", {
                                        "height": id,
                                        "includeTransactions": "true",
                                        "includeExecutedPhased": "true"
                                    }, function(response) {
                                        if (!response.errorCode) {
                                            KRS.showBlockModal(response);
                                        } else {
                                            $.growl($.t("error_search_no_results"), {
                                                "type": "danger"
                                            });
                                        }
                                    });
								}
							});
						}
					});
				}
			});
		}
	});

	function checkLocalStorage() {
	    var storage;
	    var fail;
	    var uid;
	    try {
	        uid = String(new Date());
	        (storage = window.localStorage).setItem(uid, uid);
	        fail = storage.getItem(uid) != uid;
	        storage.removeItem(uid);
	        fail && (storage = false);
	    } catch (exception) {
	        KRS.logConsole("checkLocalStorage " + exception.message)
	    }
	    return storage;
	}

	return KRS;
}(Object.assign(KRS || {}, isNode ? global.client : {}), jQuery));

if (isNode) {
    module.exports = KRS;
} else {
    $(document).ready(function() {
        console.log("document.ready");
        KRS.init();
    });
}

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
 * @depends {krs.js}
 */
var KRS = (function(KRS, $, undefined) {
	KRS.newlyCreatedAccount = false;

	KRS.allowLoginViaEnter = function() {
		$("#login_account_other").keypress(function(e) {
			if (e.which == '13') {
				e.preventDefault();
				var account = $("#login_account_other").val();
				KRS.login(false,account);
			}
		});
		$("#login_password").keypress(function(e) {
			if (e.which == '13') {
				e.preventDefault();
				var password = $("#login_password").val();
				KRS.login(true,password);
			}
		});
	};

	KRS.showLoginOrWelcomeScreen = function() {
        KRS.showLoginScreen();
		/*
		if (localStorage.getItem("logged_in")) {
			KRS.showLoginScreen();
		} else {
			KRS.showWelcomeScreen();
		}
		*/
	};

	KRS.showLoginScreen = function() {
		$("#account_phrase_custom_panel, #account_phrase_generator_panel, #welcome_panel, #custom_passphrase_link").hide();
		$("#account_phrase_custom_panel").find(":input:not(:button):not([type=submit])").val("");
		$("#account_phrase_generator_panel").find(":input:not(:button):not([type=submit])").val("");
        $("#login_account_other").mask("KPL-****-****-****-*****");
		if (KRS.isMobileApp()) {
            $(".mobile-only").show();
        }
        $("#login_panel").show();
	};

	KRS.showWelcomeScreen = function() {
		$("#login_panel, #account_phrase_generator_panel, #account_phrase_custom_panel, #welcome_panel, #custom_passphrase_link").hide();
        if (KRS.isMobileApp()) {
            $(".mobile-only").show();
        }
		$("#welcome_panel").show();
	};

    KRS.createPassphraseToConfirmPassphrase = function() {
        if ($("#confirm_passphrase_warning").is(":checked")) {
            $('.step_2').hide();$('.step_3').show();
        } else {
            $("#confirm_passphrase_warning_container").css("background-color", "red");
		}
    };

	KRS.registerUserDefinedAccount = function() {
		$("#account_phrase_generator_panel, #login_panel, #welcome_panel, #custom_passphrase_link").hide();
		$("#account_phrase_generator_panel").find(":input:not(:button):not([type=submit])").val("");
		var accountPhraseCustomPanel = $("#account_phrase_custom_panel");
        accountPhraseCustomPanel.find(":input:not(:button):not([type=submit])").val("");
		accountPhraseCustomPanel.show();
		$("#registration_password").focus();
	};

	KRS.registerAccount = function() {
		$("#login_panel, #welcome_panel").hide();
		var accountPhraseGeneratorPanel = $("#account_phrase_generator_panel");
        accountPhraseGeneratorPanel.show();
		accountPhraseGeneratorPanel.find(".step_3 .callout").hide();

		var $loading = $("#account_phrase_generator_loading");
		var $loaded = $("#account_phrase_generator_loaded");
		if (KRS.isWindowPrintSupported()) {
            $(".paper-wallet-link-container").show();
		}

		//noinspection JSUnresolvedVariable
		if (window.crypto || window.msCrypto) {
			$loading.find("span.loading_text").html($.t("generating_passphrase_wait"));
		}

		$loading.show();
		$loaded.hide();

		if (typeof PassPhraseGenerator == "undefined") {
			$.when(
				$.getScript("js/crypto/passphrasegenerator.js")
			).done(function() {
				$loading.hide();
				$loaded.show();

				PassPhraseGenerator.generatePassPhrase("#account_phrase_generator_panel");
			}).fail(function() {
				alert($.t("error_word_list"));
			});
		} else {
			$loading.hide();
			$loaded.show();

			PassPhraseGenerator.generatePassPhrase("#account_phrase_generator_panel");
		}
	};

    $("#generator_paper_wallet_link").click(function(e) {
    	e.preventDefault();
        KRS.printPaperWallet($("#account_phrase_generator_panel").find(".step_2 textarea").val());
    });

	KRS.verifyGeneratedPassphrase = function() {
		var accountPhraseGeneratorPanel = $("#account_phrase_generator_panel");
        var password = $.trim(accountPhraseGeneratorPanel.find(".step_3 textarea").val());

		if (password != PassPhraseGenerator.passPhrase) {
			accountPhraseGeneratorPanel.find(".step_3 .callout").show();
		} else {
			KRS.newlyCreatedAccount = true;
			KRS.login(true,password);
			PassPhraseGenerator.reset();
			accountPhraseGeneratorPanel.find("textarea").val("");
			accountPhraseGeneratorPanel.find(".step_3 .callout").hide();
		}
	};

	$("#account_phrase_custom_panel").find("form").submit(function(event) {
		event.preventDefault();

		var password = $("#registration_password").val();
		var repeat = $("#registration_password_repeat").val();

		var error = "";

		if (password.length < 35) {
			error = $.t("error_passphrase_length");
		} else if (password.length < 50 && (!password.match(/[A-Z]/) || !password.match(/[0-9]/))) {
			error = $.t("error_passphrase_strength");
		} else if (password != repeat) {
			error = $.t("error_passphrase_match");
		}

		if (error) {
			$("#account_phrase_custom_panel").find(".callout").first().removeClass("callout-info").addClass("callout-danger").html(error);
		} else {
			$("#registration_password, #registration_password_repeat").val("");
			KRS.login(true,password);
		}
	});

	KRS.listAccounts = function() {
		var loginAccount = $('#login_account');
        loginAccount.empty();
		if (KRS.getStrItem("savedKplAccounts") && KRS.getStrItem("savedKplAccounts") != ""){
			$('#login_account_container').show();
			$('#login_account_container_other').hide();
			var accounts = KRS.getStrItem("savedKplAccounts").split(";");
			$.each(accounts, function(index, account) {
				if (account != ''){
					$('#login_account')
					.append($("<li></li>")
						.append($("<a></a>")
							.attr("href","#")
							.attr("onClick","KRS.login(false,'"+account+"')")
							.text(account))
						.append($('<button data-dismiss="modal" class="close" type="button">×</button>')
							.attr("onClick","KRS.removeAccount('"+account+"')"))
					);
				}
			});
			var otherHTML = "<li><a href='#' data-i18n='other'>Other</a></li>";
			var $otherHTML = $(otherHTML);
			$otherHTML.click(function() {
				$('#login_account_container').hide();
				$('#login_account_container_other').show();
			});
			$otherHTML.appendTo(loginAccount);
		}
		else{
			$('#login_account_container').hide();
			$('#login_account_container_other').show();
		}
	};

	KRS.switchAccount = function(account) {
		// Reset security related state
		KRS.resetEncryptionState();
		KRS.setServerPassword(null);
		KRS.setAccountDetailsPassword(null);
		KRS.rememberPassword = false;
		KRS.account = "";
		KRS.accountRS = "";
		KRS.publicKey = "";
		KRS.accountInfo = {};

		// Reset other functional state
		$("#account_balance, #account_balance_sidebar, #account_nr_assets, #account_assets_balance, #account_currencies_balance, #account_nr_currencies, #account_purchase_count, #account_pending_sale_count, #account_completed_sale_count, #account_message_count, #account_alias_count").html("0");
		$("#id_search").find("input[name=q]").val("");
		KRS.resetAssetExchangeState();
		KRS.resetPollsState();
		KRS.resetMessagesState();
		KRS.forgingStatus = KRS.constants.UNKNOWN;
		KRS.isAccountForging = false;
		KRS.selectedContext = null;

		// Reset plugins state
		KRS.activePlugins = false;
		KRS.numRunningPlugins = 0;
		$.each(KRS.plugins, function(pluginId) {
			KRS.determinePluginLaunchStatus(pluginId);
		});

		// Return to the dashboard and notify the user
		KRS.goToPage("dashboard");
        KRS.login(false, account, function() {
            $.growl($.t("switched_to_account", { account: account }))
        }, true);
	};

    $("#loginButtons").find(".btn").click(function (e) {
        e.preventDefault();
        var type = $(this).data("login-type");
        var readerId = $(this).data("reader");
        var reader = $("#" + readerId);
        if (reader.is(':visible') && type != "scan") {
            KRS.scanQRCode(readerId, function() {}); // turn off scanning
        }
        if (type == "account") {
            KRS.listAccounts();
            $('#login_password').parent().hide();
        } else if (type == "password") {
            $('#login_account_container').hide();
            $('#login_account_container_other').hide();
            $('#login_password').parent().show();
        } else if (type == "scan" && !reader.is(':visible')) {
            KRS.scanQRCode(readerId, function(text) {
                var kplAddress = new KplAddress();
                if (kplAddress.set(text)) {
                    if ($("#remember_me").is(":checked")) {
                        rememberAccount(text);
                    }
                    KRS.login(false, text);
                } else {
                    KRS.login(true, text);
                }
            });
        }
    });

	KRS.removeAccount = function(account) {
		var accounts = KRS.getStrItem("savedKplAccounts").replace(account+';','');
		if (accounts == '') {
			KRS.removeItem('savedKplAccounts');
		} else {
			KRS.setStrItem("savedKplAccounts", accounts);
		}
		KRS.listAccounts();
	};

    function rememberAccount(account) {
        var accountsStr = KRS.getStrItem("savedKplAccounts");
        if (!accountsStr) {
            KRS.setStrItem("savedKplAccounts", account + ";");
            return;
        }
        var accounts = accountsStr.split(";");
        if (accounts.indexOf(account) >= 0) {
            return;
        }
        KRS.setStrItem("savedKplAccounts", accountsStr + account + ";");
    }

    // id can be either account id or passphrase
    KRS.login = function(isPassphraseLogin, id, callback, isAccountSwitch, isSavedPassphrase) {
		console.log("login isPassphraseLogin = " + isPassphraseLogin +
			", isAccountSwitch = " + isAccountSwitch +
			", isSavedPassphrase = " + isSavedPassphrase);
        KRS.spinner.spin($("#center")[0]);
        if (isPassphraseLogin && !isSavedPassphrase){
			var loginCheckPasswordLength = $("#login_check_password_length");
			if (!id.length) {
				$.growl($.t("error_passphrase_required_login"), {
					"type": "danger",
					"offset": 10
				});
                KRS.spinner.stop();
				return;
			} else if (!KRS.isTestNet && id.length < 12 && loginCheckPasswordLength.val() == 1) {
				loginCheckPasswordLength.val(0);
				var loginError = $("#login_error");
				loginError.find(".callout").html($.t("error_passphrase_login_length"));
				loginError.show();
                KRS.spinner.stop();
				return;
			}

			$("#login_password, #registration_password, #registration_password_repeat").val("");
			loginCheckPasswordLength.val(1);
		}

		console.log("login calling getBlockchainStatus");
		KRS.sendRequest("getBlockchainStatus", {}, function(response) {
			if (response.errorCode) {
			    KRS.connectionError(response.errorDescription);
                KRS.spinner.stop();
				console.log("getBlockchainStatus returned error");
				return;
			}
			console.log("getBlockchainStatus response received");
			KRS.state = response;
			var accountRequest;
			var requestVariable;
			if (isPassphraseLogin) {
				accountRequest = "getAccountId"; // Processed locally, not submitted to server
				requestVariable = {secretPhrase: id};
			} else {
				accountRequest = "getAccount";
				requestVariable = {account: id};
			}
			console.log("calling " + accountRequest);
			KRS.sendRequest(accountRequest, requestVariable, function(response, data) {
				console.log(accountRequest + " response received");
				if (!response.errorCode) {
					KRS.account = KRS.escapeRespStr(response.account);
					KRS.accountRS = KRS.escapeRespStr(response.accountRS);
					if (isPassphraseLogin) {
                        KRS.publicKey = KRS.getPublicKey(converters.stringToHexString(id));
                    } else {
                        KRS.publicKey = KRS.escapeRespStr(response.publicKey);
                    }
				}
				if (!isPassphraseLogin && response.errorCode == 5) {
					KRS.account = KRS.escapeRespStr(response.account);
					KRS.accountRS = KRS.escapeRespStr(response.accountRS);
				}
				if (!KRS.account) {
					$.growl($.t("error_find_account_id", { accountRS: (data && data.account ? String(data.account).escapeHTML() : "") }), {
						"type": "danger",
						"offset": 10
					});
                    KRS.spinner.stop();
					return;
				} else if (!KRS.accountRS) {
					$.growl($.t("error_generate_account_id"), {
						"type": "danger",
						"offset": 10
					});
                    KRS.spinner.stop();
					return;
				}

				KRS.sendRequest("getAccountPublicKey", {
					"account": KRS.account
				}, function(response) {
					if (response && response.publicKey && response.publicKey != KRS.generatePublicKey(id) && isPassphraseLogin) {
						$.growl($.t("error_account_taken"), {
							"type": "danger",
							"offset": 10
						});
                        KRS.spinner.stop();
						return;
					}

					var rememberMe = $("#remember_me");
					if (rememberMe.is(":checked") && isPassphraseLogin) {
						KRS.rememberPassword = true;
						KRS.setPassword(id);
						$(".secret_phrase, .show_secret_phrase").hide();
						$(".hide_secret_phrase").show();
					} else {
                        KRS.rememberPassword = false;
                        KRS.setPassword("");
                        $(".secret_phrase, .show_secret_phrase").show();
                        $(".hide_secret_phrase").hide();
                    }
					KRS.disablePluginsDuringSession = $("#disable_all_plugins").is(":checked");
					$("#sidebar_account_id").html(String(KRS.accountRS).escapeHTML());
					$("#sidebar_account_link").html(KRS.getAccountLink(KRS, "account", KRS.accountRS, "details", false, "btn btn-default btn-xs"));
					if (KRS.lastBlockHeight == 0 && KRS.state.numberOfBlocks) {
						KRS.checkBlockHeight(KRS.state.numberOfBlocks - 1);
					}
					if (KRS.lastBlockHeight == 0 && KRS.lastProxyBlockHeight) {
						KRS.checkBlockHeight(KRS.lastProxyBlockHeight);
					}
                    $("#sidebar_block_link").html(KRS.getBlockLink(KRS.lastBlockHeight));

					var passwordNotice = "";

					if (id.length < 35 && isPassphraseLogin) {
						passwordNotice = $.t("error_passphrase_length_secure");
					} else if (isPassphraseLogin && id.length < 50 && (!id.match(/[A-Z]/) || !id.match(/[0-9]/))) {
						passwordNotice = $.t("error_passphrase_strength_secure");
					}

					if (passwordNotice) {
						$.growl("<strong>" + $.t("warning") + "</strong>: " + passwordNotice, {
							"type": "danger"
						});
					}
					KRS.getAccountInfo(true, function() {
						if (KRS.accountInfo.currentLeasingHeightFrom) {
							KRS.isLeased = (KRS.lastBlockHeight >= KRS.accountInfo.currentLeasingHeightFrom && KRS.lastBlockHeight <= KRS.accountInfo.currentLeasingHeightTo);
						} else {
							KRS.isLeased = false;
						}
						KRS.updateForgingTooltip($.t("forging_unknown_tooltip"));
						KRS.updateForgingStatus(isPassphraseLogin ? id : null);
						if (KRS.isForgingSafe() && isPassphraseLogin) {
							var forgingIndicator = $("#forging_indicator");
							KRS.sendRequest("startForging", {
								"secretPhrase": id
							}, function (response) {
								if ("deadline" in response) {
									forgingIndicator.addClass("forging");
									forgingIndicator.find("span").html($.t("forging")).attr("data-i18n", "forging");
									KRS.forgingStatus = KRS.constants.FORGING;
									KRS.updateForgingTooltip(KRS.getForgingTooltip);
								} else {
									forgingIndicator.removeClass("forging");
									forgingIndicator.find("span").html($.t("not_forging")).attr("data-i18n", "not_forging");
									KRS.forgingStatus = KRS.constants.NOT_FORGING;
									KRS.updateForgingTooltip(response.errorDescription);
								}
								forgingIndicator.show();
							});
						}
					}, isAccountSwitch);
					KRS.initSidebarMenu();
					KRS.unlock();

					if (KRS.isOutdated) {
						$.growl($.t("krs_update_available"), {
							"type": "danger"
						});
					}

					if (!KRS.downloadingBlockchain) {
						KRS.checkIfOnAFork();
					}
					KRS.logConsole("User Agent: " + String(navigator.userAgent));
					if (navigator.userAgent.indexOf('Safari') != -1 &&
						navigator.userAgent.indexOf('Chrome') == -1 &&
						navigator.userAgent.indexOf('JavaFX') == -1) {
						// Don't use account based DB in Safari due to a buggy indexedDB implementation (2015-02-24)
						KRS.createDatabase("KRS_USER_DB");
						$.growl($.t("krs_safari_no_account_based_db"), {
							"type": "danger"
						});
					} else {
						KRS.createDatabase("KRS_USER_DB_" + String(KRS.account));
					}
					if (callback) {
						callback();
					}

					$.each(KRS.pages, function(key) {
						if(key in KRS.setup) {
							KRS.setup[key]();
						}
					});

					$(".sidebar .treeview").tree();
					$('#dashboard_link').find('a').addClass("ignore").click();

					var accounts;
					if (rememberMe.is(":checked") || KRS.newlyCreatedAccount) {
						rememberAccount(KRS.accountRS);
					}

					$("[data-i18n]").i18n();

					/* Add accounts to dropdown for quick switching */
					var accountIdDropdown = $("#account_id_dropdown");
					accountIdDropdown.find(".dropdown-menu .switchAccount").remove();
					if (KRS.getStrItem("savedKplAccounts") && KRS.getStrItem("savedKplAccounts")!=""){
						accountIdDropdown.show();
						accounts = KRS.getStrItem("savedKplAccounts").split(";");
						$.each(accounts, function(index, account) {
							if (account != ''){
								$('#account_id_dropdown').find('.dropdown-menu')
								.append($("<li class='switchAccount'></li>")
									.append($("<a></a>")
										.attr("href","#")
										.attr("style","font-size: 85%;")
										.attr("onClick","KRS.switchAccount('"+account+"')")
										.text(account))
								);
							}
						});
					} else {
						accountIdDropdown.hide();
					}

					KRS.updateApprovalRequests();
				});
			});
		});
	};

	$("#logout_button_container").on("show.bs.dropdown", function() {
		if (KRS.forgingStatus != KRS.constants.FORGING) {
			$(this).find("[data-i18n='logout_stop_forging']").hide();
		}
	});

	KRS.initPluginWarning = function() {
		if (KRS.activePlugins) {
			var html = "";
			html += "<div style='font-size:13px;'>";
			html += "<div style='background-color:#e6e6e6;padding:12px;'>";
			html += "<span data-i18n='following_plugins_detected'>";
			html += "The following active plugins have been detected:</span>";
			html += "</div>";
			html += "<ul class='list-unstyled' style='padding:11px;border:1px solid #e0e0e0;margin-top:8px;'>";
			$.each(KRS.plugins, function(pluginId, pluginDict) {
				if (pluginDict["launch_status"] == KRS.constants.PL_PAUSED) {
					html += "<li style='font-weight:bold;'>" + pluginDict["manifest"]["name"] + "</li>";
				}
			});
			html += "</ul>";
			html += "</div>";

			$('#lockscreen_active_plugins_overview').popover({
				"html": true,
				"content": html,
				"trigger": "hover"
			});

			html = "";
			html += "<div style='font-size:13px;padding:5px;'>";
			html += "<p data-i18n='plugin_security_notice_full_access'>";
			html += "Plugins are not sandboxed or restricted in any way and have full accesss to your client system including your Kpl passphrase.";
			html += "</p>";
			html += "<p data-i18n='plugin_security_notice_trusted_sources'>";
			html += "Make sure to only run plugins downloaded from trusted sources, otherwise ";
			html += "you can loose your KPL! In doubt don't run plugins with accounts ";
			html += "used to store larger amounts of KPL now or in the future.";
			html += "</p>";
			html += "</div>";

			$('#lockscreen_active_plugins_security').popover({
				"html": true,
				"content": html,
				"trigger": "hover"
			});

			$("#lockscreen_active_plugins_warning").show();
		} else {
			$("#lockscreen_active_plugins_warning").hide();
		}
	};

	KRS.showLockscreen = function() {
		KRS.listAccounts();
        KRS.showLoginScreen();
        /*
		if (localStorage.getItem("logged_in")) {
			KRS.showLoginScreen();
		} else {
			KRS.showWelcomeScreen();
		}
		*/
		$("#center").show();
		if (!KRS.isShowDummyCheckbox) {
			$("#dummyCheckbox").hide();
		}
	};

	KRS.unlock = function() {
		if (!localStorage.getItem("logged_in")) {
			localStorage.setItem("logged_in", true);
		}
		$("#lockscreen").hide();
		$("body, html").removeClass("lockscreen");
		$("#login_error").html("").hide();
		$(document.documentElement).scrollTop = 0;
        KRS.spinner.stop();
    };

	KRS.logout = function(stopForging) {
		if (stopForging && KRS.forgingStatus == KRS.constants.FORGING) {
			var stopForgingModal = $("#stop_forging_modal");
            stopForgingModal.find(".show_logout").show();
			stopForgingModal.modal("show");
		} else {
			KRS.setDecryptionPassword("");
			KRS.setPassword("");
			//window.location.reload();
			window.location.href = window.location.pathname;
		}
	};

	$("#logout_clear_user_data_confirm_btn").click(function(e) {
		e.preventDefault();
		if (KRS.database) {
			//noinspection JSUnresolvedFunction
			indexedDB.deleteDatabase(KRS.database.name);
		}
		if (KRS.legacyDatabase) {
			//noinspection JSUnresolvedFunction
			indexedDB.deleteDatabase(KRS.legacyDatabase.name);
		}
		KRS.removeItem("logged_in");
		KRS.removeItem("savedKplAccounts");
		KRS.removeItem("language");
        KRS.removeItem("savedPassphrase");
		KRS.localStorageDrop("data");
		KRS.localStorageDrop("polls");
		KRS.localStorageDrop("contacts");
		KRS.localStorageDrop("assets");
		KRS.logout();
	});

    KRS.setPassword = function(password) {
		KRS.setEncryptionPassword(password);
		KRS.setServerPassword(password);
        KRS.setAccountDetailsPassword(password);
        KRS.setAdvancedModalPassword(password);
        KRS.setTokenPassword(password);
		if (KRS.mobileSettings.is_store_remembered_passphrase) {
			KRS.setStrItem("savedPassphrase", password);
		} else {
			KRS.setStrItem("savedPassphrase", "");
		}
	};
	return KRS;
}(KRS || {}, jQuery));

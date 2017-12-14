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
 * @depends {krs.modals.js}
 */
var KRS = (function(KRS, $) {
	KRS.userInfoModal = {
		"user": 0
	};

    var target = document.getElementById('user_info_modal_transactions_table');


	var body = $("body");
    body.on("click", ".show_account_modal_action, a[data-user].user_info", function(e) {
		e.preventDefault();
		var account = $(this).data("user");
        if ($(this).data("back") == "true") {
            KRS.modalStack.pop(); // The forward modal
            KRS.modalStack.pop(); // The current modal
        }
		KRS.showAccountModal(account);
	});

	KRS.showAccountModal = function(account) {
		if (KRS.fetchingModalData) {
			return;
		}

		if (typeof account == "object") {
			KRS.userInfoModal.user = account.account;
		} else {
			KRS.userInfoModal.user = account;
			KRS.fetchingModalData = true;
		}
        KRS.setBackLink();
		KRS.modalStack.push({ class: "show_account_modal_action", key: "user", value: account});

		$("#user_info_modal_account").html(KRS.getAccountFormatted(KRS.userInfoModal.user));
		var accountButton;
		if (KRS.userInfoModal.user in KRS.contacts) {
			accountButton = KRS.contacts[KRS.userInfoModal.user].name.escapeHTML();
			$("#user_info_modal_add_as_contact").hide();
		} else {
			accountButton = KRS.userInfoModal.user;
			$("#user_info_modal_add_as_contact").show();
		}

		$("#user_info_modal_actions").find("button").data("account", accountButton);

		if (KRS.fetchingModalData) {
            KRS.spinner.spin(target);
			KRS.sendRequest("getAccount", {
				"account": KRS.userInfoModal.user
            }, function(response) {
				KRS.processAccountModalData(response);
				KRS.fetchingModalData = false;
			});
		} else {
			KRS.spinner.spin(target);
			KRS.processAccountModalData(account);
		}
		$("#user_info_modal_transactions").show();
		KRS.userInfoModal.transactions();
	};

	KRS.processAccountModalData = function(account) {
		if (account.unconfirmedBalanceNQT == "0") {
			$("#user_info_modal_account_balance").html("0");
		} else {
			$("#user_info_modal_account_balance").html(KRS.formatAmount(account.unconfirmedBalanceNQT) + " KPL");
		}

		if (account.name) {
			$("#user_info_modal_account_name").html(KRS.escapeRespStr(account.name));
			$("#user_info_modal_account_name_container").show();
		} else {
			$("#user_info_modal_account_name_container").hide();
		}

		if (account.description) {
			$("#user_info_description").show();
			$("#user_info_modal_description").html(KRS.escapeRespStr(account.description).nl2br());
		} else {
			$("#user_info_description").hide();
		}
		var switchAccount = $("#user_info_switch_account");
        if (KRS.accountRS != account.accountRS) {
			switchAccount.html("<a class='btn btn-info btn-xs switch-account' data-account='" + account.accountRS + "'>" + $.t("switch_account") + "</a>");
			switchAccount.show();
		} else {
			switchAccount.hide();
		}

        var userInfoModal = $("#user_info_modal");
        if (!userInfoModal.data('bs.modal') || !userInfoModal.data('bs.modal').isShown) {
            userInfoModal.modal("show");
        }
        KRS.spinner.stop(target);
	};

	body.on("click", ".switch-account", function() {
		var account = $(this).data("account");
		KRS.closeModal($("#user_info_modal"));
		KRS.switchAccount(account);
	});

	var userInfoModal = $("#user_info_modal");
    userInfoModal.on("hidden.bs.modal", function() {
		$(this).find(".user_info_modal_content").hide();
		$(this).find(".user_info_modal_content table tbody").empty();
		$(this).find(".user_info_modal_content:not(.data-loading,.data-never-loading)").addClass("data-loading");
		$(this).find("ul.nav li.active").removeClass("active");
		$("#user_info_transactions").addClass("active");
		KRS.userInfoModal.user = 0;
	});

	userInfoModal.find("ul.nav li").click(function(e) {
		e.preventDefault();
		var tab = $(this).data("tab");
		$(this).siblings().removeClass("active");
		$(this).addClass("active");
		$(".user_info_modal_content").hide();

		var content = $("#user_info_modal_" + tab);
		content.show();
		if (content.hasClass("data-loading")) {
			KRS.userInfoModal[tab]();
		}
	});

    function getTransactionType(transaction) {
        var transactionType = $.t(KRS.transactionTypes[transaction.type].subTypes[transaction.subtype].i18nKeyTitle);
        if (transaction.type == KRS.subtype.AliasSell.type && transaction.subtype == KRS.subtype.AliasSell.subtype) {
            if (transaction.attachment.priceNQT == "0") {
                if (transaction.sender == transaction.recipient) {
                    transactionType = $.t("alias_sale_cancellation");
                } else {
                    transactionType = $.t("alias_transfer");
                }
            } else {
                transactionType = $.t("alias_sale");
            }
        }
        return transactionType;
    }

    KRS.userInfoModal.transactions = function() {
        KRS.sendRequest("getBlockchainTransactions", {
			"account": KRS.userInfoModal.user,
			"firstIndex": 0,
			"lastIndex": 100
		}, function(response) {
            var infoModalTransactionsTable = $("#user_info_modal_transactions_table");
			if (response.transactions && response.transactions.length) {
				var rows = "";
				var amountDecimals = KRS.getNumberOfDecimals(response.transactions, "amountNQT", function(val) {
					return KRS.formatAmount(val.amountNQT);
				});
				var feeDecimals = KRS.getNumberOfDecimals(response.transactions, "fee", function(val) {
					return KRS.formatAmount(val.fee);
				});
				for (var i = 0; i < response.transactions.length; i++) {
					var transaction = response.transactions[i];
                    var transactionType = getTransactionType(transaction);
                    var receiving;
					if (/^KPL\-/i.test(String(KRS.userInfoModal.user))) {
						receiving = (transaction.recipientRS == KRS.userInfoModal.user);
					} else {
						receiving = (transaction.recipient == KRS.userInfoModal.user);
					}

					if (transaction.amountNQT) {
						transaction.amount = new BigInteger(transaction.amountNQT);
						transaction.fee = new BigInteger(transaction.feeNQT);
					}
					var account = (receiving ? "sender" : "recipient");
					rows += "<tr>" +
						"<td>" + KRS.getTransactionLink(transaction.transaction, KRS.formatTimestamp(transaction.timestamp)) + "</td>" +
						"<td>" + KRS.getTransactionIconHTML(transaction.type, transaction.subtype) + "&nbsp" + transactionType + "</td>" +
						"<td class='numeric'  " + (transaction.type == 0 && receiving ? " style='color:#006400;'" : (!receiving && transaction.amount > 0 ? " style='color:red'" : "")) + ">" + (!receiving && transaction.amount > 0 ? "-" : "")  + "" + KRS.formatAmount(transaction.amount, false, false, amountDecimals) + "</td>" +
						"<td class='numeric' " + (!receiving ? " style='color:red'" : "") + ">" + KRS.formatAmount(transaction.fee, false, false, feeDecimals) + "</td>" +
						"<td>" + KRS.getAccountLink(transaction, account) + "</td>" +
					"</tr>";
				}

				infoModalTransactionsTable.find("tbody").empty().append(rows);
				KRS.dataLoadFinished(infoModalTransactionsTable);
			} else {
				infoModalTransactionsTable.find("tbody").empty();
				KRS.dataLoadFinished(infoModalTransactionsTable);
			}
		});
	};

    KRS.userInfoModal.ledger = function() {
        KRS.sendRequest("getAccountLedger", {
            "account": KRS.userInfoModal.user,
            "includeHoldingInfo": true,
            "firstIndex": 0,
            "lastIndex": 100
        }, function (response) {
            var infoModalLedgerTable = $("#user_info_modal_ledger_table");
            if (response.entries && response.entries.length) {
                var rows = "";
				var decimalParams = KRS.getLedgerNumberOfDecimals(response.entries);
				for (var i = 0; i < response.entries.length; i++) {
                    var entry = response.entries[i];
                    rows += KRS.getLedgerEntryRow(entry, decimalParams);
                }
                infoModalLedgerTable.find("tbody").empty().append(rows);
                KRS.dataLoadFinished(infoModalLedgerTable);
            } else {
                infoModalLedgerTable.find("tbody").empty();
                KRS.dataLoadFinished(infoModalLedgerTable);
            }
        });
	};

	KRS.userInfoModal.aliases = function() {
		KRS.sendRequest("getAliases", {
			"account": KRS.userInfoModal.user,
			"firstIndex": 0,
			"lastIndex": 100
		}, function(response) {
			var rows = "";
			if (response.aliases && response.aliases.length) {
				var aliases = response.aliases;
				aliases.sort(function(a, b) {
					if (a.aliasName.toLowerCase() > b.aliasName.toLowerCase()) {
						return 1;
					} else if (a.aliasName.toLowerCase() < b.aliasName.toLowerCase()) {
						return -1;
					} else {
						return 0;
					}
				});
				for (var i = 0; i < aliases.length; i++) {
					var alias = aliases[i];
					rows += "<tr data-alias='" + KRS.escapeRespStr(String(alias.aliasName).toLowerCase()) + "'><td class='alias'>" + KRS.escapeRespStr(alias.aliasName) + "</td><td class='uri'>" + (alias.aliasURI.indexOf("http") === 0 ? "<a href='" + KRS.escapeRespStr(alias.aliasURI) + "' target='_blank'>" + KRS.escapeRespStr(alias.aliasURI) + "</a>" : KRS.escapeRespStr(alias.aliasURI)) + "</td></tr>";
				}
			}
            var infoModalAliasesTable = $("#user_info_modal_aliases_table");
            infoModalAliasesTable.find("tbody").empty().append(rows);
			KRS.dataLoadFinished(infoModalAliasesTable);
		});
	};

	KRS.userInfoModal.marketplace = function() {
		KRS.sendRequest("getDGSGoods", {
			"seller": KRS.userInfoModal.user,
			"firstIndex": 0,
			"lastIndex": 100
		}, function(response) {
			var rows = "";
			var quantityDecimals = KRS.getNumberOfDecimals(response.goods, "quantity", function(val) {
				return KRS.format(val.quantity);
			});
			var priceDecimals = KRS.getNumberOfDecimals(response.goods, "priceNQT", function(val) {
				return KRS.formatAmount(val.priceNQT);
			});
			if (response.goods && response.goods.length) {
				for (var i = 0; i < response.goods.length; i++) {
					var good = response.goods[i];
					if (good.name.length > 150) {
						good.name = good.name.substring(0, 150) + "...";
					}
					rows += "<tr><td><a href='#' data-goto-goods='" + KRS.escapeRespStr(good.goods) + "' data-seller='" + KRS.escapeRespStr(KRS.userInfoModal.user) + "'>" + KRS.escapeRespStr(good.name) + "</a></td><td class='numeric'>" + KRS.formatAmount(good.priceNQT, false, false, priceDecimals) + " KPL</td><td class='numeric'>" + KRS.format(good.quantity, false, quantityDecimals) + "</td></tr>";
				}
			}
            var infoModalMarketplaceTable = $("#user_info_modal_marketplace_table");
            infoModalMarketplaceTable.find("tbody").empty().append(rows);
			KRS.dataLoadFinished(infoModalMarketplaceTable);
		});
	};
	
	KRS.userInfoModal.currencies = function() {
		KRS.sendRequest("getAccountCurrencies+", {
			"account": KRS.userInfoModal.user,
			"includeCurrencyInfo": true
		}, function(response) {
			var rows = "";
			var unitsDecimals = KRS.getNumberOfDecimals(response.accountCurrencies, "unconfirmedUnits", function(val) {
				return KRS.formatQuantity(val.unconfirmedUnits, val.decimals);
			});
			if (response.accountCurrencies && response.accountCurrencies.length) {
				for (var i = 0; i < response.accountCurrencies.length; i++) {
					var currency = response.accountCurrencies[i];
					var code = KRS.escapeRespStr(currency.code);
					rows += "<tr>" +
						"<td>" + KRS.getTransactionLink(KRS.escapeRespStr(currency.currency), code) + "</td>" +
						"<td>" + currency.name + "</td>" +
						"<td class='numeric'>" + KRS.formatQuantity(currency.unconfirmedUnits, currency.decimals, false, unitsDecimals) + "</td>" +
					"</tr>";
				}
			}
            var infoModalCurrenciesTable = $("#user_info_modal_currencies_table");
            infoModalCurrenciesTable.find("tbody").empty().append(rows);
			KRS.dataLoadFinished(infoModalCurrenciesTable);
		});
	};

	KRS.userInfoModal.assets = function() {
		KRS.sendRequest("getAccount", {
			"account": KRS.userInfoModal.user,
            "includeAssets": true
        }, function(response) {
			if (response.assetBalances && response.assetBalances.length) {
				var assets = {};
				var nrAssets = 0;
				var ignoredAssets = 0; // Optimization to reduce number of getAsset calls
				for (var i = 0; i < response.assetBalances.length; i++) {
					if (response.assetBalances[i].balanceQNT == "0") {
						ignoredAssets++;
						if (nrAssets + ignoredAssets == response.assetBalances.length) {
							KRS.userInfoModal.addIssuedAssets(assets);
						}
						continue;
					}

					KRS.sendRequest("getAsset", {
						"asset": response.assetBalances[i].asset,
						"_extra": {
							"balanceQNT": response.assetBalances[i].balanceQNT
						}
					}, function(asset, input) {
						asset.asset = input.asset;
						asset.balanceQNT = input["_extra"].balanceQNT;
						assets[asset.asset] = asset;
						nrAssets++;
                        // This will work since eventually the condition below or in the previous
                        // if statement would be met
						//noinspection JSReferencingMutableVariableFromClosure
                        if (nrAssets + ignoredAssets == response.assetBalances.length) {
							KRS.userInfoModal.addIssuedAssets(assets);
						}
					});
				}
			} else {
				KRS.userInfoModal.addIssuedAssets({});
			}
		});
	};

	KRS.userInfoModal.trade_history = function() {
		KRS.sendRequest("getTrades", {
			"account": KRS.userInfoModal.user,
			"includeAssetInfo": true,
			"firstIndex": 0,
			"lastIndex": 100
		}, function(response) {
			var rows = "";
			var quantityDecimals = KRS.getNumberOfDecimals(response.trades, "quantityQNT", function(val) {
				return KRS.formatQuantity(val.quantityQNT, val.decimals);
			});
			var priceDecimals = KRS.getNumberOfDecimals(response.trades, "priceNQT", function(val) {
				return KRS.formatOrderPricePerWholeQNT(val.priceNQT, val.decimals);
			});
			var amountDecimals = KRS.getNumberOfDecimals(response.trades, "totalNQT", function(val) {
				return KRS.formatAmount(KRS.calculateOrderTotalNQT(val.quantityQNT, val.priceNQT));
			});
			if (response.trades && response.trades.length) {
				var trades = response.trades;
				for (var i = 0; i < trades.length; i++) {
					trades[i].priceNQT = new BigInteger(trades[i].priceNQT);
					trades[i].quantityQNT = new BigInteger(trades[i].quantityQNT);
					trades[i].totalNQT = new BigInteger(KRS.calculateOrderTotalNQT(trades[i].priceNQT, trades[i].quantityQNT));
					var type = (trades[i].buyerRS == KRS.userInfoModal.user ? "buy" : "sell");
					rows += "<tr><td><a href='#' data-goto-asset='" + KRS.escapeRespStr(trades[i].asset) + "'>" + KRS.escapeRespStr(trades[i].name) + "</a></td><td>" + KRS.formatTimestamp(trades[i].timestamp) + "</td><td style='color:" + (type == "buy" ? "green" : "red") + "'>" + $.t(type) + "</td><td class='numeric'>" + KRS.formatQuantity(trades[i].quantityQNT, trades[i].decimals, false, quantityDecimals) + "</td><td class='asset_price numeric'>" + KRS.formatOrderPricePerWholeQNT(trades[i].priceNQT, trades[i].decimals, priceDecimals) + "</td><td class='numeric' style='color:" + (type == "buy" ? "red" : "green") + "'>" + KRS.formatAmount(trades[i].totalNQT, false, false, amountDecimals) + "</td></tr>";
				}
			}
            var infoModalTradeHistoryTable = $("#user_info_modal_trade_history_table");
            infoModalTradeHistoryTable.find("tbody").empty().append(rows);
			KRS.dataLoadFinished(infoModalTradeHistoryTable);
		});
	};

	KRS.userInfoModal.addIssuedAssets = function(assets) {
		KRS.sendRequest("getAssetsByIssuer", {
			"account": KRS.userInfoModal.user
		}, function(response) {
			if (response.assets && response.assets[0] && response.assets[0].length) {
				$.each(response.assets[0], function(key, issuedAsset) {
					if (assets[issuedAsset.asset]) {
						assets[issuedAsset.asset].issued = true;
					} else {
						issuedAsset.balanceQNT = "0";
						issuedAsset.issued = true;
						assets[issuedAsset.asset] = issuedAsset;
					}
				});
				KRS.userInfoModal.assetsLoaded(assets);
			} else if (!$.isEmptyObject(assets)) {
				KRS.userInfoModal.assetsLoaded(assets);
			} else {
                var infoModalAssetsTable = $("#user_info_modal_assets_table");
                infoModalAssetsTable.find("tbody").empty();
				KRS.dataLoadFinished(infoModalAssetsTable);
			}
		});
	};

	KRS.userInfoModal.assetsLoaded = function(assets) {
		var assetArray = [];
		var rows = "";
		$.each(assets, function(key, asset) {
			assetArray.push(asset);
		});
		assetArray.sort(function(a, b) {
			if (a.issued && b.issued) {
				if (a.name.toLowerCase() > b.name.toLowerCase()) {
					return 1;
				} else if (a.name.toLowerCase() < b.name.toLowerCase()) {
					return -1;
				} else {
					return 0;
				}
			} else if (a.issued) {
				return -1;
			} else if (b.issued) {
				return 1;
			} else {
				if (a.name.toLowerCase() > b.name.toLowerCase()) {
					return 1;
				} else if (a.name.toLowerCase() < b.name.toLowerCase()) {
					return -1;
				} else {
					return 0;
				}
			}
		});
		var quantityDecimals = KRS.getNumberOfDecimals(assetArray, "balanceQNT", function(val) {
			return KRS.formatQuantity(val.balanceQNT, val.decimals);
		});
		var totalDecimals = KRS.getNumberOfDecimals(assetArray, "quantityQNT", function(val) {
			return KRS.formatQuantity(val.quantityQNT, val.decimals);
		});
		for (var i = 0; i < assetArray.length; i++) {
			var asset = assetArray[i];
			var percentageAsset = KRS.calculatePercentage(asset.balanceQNT, asset.quantityQNT);
			rows += "<tr" + (asset.issued ? " class='asset_owner'" : "") + "><td><a href='#' data-goto-asset='" + KRS.escapeRespStr(asset.asset) + "'" + (asset.issued ? " style='font-weight:bold'" : "") + ">" + KRS.escapeRespStr(asset.name) + "</a></td><td class='quantity numeric'>" + KRS.formatQuantity(asset.balanceQNT, asset.decimals, false, quantityDecimals) + "</td><td class='numeric'>" + KRS.formatQuantity(asset.quantityQNT, asset.decimals, false, totalDecimals) + "</td><td>" + percentageAsset + "%</td></tr>";
		}

        var infoModalAssetsTable = $("#user_info_modal_assets_table");
        infoModalAssetsTable.find("tbody").empty().append(rows);
		KRS.dataLoadFinished(infoModalAssetsTable);
	};

	return KRS;
}(KRS || {}, jQuery));
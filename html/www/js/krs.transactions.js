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

	KRS.lastTransactions = "";
	KRS.unconfirmedTransactions = [];
	KRS.unconfirmedTransactionIds = "";
	KRS.unconfirmedTransactionsChange = true;

	KRS.handleIncomingTransactions = function(transactions, confirmedTransactionIds) {
		var oldBlock = (confirmedTransactionIds === false); //we pass false instead of an [] in case there is no new block..

		if (typeof confirmedTransactionIds != "object") {
			confirmedTransactionIds = [];
		}

		if (confirmedTransactionIds.length) {
			KRS.lastTransactions = confirmedTransactionIds.toString();
		}

		if (confirmedTransactionIds.length || KRS.unconfirmedTransactionsChange) {
			transactions.sort(KRS.sortArray);
		}
		//Bug with popovers staying permanent when being open
		$('div.popover').hide();
		$('.td_transaction_phasing div.show_popover').popover('hide');

		//always refresh peers and unconfirmed transactions..
		if (KRS.currentPage == "peers") {
			KRS.incoming.peers();
		} else if (KRS.currentPage == "transactions"
            && $('#transactions_type_navi').find('li.active a').attr('data-transaction-type') == "unconfirmed") {
			KRS.incoming.transactions();
		} else {
			if (KRS.currentPage != 'messages' && (!oldBlock || KRS.unconfirmedTransactionsChange)) {
				if (KRS.incoming[KRS.currentPage]) {
					KRS.incoming[KRS.currentPage](transactions);
				}
			}
		}
		if (!oldBlock || KRS.unconfirmedTransactionsChange) {
			// always call incoming for messages to enable message notifications
			KRS.incoming['messages'](transactions);
			KRS.updateNotifications();
			KRS.setPhasingNotifications();
            KRS.setShufflingNotifications();
		}
	};

	KRS.getUnconfirmedTransactions = function(callback) {
		KRS.sendRequest("getUnconfirmedTransactions", {
			"account": KRS.account,
            "firstIndex": 0,
            "lastIndex": KRS.itemsPerPage
		}, function(response) {
			if (response.unconfirmedTransactions && response.unconfirmedTransactions.length) {
				var unconfirmedTransactions = [];
				var unconfirmedTransactionIds = [];

				response.unconfirmedTransactions.sort(function(x, y) {
					if (x.timestamp < y.timestamp) {
						return 1;
					} else if (x.timestamp > y.timestamp) {
						return -1;
					} else {
						return 0;
					}
				});

				for (var i = 0; i < response.unconfirmedTransactions.length; i++) {
					var unconfirmedTransaction = response.unconfirmedTransactions[i];
					unconfirmedTransaction.confirmed = false;
					unconfirmedTransaction.unconfirmed = true;
					unconfirmedTransaction.confirmations = "/";

					if (unconfirmedTransaction.attachment) {
						for (var key in unconfirmedTransaction.attachment) {
							if (!unconfirmedTransaction.attachment.hasOwnProperty(key)) {
								continue;
							}
							if (!unconfirmedTransaction.hasOwnProperty(key)) {
								unconfirmedTransaction[key] = unconfirmedTransaction.attachment[key];
							}
						}
					}
					unconfirmedTransactions.push(unconfirmedTransaction);
					unconfirmedTransactionIds.push(unconfirmedTransaction.transaction);
				}
				KRS.unconfirmedTransactions = unconfirmedTransactions;
				var unconfirmedTransactionIdString = unconfirmedTransactionIds.toString();
				if (unconfirmedTransactionIdString != KRS.unconfirmedTransactionIds) {
					KRS.unconfirmedTransactionsChange = true;
					KRS.setUnconfirmedNotifications();
					KRS.unconfirmedTransactionIds = unconfirmedTransactionIdString;
				} else {
					KRS.unconfirmedTransactionsChange = false;
				}

				if (callback) {
					callback(unconfirmedTransactions);
				}
			} else {
				KRS.unconfirmedTransactions = [];
				if (KRS.unconfirmedTransactionIds) {
					KRS.unconfirmedTransactionsChange = true;
					KRS.setUnconfirmedNotifications();
				} else {
					KRS.unconfirmedTransactionsChange = false;
				}

				KRS.unconfirmedTransactionIds = "";
				if (callback) {
					callback([]);
				}
			}
		});
	};

	KRS.getInitialTransactions = function() {
		KRS.sendRequest("getBlockchainTransactions", {
			"account": KRS.account,
			"firstIndex": 0,
			"lastIndex": 9
		}, function(response) {
			if (response.transactions && response.transactions.length) {
				var transactions = [];
				var transactionIds = [];

				for (var i = 0; i < response.transactions.length; i++) {
					var transaction = response.transactions[i];
					transaction.confirmed = true;
					transactions.push(transaction);
					transactionIds.push(transaction.transaction);
				}
				KRS.getUnconfirmedTransactions(function() {
					KRS.loadPage('dashboard');
				});
			} else {
				KRS.getUnconfirmedTransactions(function() {
					KRS.loadPage('dashboard');
				});
			}
		});
	};

	KRS.getNewTransactions = function() {
		//check if there is a new transaction..
		if (!KRS.blocks[0]) {
			return;
		}
        KRS.sendRequest("getBlockchainTransactions", {
			"account": KRS.account,
			"timestamp": KRS.blocks[0].timestamp + 1,
			"firstIndex": 0,
			"lastIndex": 0
		}, function(response) {
			//if there is, get latest 10 transactions
			if (response.transactions && response.transactions.length) {
				KRS.sendRequest("getBlockchainTransactions", {
					"account": KRS.account,
					"firstIndex": 0,
					"lastIndex": 9
				}, function(response) {
					if (response.transactions && response.transactions.length) {
						var transactionIds = [];

						$.each(response.transactions, function(key, transaction) {
							transactionIds.push(transaction.transaction);
							response.transactions[key].confirmed = true;
						});

						KRS.getUnconfirmedTransactions(function(unconfirmedTransactions) {
							KRS.handleIncomingTransactions(response.transactions.concat(unconfirmedTransactions), transactionIds);
						});
					} else {
						KRS.getUnconfirmedTransactions(function(unconfirmedTransactions) {
							KRS.handleIncomingTransactions(unconfirmedTransactions);
						});
					}
				});
			} else {
				KRS.getUnconfirmedTransactions(function(unconfirmedTransactions) {
					KRS.handleIncomingTransactions(unconfirmedTransactions);
				});
			}
		});
	};

	KRS.addUnconfirmedTransaction = function(transactionId, callback) {
		KRS.sendRequest("getTransaction", {
			"transaction": transactionId
		}, function(response) {
			if (!response.errorCode) {
				response.transaction = transactionId;
				response.confirmations = "/";
				response.confirmed = false;
				response.unconfirmed = true;

				if (response.attachment) {
					for (var key in response.attachment) {
                        if (!response.attachment.hasOwnProperty(key)) {
                            continue;
                        }
						if (!response.hasOwnProperty(key)) {
							response[key] = response.attachment[key];
						}
					}
				}
				var alreadyProcessed = false;
				try {
					var regex = new RegExp("(^|,)" + transactionId + "(,|$)");
					if (regex.exec(KRS.lastTransactions)) {
						alreadyProcessed = true;
					} else {
						$.each(KRS.unconfirmedTransactions, function(key, unconfirmedTransaction) {
							if (unconfirmedTransaction.transaction == transactionId) {
								alreadyProcessed = true;
								return false;
							}
						});
					}
				} catch (e) {
                    KRS.logConsole(e.message);
                }

				if (!alreadyProcessed) {
					KRS.unconfirmedTransactions.unshift(response);
				}
				if (callback) {
					callback(alreadyProcessed);
				}
				if (KRS.currentPage == 'transactions' || KRS.currentPage == 'dashboard') {
					$('div.popover').hide();
					$('.td_transaction_phasing div.show_popover').popover('hide');
					KRS.incoming[KRS.currentPage]();
				}

				KRS.getAccountInfo();
			} else if (callback) {
				callback(false);
			}
		});
	};

	KRS.sortArray = function(a, b) {
		return b.timestamp - a.timestamp;
	};

	KRS.getTransactionIconHTML = function(type, subtype) {
		var iconHTML = KRS.transactionTypes[type]['iconHTML'] + " " + KRS.transactionTypes[type]['subTypes'][subtype]['iconHTML'];
		var tooltip = $.t(KRS.transactionTypes[type].subTypes[subtype].i18nKeyTitle);
		return '<span title="' + tooltip + '" class="label label-primary" style="font-size:12px;">' + iconHTML + '</span>';
	};

	KRS.addPhasedTransactionHTML = function(t) {
		var $tr = $('.tr_transaction_' + t.transaction + ':visible');
		var $tdPhasing = $tr.find('.td_transaction_phasing');
		var $approveBtn = $tr.find('.td_transaction_actions .approve_transaction_btn');

		if (t.attachment && t.attachment["version.Phasing"] && t.attachment.phasingVotingModel != undefined) {
			KRS.sendRequest("getPhasingPoll", {
				"transaction": t.transaction,
				"countVotes": true
			}, function(responsePoll) {
				if (responsePoll.transaction) {
					KRS.sendRequest("getPhasingPollVote", {
						"transaction": t.transaction,
						"account": KRS.accountRS
					}, function(responseVote) {
						var attachment = t.attachment;
						var vm = attachment.phasingVotingModel;
						var minBalance = parseFloat(attachment.phasingMinBalance);
						var mbModel = attachment.phasingMinBalanceModel;

						if ($approveBtn) {
							var disabled = false;
							var unconfirmedTransactions = KRS.unconfirmedTransactions;
							if (unconfirmedTransactions) {
								for (var i = 0; i < unconfirmedTransactions.length; i++) {
									var ut = unconfirmedTransactions[i];
									if (ut.attachment && ut.attachment["version.PhasingVoteCasting"] && ut.attachment.transactionFullHashes && ut.attachment.transactionFullHashes.length > 0) {
										if (ut.attachment.transactionFullHashes[0] == t.fullHash) {
											disabled = true;
											$approveBtn.attr('disabled', true);
										}
									}
								}
							}
							if (!disabled) {
								if (responseVote.transaction) {
									$approveBtn.attr('disabled', true);
								} else {
									$approveBtn.attr('disabled', false);
								}
							}
						}

						if (!responsePoll.result) {
							responsePoll.result = 0;
						}

						var state = "";
						var color = "";
						var icon = "";
						var minBalanceFormatted = "";
                        var finished = attachment.phasingFinishHeight <= KRS.lastBlockHeight;
						var finishHeightFormatted = String(attachment.phasingFinishHeight);
						var percentageFormatted = attachment.phasingQuorum > 0 ? KRS.calculatePercentage(responsePoll.result, attachment.phasingQuorum, 0) + "%" : "";
						var percentageProgressBar = attachment.phasingQuorum > 0 ? Math.round(responsePoll.result * 100 / attachment.phasingQuorum) : 0;
						var progressBarWidth = Math.round(percentageProgressBar / 2);
                        var approvedFormatted;
						if (responsePoll.approved || attachment.phasingQuorum == 0) {
							approvedFormatted = "Yes";
						} else {
							approvedFormatted = "No";
						}

						if (finished) {
							if (responsePoll.approved) {
								state = "success";
								color = "#00a65a";
							} else {
								state = "danger";
								color = "#f56954";
							}
						} else {
							state = "warning";
							color = "#f39c12";
						}

						var $popoverTable = $("<table class='table table-striped'></table>");
						var $popoverTypeTR = $("<tr><td></td><td></td></tr>");
						var $popoverVotesTR = $("<tr><td>" + $.t('votes', 'Votes') + ":</td><td></td></tr>");
						var $popoverPercentageTR = $("<tr><td>" + $.t('percentage', 'Percentage') + ":</td><td></td></tr>");
						var $popoverFinishTR = $("<tr><td>" + $.t('finish_height', 'Finish Height') + ":</td><td></td></tr>");
						var $popoverApprovedTR = $("<tr><td>" + $.t('approved', 'Approved') + ":</td><td></td></tr>");

						$popoverTypeTR.appendTo($popoverTable);
						$popoverVotesTR.appendTo($popoverTable);
						$popoverPercentageTR.appendTo($popoverTable);
						$popoverFinishTR.appendTo($popoverTable);
						$popoverApprovedTR.appendTo($popoverTable);

						$popoverPercentageTR.find("td:last").html(percentageFormatted);
						$popoverFinishTR.find("td:last").html(finishHeightFormatted);
						$popoverApprovedTR.find("td:last").html(approvedFormatted);

						var template = '<div class="popover" style="min-width:260px;"><div class="arrow"></div><div class="popover-inner">';
						template += '<h3 class="popover-title"></h3><div class="popover-content"><p></p></div></div></div>';

						var popoverConfig = {
							"html": true,
							"trigger": "hover",
							"placement": "top",
							"template": template
						};

						if (vm == -1) {
							icon = '<i class="fa ion-load-a"></i>';
						}
						if (vm == 0) {
							icon = '<i class="fa fa-group"></i>';
						}
						if (vm == 1) {
							icon = '<i class="fa fa-money"></i>';
						}
						if (vm == 2) {
							icon = '<i class="fa fa-signal"></i>';
						}
						if (vm == 3) {
							icon = '<i class="fa fa-bank"></i>';
						}
						if (vm == 4) {
							icon = '<i class="fa fa-thumbs-up"></i>';
						}
						if (vm == 5) {
							icon = '<i class="fa fa-question"></i>';
						}
						var phasingDiv = "";
						phasingDiv += '<div class="show_popover" style="display:inline-block;min-width:94px;text-align:left;border:1px solid #e2e2e2;background-color:#fff;padding:3px;" ';
	 				 	phasingDiv += 'data-toggle="popover" data-container="body">';
						phasingDiv += "<div class='label label-" + state + "' style='display:inline-block;margin-right:5px;'>" + icon + "</div>";

						if (vm == -1) {
							phasingDiv += '<span style="color:' + color + '">' + $.t("none") + '</span>';
						} else if (vm == 0) {
							phasingDiv += '<span style="color:' + color + '">' + String(responsePoll.result) + '</span> / <span>' + String(attachment.phasingQuorum) + '</span>';
						} else {
							phasingDiv += '<div class="progress" style="display:inline-block;height:10px;width: 50px;">';
	    					phasingDiv += '<div class="progress-bar progress-bar-' + state + '" role="progressbar" aria-valuenow="' + percentageProgressBar + '" ';
	    					phasingDiv += 'aria-valuemin="0" aria-valuemax="100" style="height:10px;width: ' + progressBarWidth + 'px;">';
	      					phasingDiv += '<span class="sr-only">' + percentageProgressBar + '% Complete</span>';
	    					phasingDiv += '</div>';
	  						phasingDiv += '</div> ';
	  					}
						phasingDiv += "</div>";
						var $phasingDiv = $(phasingDiv);
						popoverConfig["content"] = $popoverTable;
						$phasingDiv.popover(popoverConfig);
						$phasingDiv.appendTo($tdPhasing);
                        var votesFormatted;
						if (vm == 0) {
							$popoverTypeTR.find("td:first").html($.t('accounts', 'Accounts') + ":");
							$popoverTypeTR.find("td:last").html(String(attachment.phasingWhitelist ? attachment.phasingWhitelist.length : ""));
							votesFormatted = String(responsePoll.result) + " / " + String(attachment.phasingQuorum);
							$popoverVotesTR.find("td:last").html(votesFormatted);
						}
						if (vm == 1) {
							$popoverTypeTR.find("td:first").html($.t('accounts', 'Accounts') + ":");
							$popoverTypeTR.find("td:last").html(String(attachment.phasingWhitelist ? attachment.phasingWhitelist.length : ""));
							votesFormatted = KRS.convertToKPL(responsePoll.result) + " / " + KRS.convertToKPL(attachment.phasingQuorum) + " KPL";
							$popoverVotesTR.find("td:last").html(votesFormatted);
						}
						if (mbModel == 1) {
							if (minBalance > 0) {
								minBalanceFormatted = KRS.convertToKPL(minBalance) + " KPL";
								$approveBtn.data('minBalanceFormatted', minBalanceFormatted.escapeHTML());
							}
						}
						if (vm == 2 || mbModel == 2) {
							KRS.sendRequest("getAsset", {
								"asset": attachment.phasingHolding
							}, function(phResponse) {
								if (phResponse && phResponse.asset) {
									if (vm == 2) {
										$popoverTypeTR.find("td:first").html($.t('asset', 'Asset') + ":");
										$popoverTypeTR.find("td:last").html(String(phResponse.name));
										var votesFormatted = KRS.convertToQNTf(responsePoll.result, phResponse.decimals) + " / ";
										votesFormatted += KRS.convertToQNTf(attachment.phasingQuorum, phResponse.decimals) + " QNT";
										$popoverVotesTR.find("td:last").html(votesFormatted);
									}
									if (mbModel == 2) {
										if (minBalance > 0) {
											minBalanceFormatted = KRS.convertToQNTf(minBalance, phResponse.decimals) + " QNT (" + phResponse.name + ")";
											$approveBtn.data('minBalanceFormatted', minBalanceFormatted.escapeHTML());
										}
									}
								}
							}, { isAsync: false });
						}
						if (vm == 3 || mbModel == 3) {
							KRS.sendRequest("getCurrency", {
								"currency": attachment.phasingHolding
							}, function(phResponse) {
								if (phResponse && phResponse.currency) {
									if (vm == 3) {
										$popoverTypeTR.find("td:first").html($.t('currency', 'Currency') + ":");
										$popoverTypeTR.find("td:last").html(String(phResponse.code));
										var votesFormatted = KRS.convertToQNTf(responsePoll.result, phResponse.decimals) + " / ";
										votesFormatted += KRS.convertToQNTf(attachment.phasingQuorum, phResponse.decimals) + " Units";
										$popoverVotesTR.find("td:last").html(votesFormatted);
									}
									if (mbModel == 3) {
										if (minBalance > 0) {
											minBalanceFormatted = KRS.convertToQNTf(minBalance, phResponse.decimals) + " Units (" + phResponse.code + ")";
											$approveBtn.data('minBalanceFormatted', minBalanceFormatted.escapeHTML());
										}
									}
								}
							}, { isAsync: false });
						}
					});
				} else {
					$tdPhasing.html("&nbsp;");
				}
			}, { isAsync: false });
		} else {
			$tdPhasing.html("&nbsp;");
		}
	};

	KRS.addPhasingInfoToTransactionRows = function(transactions) {
		for (var i = 0; i < transactions.length; i++) {
			var transaction = transactions[i];
			KRS.addPhasedTransactionHTML(transaction);
		}
	};

    KRS.getTransactionRowHTML = function(t, actions, decimals, isScheduled) {
		var transactionType = $.t(KRS.transactionTypes[t.type]['subTypes'][t.subtype]['i18nKeyTitle']);

		if (t.type == 1 && t.subtype == 6 && t.attachment.priceNQT == "0") {
			if (t.sender == KRS.account && t.recipient == KRS.account) {
				transactionType = $.t("alias_sale_cancellation");
			} else {
				transactionType = $.t("alias_transfer");
			}
		}

		var amount = "";
		var sign = 0;
		var fee = new BigInteger(t.feeNQT);
		var feeColor = "";
		var receiving = t.recipient == KRS.account && !(t.sender == KRS.account);
		if (receiving) {
			if (t.amountNQT != "0") {
				amount = new BigInteger(t.amountNQT);
				sign = 1;
			}
			feeColor = "color:black;";
		} else {
			if (t.sender != t.recipient) {
				if (t.amountNQT != "0") {
					amount = new BigInteger(t.amountNQT);
					amount = amount.negate();
					sign = -1;
				}
			} else {
				if (t.amountNQT != "0") {
					amount = new BigInteger(t.amountNQT); // send to myself
				}
			}
			feeColor = "color:red;";
		}
		var formattedAmount = "";
		if (amount != "") {
			formattedAmount = KRS.formatAmount(amount, false, false, decimals.amount);
		}
		var formattedFee = KRS.formatAmount(fee, false, false, decimals.fee);
		var amountColor = (sign == 1 ? "color:green;" : (sign == -1 ? "color:red;" : "color:black;"));
		var hasMessage = false;

		if (t.attachment) {
			if (t.attachment.encryptedMessage || t.attachment.message) {
				hasMessage = true;
			} else if (t.sender == KRS.account && t.attachment.encryptToSelfMessage) {
				hasMessage = true;
			}
		}
		var html = "";
		html += "<tr class='tr_transaction_" + t.transaction + "'>";
		html += "<td style='vertical-align:middle;'>";
		if (isScheduled) {
            html += "<a href='#' onclick='KRS.showTransactionModal(" + JSON.stringify(t) + ");'>" + KRS.formatTimestamp(t.timestamp) + "</a>";
		}  else {
            html += "<a class='show_transaction_modal_action' href='#' data-timestamp='" + KRS.escapeRespStr(t.timestamp) + "' ";
            html += "data-transaction='" + KRS.escapeRespStr(t.transaction) + "'>";
            html += KRS.formatTimestamp(t.timestamp) + "</a>";
		}
  		html += "</td>";
  		html += "<td style='vertical-align:middle;text-align:center;'>" + (hasMessage ? "&nbsp; <i class='fa fa-envelope-o'></i>&nbsp;" : "&nbsp;") + "</td>";
		html += '<td style="vertical-align:middle;">';
		html += KRS.getTransactionIconHTML(t.type, t.subtype) + '&nbsp; ';
		html += '<span style="font-size:11px;display:inline-block;margin-top:5px;">' + transactionType + '</span>';
		html += '</td>';
        html += "<td style='vertical-align:middle;" + amountColor + "'>" + formattedAmount + "</td>";
        html += "<td style='vertical-align:middle;" + feeColor + "'>" + formattedFee + "</td>";
		html += "<td style='vertical-align:middle;'>" + ((KRS.getAccountLink(t, "sender") == "/" && t.type == 2) ? "Asset Exchange" : KRS.getAccountLink(t, "sender")) + " ";
		html += "<i class='fa fa-arrow-circle-right' style='color:#777;'></i> " + ((KRS.getAccountLink(t, "recipient") == "/" && t.type == 2) ? "Asset Exchange" : KRS.getAccountLink(t, "recipient")) + "</td>";
		if (!isScheduled) {
            html += "<td class='td_transaction_phasing' style='min-width:100px;vertical-align:middle;text-align:center;'></td>";
            html += "<td style='vertical-align:middle;text-align:center;'>" + (t.confirmed ? KRS.getBlockLink(t.height, null, true) : "-") + "</td>";
            html += "<td class='confirmations' style='vertical-align:middle;text-align:center;font-size:12px;'>";
            html += "<span class='show_popover' data-content='" + (t.confirmed ? KRS.formatAmount(t.confirmations) + " " + $.t("confirmations") : $.t("unconfirmed_transaction")) + "' ";
            html += "data-container='body' data-placement='left'>";
            html += (!t.confirmed ? "-" : (t.confirmations > 1440 ? (KRS.formatAmount('144000000000') + "+") : KRS.formatAmount(t.confirmations))) + "</span></td>";
        }
		if (actions && actions.length != undefined) {
			html += '<td class="td_transaction_actions" style="vertical-align:middle;text-align:right;">';
			if (actions.indexOf('approve') > -1) {
                html += "<a class='btn btn-xs btn-default approve_transaction_btn' href='#' data-toggle='modal' data-target='#approve_transaction_modal' ";
				html += "data-transaction='" + KRS.escapeRespStr(t.transaction) + "' data-fullhash='" + KRS.escapeRespStr(t.fullHash) + "' ";
				html += "data-timestamp='" + t.timestamp + "' " + "data-votingmodel='" + t.attachment.phasingVotingModel + "' ";
				html += "data-fee='1' data-min-balance-formatted=''>" + $.t('approve') + "</a>";
			}
			if (actions.indexOf('delete') > -1) {
                html += "<a class='btn btn-xs btn-default' href='#' data-toggle='modal' data-target='#delete_scheduled_transaction_modal' ";
				html += "data-transaction='" + KRS.escapeRespStr(t.transaction) + "'>" + $.t("delete") + "</a>";
			}
			html += "</td>";
		}
		html += "</tr>";
		return html;
	};

    KRS.getLedgerEntryRow = function(entry, decimalParams) {
        var linkClass;
        var dataToken;
        if (entry.isTransactionEvent) {
            linkClass = "show_transaction_modal_action";
            dataToken = "data-transaction='" + KRS.escapeRespStr(entry.event) + "'";
        } else {
            linkClass = "show_block_modal_action";
            dataToken = "data-id='1' data-block='" + KRS.escapeRespStr(entry.event)+ "'";
        }
        var change = entry.change;
        var balance = entry.balance;
        var balanceType = "kpl";
        var balanceEntity = "KPL";
        var holdingIcon = "";
        if (change < 0) {
            change = String(change).substring(1);
        }
        if (/ASSET_BALANCE/i.test(entry.holdingType)) {
            KRS.sendRequest("getAsset", {"asset": entry.holding}, function (response) {
                balanceType = "asset";
                balanceEntity = response.name;
                change = KRS.formatQuantity(change, response.decimals, false, decimalParams.holdingChangeDecimals);
                balance = KRS.formatQuantity(balance, response.decimals, false, decimalParams.holdingBalanceDecimals);
                holdingIcon = "<i class='fa fa-signal'></i> ";
            }, { isAsync: false });
        } else if (/CURRENCY_BALANCE/i.test(entry.holdingType)) {
            KRS.sendRequest("getCurrency", {"currency": entry.holding}, function (response) {
                balanceType = "currency";
                balanceEntity = response.name;
                change = KRS.formatQuantity(change, response.decimals, false, decimalParams.holdingChangeDecimals);
                balance = KRS.formatQuantity(balance, response.decimals, false, decimalParams.holdingBalanceDecimals);
                holdingIcon =  "<i class='fa fa-bank'></i> ";
            }, { isAsync: false });
        } else {
            change = KRS.formatAmount(change, false, false, decimalParams.changeDecimals);
            balance = KRS.formatAmount(balance, false, false, decimalParams.balanceDecimals);
        }
        var sign = "";
		var color = "";
        if (entry.change > 0) {
			color = "color:green;";
		} else if (entry.change < 0) {
			color = "color:red;";
			sign = "-";
        }
        var eventType = KRS.escapeRespStr(entry.eventType);
        if (eventType.indexOf("ASSET") == 0 || eventType.indexOf("CURRENCY") == 0) {
            eventType = eventType.substring(eventType.indexOf("_") + 1);
        }
        eventType = $.t(eventType.toLowerCase());
        var html = "";
		html += "<tr>";
		html += "<td style='vertical-align:middle;'>";
  		html += "<a class='show_ledger_modal_action' href='#' data-entry='" + KRS.escapeRespStr(entry.ledgerId) +"'";
        html += "data-change='" + (entry.change < 0 ? ("-" + change) : change) + "' data-balance='" + balance + "'>";
  		html += KRS.formatTimestamp(entry.timestamp) + "</a>";
  		html += "</td>";
		html += '<td style="vertical-align:middle;">';
        html += '<span style="font-size:11px;display:inline-block;margin-top:5px;">' + eventType + '</span>';
        html += "<a class='" + linkClass + "' href='#' data-timestamp='" + KRS.escapeRespStr(entry.timestamp) + "' " + dataToken + ">";
        html += " <i class='fa fa-info'></i></a>";
		html += '</td>';
		if (balanceType == "kpl") {
            html += "<td style='vertical-align:middle;" + color + "' class='numeric'>" + sign + change + "</td>";
            html += "<td style='vertical-align:middle;' class='numeric'>" + balance + "</td>";
            html += "<td></td>";
            html += "<td></td>";
            html += "<td></td>";
        } else {
            html += "<td></td>";
            html += "<td></td>";
            html += "<td>" + holdingIcon + balanceEntity + "</td>";
            html += "<td style='vertical-align:middle;" + color + "' class='numeric'>" + sign + change + "</td>";
            html += "<td style='vertical-align:middle;' class='numeric'>" + balance + "</td>";
        }
		return html;
	};

	KRS.buildTransactionsTypeNavi = function() {
		var html = '';
		html += '<li role="presentation" class="active"><a href="#" data-transaction-type="" ';
		html += 'data-toggle="popover" data-placement="top" data-content="All" data-container="body" data-i18n="[data-content]all">';
		html += '<span data-i18n="all">All</span></a></li>';
        var typeNavi = $('#transactions_type_navi');
        typeNavi.append(html);

		$.each(KRS.transactionTypes, function(typeIndex, typeDict) {
			var titleString = $.t(typeDict.i18nKeyTitle);
			html = '<li role="presentation"><a href="#" data-transaction-type="' + typeIndex + '" ';
			html += 'data-toggle="popover" data-placement="top" data-content="' + titleString + '" data-container="body">';
			html += typeDict.iconHTML + '</a></li>';
			$('#transactions_type_navi').append(html);
		});

		html  = '<li role="presentation"><a href="#" data-transaction-type="unconfirmed" ';
		html += 'data-toggle="popover" data-placement="top" data-content="Unconfirmed (Account)" data-container="body" data-i18n="[data-content]unconfirmed_account">';
		html += '<i class="fa fa-circle-o"></i>&nbsp; <span data-i18n="unconfirmed">Unconfirmed</span></a></li>';
		typeNavi.append(html);

		html  = '<li role="presentation"><a href="#" data-transaction-type="phasing" ';
		html += 'data-toggle="popover" data-placement="top" data-content="Phasing (Pending)" data-container="body" data-i18n="[data-content]phasing_pending">';
		html += '<i class="fa fa-gavel"></i>&nbsp; <span data-i18n="phasing">Phasing</span></a></li>';
		typeNavi.append(html);

		html  = '<li role="presentation"><a href="#" data-transaction-type="all_unconfirmed" ';
		html += 'data-toggle="popover" data-placement="top" data-content="Unconfirmed (Everyone)" data-container="body" data-i18n="[data-content]unconfirmed_everyone">';
		html += '<i class="fa fa-circle-o"></i>&nbsp; <span data-i18n="all_unconfirmed">Unconfirmed (Everyone)</span></a></li>';
		typeNavi.append(html);

        typeNavi.find('a[data-toggle="popover"]').popover({
			"trigger": "hover"
		});
        typeNavi.find("[data-i18n]").i18n();
	};

	KRS.buildTransactionsSubTypeNavi = function() {
        var subtypeNavi = $('#transactions_sub_type_navi');
        subtypeNavi.empty();
		var html  = '<li role="presentation" class="active"><a href="#" data-transaction-sub-type="">';
		html += '<span>' + $.t("all_types") + '</span></a></li>';
		subtypeNavi.append(html);

		var typeIndex = $('#transactions_type_navi').find('li.active a').attr('data-transaction-type');
		if (typeIndex && typeIndex != "unconfirmed" && typeIndex != "all_unconfirmed" && typeIndex != "phasing") {
			var typeDict = KRS.transactionTypes[typeIndex];
			$.each(typeDict["subTypes"], function(subTypeIndex, subTypeDict) {
				var subTitleString = $.t(subTypeDict.i18nKeyTitle);
				html = '<li role="presentation"><a href="#" data-transaction-sub-type="' + subTypeIndex + '">';
				html += subTypeDict.iconHTML + ' ' + subTitleString + '</a></li>';
				$('#transactions_sub_type_navi').append(html);
			});
		}
	};

    KRS.displayUnconfirmedTransactions = function(account) {
        var params = {
            "firstIndex": KRS.pageNumber * KRS.itemsPerPage - KRS.itemsPerPage,
            "lastIndex": KRS.pageNumber * KRS.itemsPerPage
        };
        if (account != "") {
            params["account"] = account;
        }
        KRS.sendRequest("getUnconfirmedTransactions", params, function(response) {
			var rows = "";
			if (response.unconfirmedTransactions && response.unconfirmedTransactions.length) {
				var decimals = KRS.getTransactionsAmountDecimals(response.unconfirmedTransactions);
				for (var i = 0; i < response.unconfirmedTransactions.length; i++) {
                    rows += KRS.getTransactionRowHTML(response.unconfirmedTransactions[i], false, decimals);
				}
			}
			KRS.dataLoaded(rows);
		});
	};

	KRS.displayPhasedTransactions = function() {
		var params = {
			"account": KRS.account,
			"firstIndex": KRS.pageNumber * KRS.itemsPerPage - KRS.itemsPerPage,
			"lastIndex": KRS.pageNumber * KRS.itemsPerPage
		};
		KRS.sendRequest("getAccountPhasedTransactions", params, function(response) {
			var rows = "";
			if (response.transactions && response.transactions.length) {
				var decimals = KRS.getTransactionsAmountDecimals(response.transactions);
				for (var i = 0; i < response.transactions.length; i++) {
					var t = response.transactions[i];
					t.confirmed = true;
					rows += KRS.getTransactionRowHTML(t, false, decimals);
				}
				KRS.dataLoaded(rows);
				KRS.addPhasingInfoToTransactionRows(response.transactions);
			} else {
				KRS.dataLoaded(rows);
			}
		});
	};

    KRS.pages.dashboard = function() {
        var rows = "";
        var params = {
            "account": KRS.account,
            "firstIndex": 0,
            "lastIndex": 9
        };
        var unconfirmedTransactions = KRS.unconfirmedTransactions;
		var decimals = KRS.getTransactionsAmountDecimals(unconfirmedTransactions);
        if (unconfirmedTransactions) {
            for (var i = 0; i < unconfirmedTransactions.length; i++) {
                rows += KRS.getTransactionRowHTML(unconfirmedTransactions[i], false, decimals);
            }
        }

        KRS.sendRequest("getBlockchainTransactions+", params, function(response) {
            if (response.transactions && response.transactions.length) {
				var decimals = KRS.getTransactionsAmountDecimals(response.transactions);
                for (var i = 0; i < response.transactions.length; i++) {
                    var transaction = response.transactions[i];
                    transaction.confirmed = true;
                    rows += KRS.getTransactionRowHTML(transaction, false, decimals);
                }

                KRS.dataLoaded(rows);
                KRS.addPhasingInfoToTransactionRows(response.transactions);
            } else {
                KRS.dataLoaded(rows);
            }
        });
    };

	KRS.incoming.dashboard = function() {
		KRS.loadPage("dashboard");
	};

	var isHoldingEntry = function (entry){
		return /ASSET_BALANCE/i.test(entry.holdingType) || /CURRENCY_BALANCE/i.test(entry.holdingType);
	};

    KRS.getLedgerNumberOfDecimals = function (entries){
		var decimalParams = {};
		decimalParams.changeDecimals = KRS.getNumberOfDecimals(entries, "change", function(entry) {
			if (isHoldingEntry(entry)) {
				return "";
			}
			return KRS.formatAmount(entry.change);
		});
		decimalParams.holdingChangeDecimals = KRS.getNumberOfDecimals(entries, "change", function(entry) {
			if (isHoldingEntry(entry)) {
				return KRS.formatQuantity(entry.change, entry.holdingInfo.decimals);
			}
			return "";
		});
		decimalParams.balanceDecimals = KRS.getNumberOfDecimals(entries, "balance", function(entry) {
			if (isHoldingEntry(entry)) {
				return "";
			}
			return KRS.formatAmount(entry.balance);
		});
		decimalParams.holdingBalanceDecimals = KRS.getNumberOfDecimals(entries, "balance", function(entry) {
			if (isHoldingEntry(entry)) {
				return KRS.formatQuantity(entry.balance, entry.holdingInfo.decimals);
			}
			return "";
		});
		return decimalParams;
	};

    KRS.pages.ledger = function() {
		var rows = "";
        var params = {
            "account": KRS.account,
            "includeHoldingInfo": true,
            "firstIndex": KRS.pageNumber * KRS.itemsPerPage - KRS.itemsPerPage,
            "lastIndex": KRS.pageNumber * KRS.itemsPerPage
        };

        KRS.sendRequest("getAccountLedger+", params, function(response) {
            if (response.entries && response.entries.length) {
                if (response.entries.length > KRS.itemsPerPage) {
                    KRS.hasMorePages = true;
                    response.entries.pop();
                }
				var decimalParams = KRS.getLedgerNumberOfDecimals(response.entries);
                for (var i = 0; i < response.entries.length; i++) {
                    var entry = response.entries[i];
                    rows += KRS.getLedgerEntryRow(entry, decimalParams);
                }
            }
            KRS.dataLoaded(rows);
			if (KRS.ledgerTrimKeep > 0) {
				var ledgerMessage = $("#account_ledger_message");
                ledgerMessage.text($.t("account_ledger_message", { blocks: KRS.ledgerTrimKeep }));
				ledgerMessage.show();
			}
        });
	};

	KRS.pages.transactions = function(callback, subpage) {
        var typeNavi = $('#transactions_type_navi');
        if (typeNavi.children().length == 0) {
			KRS.buildTransactionsTypeNavi();
			KRS.buildTransactionsSubTypeNavi();
		}

		if (subpage) {
			typeNavi.find('li a[data-transaction-type="' + subpage + '"]').click();
			return;
		}

		var selectedType = typeNavi.find('li.active a').attr('data-transaction-type');
		var selectedSubType = $('#transactions_sub_type_navi').find('li.active a').attr('data-transaction-sub-type');
		if (!selectedSubType) {
			selectedSubType = "";
		}
		if (selectedType == "unconfirmed") {
			KRS.displayUnconfirmedTransactions(KRS.account);
			return;
		}
		if (selectedType == "phasing") {
			KRS.displayPhasedTransactions();
			return;
		}
		if (selectedType == "all_unconfirmed") {
			KRS.displayUnconfirmedTransactions("");
			return;
		}

		var rows = "";
		var params = {
			"account": KRS.account,
			"firstIndex": KRS.pageNumber * KRS.itemsPerPage - KRS.itemsPerPage,
			"lastIndex": KRS.pageNumber * KRS.itemsPerPage
		};
        var unconfirmedTransactions;
		if (selectedType) {
			params.type = selectedType;
			params.subtype = selectedSubType;
			unconfirmedTransactions = KRS.getUnconfirmedTransactionsFromCache(params.type, (params.subtype ? params.subtype : []));
		} else {
			unconfirmedTransactions = KRS.unconfirmedTransactions;
		}
		var decimals = KRS.getTransactionsAmountDecimals(unconfirmedTransactions);
		if (unconfirmedTransactions) {
			for (var i = 0; i < unconfirmedTransactions.length; i++) {
				rows += KRS.getTransactionRowHTML(unconfirmedTransactions[i], false, decimals);
			}
		}

		KRS.sendRequest("getBlockchainTransactions+", params, function(response) {
			if (response.transactions && response.transactions.length) {
				if (response.transactions.length > KRS.itemsPerPage) {
					KRS.hasMorePages = true;
					response.transactions.pop();
				}
				var decimals = KRS.getTransactionsAmountDecimals(response.transactions);
				for (var i = 0; i < response.transactions.length; i++) {
					var transaction = response.transactions[i];
					transaction.confirmed = true;
					rows += KRS.getTransactionRowHTML(transaction, false, decimals);
				}

				KRS.dataLoaded(rows);
				KRS.addPhasingInfoToTransactionRows(response.transactions);
			} else {
				KRS.dataLoaded(rows);
			}
		});
	};

	KRS.updateApprovalRequests = function() {
		var params = {
			"account": KRS.account,
			"firstIndex": 0,
			"lastIndex": 20
		};
		KRS.sendRequest("getVoterPhasedTransactions", params, function(response) {
			var $badge = $('#dashboard_link').find('.sm_treeview_submenu a[data-page="approval_requests_account"] span.badge');
			if (response.transactions && response.transactions.length) {
				if (response.transactions.length == 0) {
					$badge.hide();
				} else {
                    var length;
					if (response.transactions.length == 21) {
						length = "20+";
					} else {
						length = String(response.transactions.length);
					}
					$badge.text(length);
					$badge.show();
				}
			} else {
				$badge.hide();
			}
		});
		if (KRS.currentPage == 'approval_requests_account') {
			KRS.loadPage(KRS.currentPage);
		}
	};

	KRS.pages.approval_requests_account = function() {
		var params = {
			"account": KRS.account,
			"firstIndex": KRS.pageNumber * KRS.itemsPerPage - KRS.itemsPerPage,
			"lastIndex": KRS.pageNumber * KRS.itemsPerPage
		};
		KRS.sendRequest("getVoterPhasedTransactions", params, function(response) {
			var rows = "";

			if (response.transactions && response.transactions.length) {
				if (response.transactions.length > KRS.itemsPerPage) {
					KRS.hasMorePages = true;
					response.transactions.pop();
				}
				var decimals = KRS.getTransactionsAmountDecimals(response.transactions);
				for (var i = 0; i < response.transactions.length; i++) {
					var t = response.transactions[i];
					t.confirmed = true;
					rows += KRS.getTransactionRowHTML(t, ['approve'], decimals);
				}
			}
			KRS.dataLoaded(rows);
			KRS.addPhasingInfoToTransactionRows(response.transactions);
		});
	};

    KRS.pages.scheduled_transactions = function(callback, subpage) {
        KRS.sendRequest("getScheduledTransactions+", {
        	account: KRS.accountRS,
			adminPassword: KRS.getAdminPassword()
		}, function(response) {
            var errorMessage = $("#scheduled_transactions_error_message");
            if (response.errorCode) {
        		errorMessage.text(KRS.unescapeRespStr(response.errorDescription));
        		errorMessage.show();
			} else {
                errorMessage.hide();
                errorMessage.text("");
			}
			var rows = "";
            if (response.scheduledTransactions && response.scheduledTransactions.length) {
                if (response.scheduledTransactions.length > KRS.itemsPerPage) {
                    KRS.hasMorePages = true;
                    response.scheduledTransactions.pop();
                }
                var decimals = KRS.getTransactionsAmountDecimals(response.scheduledTransactions);
                for (var i = 0; i < response.scheduledTransactions.length; i++) {
                    var transaction = response.scheduledTransactions[i];
					rows += KRS.getTransactionRowHTML(transaction, ["delete"], decimals, true);
                }
            }
            KRS.dataLoaded(rows);
        });
    };

    $("#delete_scheduled_transaction_modal").on("show.bs.modal", function(e) {
        var $invoker = $(e.relatedTarget);
        var transaction = $invoker.data("transaction");
		$("#delete_scheduled_transaction_id").val(transaction);
    });

    KRS.forms.deleteScheduledTransaction = function($modal) {
    	var data = KRS.getFormData($modal.find("form:first"));
    	data.adminPassword = KRS.getAdminPassword();
		return { data: data };
    };

    KRS.forms.deleteScheduledTransactionComplete = function() {
    	KRS.goToPage("scheduled_transactions");
	};

    KRS.incoming.transactions = function() {
		KRS.loadPage("transactions");
	};

	KRS.setup.transactions = function() {
		var sidebarId = 'dashboard_link';
		var options = {
			"id": sidebarId,
			"titleHTML": '<i class="fa fa-dashboard"></i> <span data-i18n="dashboard">Dashboard</span>',
			"page": 'dashboard',
			"desiredPosition": 10
		};
		KRS.addTreeviewSidebarMenuItem(options);
		options = {
			"titleHTML": '<span data-i18n="dashboard">Dashboard</span>',
			"type": 'PAGE',
			"page": 'dashboard'
		};
		KRS.appendMenuItemToTSMenuItem(sidebarId, options);
		options = {
			"titleHTML": '<span data-i18n="account_ledger">Account Ledger</span>',
			"type": 'PAGE',
			"page": 'ledger'
		};
		KRS.appendMenuItemToTSMenuItem(sidebarId, options);
		options = {
			"titleHTML": '<span data-i18n="account_properties">Account Properties</span>',
			"type": 'PAGE',
			"page": 'account_properties'
		};
		KRS.appendMenuItemToTSMenuItem(sidebarId, options);
		options = {
			"titleHTML": '<span data-i18n="my_transactions">My Transactions</span>',
			"type": 'PAGE',
			"page": 'transactions'
		};
		KRS.appendMenuItemToTSMenuItem(sidebarId, options);
		options = {
			"titleHTML": '<span data-i18n="approval_requests">Approval Requests</span>',
			"type": 'PAGE',
			"page": 'approval_requests_account'
		};
		KRS.appendMenuItemToTSMenuItem(sidebarId, options);
	};

	$(document).on("click", "#transactions_type_navi li a", function(e) {
		e.preventDefault();
		$('#transactions_type_navi').find('li.active').removeClass('active');
  		$(this).parent('li').addClass('active');
  		KRS.buildTransactionsSubTypeNavi();
  		KRS.pageNumber = 1;
		KRS.loadPage("transactions");
	});

	$(document).on("click", "#transactions_sub_type_navi li a", function(e) {
		e.preventDefault();
		$('#transactions_sub_type_navi').find('li.active').removeClass('active');
  		$(this).parent('li').addClass('active');
  		KRS.pageNumber = 1;
		KRS.loadPage("transactions");
	});

	$(document).on("click", "#transactions_sub_type_show_hide_btn", function(e) {
		e.preventDefault();
        var subTypeNaviBox = $('#transactions_sub_type_navi_box');
        if (subTypeNaviBox.is(':visible')) {
			subTypeNaviBox.hide();
			$(this).text($.t('show_type_menu', 'Show Type Menu'));
		} else {
			subTypeNaviBox.show();
			$(this).text($.t('hide_type_menu', 'Hide Type Menu'));
		}
	});

	return KRS;
}(KRS || {}, jQuery));

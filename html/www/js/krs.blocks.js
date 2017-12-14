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
var KRS = (function(KRS, $) {
	KRS.blocksPageType = null;
	KRS.tempBlocks = [];
	var trackBlockchain = false;
	KRS.averageBlockGenerationTime = 60;

	KRS.getBlock = function(id, callback, pageRequest) {
		KRS.sendRequest("getBlock" + (pageRequest ? "+" : ""), {
			"block": id
		}, function(response) {
			if (response.errorCode && response.errorCode == -1) {
				KRS.logConsole("getBlock request failed, setTimeout for retry");
				setTimeout(function() {
					KRS.getBlock(id, callback, pageRequest);
				}, 2500);
			} else {
				callback(response);
			}
		}, { noProxy: true });
	};

	KRS.handleInitialBlocks = function(response) {
		KRS.blocks.push(response);
		if (KRS.blocks.length < 10 && response.previousBlock) {
			KRS.getBlock(response.previousBlock, KRS.handleInitialBlocks);
		} else {
			KRS.checkBlockHeight(KRS.blocks[0].height);
			if (KRS.state) {
				//if no new blocks in 6 hours, show blockchain download progress..
				var timeDiff = KRS.state.time - KRS.blocks[0].timestamp;
				if (timeDiff > 60 * 60 * 18) {
					if (timeDiff > 60 * 60 * 24 * 14) {
						KRS.setStateInterval(30);
					} else if (timeDiff > 60 * 60 * 24 * 7) {
						//second to last week
						KRS.setStateInterval(15);
					} else {
						//last week
						KRS.setStateInterval(10);
					}
					KRS.downloadingBlockchain = true;
					$("#krs_update_explanation").find("span").hide();
					$("#krs_update_explanation_wait").attr("style", "display: none !important");
					$("#downloading_blockchain, #krs_update_explanation_blockchain_sync").show();
					$("#show_console").hide();
					KRS.updateBlockchainDownloadProgress();
				} else {
					//continue with faster state intervals if we still haven't reached current block from within 1 hour
					if (timeDiff < 60 * 60) {
						KRS.setStateInterval(30);
						trackBlockchain = false;
					} else {
						KRS.setStateInterval(10);
						trackBlockchain = true;
					}
				}
			}
			if (!KRS.state.apiProxy) {
				KRS.updateDashboardLastBlock(KRS.blocks[0]);
			}

		}
	};

	KRS.handleNewBlocks = function(response) {
		if (KRS.downloadingBlockchain) {
			//new round started...
			if (KRS.tempBlocks.length == 0 && KRS.getLastBlock() != response.block) {
				return;
			}
		}

		//we have all blocks
		if (response.height - 1 == KRS.lastBlockHeight || KRS.tempBlocks.length == 99) {
			var newBlocks = [];

			//there was only 1 new block (response)
			if (KRS.tempBlocks.length == 0) {
				//remove oldest block, add newest block
				KRS.blocks.unshift(response);
				newBlocks.push(response);
			} else {
				KRS.tempBlocks.push(response);
				//remove oldest blocks, add newest blocks
				[].unshift.apply(KRS.blocks, KRS.tempBlocks);
				newBlocks = KRS.tempBlocks;
				KRS.tempBlocks = [];
			}

			if (KRS.blocks.length > 100) {
				KRS.blocks = KRS.blocks.slice(0, 100);
			}
			KRS.checkBlockHeight(KRS.blocks[0].height);
			KRS.incoming.updateDashboardBlocks(newBlocks.length);
			if (!KRS.state.apiProxy) {
				KRS.updateDashboardLastBlock(KRS.blocks[0]);
			}
		} else {
			KRS.tempBlocks.push(response);
			KRS.getBlock(response.previousBlock, KRS.handleNewBlocks);
		}
	};

	KRS.checkBlockHeight = function(blockHeight) {
		if (blockHeight) {
			if (KRS.state && KRS.state.apiProxy) {
				KRS.lastLocalBlockHeight = blockHeight;
			} else {
				KRS.lastBlockHeight = blockHeight;
			}
		}
	};

	KRS.updateDashboardLastBlock = function(block) {
		$("#krs_current_block_time").empty().append(KRS.formatTimestamp(block.timestamp));
		$(".krs_current_block").empty().append(KRS.escapeRespStr(block.height));
	};

	//we always update the dashboard page..
	KRS.incoming.updateDashboardBlocks = function(newBlocksCount) {
        var timeDiff;
		if (KRS.downloadingBlockchain) {
			if (KRS.state) {
				timeDiff = KRS.state.time - KRS.blocks[0].timestamp;
				if (timeDiff < 60 * 60 * 18) {
					if (timeDiff < 60 * 60) {
						KRS.setStateInterval(30);
					} else {
						KRS.setStateInterval(10);
						trackBlockchain = true;
					}
					KRS.downloadingBlockchain = false;
					$("#dashboard_message").hide();
					$("#downloading_blockchain, #krs_update_explanation_blockchain_sync").hide();
					$("#krs_update_explanation_wait").removeAttr("style");
					if (KRS.settings["console_log"]) {
						$("#show_console").show();
					}
					//todo: update the dashboard blocks!
					$.growl($.t("success_blockchain_up_to_date"), {
						"type": "success"
					});
					KRS.checkAliasVersions();
					KRS.checkIfOnAFork();
				} else {
					if (timeDiff > 60 * 60 * 24 * 14) {
						KRS.setStateInterval(30);
					} else if (timeDiff > 60 * 60 * 24 * 7) {
						//second to last week
						KRS.setStateInterval(15);
					} else {
						//last week
						KRS.setStateInterval(10);
					}

					KRS.updateBlockchainDownloadProgress();
				}
			}
		} else if (trackBlockchain) {
			//continue with faster state intervals if we still haven't reached current block from within 1 hour
            timeDiff = KRS.state.time - KRS.blocks[0].timestamp;
			if (timeDiff < 60 * 60) {
				KRS.setStateInterval(30);
				trackBlockchain = false;
			} else {
				KRS.setStateInterval(10);
			}
		}

		//update number of confirmations... perhaps we should also update it in tne KRS.transactions array
		$("#dashboard_table").find("tr.confirmed td.confirmations").each(function() {
			if ($(this).data("incoming")) {
				$(this).removeData("incoming");
				return true;
			}
			var confirmations = parseInt($(this).data("confirmations"), 10);
			var nrConfirmations = confirmations + newBlocksCount;
			if (confirmations <= 10) {
				$(this).data("confirmations", nrConfirmations);
				$(this).attr("data-content", $.t("x_confirmations", {
					"x": KRS.formatAmount(nrConfirmations, false, true)
				}));

				if (nrConfirmations > 10) {
					nrConfirmations = '10+';
				}
				$(this).html(nrConfirmations);
			} else {
				$(this).attr("data-content", $.t("x_confirmations", {
					"x": KRS.formatAmount(nrConfirmations, false, true)
				}));
			}
		});
		var blockLink = $("#sidebar_block_link");
		if (blockLink.length > 0) {
			blockLink.html(KRS.getBlockLink(KRS.lastBlockHeight));
		}
	};

	KRS.pages.blocks = function() {
		if (KRS.blocksPageType == "forged_blocks") {
			$("#forged_fees_total_box, #forged_blocks_total_box").show();
			$("#blocks_transactions_per_hour_box, #blocks_generation_time_box").hide();

			KRS.sendRequest("getAccountBlocks+", {
				"account": KRS.account,
				"firstIndex": KRS.pageNumber * KRS.itemsPerPage - KRS.itemsPerPage,
				"lastIndex": KRS.pageNumber * KRS.itemsPerPage
			}, function(response) {
				if (response.blocks && response.blocks.length) {
					if (response.blocks.length > KRS.itemsPerPage) {
						KRS.hasMorePages = true;
						response.blocks.pop();
					}
					KRS.blocksPageLoaded(response.blocks);
				} else {
					KRS.blocksPageLoaded([]);
				}
			});
		} else {
			$("#forged_fees_total_box, #forged_blocks_total_box").hide();
			$("#blocks_transactions_per_hour_box, #blocks_generation_time_box").show();

			KRS.sendRequest("getBlocks+", {
				"firstIndex": KRS.pageNumber * KRS.itemsPerPage - KRS.itemsPerPage,
				"lastIndex": KRS.pageNumber * KRS.itemsPerPage
			}, function(response) {
				if (response.blocks && response.blocks.length) {
					if (response.blocks.length > KRS.itemsPerPage) {
						KRS.hasMorePages = true;
						response.blocks.pop();
					}
					KRS.blocksPageLoaded(response.blocks);
				} else {
					KRS.blocksPageLoaded([]);
				}
			});
		}
	};

	KRS.incoming.blocks = function() {
		KRS.loadPage("blocks");
	};

	KRS.blocksPageLoaded = function(blocks) {
		var rows = "";
		var totalAmount = new BigInteger("0");
		var totalFees = new BigInteger("0");
		var totalTransactions = 0;

		for (var i = 0; i < blocks.length; i++) {
			var block = blocks[i];
			totalAmount = totalAmount.add(new BigInteger(block.totalAmountNQT));
			totalFees = totalFees.add(new BigInteger(block.totalFeeNQT));
			totalTransactions += block.numberOfTransactions;
			rows += "<tr>" +
                "<td><a href='#' data-block='" + KRS.escapeRespStr(block.height) + "' data-blockid='" + KRS.escapeRespStr(block.block) + "' class='block show_block_modal_action'" + (block.numberOfTransactions > 0 ? " style='font-weight:bold'" : "") + ">" + KRS.escapeRespStr(block.height) + "</a></td>" +
                "<td>" + KRS.formatTimestamp(block.timestamp) + "</td>" +
                "<td>" + KRS.formatAmount(block.totalAmountNQT) + "</td>" +
                "<td>" + KRS.formatAmount(block.totalFeeNQT) + "</td>" +
                "<td>" + KRS.formatAmount(block.numberOfTransactions) + "</td>" +
                "<td>" + KRS.getAccountLink(block, "generator") + "</td>" +
                "<td>" + KRS.formatVolume(block.payloadLength) + "</td>" +
				"<td>" + KRS.baseTargetPercent(block).pad(4) + " %</td>" +
            "</tr>";
		}

        var blocksAverageAmount = $("#blocks_average_amount");
        if (KRS.blocksPageType == "forged_blocks") {
			KRS.sendRequest("getAccountBlockCount+", {
				"account": KRS.account
			}, function(response) {
				if (response.numberOfBlocks && response.numberOfBlocks > 0) {
					$("#forged_blocks_total").html(response.numberOfBlocks).removeClass("loading_dots");
                    var avgFee = new Big(KRS.accountInfo.forgedBalanceNQT).div(response.numberOfBlocks).div(new Big("100000000")).toFixed(2);
                    $("#blocks_average_fee").html(KRS.formatStyledAmount(KRS.convertToNQT(avgFee))).removeClass("loading_dots");
				} else {
					$("#forged_blocks_total").html(0).removeClass("loading_dots");
					$("#blocks_average_fee").html(0).removeClass("loading_dots");
				}
			});
			$("#forged_fees_total").html(KRS.formatStyledAmount(KRS.accountInfo.forgedBalanceNQT)).removeClass("loading_dots");
			blocksAverageAmount.removeClass("loading_dots");
			blocksAverageAmount.parent().parent().css('visibility', 'hidden');
			$("#blocks_page").find(".ion-stats-bars").parent().css('visibility', 'hidden');
		} else {
			var time;
            if (blocks.length) {
				var startingTime = blocks[blocks.length - 1].timestamp;
				var endingTime = blocks[0].timestamp;
				time = endingTime - startingTime;
			} else {
				time = 0;
			}
            var averageFee = 0;
            var averageAmount = 0;
			if (blocks.length) {
				averageFee = new Big(totalFees.toString()).div(new Big("100000000")).div(new Big(String(blocks.length))).toFixed(2);
				averageAmount = new Big(totalAmount.toString()).div(new Big("100000000")).div(new Big(String(blocks.length))).toFixed(2);
			}
			averageFee = KRS.convertToNQT(averageFee);
			averageAmount = KRS.convertToNQT(averageAmount);
			if (time == 0) {
				$("#blocks_transactions_per_hour").html("0").removeClass("loading_dots");
			} else {
				$("#blocks_transactions_per_hour").html(Math.round(totalTransactions / (time / 60) * 60)).removeClass("loading_dots");
			}
			$("#blocks_average_generation_time").html(Math.round(time / KRS.itemsPerPage) + "s").removeClass("loading_dots");
			$("#blocks_average_fee").html(KRS.formatStyledAmount(averageFee)).removeClass("loading_dots");
			blocksAverageAmount.parent().parent().css('visibility', 'visible');
			$("#blocks_page").find(".ion-stats-bars").parent().css('visibility', 'visible');
			blocksAverageAmount.html(KRS.formatStyledAmount(averageAmount)).removeClass("loading_dots");
		}
		KRS.dataLoaded(rows);
	};

	KRS.blockchainDownloadingMessage = function() {
		if (KRS.state.apiProxy) {
			return $.t(KRS.state.isLightClient ? "status_light_client_proxy" : "status_blockchain_downloading_proxy",
					{ peer: KRS.getPeerLink(KRS.state.apiProxyPeer) }) +
				" <a href='#' class='btn btn-xs' data-toggle='modal' data-target='#client_status_modal'>" + $.t("proxy_info_link") + "</a>";
		} else if(KRS.state.isLightClient) {
			$.t("status_light_client_proxy");
		} else {
			return $.t("status_blockchain_downloading");
		}
	};

	$("#blocks_page_type").find(".btn").click(function(e) {
		e.preventDefault();
		KRS.blocksPageType = $(this).data("type");
		$("#blocks_average_amount, #blocks_average_fee, #blocks_transactions_per_hour, #blocks_average_generation_time, #forged_blocks_total, #forged_fees_total").html("<span>.</span><span>.</span><span>.</span></span>").addClass("loading_dots");
        var blocksTable = $("#blocks_table");
        blocksTable.find("tbody").empty();
		blocksTable.parent().addClass("data-loading").removeClass("data-empty");
		KRS.loadPage("blocks");
	});

	return KRS;
}(KRS || {}, jQuery));
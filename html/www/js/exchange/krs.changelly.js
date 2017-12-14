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
    var EXCHANGE_NAME = "changelly";
    var DEPOSIT_ADDRESSES_KEY = "changelly.depositAddresses.";
    var SUPPORTED_COINS = {};

    var apiCall = function (method, params, doneCallback, ignoreError, modal) {
        var postData = {};
        postData.method = method;
        postData.jsonrpc = "2.0";
        postData.params = params;
        postData.id = "1";
        var hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA512, KRS.settings.changelly_api_secret);
        hmac.update(JSON.stringify(postData));
        var signature = hmac.finalize();
        KRS.logConsole("changelly api call method: " + method + " post data: " + JSON.stringify(postData) + " api-key: " + KRS.settings.changelly_api_key + " signature:" + signature +
            (ignoreError ? " ignore " + ignoreError : "") + (modal ? " modal " + modal : ""));
        $.ajax({
            url: KRS.getChangellyUrl(),
            beforeSend: function(xhr) {
                xhr.setRequestHeader("api-key", KRS.settings.changelly_api_key);
                xhr.setRequestHeader("sign", signature);
                xhr.setRequestHeader("Content-Type", "application/json; charset=utf-8");
            },
            crossDomain: true,
            dataType: "json",
            type: "POST",
            timeout: 30000,
            async: true,
            data: JSON.stringify(postData)
        }).done(function(response, status) {
            if (status !== "success") {
                KRS.logConsole(method + ' status ' + status);
                if (modal) {
                    KRS.showModalError(status, modal);
                }
            }
            if (response.error) {
                var error = response.error;
                var msg;
                if (error.code) {
                    msg = ' code ' + error.code + ' message ' + error.message;
                    KRS.logConsole(method + msg + " params:" + JSON.stringify(params));
                } else {
                    msg = error;
                    KRS.logConsole(method + ' error ' + error);
                }
                if (ignoreError === false) {
                    return;
                }
                if (modal) {
                    KRS.showModalError(msg, modal);
                }
            }
            doneCallback(response);
        }).fail(function (xhr, textStatus, error) {
            var message = "Request failed, method " + method + " status " + textStatus + " error " + error;
            KRS.logConsole(message);
            throw message;
        })
    };

    var renderExchangeTable = function (op) {
        var coins = KRS.getCoins(EXCHANGE_NAME);
        var tasks = [];
        for (var i = 0; i < coins.length; i++) {
            tasks.push((function (i) {
                return function (callback) {
                    var from, to;
                    if (op == "buy") {
                        from = "KPL";
                        to = coins[i];
                    } else {
                        from = coins[i];
                        to = "KPL";
                    }
                    async.waterfall([
                        function(callback) {
                            apiCall("getMinAmount", { from: from, to: to }, function (response) {
                                callback(response.error, response);
                            })
                        },
                        function(minAmount, callback) {
                            apiCall("getExchangeAmount", { from: from, to: to, amount: "1" }, function (response) {
                                response.minAmount = minAmount.result;
                                response.rate = response.result;
                                delete response.result;
                                callback(null, response);
                            })
                        }
                    ], function(err, response){
                        if (err) {
                            callback(err, err);
                            return;
                        }
                        var rate;
                        var symbol;
                        if (op === "sell") {
                            rate = KRS.invert(response.rate);
                            symbol = coins[i];
                        } else {
                            rate = response.rate;
                            symbol = "KPL";
                        }
                        var row = "<tr><td>" + coins[i] + "</td>";
                        row += "<td><span>" + String(response.minAmount).escapeHTML() + "</span>&nbsp<span>" + symbol + "</span></td>";
                        row += "<td>" + String(rate).escapeHTML() + "</td>";
                        row += "<td><a href='#' class='btn btn-xs btn-default' data-toggle='modal' data-target='#changelly_" + op + "_modal' " +
                            "data-from='" + from + "' data-to='" + to + "' data-rate='" + response.rate + "' data-min='" + response.minAmount + "'>" + $.t(op) + "</a>";
                        KRS.logConsole(row);
                        callback(null, row);
                    });
                }
            })(i));
        }
        KRS.logConsole(tasks.length + " tasks ready to run");
        async.series(tasks, function (err, results) {
            var table = $("#p_changelly_" + op + "_kpl");
            if (err) {
                KRS.logConsole("Err: ", err, "\nResults:", results);
                table.find("tbody").empty();
                KRS.dataLoadFinished(table);
                return;
            }
            KRS.logConsole("results", results);
            var rows = "";
            for (i = 0; i < results.length; i++) {
                rows += results[i];
            }
            KRS.logConsole("rows " + rows);
            table.find("tbody").empty().append(rows);
            KRS.dataLoadFinished(table);
        });
    };

    var renderMyExchangesTable = function () {
        var depositAddressesJSON = localStorage[DEPOSIT_ADDRESSES_KEY + KRS.accountRS];
        var depositAddresses = [];
        if (depositAddressesJSON) {
            depositAddresses = JSON.parse(depositAddressesJSON);
        }
        var tasks = [];
        for (var i = 0; i < depositAddresses.length; i++) {
            tasks.push((function (i) {
                return function (callback) {
                    apiCall("getTransactions", {address: depositAddresses[i].address}, function(response) {
                        KRS.logConsole("my exchanges iteration " + i + " address " + depositAddresses[i].address);
                        var rows = "";
                        for (var j=0; j < response.result.length; j++) {
                            var transaction = response.result[j];
                            var row = "";
                            row += "<tr>";
                            var date = parseInt(transaction.createdAt) * 1000;
                            row += "<td>" + KRS.formatTimestamp(date, false, true) + "</td>";
                            row += "<td>" + transaction.status + "</td>";
                            row += "<td>" + KRS.getExchangeAddressLink(transaction.payinAddress, transaction.currencyFrom) + "</td>";
                            row += "<td>" + transaction.amountFrom + "</td>";
                            row += "<td>" + transaction.currencyFrom + "</td>";
                            row += "<td>" + KRS.getExchangeAddressLink(transaction.payoutAddress, transaction.currencyTo) + "</td>";
                            row += "<td>" + transaction.amountTo + "</td>";
                            row += "<td>" + transaction.currencyTo + "</td>";
                            var transactionLink;
                            if (transaction.payoutHash) {
                                transactionLink = KRS.getExchangeTransactionLink(transaction.payoutHash, transaction.currencyTo);
                            } else {
                                transactionLink = "N/A";
                            }
                            row += "<td>" + transactionLink + "</td>";
                            row += "<td><a class='btn btn-xs btn-default' href='#' data-toggle='modal' data-target='#changelly_view_transaction' " +
                                "data-id='" + transaction.id + "' data-content='" + JSON.stringify(transaction) + "'>" + $.t("view") + "</a></td>";
                            KRS.logConsole(row);
                            rows += row;
                        }
                        callback(null, rows);
                    }, true);
                }
            })(i));
        }
        KRS.logConsole(tasks.length + " tasks ready to run");
        var table = $("#p_changelly_my_table");
        if (tasks.length === 0) {
            table.find("tbody").empty();
            KRS.dataLoadFinished(table);
            return;
        }
        async.series(tasks, function (err, results) {
            if (err) {
                KRS.logConsole("Err: ", err, "\nResults:", results);
                table.find("tbody").empty();
                KRS.dataLoadFinished(table);
                return;
            }
            KRS.logConsole("results", results);
            var rows = "";
            for (i = 0; i < results.length; i++) {
                rows += results[i];
            }
            KRS.logConsole("rows " + rows);
            table.find("tbody").empty().append(rows);
            KRS.dataLoadFinished(table);
        });
    };

    function loadCoins() {
        var coin0 = EXCHANGE_NAME + "_coin0";
        var coin1 = EXCHANGE_NAME + "_coin1";
        var coin2 = EXCHANGE_NAME + "_coin2";
        var inputFields = [];
        inputFields.push($('#' + coin0));
        inputFields.push($('#' + coin1));
        inputFields.push($('#' + coin2));
        var selectedCoins = [];
        selectedCoins.push(KRS.settings[coin0]);
        selectedCoins.push(KRS.settings[coin1]);
        selectedCoins.push(KRS.settings[coin2]);
        KRS.changellySelectCoins(inputFields, selectedCoins);
    }

    KRS.changellySelectCoins = function(inputFields, selectedCoins) {
        apiCall('getCurrencies', {}, function (data) {
            SUPPORTED_COINS = data.result;
            for (var i = 0; i < inputFields.length; i++) {
                inputFields[i].empty();
                var isSelectionAvailable = false;
                for (var j = 0; j < data.result.length; j++) {
                    var code = String(data.result[j]).toUpperCase();
                    if (code !== 'KPL') {
                        inputFields[i].append('<option value="' + code + '">' + code + '</option>');
                        SUPPORTED_COINS[code] = code;
                    }
                    if (selectedCoins[i] === code) {
                        isSelectionAvailable = true;
                    }
                }
                if (isSelectionAvailable) {
                    inputFields[i].val(selectedCoins[i]);
                }
            }
            $('#changelly_status').html('ok');
        });
    };

    KRS.pages.exchange_changelly = function() {
        var exchangeDisabled = $(".exchange_disabled");
        var exchangePageHeader = $(".exchange_page_header");
        var exchangePageContent = $(".exchange_page_content");
        if (KRS.settings.exchange !== "1") {
			exchangeDisabled.show();
            exchangePageHeader.hide();
            exchangePageContent.hide();
            return;
		}
        exchangeDisabled.hide();
        exchangePageHeader.show();
        exchangePageContent.show();
        KRS.pageLoading();
        loadCoins();
        renderExchangeTable("buy");
        renderExchangeTable("sell");
        renderMyExchangesTable();
        KRS.pageLoaded();
        setTimeout(refreshPage, 60000);
    };

    var refreshPage = function() {
        if (KRS.currentPage === "exchange_changelly") {
            KRS.pages.exchange_changelly();
        }
    };

    $("#changelly_accept_exchange_link").on("click", function(e) {
   		e.preventDefault();
   		KRS.updateSettings("exchange", "1");
        KRS.pages.exchange_changelly();
   	});

    $("#changelly_clear_my_exchanges").on("click", function(e) {
   		e.preventDefault();
   		localStorage.removeItem(DEPOSIT_ADDRESSES_KEY + KRS.accountRS);
        renderMyExchangesTable();
   	});

    $('.coin-select.changelly').change(function() {
        var id = $(this).attr('id');
        var coins = KRS.getCoins(EXCHANGE_NAME);
        coins[parseInt(id.slice(-1))] = $(this).val();
        KRS.setCoins(EXCHANGE_NAME, coins);
        renderExchangeTable('buy');
        renderExchangeTable('sell');
    });

	KRS.setup.exchange = function() {
        // Do not implement connection to a 3rd party site here to prevent privacy leak
    };

    $("#changelly_buy_modal").on("show.bs.modal", function (e) {
        var invoker = $(e.relatedTarget);
        var pair = invoker.data("pair");
        var from = invoker.data("from");
        var to = invoker.data("to");
        var min = invoker.data("min");
        $("#changelly_buy_from").val(from);
        $("#changelly_buy_to").val(to);
        KRS.logConsole("modal invoked from " + from + " to " + to);
        $("#changelly_buy_title").html($.t("exchange_kpl_to_coin", { coin: to }));
        $("#changelly_buy_min").val(invoker.data("min"));
        $("#changelly_buy_min_coin").html("KPL");
        $("#changelly_buy_rate").val(invoker.data("rate"));
        $("#changelly_buy_rate_text").html("KPL/" + to);
        $('#changelly_buy_estimated_amount').val("");
        $("#changelly_buy_estimated_amount_text").html(to);
        $("#changelly_withdrawal_address_coin").html(to);
    });

    $("#changelly_buy_submit").on("click", function(e) {
        e.preventDefault();
        var $modal = $(this).closest(".modal");
        var $btn = KRS.lockForm($modal);
        var amountKPL = $("#changelly_buy_amount").val();
        var minAmount = $("#changelly_buy_min").val();
        if (parseFloat(amountKPL) <= parseFloat(minAmount)) {
            var msg = "amount is lower tham minimum amount " + minAmount;
            KRS.logConsole(msg);
            KRS.showModalError(msg, $modal);
            return;
        }
        var amountNQT = KRS.convertToNQT(amountKPL);
        var withdrawal = $("#changelly_buy_withdrawal_address").val();
        var from = $("#changelly_buy_from").val();
        var to = $("#changelly_buy_to").val();
        KRS.logConsole('changelly withdrawal to address ' + withdrawal + " coin " + to);
        apiCall('generateAddress', {
            from: from,
            to: to,
            address: withdrawal
        }, function (data) {
            var msg;
            if (data.error) {
                KRS.logConsole("Changelly generateAddress error " + data.error.code + " " + data.error.message);
                return;
            }
            var depositAddress = data.result.address;
            if (!depositAddress) {
                msg = "changelly did not return a deposit address for id " + data.id;
                KRS.logConsole(msg);
                KRS.showModalError(msg, $modal);
                return;
            }

            KRS.logConsole("KPL deposit address " + depositAddress);
            KRS.sendRequest("sendMoney", {
                "recipient": depositAddress,
                "amountNQT": amountNQT,
                "secretPhrase": $("#changelly_buy_password").val(),
                "deadline": "1440",
                "feeNQT": KRS.convertToNQT(1)
            }, function (response) {
                if (response.errorCode) {
                    KRS.logConsole("sendMoney response " + response.errorCode + " " + response.errorDescription.escapeHTML());
                    KRS.showModalError(KRS.translateServerError(response), $modal);
                    return;
                }
                KRS.addDepositAddress(depositAddress, from, to, DEPOSIT_ADDRESSES_KEY + KRS.accountRS);
                renderMyExchangesTable();
                $("#changelly_buy_passpharse").val("");
                KRS.unlockForm($modal, $btn, true);
            })
        }, true, $modal);
    });

    $('#changelly_buy_amount').change(function () {
        var $modal = $(this).closest(".modal");
        var amount = $('#changelly_buy_amount').val();
        var from = $('#changelly_buy_from').val();
        var to = $('#changelly_buy_to').val();
        var $estimatedAmount = $('#changelly_buy_estimated_amount');
        if (!amount) {
            $estimatedAmount.val("");
            return;
        }
        $modal.css('cursor', 'wait');
        apiCall('getExchangeAmount', {
            amount: amount,
            from: from,
            to: to
        }, function (response) {
            if (response.error) {
                $estimatedAmount.val("");
                $modal.css('cursor', 'default');
                return;
            }
            $estimatedAmount.val(response.result);
            $modal.css('cursor', 'default');
        })
    });

    $("#changelly_sell_modal").on("show.bs.modal", function (e) {
        var invoker = $(e.relatedTarget);
        var modal = $(this).closest(".modal");
        var from = invoker.data("from");
        var to = invoker.data("to");
        var rate = invoker.data("rate");
        var min = invoker.data("min");
        KRS.logConsole("sell modal exchange from " + from + " to " + to);
        $("#changelly_sell_title").html($.t("exchange_coin_to_kpl_changelly", { coin: from }));
        $("#changelly_sell_qr_code").html("");
        $("#changelly_sell_min").val(min);
        $("#changelly_sell_min_coin").html(from);
        $("#changelly_sell_rate").val(rate);
        $("#changelly_sell_rate_text").html(from + "/KPL");
        $("#changelly_sell_amount_text").html(from);
        $("#changelly_sell_estimated_amount").val("");
        $("#changelly_sell_from").val(from);
        $("#changelly_sell_to").val(to);
        var publicKey = KRS.publicKey;
        if (publicKey === "" && KRS.accountInfo) {
            publicKey = KRS.accountInfo.publicKey;
        }
        if (!publicKey || publicKey === "") {
            KRS.showModalError("Account has no public key, please login using your passphrase", modal);
            return;
        }
        modal.css('cursor','wait');
        apiCall('generateAddress', {
            from: from,
            to: to,
            address: KRS.accountRS,
            extraId: publicKey
        }, function (data) {
            modal.css('cursor', 'default');
            var msg;
            if (data.error) {
                msg = "Changelly generateAddress error " + data.error.code + " " + data.error.message;
                KRS.logConsole(msg);
                KRS.showModalError(msg, modal);
                return;
            }
            var depositAddress = data.result.address;
            if (!depositAddress) {
                msg = "changelly did not return a deposit address for id " + data.id;
                KRS.logConsole(msg);
                KRS.showModalError(msg, modal);
                return;
            }
            KRS.logConsole(from + " deposit address " + depositAddress);
            $("#changelly_sell_deposit_address").html(depositAddress);
            KRS.generateQRCode("#changelly_sell_qr_code", depositAddress);
        })
    });

    $('#changelly_sell_amount').change(function () {
        var $modal = $(this).closest(".modal");
        var amount = $('#changelly_sell_amount').val();
        var from = $('#changelly_sell_from').val();
        var to = $('#changelly_sell_to').val();
        var $estimatedAmount = $('#changelly_sell_estimated_amount');
        var depositAddress = $("#changelly_sell_deposit_address").html();
        if (!amount) {
            $estimatedAmount.val("");
            KRS.generateQRCode("#changelly_sell_qr_code", depositAddress);
            return;
        }
        $modal.css('cursor', 'wait');
        apiCall('getExchangeAmount', {
            amount: amount,
            from: from,
            to: to
        }, function (response) {
            if (response.error) {
                $estimatedAmount.val("");
                KRS.generateQRCode("#changelly_sell_qr_code", depositAddress);
                $modal.css('cursor', 'default');
                return;
            }
            $estimatedAmount.val(response.result);
            KRS.generateQRCode("#changelly_sell_qr_code", "bitcoin:" + depositAddress + "?amount=" + amount);
            $modal.css('cursor', 'default');
        })
    });

    $("#changelly_sell_done").on("click", function(e) {
        e.preventDefault();
        var $modal = $(this).closest(".modal");
        var $btn = KRS.lockForm($modal);
        var from = $("#changelly_sell_from").val();
        var to = $("#changelly_sell_to").val();
        var deposit = $("#changelly_sell_deposit_address").html();
        if (deposit !== "") {
            KRS.addDepositAddress(deposit, from, to, DEPOSIT_ADDRESSES_KEY + KRS.accountRS);
            renderMyExchangesTable();
            KRS.unlockForm($modal, $btn, true);
        }
    });

    $("#changelly_view_transaction").on("show.bs.modal", function(e) {
        var $invoker = $(e.relatedTarget);
        var id = $invoker.data("id");
        var content = $invoker.data("content");
        $("#changelly_identifier").val(id);
        var viewContent = $("#changelly_view_content");
        viewContent.html(JSON.stringify(content, null, 2));
        hljs.highlightBlock(viewContent[0]);
    });

    $("#changelly_search").on("click", function(e) {
        e.preventDefault();
        var key = $("#changelly_search_key").val();
        var id = $("#changelly_search_id").val();
        var params = {};
        params[key] = id;
        apiCall("getTransactions", params, function(response) {
            $(this).data("id", id);
            $(this).data("content", response);
            $("#changelly_view_transaction").modal({}, $(this));
        });
    });

    $("#ignis_changelly_button").on("click", function(e) {
        e.preventDefault();
        var from = $(this).data("from");
        var to = $(this).data("to");
        apiCall("getMinAmount", { from: from, to: to }, function (response) {
            $(this).data("min", response.result);
            apiCall("getExchangeAmount", { from: from, to: to, amount: "1" }, function (response) {
                $(this).data("from", from); // It's unclear why this line is necessary but the value is not passed without it
                $(this).data("to", to); // It's unclear why this line is necessary but the value is not passed without it
                $(this).data("rate", response.result);
                $("#changelly_sell_modal").modal({}, $(this));
            })
        })
    });

    return KRS;
}(KRS || {}, jQuery));
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

    KRS.invert = function(rate) {
        return Math.round(100000000 / parseFloat(rate)) / 100000000;
    };

    KRS.getCoins = function(exchange) {
        var coins = [];
        for (var i=0; i<3; i++) {
            coins.push(KRS.settings[exchange + "_coin" + i]);
        }
        return coins;
    };

    KRS.setCoins = function(exchange, coins) {
        for (var i=0; i<coins.length; i++) {
            KRS.updateSettings(exchange + "_coin" + i, coins[i]);
        }
    };


    KRS.addDepositAddress = function(address, from, to, key) {
        var json = localStorage[key];
        var addresses;
        if (json === undefined) {
            addresses = [];
        } else {
            addresses = JSON.parse(json);
            if (addresses.length > 10) {
                addresses.splice(10, addresses.length - 10);
            }
        }
        var item = { address: address, from: from, to: to, time: Date.now() };
        for (var i=0; i < addresses.length; i++) {
            if (item.address == addresses[i].address && item.from == addresses[i].from && item.to == addresses[i].to) {
                KRS.logConsole("deposit address " + item.address + " from " + item.from + " to " + item.to + " already exists");
                return;
            }
        }
        addresses.splice(0, 0, item);
        KRS.logConsole("deposit address " + address + " from " + from + " to " + to + " added");
        localStorage[key] = JSON.stringify(addresses);
    };

    KRS.getExchangeAddressLink = function (address, coin) {
        if (coin.toUpperCase() === "KPL") {
            return KRS.getAccountLink({ accountRS: address }, "account");
        }
        if (coin.toUpperCase() === "BTC") {
            return "<a target='_blank' href='https://blockchain.info/address/" + address + "'>" + address + "</a>";
        }
        return address;
    };

    KRS.getExchangeTransactionLink = function (transaction, coin) {
        if (coin.toUpperCase() === "KPL") {
            return "<a href='#' class='show_transaction_modal_action' data-transaction='" + transaction + "'>" + transaction + "</a>";
        }
        if (coin.toUpperCase() === "BTC") {
            return "<a target='_blank' href='https://blockchain.info/tx/" + transaction + "'>" + transaction + "</a>";
        }
        return transaction;
    };

    return KRS;
}(KRS || {}, jQuery));


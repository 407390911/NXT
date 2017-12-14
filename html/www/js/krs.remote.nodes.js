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
var KRS = (function(KRS) {
    var requestConfirmations = [];

    KRS.updateRemoteNodes = function() {
        console.log("Updating remote nodes");
        var data = {state: "CONNECTED", includePeerInfo: true};
        KRS.sendRequest("getPeers", data, function (response) {
            if (response.peers) {
                KRS.remoteNodesMgr.nodes = {};
                KRS.remoteNodesMgr.addRemoteNodes(response.peers);
            }
            console.log("remote nodes updated");
        });
    };

    KRS.initRemoteNodesMgr = function (isTestnet, resolve, reject) {
        KRS.remoteNodesMgr = new RemoteNodesManager(isTestnet);
        if (KRS.isMobileApp()) {
            if (KRS.mobileSettings.remote_node_address == "") {
                KRS.remoteNodesMgr.addBootstrapNodes(resolve, reject);
            } else {
                KRS.remoteNodesMgr.addBootstrapNode(resolve, reject);
            }
        } else if (KRS.isUpdateRemoteNodes()) {
            if (KRS.isRemoteNodeConnectionAllowed()) {
                KRS.updateRemoteNodes();
            } else {
                $.growl($.t("https_client_cannot_connect_remote_nodes"));
            }
        }
    };

    KRS.requestNeedsConfirmation = function (requestType) {
        if (KRS.remoteNodesMgr) {
            var plusIndex = requestType.indexOf("+");
            if (plusIndex > 0) {
                requestType = requestType.substring(0, plusIndex);
            }
            return !KRS.isRequirePost(requestType) && KRS.isRequestForwardable(requestType)
        }
        return false;
    };

    var prunableAttachments = [
        "PrunablePlainMessage", "PrunableEncryptedMessage", "UnencryptedPrunableEncryptedMessage", "ShufflingProcessing", "TaggedDataUpload"
    ];

    function normalizePrunableAttachment(transaction) {
        var attachment = transaction.attachment;
        if (attachment) {
            // Check if prunable attachment
            var isPrunableAttachment = false;
            for (var key in attachment) {
                if (!attachment.hasOwnProperty(key) || !key.startsWith("version.")) {
                    continue;
                }
                key = key.substring("version.".length);
                for (var i=0; i<prunableAttachments.length; i++) {
                    if (key == prunableAttachments[i]) {
                        isPrunableAttachment = true;
                    }
                }
            }
            if (!isPrunableAttachment) {
                return;
            }
            for (key in attachment) {
                if (!attachment.hasOwnProperty(key)) {
                    continue;
                }
                if (key.length < 4 || !(key.substring(key.length - 4, key.length).toLowerCase() == "hash")) {
                    delete attachment[key];
                }
            }
        }
    }

    KRS.isPeerListSimilar = function(peers1, peers2) {
        if (!peers1.peers && !peers2.peers) {
            return true;
        }
        if (!peers1.peers) {
            return false;
        }
        if (!peers2.peers) {
            return false;
        }
        var sharedPeers = KRS.countCommonElements(peers1.peers, peers2.peers);
        return 100*sharedPeers / Math.min(peers1.peers.length, peers2.peers.length) > 70;
    };

    KRS.compareLedgerEntries = function(obj1, obj2) {
        if (!obj1.entries && !obj2.entries) {
            return true;
        }
        if (!obj1.entries || !obj2.entries) {
            return false;
        }
        if (obj1.entries instanceof Array && obj2.entries instanceof Array) {
            for (var i = 0; i < obj1.entries.length && i < obj2.entries.length; i++) {
                var str1 = JSON.stringify(obj1.entries[i]);
                var str2 = JSON.stringify(obj2.entries[i]);
                if (str1 != str2) {
                    return false;
                }
            }
            return true;
        }
        return false;
    };

    KRS.countCommonElements = function(a1, a2) {
        var count = 0;
        for (var i = 0; i < a1.length; i++) {
            if (a2.indexOf(a1[i]) >= 0) {
                count++;
            }
        }
        return count;
    };

    KRS.getComparableResponse = function(origResponse, requestType) {
        if (requestType == "getBlockchainStatus") {
            var response = {
                application: origResponse.application,
                isTestnet: origResponse.isTestnet
            };
            return JSON.stringify(response);
        }
        if (requestType == "getState") {
            return requestType; // no point to compare getState responses
        }

        delete origResponse.requestProcessingTime;
        delete origResponse.confirmations;
        if (requestType == "getBlock") {
            delete origResponse.nextBlock;
        } else if (origResponse.transactions) {
            var transactions = origResponse.transactions;
            for (var i=0; i<transactions.length; i++) {
                var transaction = transactions[i];
                delete transaction.confirmations;
                normalizePrunableAttachment(transaction);
            }
        } else if (requestType == "getAccountLedger") {
            for (var i=0; i<origResponse.entries.length; i++) {
                var entry = origResponse.entries[i];
                delete entry.ledgerId;
            }
        }
        return JSON.stringify(origResponse);
    };

    KRS.confirmResponse = function(requestType, data, expectedResponse, requestRemoteNode) {
        if (KRS.requestNeedsConfirmation(requestType)) {
            try {
                // First clone the response so that we do not change it
                var expectedResponseStr = JSON.stringify(expectedResponse);
                expectedResponse = JSON.parse(expectedResponseStr);

                // Now remove all variable parts
                expectedResponseStr = KRS.getComparableResponse(expectedResponse, requestType);
            } catch(e) {
                KRS.logConsole("Cannot parse JSON response for request " + requestType);
                return;
            }
            var ignoredAddresses = [];
            if (requestRemoteNode) {
                ignoredAddresses.push(requestRemoteNode.address);
            }
            var nodes = KRS.remoteNodesMgr.getRandomNodes(KRS.mobileSettings.validators_count, ignoredAddresses);
            var now = new Date();
            var confirmationReport = {processing: [], confirmingNodes: [], rejectingNodes: [],
                requestType: requestType, requestTime: now};

            requestConfirmations.unshift(confirmationReport);

            var minRequestTime = new Date(now);
            //keep history since 1 minute and 15 seconds ago
            minRequestTime.setMinutes(minRequestTime.getMinutes() - 1);
            minRequestTime.setSeconds(minRequestTime.getSeconds() - 15);

            var idx = requestConfirmations.length - 1;
            while (idx > 0){
                if (minRequestTime > requestConfirmations[idx].requestTime) {
                    requestConfirmations.pop();
                } else {
                    break;
                }
                idx--;
            }

            if (requestConfirmations.length > 50) {
                requestConfirmations.pop();
            }
            function onConfirmation(response) {
                var fromNode = this;
                var index = confirmationReport.processing.indexOf(fromNode.announcedAddress);
                confirmationReport.processing.splice(index, 1);

                if (!response.errorCode) {
                    // here it's Ok to modify the response since it is only being used for comparison
                    var node = data["_extra"].node;
                    var type = data["_extra"].requestType;
                    KRS.logConsole("Confirm request " + type + " with node " + node.announcedAddress);
                    var responseStr = KRS.getComparableResponse(response, type);
                    if (responseStr == expectedResponseStr
                        || (type == "getPeers" && KRS.isPeerListSimilar(response, expectedResponse))
                        || (type == "getAccountLedger" && KRS.compareLedgerEntries(response, expectedResponse))) {
                        confirmationReport.confirmingNodes.push(node);
                    } else {
                        KRS.logConsole(node.announcedAddress + " response defers from " + requestRemoteNode.announcedAddress + " response for " + type);
                        KRS.logConsole("Expected Response: " + expectedResponseStr);
                        KRS.logConsole("Actual   Response: " + responseStr);
                        confirmationReport.rejectingNodes.push(node);
                        KRS.updateConfirmationsIndicator();
                    }

                    if (confirmationReport.processing.length == 0) {
                        KRS.logConsole("onConfirmation:Request " + type +
                            " confirmations " + confirmationReport.confirmingNodes.length +
                            " rejections " + confirmationReport.rejectingNodes.length);
                        KRS.updateConfirmationsIndicator();
                    }
                } else {
                    // Confirmation request received error
                    KRS.logConsole("Confirm request error " + response.errorDescription);
                }
            }

            for (var i=0; i<nodes.length; i++) {
                var node = nodes[i];
                if (node.isBlacklisted()) {
                    continue;
                }
                confirmationReport.processing.push(node.announcedAddress);
                ignoredAddresses.push(node.address);
                if (typeof data == "string") {
                    data = { "querystring": data };
                }
                data["_extra"] = { node: node, requestType: requestType };
                KRS.sendRequest(requestType, data, onConfirmation, { noProxy: true, remoteNode: node, doNotEscape: true });
            }
        }
    };

    KRS.updateConfirmationsIndicator = function () {
        var color = (62 << 16) | (169 << 8) | 64;
        var rejections = 0;
        var confirmations = 0;
        var hasRejections = false;
        for (var i=0; i<requestConfirmations.length; i++) {
            confirmations++; //the main remote node counts as 1 vote
            confirmations += requestConfirmations[i].confirmingNodes.length;
            rejections += requestConfirmations[i].rejectingNodes.length;
        }
        if (confirmations > 0) {
            var rejectionsRatio = rejections * 2 / confirmations; // It can't get worse than 1:1 ratio
            if (rejectionsRatio > 1) {
                rejectionsRatio = 1;
            }
            if (rejectionsRatio > 0) {
                var gradientStart = 0xeccc31;
                var gradientEnd = 0xa94442;
                var red = (gradientStart >> 16) * (1 - rejectionsRatio) + (gradientEnd >> 16) * rejectionsRatio;
                var green = ((gradientStart >> 8) & 0xff) * (1 - rejectionsRatio) + ((gradientEnd >> 8) & 0xff) * rejectionsRatio;
                var blue = (gradientStart & 0xff) * (1 - rejectionsRatio) + (gradientEnd & 0xff) * rejectionsRatio;
                color = (red << 16) | (green << 8) | blue;
                hasRejections = true;
            }
        }
        var indicator = $("#confirmation_rate_indicator");
        var indicatorIcon = indicator.find("i");
        if (hasRejections) {
            indicatorIcon.removeClass('fa-bolt');
            indicatorIcon.addClass('fa-exclamation');
        } else {
            indicatorIcon.addClass('fa-bolt');
            indicatorIcon.removeClass('fa-exclamation');
        }
        indicator.css({'background-color': "#" + color.toString(16)});
        KRS.updateConfirmationsTable();
    };

    KRS.printRemoteAddresses = function (nodesList) {
        var result = "";
        for (var i=0; i<nodesList.length; i++) {
            result += '<a target="_blank" href="' + nodesList[i].getUrl() + '">' + nodesList[i].announcedAddress + '</a><br/>';
        }
        return result;
    };

    KRS.updateConfirmationsTable = function () {
        var requestConfirmationsInfoTable = $("#request_confirmations_info_table");
        var rows = "";

        for (var i=0; i<requestConfirmations.length; i++) {
            var confirmation = requestConfirmations[i];
            rows += "<tr>" +
                        "<td>" + KRS.formatTimestamp(confirmation.requestTime) + "<br/>"
                            + String(confirmation.requestType).escapeHTML() + "</td>" +
                        "<td>" + KRS.printRemoteAddresses(confirmation.confirmingNodes) + "</td>" +
                        "<td>" + KRS.printRemoteAddresses(confirmation.rejectingNodes) + "</td>" +
                    "</tr>";
        }
        requestConfirmationsInfoTable.find("tbody").empty().append(rows);
    };
	return KRS;
}(KRS || {}, jQuery));
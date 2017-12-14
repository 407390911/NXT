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
    var currentMonitor;

    function isErrorResponse(response) {
        return response.errorCode || response.errorDescription || response.errorMessage || response.error;
    }

    function getErrorMessage(response) {
        return response.errorDescription || response.errorMessage || response.error;
    } 

    KRS.jsondata = KRS.jsondata||{};

    KRS.jsondata.monitors = function (response) {
        return {
            accountFormatted: KRS.getAccountLink(response, "account"),
            property: KRS.escapeRespStr(response.property),
            amountFormatted: KRS.formatAmount(response.amount),
            thresholdFormatted: KRS.formatAmount(response.threshold),
            interval: KRS.escapeRespStr(response.interval),
            statusLinkFormatted: "<a href='#' class='btn btn-xs' " +
                        "onclick='KRS.goToMonitor(" + JSON.stringify(response) + ");'>" +
                         $.t("status") + "</a>",
            stopLinkFormatted: "<a href='#' class='btn btn-xs' data-toggle='modal' data-target='#stop_funding_monitor_modal' " +
                        "data-account='" + KRS.escapeRespStr(response.accountRS) + "' " +
                        "data-property='" + KRS.escapeRespStr(response.property) + "'>" + $.t("stop") + "</a>"
        };
    };

    KRS.jsondata.monitoredAccount = function (response) {
        try {
            var value = JSON.parse(response.value);
        } catch (e) {
            KRS.logConsole(e.message);
        }
        return {
            accountFormatted: KRS.getAccountLink(response, "recipient"),
            property: KRS.escapeRespStr(response.property),
            amountFormatted: (value && value.amount) ? "<b>" + KRS.formatAmount(value.amount) : KRS.formatAmount(currentMonitor.amount),
            thresholdFormatted: (value && value.threshold) ? "<b>" + KRS.formatAmount(value.threshold) : KRS.formatAmount(currentMonitor.threshold),
            intervalFormatted: (value && value.interval) ? "<b>" + KRS.escapeRespStr(value.interval) : KRS.escapeRespStr(currentMonitor.interval),
            removeLinkFormatted: "<a href='#' class='btn btn-xs' data-toggle='modal' data-target='#remove_monitored_account_modal' " +
                        "data-recipient='" + KRS.escapeRespStr(response.recipientRS) + "' " +
                        "data-property='" + KRS.escapeRespStr(response.property) + "' " +
                        "data-value='" + KRS.normalizePropertyValue(response.value) + "'>" + $.t("remove") + "</a>"
        };
    };

    KRS.incoming.funding_monitors = function() {
        KRS.loadPage("funding_monitors");
    };

    KRS.pages.funding_monitors = function () {
        KRS.hasMorePages = false;
        var view = KRS.simpleview.get('funding_monitors_page', {
            errorMessage: null,
            isLoading: true,
            isEmpty: false,
            monitors: []
        });
        var params = {
            "account": KRS.accountRS,
            "adminPassword": KRS.getAdminPassword(),
            "firstIndex": KRS.pageNumber * KRS.itemsPerPage - KRS.itemsPerPage,
            "lastIndex": KRS.pageNumber * KRS.itemsPerPage
        };
        KRS.sendRequest("getFundingMonitor", params,
            function (response) {
                if (isErrorResponse(response)) {
                    view.render({
                        errorMessage: getErrorMessage(response),
                        isLoading: false,
                        isEmpty: false
                    });
                    return;
                }
                if (response.monitors.length > KRS.itemsPerPage) {
                    KRS.hasMorePages = true;
                    response.monitors.pop();
                }
                view.monitors.length = 0;
                response.monitors.forEach(
                    function (monitorJson) {
                        view.monitors.push(KRS.jsondata.monitors(monitorJson))
                    }
                );
                view.render({
                    isLoading: false,
                    isEmpty: view.monitors.length == 0
                });
                KRS.pageLoaded();
            }
        )
    };

    KRS.forms.startFundingMonitorComplete = function() {
        $.growl($.t("monitor_started"));
        KRS.loadPage("funding_monitors");
    };

    $("#stop_funding_monitor_modal").on("show.bs.modal", function(e) {
        var $invoker = $(e.relatedTarget);
        var account = $invoker.data("account");
        if (account) {
            $("#stop_monitor_account").val(account);
        }
        var property = $invoker.data("property");
        if (property) {
            $("#stop_monitor_property").val(property);
        }
        if (KRS.getAdminPassword()) {
            $("#stop_monitor_admin_password").val(KRS.getAdminPassword());
        }
    });

    KRS.forms.stopFundingMonitorComplete = function() {
        $.growl($.t("monitor_stopped"));
        KRS.loadPage("funding_monitors");
    };

    KRS.goToMonitor = function(monitor) {
   		KRS.goToPage("funding_monitor_status", function() {
            return monitor;
        });
   	};

    KRS.incoming.funding_monitors_status = function() {
        KRS.loadPage("funding_monitor_status");
    };

    KRS.pages.funding_monitor_status = function (callback) {
        currentMonitor = callback();
        $("#monitor_funding_account").html(KRS.escapeRespStr(currentMonitor.account));
        $("#monitor_control_property").html(KRS.escapeRespStr(currentMonitor.property));
        KRS.hasMorePages = false;
        var view = KRS.simpleview.get('funding_monitor_status_page', {
            errorMessage: null,
            isLoading: true,
            isEmpty: false,
            monitoredAccount: []
        });
        var params = {
            "setter": currentMonitor.account,
            "property": currentMonitor.property,
            "firstIndex": KRS.pageNumber * KRS.itemsPerPage - KRS.itemsPerPage,
            "lastIndex": KRS.pageNumber * KRS.itemsPerPage
        };
        KRS.sendRequest("getAccountProperties", params,
            function (response) {
                if (isErrorResponse(response)) {
                    view.render({
                        errorMessage: getErrorMessage(response),
                        isLoading: false,
                        isEmpty: false
                    });
                    return;
                }
                if (response.properties.length > KRS.itemsPerPage) {
                    KRS.hasMorePages = true;
                    response.properties.pop();
                }
                view.monitoredAccount.length = 0;
                response.properties.forEach(
                    function (propertiesJson) {
                        view.monitoredAccount.push(KRS.jsondata.monitoredAccount(propertiesJson))
                    }
                );
                view.render({
                    isLoading: false,
                    isEmpty: view.monitoredAccount.length == 0,
                    fundingAccountFormatted: KRS.getAccountLink(currentMonitor, "account"),
                    controlProperty: currentMonitor.property
                });
                KRS.pageLoaded();
            }
        )
    };

    $("#add_monitored_account_modal").on("show.bs.modal", function() {
        $("#add_monitored_account_property").val(currentMonitor.property);
        $("#add_monitored_account_amount").val(KRS.convertToKPL(currentMonitor.amount));
        $("#add_monitored_account_threshold").val(KRS.convertToKPL(currentMonitor.threshold));
        $("#add_monitored_account_interval").val(currentMonitor.interval);
        $("#add_monitored_account_value").val("");
    });

    $(".add_monitored_account_value").on('change', function() {
        if (!currentMonitor) {
            return;
        }
        var value = {};
        var amount = KRS.convertToNQT($("#add_monitored_account_amount").val());
        if (currentMonitor.amount != amount) {
            value.amount = amount;
        }
        var threshold = KRS.convertToNQT($("#add_monitored_account_threshold").val());
        if (currentMonitor.threshold != threshold) {
            value.threshold = threshold;
        }
        var interval = $("#add_monitored_account_interval").val();
        if (currentMonitor.interval != interval) {
            value.interval = interval;
        }
        if (jQuery.isEmptyObject(value)) {
            value = "";
        } else {
            value = JSON.stringify(value);
        }
        $("#add_monitored_account_value").val(value);
    });

    $("#remove_monitored_account_modal").on("show.bs.modal", function(e) {
        var $invoker = $(e.relatedTarget);
        $("#remove_monitored_account_recipient").val($invoker.data("recipient"));
        $("#remove_monitored_account_property").val($invoker.data("property"));
        $("#remove_monitored_account_value").val(KRS.normalizePropertyValue($invoker.data("value")));
    });

    return KRS;

}(KRS || {}, jQuery));
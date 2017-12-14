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

    $("#mobile_settings_modal").on("show.bs.modal", function() {
        var isOffline = !!$("#mobile_settings_modal").find("input[name=is_offline]").val();
        if (isOffline) {
            $(".info_message").html($.t("working_offline"));
            $("#mobile_offline_links").show();
        } else {
            $(".info_message").html($.t("remote_node_url", {url: KRS.getRemoteNodeUrl()}));
            $("#mobile_offline_links").hide();
        }
        if (KRS.mobileSettings.is_check_remember_me) {
            $("#mobile_is_check_remember_me").prop('checked', true);
        } else {
            $("#mobile_is_check_remember_me").prop('checked', false);
        }
        if (KRS.mobileSettings.is_store_remembered_passphrase) {
            $("#mobile_is_store_remembered_passphrase").prop('checked', true);
        } else {
            $("#mobile_is_store_remembered_passphrase").prop('checked', false);
        }
        if (KRS.isEnableMobileAppSimulation()) {
            if (KRS.mobileSettings.is_simulate_app) {
                $("#mobile_is_simulate_app").prop('checked', true);
            } else {
                $("#mobile_is_simulate_app").prop('checked', false);
            }
        } else {
            $("#mobile_is_simulate_app_container").hide();
        }
        if (KRS.mobileSettings.is_testnet) {
            $("#mobile_is_testnet").prop('checked', true);
        } else {
            $("#mobile_is_testnet").prop('checked', false);
        }
        $("#mobile_remote_node_address").val(KRS.mobileSettings.remote_node_address);
        $("#mobile_remote_node_port").val(KRS.mobileSettings.remote_node_port);
        if (KRS.mobileSettings.is_remote_node_ssl) {
            $("#mobile_is_remote_node_ssl").prop('checked', true);
        } else {
            $("#mobile_is_remote_node_ssl").prop('checked', false);
        }
        $("#mobile_validators_count").val(KRS.mobileSettings.validators_count);
        $("#mobile_bootstrap_nodes_count").val(KRS.mobileSettings.bootstrap_nodes_count);
    });

    KRS.forms.setMobileSettings = function() {
        KRS.mobileSettings.is_check_remember_me = $("#mobile_is_check_remember_me").prop('checked');
        KRS.mobileSettings.is_store_remembered_passphrase = $("#mobile_is_store_remembered_passphrase").prop('checked');
        KRS.mobileSettings.is_simulate_app = $("#mobile_is_simulate_app").prop('checked');
        KRS.mobileSettings.is_testnet = $("#mobile_is_testnet").prop('checked');
        KRS.mobileSettings.remote_node_address = $("#mobile_remote_node_address").val();

        var remoteNodePort = $("#mobile_remote_node_port").val();
        if (!$.isNumeric(remoteNodePort) && remoteNodePort != "") {
            return { error: $.t("remote_node_port") + " " + $.t("is_not_numeric") };
        }
        KRS.mobileSettings.remote_node_port = parseInt(remoteNodePort);
        KRS.mobileSettings.is_remote_node_ssl = $("#mobile_is_remote_node_ssl").prop('checked');

        var validatorsCount = $("#mobile_validators_count").val();
        if (!$.isNumeric(validatorsCount)) {
            return { error: $.t("validators_count") + " " + $.t("is_not_numeric") };
        }
        var count = parseInt(validatorsCount);
        if (count < 0 || count > 3) {
            return { error: $.t("validators_count") + " " + $.t("is_not_in_the_range", { from: 0, to: 3 }) };
        }
        KRS.mobileSettings.validators_count = count;

        var bootstrapNodesCount = $("#mobile_bootstrap_nodes_count").val();
        if (!$.isNumeric(bootstrapNodesCount)) {
            return { error: $.t("bootstrap_nodes_count") + " " + $.t("is_not_numeric") };
        }
        count = parseInt(bootstrapNodesCount);
        if (count < 0 || count > 5) {
            return { error: $.t("bootstrap_nodes_count") + " " + $.t("is_not_in_the_range", { from: 0, to: 5 }) };
        }
        KRS.mobileSettings.bootstrap_nodes_count = count;
        KRS.setJSONItem("mobile_settings", KRS.mobileSettings);
        return { reload: true, forceGet: false };
    };

    return KRS;

}(KRS || {}, jQuery));
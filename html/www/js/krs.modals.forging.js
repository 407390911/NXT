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
	KRS.forms.startForgingComplete = function(response, data) {
		if ("deadline" in response) {
            setForgingIndicatorStatus(KRS.constants.FORGING);
			forgingIndicator.find("span").html($.t(KRS.constants.FORGING)).attr("data-i18n", "forging");
			KRS.forgingStatus = KRS.constants.FORGING;
            KRS.isAccountForging = true;
			$.growl($.t("success_start_forging"), {
				type: "success"
			});
		} else {
            KRS.isAccountForging = false;
			$.growl($.t("error_start_forging"), {
				type: 'danger'
			});
		}
	};

	KRS.forms.stopForgingComplete = function(response, data) {
		if ($("#stop_forging_modal").find(".show_logout").css("display") == "inline") {
			KRS.logout();
			return;
		}
        if (response.foundAndStopped || (response.stopped && response.stopped > 0)) {
            KRS.isAccountForging = false;
            if (!response.forgersCount || response.forgersCount == 0) {
                setForgingIndicatorStatus(KRS.constants.NOT_FORGING);
                forgingIndicator.find("span").html($.t(KRS.constants.NOT_FORGING)).attr("data-i18n", "forging");
            }
            $.growl($.t("success_stop_forging"), {
				type: 'success'
			});
		} else {
			$.growl($.t("error_stop_forging"), {
				type: 'danger'
			});
		}
	};

	var forgingIndicator = $("#forging_indicator");
	forgingIndicator.click(function(e) {
		e.preventDefault();

        if (KRS.state.isLightClient) {
            $.growl($.t("error_forging_light_client"), {
                "type": "danger"
            });
        } else if (KRS.downloadingBlockchain) {
			$.growl($.t("error_forging_blockchain_downloading"), {
				"type": "danger"
			});
		} else if (KRS.state.isScanning) {
			$.growl($.t("error_forging_blockchain_rescanning"), {
				"type": "danger"
			});
		} else if (!KRS.accountInfo.publicKey) {
			$.growl($.t("error_forging_no_public_key"), {
				"type": "danger"
			});
		} else if (KRS.accountInfo.effectiveBalanceKPL == 0) {
			if (KRS.lastBlockHeight >= KRS.accountInfo.currentLeasingHeightFrom && KRS.lastBlockHeight <= KRS.accountInfo.currentLeasingHeightTo) {
				$.growl($.t("error_forging_lease"), {
					"type": "danger"
				});
			} else {
				$.growl($.t("error_forging_effective_balance"), {
					"type": "danger"
				});
			}
		} else if (KRS.isAccountForging) {
			$("#stop_forging_modal").modal("show");
		} else {
			$("#start_forging_modal").modal("show");
		}
	});

	forgingIndicator.hover(
		function() {
            KRS.updateForgingStatus();
        }
	);

    KRS.getForgingTooltip = function(data) {
        if (!data || data.account == KRS.accountInfo.account) {
            KRS.isAccountForging = true;
            return $.t("forging_tooltip", {"balance": KRS.accountInfo.effectiveBalanceKPL});
        }
        return $.t("forging_another_account_tooltip", {"accountRS": data.accountRS });
    };

    KRS.updateForgingTooltip = function(tooltip) {
        $("#forging_indicator").attr('title', tooltip).tooltip('fixTitle');
    };

    function setForgingIndicatorStatus(status) {
        var forgingIndicator = $("#forging_indicator");
        forgingIndicator.removeClass(KRS.constants.FORGING);
        forgingIndicator.removeClass(KRS.constants.NOT_FORGING);
        forgingIndicator.removeClass(KRS.constants.UNKNOWN);
        forgingIndicator.addClass(status);
    }

    KRS.updateForgingStatus = function(secretPhrase) {
        var forgingIndicator = $("#forging_indicator");
        if (!KRS.isForgingSupported()) {
            forgingIndicator.hide();
            return;
        }
        var status = KRS.forgingStatus;
        var tooltip = forgingIndicator.attr('title');
        if (KRS.state.isLightClient) {
            status = KRS.constants.NOT_FORGING;
            tooltip = $.t("error_forging_light_client");
        } else if (!KRS.accountInfo.publicKey) {
            status = KRS.constants.NOT_FORGING;
            tooltip = $.t("error_forging_no_public_key");
        } else if (KRS.isLeased) {
            status = KRS.constants.NOT_FORGING;
            tooltip = $.t("error_forging_lease");
        } else if (KRS.accountInfo.effectiveBalanceKPL == 0) {
            status = KRS.constants.NOT_FORGING;
            tooltip = $.t("error_forging_effective_balance");
        } else if (KRS.downloadingBlockchain) {
            status = KRS.constants.NOT_FORGING;
            tooltip = $.t("error_forging_blockchain_downloading");
        } else if (KRS.state.isScanning) {
            status = KRS.constants.NOT_FORGING;
            tooltip = $.t("error_forging_blockchain_rescanning");
        } else if (KRS.needsAdminPassword && KRS.getAdminPassword() == "" && (!secretPhrase || !KRS.isForgingSafe())) {
            // do not change forging status
        } else {
            var params = {};
            if (KRS.needsAdminPassword && KRS.getAdminPassword() != "") {
                params["adminPassword"] = KRS.getAdminPassword();
            }
            if (secretPhrase && KRS.needsAdminPassword && KRS.getAdminPassword() == "") {
                params["secretPhrase"] = secretPhrase;
            }
            KRS.sendRequest("getForging", params, function (response) {
                KRS.isAccountForging = false;
                if ("account" in response) {
                    status = KRS.constants.FORGING;
                    tooltip = KRS.getForgingTooltip(response);
                    KRS.isAccountForging = true;
                } else if ("generators" in response) {
                    if (response.generators.length == 0) {
                        status = KRS.constants.NOT_FORGING;
                        tooltip = $.t("not_forging_not_started_tooltip");
                    } else {
                        status = KRS.constants.FORGING;
                        if (response.generators.length == 1) {
                            tooltip = KRS.getForgingTooltip(response.generators[0]);
                        } else {
                            tooltip = $.t("forging_more_than_one_tooltip", { "generators": response.generators.length });
                            for (var i=0; i< response.generators.length; i++) {
                                if (response.generators[i].account == KRS.accountInfo.account) {
                                    KRS.isAccountForging = true;
                                }
                            }
                            if (KRS.isAccountForging) {
                                tooltip += ", " + $.t("forging_current_account_true");
                            } else {
                                tooltip += ", " + $.t("forging_current_account_false");
                            }
                        }
                    }
                } else {
                    status = KRS.constants.UNKNOWN;
                    tooltip = KRS.escapeRespStr(response.errorDescription);
                }
            }, { isAsync: false });
        }
        setForgingIndicatorStatus(status);
        if (status == KRS.constants.NOT_FORGING) {
            KRS.isAccountForging = false;
        }
        forgingIndicator.find("span").html($.t(status)).attr("data-i18n", status);
        forgingIndicator.show();
        KRS.forgingStatus = status;
        KRS.updateForgingTooltip(tooltip);
    };

	return KRS;
}(KRS || {}, jQuery));
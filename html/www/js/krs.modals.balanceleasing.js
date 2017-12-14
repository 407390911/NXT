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
var KRS = (function(KRS, $, undefined) {
	KRS.forms.leaseBalanceComplete = function(response, data) {
		KRS.getAccountInfo();
	};

    function setLeaseBalanceHelp(period) {
        var days = Math.round(period / 1440);
        $("#lease_balance_help").html($.t("lease_balance_help_var", {
            "blocks": String(period).escapeHTML(),
            "days": String(Math.round(days)).escapeHTML()
        }));
    }

	$("#lease_balance_modal").on("show.bs.modal", function() {
        var leaseBalancePeriod = $("#lease_balance_period");
        leaseBalancePeriod.attr('min', 1440);
        leaseBalancePeriod.attr('max', KRS.constants.MAX_UNSIGNED_SHORT_JAVA);
		setLeaseBalanceHelp(KRS.constants.MAX_UNSIGNED_SHORT_JAVA);
	});

    $("#lease_balance_period").on("change", function() {
		if (this.value > KRS.constants.MAX_UNSIGNED_SHORT_JAVA) {
			$("#lease_balance_help").html($.t("error_lease_balance_period"));
		} else {
            setLeaseBalanceHelp(this.value);
        }
	});

	return KRS;
}(KRS || {}, jQuery));
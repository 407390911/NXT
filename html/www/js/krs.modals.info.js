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
	var krsModal = $("#krs_modal");
    krsModal.on("shown.bs.modal", function() {
		if (KRS.fetchingModalData) {
			return;
		}

		KRS.fetchingModalData = true;
        KRS.spinner.spin(krsModal[0]);
		KRS.sendRequest("getState", {
			"includeCounts": true,
            "adminPassword": KRS.getAdminPassword()
		}, function(state) {
			for (var key in state) {
				if (!state.hasOwnProperty(key)) {
					continue;
				}
				var el = $("#krs_node_state_" + key);
				if (el.length) {
					if (key.indexOf("number") != -1) {
						el.html(KRS.formatAmount(state[key]));
					} else if (key.indexOf("Memory") != -1) {
						el.html(KRS.formatVolume(state[key]));
					} else if (key == "time") {
						el.html(KRS.formatTimestamp(state[key]));
					} else {
						el.html(KRS.escapeRespStr(state[key]));
					}
				}
			}

			$("#krs_update_explanation").show();
			$("#krs_modal_state").show();
            KRS.spinner.stop();
			KRS.fetchingModalData = false;
		});
	});

	krsModal.on("hide.bs.modal", function() {
		$("body").off("dragover.krs, drop.krs");

		$("#krs_update_drop_zone, #krs_update_result, #krs_update_hashes, #krs_update_hash_progress").hide();

		$(this).find("ul.nav li.active").removeClass("active");
		$("#krs_modal_state_nav").addClass("active");

		$(".krs_modal_content").hide();
	});

	krsModal.find("ul.nav li").click(function(e) {
		e.preventDefault();

		var tab = $(this).data("tab");

		$(this).siblings().removeClass("active");
		$(this).addClass("active");

		$(".krs_modal_content").hide();

		var content = $("#krs_modal_" + tab);

		content.show();
	});

	return KRS;
}(KRS || {}, jQuery));
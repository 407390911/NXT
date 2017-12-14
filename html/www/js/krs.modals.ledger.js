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
	$("body").on("click", ".show_ledger_modal_action", function(event) {
		event.preventDefault();
		if (KRS.fetchingModalData) {
			return;
		}
		KRS.fetchingModalData = true;
        var ledgerId, change, balance;
        if (typeof $(this).data("entry") == "object") {
            var dataObject = $(this).data("entry");
            ledgerId = dataObject["entry"];
            change = dataObject["change"];
            balance = dataObject["balance"];
        } else {
            ledgerId = $(this).data("entry");
            change = $(this).data("change");
            balance = $(this).data("balance");
        }
        if ($(this).data("back") == "true") {
            KRS.modalStack.pop(); // The forward modal
            KRS.modalStack.pop(); // The current modal
        }
        KRS.sendRequest("getAccountLedgerEntry+", { ledgerId: ledgerId }, function(response) {
			KRS.showLedgerEntryModal(response, change, balance);
		});
	});

	KRS.showLedgerEntryModal = function(entry, change, balance) {
        try {
            KRS.setBackLink();
    		KRS.modalStack.push({ class: "show_ledger_modal_action", key: "entry", value: { entry: entry.ledgerId, change: change, balance: balance }});
            $("#ledger_info_modal_entry").html(entry.ledgerId);
            var entryDetails = $.extend({}, entry);
            entryDetails.eventType = $.t(entryDetails.eventType.toLowerCase());
            entryDetails.holdingType = $.t(entryDetails.holdingType.toLowerCase());
            if (entryDetails.timestamp) {
                entryDetails.entryTime = KRS.formatTimestamp(entryDetails.timestamp);
            }
            if (entryDetails.holding) {
                entryDetails.holding_formatted_html = KRS.getTransactionLink(entry.holding);
                delete entryDetails.holding;
            }
            entryDetails.height_formatted_html = KRS.getBlockLink(entry.height);
            delete entryDetails.block;
            delete entryDetails.height;
            if (entryDetails.isTransactionEvent) {
                entryDetails.transaction_formatted_html = KRS.getTransactionLink(entry.event);
            }
            delete entryDetails.event;
            delete entryDetails.isTransactionEvent;
            entryDetails.change_formatted_html = change;
            delete entryDetails.change;
            entryDetails.balance_formatted_html = balance;
            delete entryDetails.balance;
            var detailsTable = $("#ledger_info_details_table");
            detailsTable.find("tbody").empty().append(KRS.createInfoTable(entryDetails));
            detailsTable.show();
            $("#ledger_info_modal").modal("show");
        } finally {
            KRS.fetchingModalData = false;
        }
	};

	return KRS;
}(KRS || {}, jQuery));
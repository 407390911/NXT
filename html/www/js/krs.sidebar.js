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
	$(".sidebar_context").on("contextmenu", "a", function(e) {
		e.preventDefault();
		KRS.closeContextMenu();
		if ($(this).hasClass("no-context")) {
			return;
		}

		KRS.selectedContext = $(this);
		KRS.selectedContext.addClass("context");
		$(document).on("click.contextmenu", KRS.closeContextMenu);
		var contextMenu = $(this).data("context");
		if (!contextMenu) {
			contextMenu = $(this).closest(".list-group").attr("id") + "_context";
		}

		var $contextMenu = $("#" + contextMenu);
		if ($contextMenu.length) {
			var $options = $contextMenu.find("ul.dropdown-menu a");
			$.each($options, function() {
				var requiredClass = $(this).data("class");
				if (!requiredClass) {
					$(this).show();
				} else if (KRS.selectedContext.hasClass(requiredClass)) {
					$(this).show();
				} else {
					$(this).hide();
				}
			});

			$contextMenu.css({
				display: "block",
				left: e.pageX,
				top: e.pageY
			});
		}
		return false;
	});

	KRS.closeContextMenu = function(e) {
		if (e && e.which == 3) {
			return;
		}

		$(".context_menu").hide();
		if (KRS.selectedContext) {
			KRS.selectedContext.removeClass("context");
			//KRS.selectedContext = null;
		}

		$(document).off("click.contextmenu");
	};

	return KRS;
}(KRS || {}, jQuery));
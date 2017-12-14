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
	var _tagsPerPage = 34;
	var _currentSearch = {
		"page": "",
		"searchStr": ""
	};

    KRS.jsondata.data = function(response) {
        return {
            nameFormatted: KRS.getTransactionLink(response.transaction, KRS.addEllipsis(KRS.unescapeRespStr(response.name), 20)),
            accountFormatted: KRS.getAccountLink(response, "account"),
            type: KRS.addEllipsis(KRS.unescapeRespStr(response.type), 20),
            channel: KRS.addEllipsis(KRS.unescapeRespStr(response.channel), 20),
            filename: KRS.addEllipsis(KRS.unescapeRespStr(response.filename), 20),
            dataFormatted: KRS.getTaggedDataLink(response.transaction, response.isText)
        };
    };

    KRS.getTaggedDataLink = function(transaction, isText) {
        if (isText) {
            return "<a href='#' class='btn btn-xs btn-default' data-toggle='modal' " +
                "data-target='#tagged_data_view_modal' " +
                "data-transaction='" + KRS.escapeRespStr(transaction) + "'>" + $.t("view") + "</a>";
        } else {
            return KRS.getDownloadLink(
                KRS.getRequestPath() + "?requestType=downloadTaggedData&transaction=" + KRS.escapeRespStr(transaction) + "&retrieve=true");
        }
    };

	KRS.tagged_data_show_results = function(response) {
		$("#tagged_data_search_contents").empty();
		$("#tagged_data_search_results").show();
		$("#tagged_data_search_center").hide();
		$("#tagged_data_reset").show();

        KRS.hasMorePages = false;
        var view = KRS.simpleview.get('tagged_data_search_results_section', {
            errorMessage: null,
            isLoading: true,
            isEmpty: false,
            data: []
        });
        if (response.data.length > KRS.itemsPerPage) {
            KRS.hasMorePages = true;
            response.data.pop();
        }
        view.data.length = 0;
        response.data.forEach(
            function (dataJson) {
                view.data.push( KRS.jsondata.data(dataJson) );
            }
        );
        view.render({
            isLoading: false,
            isEmpty: view.data.length == 0
        });
        KRS.pageLoaded();
    };

	KRS.tagged_data_load_tags = function() {
		$('#tagged_data_tag_list').empty();
		KRS.sendRequest("getDataTags+", {
			"firstIndex": KRS.pageNumber * _tagsPerPage - _tagsPerPage,
			"lastIndex": KRS.pageNumber * _tagsPerPage
		}, function(response) {
			var content = "";
			if (response.tags && response.tags.length) {
				KRS.hasMorePages = response.tags.length > _tagsPerPage;
				for (var i=0; i<response.tags.length; i++) {
					content += '<div style="padding:5px 24px 5px 24px;text-align:center;background-color:#fff;font-size:16px;';
					content += 'width:220px;display:inline-block;margin:2px;border:1px solid #f2f2f2;">';
					content += '<a href="#" onclick="event.preventDefault(); KRS.tagged_data_search_tag(\'' +response.tags[i].tag + '\');">';
					content += response.tags[i].tag.escapeHTML() + ' [' + response.tags[i].count + ']</a>';
					content += '</div>';
				}
			}
			$('#tagged_data_tag_list').html(content);
			KRS.pageLoaded();
		});
	};

	KRS.tagged_data_search_account = function(account) {
		if (account == null) {
			account = _currentSearch["searchStr"];
		} else {
			_currentSearch = {
				"page": "account",
				"searchStr": account
			};
			KRS.pageNumber = 1;
			KRS.hasMorePages = false;
		}
		$(".tagged_data_search_pageheader_addon").hide();
		$(".tagged_data_search_pageheader_addon_account_text").text(account);
		$(".tagged_data_search_pageheader_addon_account").show();
		KRS.sendRequest("getAccountTaggedData+", {
			"account": account,
			"firstIndex": KRS.pageNumber * KRS.itemsPerPage - KRS.itemsPerPage,
			"lastIndex": KRS.pageNumber * KRS.itemsPerPage
		}, function(response) {
			KRS.tagged_data_show_results(response);
		});
	};

	KRS.tagged_data_search_fulltext = function(query) {
		if (query == null) {
			query = _currentSearch["searchStr"];
		} else {
			_currentSearch = {
				"page": "fulltext",
				"searchStr": query
			};
			KRS.pageNumber = 1;
			KRS.hasMorePages = false;
		}
		$(".tagged_data_search_pageheader_addon").hide();
		$(".tagged_data_search_pageheader_addon_fulltext_text").text('"' + query + '"');
		$(".tagged_data_search_pageheader_addon_fulltext").show();
		KRS.sendRequest("searchTaggedData+", {
			"query": query,
            "firstIndex": KRS.pageNumber * KRS.itemsPerPage - KRS.itemsPerPage,
			"lastIndex": KRS.pageNumber * KRS.itemsPerPage
		}, function(response) {
			KRS.tagged_data_show_results(response);
		});
	};

	KRS.tagged_data_search_tag = function(tag) {
		if (tag == null) {
			tag = _currentSearch["searchStr"];
		} else {
			_currentSearch = {
				"page": "tag",
				"searchStr": tag
			};
			KRS.pageNumber = 1;
			KRS.hasMorePages = false;
		}
		$(".tagged_data_search_pageheader_addon").hide();
		$(".tagged_data_search_pageheader_addon_tag_text").text('"' + tag + '"');
		$(".tagged_data_search_pageheader_addon_tag").show();
		KRS.sendRequest("searchTaggedData+", {
			"tag": tag,
			"firstIndex": KRS.pageNumber * KRS.itemsPerPage - KRS.itemsPerPage,
			"lastIndex": KRS.pageNumber * KRS.itemsPerPage
		}, function(response) {
			KRS.tagged_data_show_results(response);
		});
	};

	KRS.tagged_data_search_main = function(callback) {
		if (_currentSearch["page"] != "main") {
			KRS.pageNumber = 1;
			KRS.hasMorePages = false;
		}
		_currentSearch = {
			"page": "main",
			"searchStr": ""
		};
		$(".tagged_data_search input[name=q]").val("").trigger("unmask").mask("KPL-****-****-****-*****");
		$(".tagged_data_fulltext_search input[name=fs_q]").val("");
		$(".tagged_data_search_pageheader_addon").hide();
		$("#tagged_data_search_contents").empty();
		KRS.tagged_data_load_tags();

		$("#tagged_data_search_center").show();
		$("#tagged_data_reset").hide();
		$("#tagged_data_search_results").hide();
        KRS.sendRequest("getAllTaggedData+", {
            "firstIndex": KRS.pageNumber * KRS.itemsPerPage - KRS.itemsPerPage,
            "lastIndex": KRS.pageNumber * KRS.itemsPerPage
        }, function (response) {
            KRS.tagged_data_show_results(response);
        });

		if (callback) {
			callback();
		}
	};

	KRS.pages.tagged_data_search = function(callback) {
		$("#tagged_data_top").show();
		$("#tagged_data_search_center").show();
		if (_currentSearch["page"] == "account") {
			KRS.tagged_data_search_account();
		} else if (_currentSearch["page"] == "fulltext") {
			KRS.tagged_data_search_fulltext();
		} else if (_currentSearch["page"] == "tag") {
			KRS.tagged_data_search_tag();
		} else {
			KRS.tagged_data_search_main(callback);
		}
	};

	KRS.setup.tagged_data_search = function() {
		var sidebarId = 'sidebar_tagged_data';
		var options = {
			"id": sidebarId,
			"titleHTML": '<i class="fa fa-database"></i><span data-i18n="data_cloud">Data Cloud</span>',
			"page": 'tagged_data_search',
			"desiredPosition": 60,
			"depends": { tags: [ KRS.constants.API_TAGS.DATA ] }
		};
		KRS.addTreeviewSidebarMenuItem(options);
		options = {
			"titleHTML": '<span data-i18n="search">Search</span></a>',
			"type": 'PAGE',
			"page": 'tagged_data_search'
		};
		KRS.appendMenuItemToTSMenuItem(sidebarId, options);
		options = {
			"titleHTML": '<span data-i18n="upload_file">File Upload</span></a>',
			"type": 'MODAL',
			"modalId": 'upload_data_modal'
		};
		KRS.appendMenuItemToTSMenuItem(sidebarId, options);
	};

	$(".tagged_data_search").on("submit", function(e) {
		e.preventDefault();
		var account = $.trim($(this).find("input[name=q]").val());
		$(".tagged_data_search input[name=q]").val(account);

		if (account == "") {
			KRS.pages.tagged_data_search();
		} else if (/^(KPL\-)/i.test(account)) {
			var address = new KplAddress();
			if (!address.set(account)) {
				$.growl($.t("error_invalid_account"), {
					"type": "danger"
				});
			} else {
				KRS.tagged_data_search_account(account);
			}
		} else {
            KRS.tagged_data_search_account(account);
		}
	});

	$(".tagged_data_fulltext_search").on("submit", function(e) {
		e.preventDefault();
		var query = $.trim($(this).find("input[name=fs_q]").val());
		if (query != "") {
			KRS.tagged_data_search_fulltext(query);
		}
	});

	$("#tagged_data_reset").on("click", function(e) {
		e.preventDefault();
		KRS.tagged_data_search_main();
	});

	$("#tagged_data_upload").on("click", function(e) {
		e.preventDefault();
        $('#upload_data_modal').modal("show");
	});

    $("#tagged_data_view_modal").on("show.bs.modal", function(e) {
        var $invoker = $(e.relatedTarget);
        var transaction = $invoker.data("transaction");
        KRS.sendRequest("getTaggedData", {
			"transaction": transaction,
			"retrieve": "true"
		}, function (response) {
			if (response.errorCode) {
                $("#tagged_data_content").val(KRS.unescapeRespStr(response.errorDescription));
			} else {
                $("#tagged_data_content").val(KRS.unescapeRespStr(response.data));
			}
		}, { isAsync: false });
		KRS.getDownloadLink(KRS.getRequestPath() + "?requestType=downloadTaggedData&transaction=" + transaction + "&retrieve=true", $("#tagged_data_download"));
    });

    $("#extend_data_modal").on("show.bs.modal", function (e) {
        var $invoker = $(e.relatedTarget);
        var transaction = $invoker.data("transaction");
        $("#extend_data_transaction").val(transaction);
        KRS.sendRequest("getTransaction", {
            "transaction": transaction
        }, function (response) {
            var fee = KRS.convertToKPL(KRS.escapeRespStr(response.feeNQT));
            $('#extend_data_fee').val(fee);
            $('#extend_data_fee_label').html(String(fee) + " KPL");
        })
    });

	return KRS;
}(KRS || {}, jQuery));
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
var KRS = (function (KRS, $, undefined) {
    var assets;
    var assetIds;
    var closedGroups;
    var assetSearch;
    var viewingAsset;
    var currentAsset;
    var assetTradeHistoryType;
    var currentAssetID;
    var selectedApprovalAsset;

    KRS.resetAssetExchangeState = function () {
        assets = [];
        assetIds = [];
        closedGroups = [];
        assetSearch = false;
        viewingAsset = false; //viewing non-bookmarked asset
        currentAsset = {};
        assetTradeHistoryType = "everyone";
        currentAssetID = 0;
        selectedApprovalAsset = "";
    };
    KRS.resetAssetExchangeState();

    KRS.setClosedGroups = function(groups) {
        closedGroups = groups;
    };

    KRS.getCurrentAsset = function() {
        return currentAsset;
    };

    function loadAssetFromURL() {
        var page = KRS.getUrlParameter("page");
        var asset = KRS.getUrlParameter("asset");
        if (!page || page != "asset_exchange") {
            return;
        }
        if (!asset) {
            $.growl($.t("missing_asset_param"), {
                "type": "danger"
            });
            return;
        }
        page = page.escapeHTML();
        asset = asset.escapeHTML();
        KRS.sendRequest("getAsset", {
            "asset": asset
        }, function(response) {
            if (response.errorCode) {
                $.growl($.t("invalid_asset_param", { asset: asset }), {
                    "type": "danger"
                });
            } else {
                KRS.loadAsset(response, false);
            }
        });
    }

    KRS.pages.asset_exchange = function (callback) {
        $(".content.content-stretch:visible").width($(".page:visible").width());
        assets = [];
        assetIds = [];
        KRS.storageSelect("assets", null, function (error, assets) {
            //select already bookmarked assets
            $.each(assets, function (index, asset) {
                KRS.cacheAsset(asset);
            });

            //check owned assets, see if any are not yet in bookmarked assets
            if (KRS.accountInfo.unconfirmedAssetBalances) {
                var newAssetIds = [];

                $.each(KRS.accountInfo.unconfirmedAssetBalances, function (key, assetBalance) {
                    if (assetIds.indexOf(assetBalance.asset) == -1) {
                        newAssetIds.push(assetBalance.asset);
                        assetIds.push(assetBalance.asset);
                    }
                });

                //add to bookmarked assets
                if (newAssetIds.length) {
                    var qs = [];
                    for (var i = 0; i < newAssetIds.length; i++) {
                        qs.push("assets=" + encodeURIComponent(newAssetIds[i]));
                    }
                    qs = qs.join("&");
                    //first get the assets info
                    KRS.sendRequest("getAssets+", {
                        // This hack is used to manually compose the query string. The querystring param is later
                        // transformed into the actual request data before sending to the server.
                        "querystring": qs
                    }, function (response) {
                        if (response.assets && response.assets.length) {
                            KRS.saveAssetBookmarks(response.assets, function () {
                                KRS.loadAssetExchangeSidebar(callback);
                            });
                        } else {
                            KRS.loadAssetExchangeSidebar(callback);
                        }
                    });
                } else {
                    KRS.loadAssetExchangeSidebar(callback);
                }
            } else {
                KRS.loadAssetExchangeSidebar(callback);
            }
        });
        loadAssetFromURL();
    };

    KRS.cacheAsset = function (asset) {
        if (assetIds.indexOf(asset.asset) != -1) {
            return;
        }
        assetIds.push(asset.asset);
        if (!asset.groupName) {
            asset.groupName = "";
        }

        var cachedAsset = {
            "asset": String(asset.asset),
            "name": String(asset.name).toLowerCase(),
            "description": String(asset.description),
            "groupName": String(asset.groupName).toLowerCase(),
            "account": String(asset.account),
            "accountRS": String(asset.accountRS),
            "quantityQNT": String(asset.quantityQNT),
            "decimals": parseInt(asset.decimals, 10)
        };
        assets.push(cachedAsset);
    };

    KRS.forms.addAssetBookmark = function ($modal) {
        var data = KRS.getFormData($modal.find("form:first"));
        data.id = $.trim(data.id);
        if (!data.id) {
            return {
                "error": $.t("error_asset_or_account_id_required")
            };
        }

        if (!/^\d+$/.test(data.id) && !/^KPL\-/i.test(data.id)) {
            return {
                "error": $.t("error_asset_or_account_id_invalid")
            };
        }

        if (/^KPL\-/i.test(data.id)) {
            KRS.sendRequest("getAssetsByIssuer", {
                "account": data.id
            }, function (response) {
                if (response.errorCode) {
                    KRS.showModalError(KRS.translateServerError(response), $modal);
                } else {
                    if (response.assets && response.assets[0] && response.assets[0].length) {
                        KRS.saveAssetBookmarks(response.assets[0], KRS.forms.addAssetBookmarkComplete);
                    } else {
                        KRS.showModalError($.t("account_no_assets"), $modal);
                    }
                    //KRS.saveAssetIssuer(data.id);
                }
            });
        } else {
            KRS.sendRequest("getAsset", {
                "asset": data.id
            }, function (response) {
                if (response.errorCode) {
                    KRS.sendRequest("getAssetsByIssuer", {
                        "account": data.id
                    }, function (response) {
                        if (response.errorCode) {
                            KRS.showModalError(KRS.translateServerError(response), $modal);
                        } else {
                            if (response.assets && response.assets[0] && response.assets[0].length) {
                                KRS.saveAssetBookmarks(response.assets[0], KRS.forms.addAssetBookmarkComplete);
                                //KRS.saveAssetIssuer(data.id);
                            } else {
                                KRS.showModalError($.t("no_asset_found"), $modal);
                            }
                        }
                    });
                } else {
                    KRS.saveAssetBookmarks(new Array(response), KRS.forms.addAssetBookmarkComplete);
                }
            });
        }
    };

    $("#asset_exchange_bookmark_this_asset").on("click", function () {
        if (viewingAsset) {
            KRS.saveAssetBookmarks(new Array(viewingAsset), function (newAssets) {
                viewingAsset = false;
                KRS.loadAssetExchangeSidebar(function () {
                    $("#asset_exchange_sidebar").find("a[data-asset=" + newAssets[0].asset + "]").addClass("active").trigger("click");
                });
            });
        }
    });

    KRS.forms.addAssetBookmarkComplete = function (newAssets, submittedAssets) {
        assetSearch = false;
        var assetExchangeSidebar = $("#asset_exchange_sidebar");
        if (newAssets.length == 0) {
            KRS.closeModal();
            $.growl($.t("error_asset_already_bookmarked", {
                "count": submittedAssets.length
            }), {
                "type": "danger"
            });
            assetExchangeSidebar.find("a.active").removeClass("active");
            assetExchangeSidebar.find("a[data-asset=" + submittedAssets[0].asset + "]").addClass("active").trigger("click");
        } else {
            KRS.closeModal();
            var message = $.t("success_asset_bookmarked", {
                "count": newAssets.length
            });
            $.growl(message, {
                "type": "success"
            });
            KRS.loadAssetExchangeSidebar(function () {
                assetExchangeSidebar.find("a.active").removeClass("active");
                assetExchangeSidebar.find("a[data-asset=" + newAssets[0].asset + "]").addClass("active").trigger("click");
            });
        }
    };

    KRS.saveAssetBookmarks = function (assetsNew, callback) {
        var newAssetIds = [];
        var newAssets = [];

        $.each(assetsNew, function (key, asset) {
            var newAsset = {
                "asset": String(asset.asset),
                "name": String(asset.name),
                "description": String(asset.description),
                "account": String(asset.account),
                "accountRS": String(asset.accountRS),
                "quantityQNT": String(asset.quantityQNT),
                "decimals": parseInt(asset.decimals, 10),
                "groupName": ""
            };
            newAssets.push(newAsset);
            newAssetIds.push({
                "asset": String(asset.asset)
            });
        });

        KRS.storageSelect("assets", newAssetIds, function (error, existingAssets) {
            var existingIds = [];
            if (existingAssets.length) {
                $.each(existingAssets, function (index, asset) {
                    existingIds.push(asset.asset);
                });

                newAssets = $.grep(newAssets, function (v) {
                    return (existingIds.indexOf(v.asset) === -1);
                });
            }

            if (newAssets.length == 0) {
                if (callback) {
                    callback([], assets);
                }
            } else {
                KRS.storageInsert("assets", "asset", newAssets, function () {
                    $.each(newAssets, function (key, asset) {
                        asset.name = asset.name.toLowerCase();
                        assetIds.push(asset.asset);
                        assets.push(asset);
                    });

                    if (callback) {
                        //for some reason we need to wait a little or DB won't be able to fetch inserted record yet..
                        setTimeout(function () {
                            callback(newAssets, assets);
                        }, 50);
                    }
                });
            }
        });
    };

    KRS.positionAssetSidebar = function () {
        var assetExchangeSidebar = $("#asset_exchange_sidebar");
        assetExchangeSidebar.parent().css("position", "relative");
        assetExchangeSidebar.parent().css("padding-bottom", "5px");
        assetExchangeSidebar.height($(window).height() - 120);
    };

    //called on opening the asset exchange page and automatic refresh
    KRS.loadAssetExchangeSidebar = function (callback) {
        var assetExchangePage = $("#asset_exchange_page");
        var assetExchangeSidebarContent = $("#asset_exchange_sidebar_content");
        if (!assets.length) {
            KRS.pageLoaded(callback);
            assetExchangeSidebarContent.empty();
            if (!viewingAsset) {
                $("#no_asset_selected, #loading_asset_data, #no_asset_search_results, #asset_details").hide();
                $("#no_assets_available").show();
            }
            assetExchangePage.addClass("no_assets");
            return;
        }

        var rows = "";
        assetExchangePage.removeClass("no_assets");
        KRS.positionAssetSidebar();
        assets.sort(function (a, b) {
            if (!a.groupName && !b.groupName) {
                if (a.name > b.name) {
                    return 1;
                } else if (a.name < b.name) {
                    return -1;
                } else {
                    return 0;
                }
            } else if (!a.groupName) {
                return 1;
            } else if (!b.groupName) {
                return -1;
            } else if (a.groupName > b.groupName) {
                return 1;
            } else if (a.groupName < b.groupName) {
                return -1;
            } else {
                if (a.name > b.name) {
                    return 1;
                } else if (a.name < b.name) {
                    return -1;
                } else {
                    return 0;
                }
            }
        });

        var lastGroup = "";
        var ungrouped = true;
        var isClosedGroup = false;
        var isSearch = (assetSearch !== false);
        var searchResults = 0;

        for (var i = 0; i < assets.length; i++) {
            var asset = assets[i];
            if (isSearch) {
                if (assetSearch.indexOf(asset.asset) == -1) {
                    continue;
                } else {
                    searchResults++;
                }
            }

            if (asset.groupName.toLowerCase() != lastGroup) {
                var to_check = (asset.groupName ? asset.groupName : "undefined");
                isClosedGroup = closedGroups.indexOf(to_check) != -1;
                if (asset.groupName) {
                    ungrouped = false;
                    rows += "<a href='#' class='list-group-item list-group-item-header" + (asset.groupName == "Ignore List" ? " no-context" : "") + "'";
                    rows += (asset.groupName != "Ignore List" ? " data-context='asset_exchange_sidebar_group_context' " : "data-context=''");
                    rows += " data-groupname='" + KRS.escapeRespStr(asset.groupName) + "' data-closed='" + isClosedGroup + "'>";
                    rows += "<h4 class='list-group-item-heading'>" + KRS.unescapeRespStr(asset.groupName).toUpperCase().escapeHTML() + "</h4>";
                    rows += "<i class='fa fa-angle-" + (isClosedGroup ? "right" : "down") + " group_icon'></i></h4></a>";
                } else {
                    ungrouped = true;
                    rows += "<a href='#' class='list-group-item list-group-item-header no-context' data-closed='" + isClosedGroup + "'>";
                    rows += "<h4 class='list-group-item-heading'>UNGROUPED <i class='fa pull-right fa-angle-" + (isClosedGroup ? "right" : "down") + "'></i></h4>";
                    rows += "</a>";
                }
                lastGroup = asset.groupName.toLowerCase();
            }

            var ownsAsset = false;
            var ownsQuantityQNT = 0;
            if (KRS.accountInfo.assetBalances) {
                $.each(KRS.accountInfo.assetBalances, function (key, assetBalance) {
                    if (assetBalance.asset == asset.asset && assetBalance.balanceQNT != "0") {
                        ownsAsset = true;
                        ownsQuantityQNT = assetBalance.balanceQNT;
                        return false;
                    }
                });
            }

            rows += "<a href='#' class='list-group-item list-group-item-" + (ungrouped ? "ungrouped" : "grouped") + (ownsAsset ? " owns_asset" : " not_owns_asset") + "' ";
            rows += "data-cache='" + i + "' ";
            rows += "data-asset='" + KRS.escapeRespStr(asset.asset) + "'" + (!ungrouped ? " data-groupname='" + KRS.escapeRespStr(asset.groupName) + "'" : "");
            rows += (isClosedGroup ? " style='display:none'" : "") + " data-closed='" + isClosedGroup + "'>";
            rows += "<h4 class='list-group-item-heading'>" + KRS.escapeRespStr(asset.name) + "</h4>";
            rows += "<p class='list-group-item-text'><span>" + $.t('quantity') + "</span>: " + KRS.formatQuantity(ownsQuantityQNT, asset.decimals) + "</p>";
            rows += "</a>";
        }

        var exchangeSidebar = $("#asset_exchange_sidebar");
        var active = exchangeSidebar.find("a.active");
        if (active.length) {
            active = active.data("asset");
        } else {
            active = false;
        }

        assetExchangeSidebarContent.empty().append(rows);
        var assetExchangeSidebarSearch = $("#asset_exchange_sidebar_search");
        assetExchangeSidebarSearch.show();

        if (isSearch) {
            if (active && assetSearch.indexOf(active) != -1) {
                //check if currently selected asset is in search results, if so keep it at that
                exchangeSidebar.find("a[data-asset=" + active + "]").addClass("active");
            } else if (assetSearch.length == 1) {
                //if there is only 1 search result, click it
                exchangeSidebar.find("a[data-asset=" + assetSearch[0] + "]").addClass("active").trigger("click");
            }
        } else if (active) {
            exchangeSidebar.find("a[data-asset=" + active + "]").addClass("active");
        }

        if (isSearch || assets.length >= 10) {
            assetExchangeSidebarSearch.show();
        } else {
            assetExchangeSidebarSearch.hide();
        }
        if (KRS.getUrlParameter("page") && KRS.getUrlParameter("page") == "asset_exchange" && KRS.getUrlParameter("asset")) {

        } else {
        if (isSearch && assetSearch.length == 0) {
            $("#no_asset_search_results").show();
            $("#asset_details, #no_asset_selected, #no_assets_available").hide();
        } else if (!exchangeSidebar.find("a.active").length) {
            $("#no_asset_selected").show();
            $("#asset_details, #no_assets_available, #no_asset_search_results").hide();
        } else if (active) {
            $("#no_assets_available, #no_asset_selected, #no_asset_search_results").hide();
        }

        if (viewingAsset) {
            $("#asset_exchange_bookmark_this_asset").show();
        } else {
            $("#asset_exchange_bookmark_this_asset").hide();
        }
        }
        KRS.pageLoaded(callback);
    };

    KRS.incoming.asset_exchange = function () {
        var assetExchangeSidebar = $("#asset_exchange_sidebar");
        if (!viewingAsset) {
            //refresh active asset
            var $active = assetExchangeSidebar.find("a.active");

            if ($active.length) {
                $active.trigger("click", [{
                    "refresh": true
                }]);
            }
        } else {
            KRS.loadAsset(viewingAsset, true);
        }

        //update assets owned (colored)
        assetExchangeSidebar.find("a.list-group-item.owns_asset").removeClass("owns_asset").addClass("not_owns_asset");
        if (KRS.accountInfo.assetBalances) {
            $.each(KRS.accountInfo.assetBalances, function (key, assetBalance) {
                if (assetBalance.balanceQNT != "0") {
                    $("#asset_exchange_sidebar").find("a.list-group-item[data-asset=" + assetBalance.asset + "]").addClass("owns_asset").removeClass("not_owns_asset");
                }
            });
        }
    };

    $("#asset_exchange_sidebar").on("click", "a", function (e, data) {
        e.preventDefault();
        currentAssetID = String($(this).data("asset")).escapeHTML();

        //refresh is true if data is refreshed automatically by the system (when a new block arrives)
        var refresh = (data && data.refresh);

        //clicked on a group
        if (!currentAssetID) {
            var group = $(this).data("groupname");
            var closed = $(this).data("closed");

            var $links;
            if (!group) {
                $links = $("#asset_exchange_sidebar").find("a.list-group-item-ungrouped");
            } else {
                $links = $("#asset_exchange_sidebar").find("a.list-group-item-grouped[data-groupname='" + group.escapeHTML() + "']");
            }
            if (!group) {
                group = "undefined";
            }
            if (closed) {
                var pos = closedGroups.indexOf(group);
                if (pos >= 0) {
                    closedGroups.splice(pos);
                }
                $(this).data("closed", "");
                $(this).find("i").removeClass("fa-angle-right").addClass("fa-angle-down");
                $links.show();
            } else {
                closedGroups.push(group);
                $(this).data("closed", true);
                $(this).find("i").removeClass("fa-angle-down").addClass("fa-angle-right");
                $links.hide();
            }
            KRS.storageUpdate("data", {
                "contents": closedGroups.join("#")
            }, [{
                "id": "closed_groups"
            }]);
            return;
        }

        KRS.storageSelect("assets", [{
            "asset": currentAssetID
        }], function (error, asset) {
            if (asset && asset.length && asset[0].asset == currentAssetID) {
                KRS.loadAsset(asset[0], refresh);
            }
        });
    });

    KRS.loadAsset = function (asset, refresh) {
        var assetId = asset.asset;
        currentAsset = asset;
        KRS.currentSubPage = assetId;

        if (!refresh) {
            var assetExchangeSidebar = $("#asset_exchange_sidebar");
            assetExchangeSidebar.find("a.active").removeClass("active");
            assetExchangeSidebar.find("a[data-asset=" + assetId + "]").addClass("active");
            $("#no_asset_selected, #loading_asset_data, #no_assets_available, #no_asset_search_results").hide();
            //noinspection JSValidateTypes
            $("#asset_details").show().parent().animate({
                "scrollTop": 0
            }, 0);
            $("#asset_account").html(KRS.getAccountLink(asset, "account"));
            $("#asset_id").html(KRS.getTransactionLink(assetId));
            $("#asset_decimals").html(KRS.escapeRespStr(asset.decimals));
            $("#asset_name").html(KRS.escapeRespStr(asset.name));
            $("#asset_description").html(String(asset.description).autoLink());
            $(".asset_name").html(KRS.escapeRespStr(asset.name));
            $("#sell_asset_button").data("asset", assetId);
            $("#buy_asset_button").data("asset", assetId);
            $("#view_asset_distribution_link").data("asset", assetId);
            $("#sell_asset_for_kpl").html($.t("sell_asset_for_kpl", {
                "assetName": KRS.escapeRespStr(asset.name)
            }));
            $("#buy_asset_with_kpl").html($.t("buy_asset_with_kpl", {
                "assetName": KRS.escapeRespStr(asset.name)
            }));
            $("#sell_asset_price, #buy_asset_price").val("");
            $("#sell_asset_quantity, #sell_asset_total, #buy_asset_quantity, #buy_asset_total").val("0");

            var assetExchangeAskOrdersTable = $("#asset_exchange_ask_orders_table");
            var assetExchangeBidOrdersTable = $("#asset_exchange_bid_orders_table");
            var assetExchangeTradeHistoryTable = $("#asset_exchange_trade_history_table");
            assetExchangeAskOrdersTable.find("tbody").empty();
            assetExchangeBidOrdersTable.find("tbody").empty();
            assetExchangeTradeHistoryTable.find("tbody").empty();
            assetExchangeAskOrdersTable.parent().addClass("data-loading").removeClass("data-empty");
            assetExchangeBidOrdersTable.parent().addClass("data-loading").removeClass("data-empty");
            assetExchangeTradeHistoryTable.parent().addClass("data-loading").removeClass("data-empty");

            $(".data-loading img.loading").hide();

            setTimeout(function () {
                $(".data-loading img.loading").fadeIn(200);
            }, 200);

            var nrDuplicates = 0;
            $.each(assets, function (key, singleAsset) {
                if (String(singleAsset.name).toLowerCase() == String(asset.name).toLowerCase() && singleAsset.asset != assetId) {
                    nrDuplicates++;
                }
            });

            $("#asset_exchange_duplicates_warning").html($.t("asset_exchange_duplicates_warning", {
                "count": nrDuplicates
            }));

            KRS.sendRequest("getAsset", {
                "asset": assetId
            }, function (response) {
                if (!response.errorCode) {
                    if (response.asset != asset.asset || response.account != asset.account || response.accountRS != asset.accountRS || response.decimals != asset.decimals || response.description != asset.description || response.name != asset.name) {
                        KRS.storageDelete("assets", [{
                            "asset": asset.asset
                        }], function () {
                            setTimeout(function () {
                                KRS.loadPage("asset_exchange");
                                $.growl($.t("invalid asset") + " " + asset.name, {
                                    "type": "danger"
                                });
                            }, 50);
                        });
                    }
                    $("#asset_quantity").html(KRS.formatQuantity(response.quantityQNT, response.decimals));
                }
            });

            if (asset.viewingAsset) {
                $("#asset_exchange_bookmark_this_asset").show();
                viewingAsset = asset;
            } else {
                $("#asset_exchange_bookmark_this_asset").hide();
                viewingAsset = false;
            }
        }

        // Only asset issuers have the ability to pay dividends.
        if (asset.accountRS == KRS.accountRS) {
            $("#dividend_payment_link").show();
        } else {
            $("#dividend_payment_link").hide();
        }

        if (KRS.accountInfo.unconfirmedBalanceNQT == "0") {
            $("#your_kpl_balance").html("0");
            $("#buy_automatic_price").addClass("zero").removeClass("nonzero");
        } else {
            $("#your_kpl_balance").html(KRS.formatAmount(KRS.accountInfo.unconfirmedBalanceNQT));
            $("#buy_automatic_price").addClass("nonzero").removeClass("zero");
        }

        if (KRS.accountInfo.unconfirmedAssetBalances) {
            for (var i = 0; i < KRS.accountInfo.unconfirmedAssetBalances.length; i++) {
                var balance = KRS.accountInfo.unconfirmedAssetBalances[i];
                if (balance.asset == assetId) {
                    currentAsset.yourBalanceQNT = balance.unconfirmedBalanceQNT;
                    $("#your_asset_balance").html(KRS.formatQuantity(balance.unconfirmedBalanceQNT, currentAsset.decimals));
                    if (balance.unconfirmedBalanceQNT == "0") {
                        $("#sell_automatic_price").addClass("zero").removeClass("nonzero");
                    } else {
                        $("#sell_automatic_price").addClass("nonzero").removeClass("zero");
                    }
                    break;
                }
            }
        }

        if (!currentAsset.yourBalanceQNT) {
            currentAsset.yourBalanceQNT = "0";
            $("#your_asset_balance").html("0");
        }

        KRS.loadAssetOrders("ask", assetId, refresh);
        KRS.loadAssetOrders("bid", assetId, refresh);
        KRS.getAssetTradeHistory(assetId, refresh);
        KRS.getAssetDividendHistory(assetId, "asset_dividend");
    };

    function processOrders(orders, type, refresh) {
        if (orders.length) {
            var order;
            $("#" + (type == "ask" ? "sell" : "buy") + "_orders_count").html("(" + orders.length + (orders.length == 50 ? "+" : "") + ")");
            var rows = "";
            var sum = new BigInteger(String("0"));
            var quantityDecimals = KRS.getNumberOfDecimals(orders, "quantityQNT", function(val) {
                return KRS.formatQuantity(val.quantityQNT, currentAsset.decimals);
            });
            var priceDecimals = KRS.getNumberOfDecimals(orders, "priceNQT", function(val) {
                return KRS.formatOrderPricePerWholeQNT(val.priceNQT, currentAsset.decimals);
            });
            var amountDecimals = KRS.getNumberOfDecimals(orders, "totalNQT", function(val) {
                return KRS.formatAmount(KRS.calculateOrderTotalNQT(val.quantityQNT, val.priceNQT));
            });
            for (var i = 0; i < orders.length; i++) {
                order = orders[i];
                order.priceNQT = new BigInteger(order.priceNQT);
                order.quantityQNT = new BigInteger(order.quantityQNT);
                order.totalNQT = new BigInteger(KRS.calculateOrderTotalNQT(order.quantityQNT, order.priceNQT));
                sum = sum.add(order.totalNQT);
                if (i == 0 && !refresh) {
                    $("#" + (type == "ask" ? "buy" : "sell") + "_asset_price").val(KRS.calculateOrderPricePerWholeQNT(order.priceNQT, currentAsset.decimals));
                }
                var statusIcon = KRS.getTransactionStatusIcon(order);
                var className = (order.account == KRS.account ? "your-order" : "");
                rows += "<tr class='" + className + "' data-transaction='" + KRS.escapeRespStr(order.order) + "' data-quantity='" + order.quantityQNT.toString().escapeHTML() + "' data-price='" + order.priceNQT.toString().escapeHTML() + "'>" +
                    "<td>" + KRS.getTransactionLink(order.order, statusIcon, true) + "</td>" +
                    "<td>" + KRS.getAccountLink(order, "account", currentAsset.accountRS, "asset_issuer") + "</td>" +
                    "<td class='numeric'>" + KRS.formatQuantity(order.quantityQNT, currentAsset.decimals, false, quantityDecimals) + "</td>" +
                    "<td class='numeric'>" + KRS.formatOrderPricePerWholeQNT(order.priceNQT, currentAsset.decimals, priceDecimals) + "</td>" +
                    "<td class='numeric'>" + KRS.formatAmount(order.totalNQT, false, false, amountDecimals) + "</td>" +
                    "<td class='numeric'>" + KRS.formatAmount(sum, false, false, amountDecimals) + "</td>" +
                "</tr>";
            }
            $("#asset_exchange_" + type + "_orders_table tbody").empty().append(rows);
        } else {
            $("#asset_exchange_" + type + "_orders_table tbody").empty();
            if (!refresh) {
                $("#" + (type == "ask" ? "buy" : "sell") + "_asset_price").val("0");
            }
            $("#" + (type == "ask" ? "sell" : "buy") + "_orders_count").html("");
        }
        KRS.dataLoadFinished($("#asset_exchange_" + type + "_orders_table"), !refresh);
    }

    KRS.loadAssetOrders = function (type, assetId, refresh) {
        type = type.toLowerCase();
        var params = {
            "asset": assetId,
            "firstIndex": 0,
            "lastIndex": 25
        };
        async.parallel([
            function(callback) {
                params["showExpectedCancellations"] = "true";
                KRS.sendRequest("get" + type.capitalize() + "Orders+" + assetId, params, function (response) {
                    var orders = response[type + "Orders"];
                    if (!orders) {
                        orders = [];
                    }
                    callback(null, orders);
                })
            },
            function(callback) {
                KRS.sendRequest("getExpected" + type.capitalize() + "Orders+" + assetId, params, function (response) {
                    var orders = response[type + "Orders"];
                    if (!orders) {
                        orders = [];
                    }
                    callback(null, orders);
                })
            }
        ],
        // invoked when both the requests above has completed
        // the results array contains both order lists
        function(err, results) {
            if (err) {
                KRS.logConsole(err);
                return;
            }
            var orders = results[0].concat(results[1]);
            orders.sort(function (a, b) {
                if (type == "ask") {
                    return a.priceNQT - b.priceNQT;
                } else {
                    return b.priceNQT - a.priceNQT;
                }
            });
            processOrders(orders, type, refresh);
        });
    };

    KRS.getAssetDividendHistory = function (assetId, table) {
        var assetExchangeDividendHistoryTable = $("#" + table + "table");
        assetExchangeDividendHistoryTable.find("tbody").empty();
        assetExchangeDividendHistoryTable.parent().addClass("data-loading").removeClass("data-empty");
        var options = {
            "asset": assetId
        };
        var view = KRS.simpleview.get(table, {
            errorMessage: null,
            isLoading: true,
            isEmpty: false,
            data: []
        });
        KRS.sendRequest("getAssetDividends+", options, function (response) {
            var dividends = response.dividends;
            var amountDecimals = KRS.getNumberOfDecimals(dividends, "totalDividend", function(val) {
                return KRS.formatAmount(val.totalDividend);
            });
            var accountsDecimals = KRS.getNumberOfDecimals(dividends, "numberOfAccounts", function(val) {
                return KRS.formatAmount(val.numberOfAccounts);
            });
            var amountNQTPerQNTDecimals = KRS.getNumberOfDecimals(dividends, "amountNQTPerQNT", function(val) {
                return KRS.formatOrderPricePerWholeQNT(val.amountNQTPerQNT, currentAsset.decimals);
            });
            for (var i = 0; i < dividends.length; i++) {
                var dividend = dividends[i];
                dividend.numberOfAccounts = new BigInteger(dividend.numberOfAccounts.toString());
                dividend.amountNQTPerQNT = new BigInteger(dividend.amountNQTPerQNT);
                dividend.totalDividend = new BigInteger(dividend.totalDividend);
                view.data.push({
                    "timestamp": KRS.getTransactionLink(dividend.assetDividend, KRS.formatTimestamp(dividend.timestamp)),
                    "dividend_height": String(dividend.dividendHeight).escapeHTML(),
                    "total": KRS.formatAmount(dividend.totalDividend, false, false, amountDecimals),
                    "accounts": KRS.formatQuantity(dividend.numberOfAccounts, false, false, accountsDecimals),
                    "amount_per_share": KRS.formatOrderPricePerWholeQNT(dividend.amountNQTPerQNT, currentAsset.decimals, amountNQTPerQNTDecimals)
                })
            }
            view.render({
                isLoading: false,
                isEmpty: view.data.length == 0
            });
            KRS.pageLoaded();
        });
    };

    KRS.getAssetTradeHistory = function (assetId, refresh) {
        var options = {
            "asset": assetId,
            "firstIndex": 0,
            "lastIndex": 50
        };

        if (assetTradeHistoryType == "you") {
            options["account"] = KRS.accountRS;
        }

        KRS.sendRequest("getTrades+" + assetId, options, function (response) {
            var exchangeTradeHistoryTable = $("#asset_exchange_trade_history_table");
            if (response.trades && response.trades.length) {
                var trades = response.trades;
                var rows = "";
                var quantityDecimals = KRS.getNumberOfDecimals(trades, "quantityQNT", function(val) {
                    return KRS.formatQuantity(val.quantityQNT, currentAsset.decimals);
                });
                var priceDecimals = KRS.getNumberOfDecimals(trades, "priceNQT", function(val) {
                    return KRS.formatOrderPricePerWholeQNT(val.priceNQT, currentAsset.decimals);
                });
                var amountDecimals = KRS.getNumberOfDecimals(trades, "sum", function(val) {
                    return KRS.formatAmount(KRS.calculateOrderTotalNQT(val.quantityQNT, val.priceNQT));
                });
                for (var i = 0; i < trades.length; i++) {
                    var trade = trades[i];
                    trade.priceNQT = new BigInteger(trade.priceNQT);
                    trade.quantityQNT = new BigInteger(trade.quantityQNT);
                    trade.totalNQT = new BigInteger(KRS.calculateOrderTotalNQT(trade.priceNQT, trade.quantityQNT));
                    rows += "<tr>" +
                        "<td>" + KRS.getTransactionLink(trade.bidOrder, KRS.formatTimestamp(trade.timestamp)) + "</td>" +
                        "<td>" + $.t(trade.tradeType) + "</td>" +
                        "<td class='numeric'>" + KRS.formatQuantity(trade.quantityQNT, currentAsset.decimals, false, quantityDecimals) + "</td>" +
                        "<td class='asset_price numeric'>" + KRS.formatOrderPricePerWholeQNT(trade.priceNQT, currentAsset.decimals, priceDecimals) + "</td>" +
                        "<td style='text-align:right;color:";
                        if (trade.buyer == KRS.account && trade.buyer != trade.seller) {
                            rows += "red";
                        } else if (trade.seller == KRS.account && trade.buyer != trade.seller) {
                            rows += "green";
                        } else {
                            rows += "black";
                        }
                    rows += "'>" + KRS.formatAmount(trade.totalNQT, false, false, amountDecimals) + "</td>" +
                        "<td>" + KRS.getAccountLink(trade, "buyer", currentAsset.accountRS, "asset_issuer") + "</td>" +
                        "<td>" + KRS.getAccountLink(trade, "seller", currentAsset.accountRS, "asset_issuer") + "</td>" +
                    "</tr>";
                }
                exchangeTradeHistoryTable.find("tbody").empty().append(rows);
                KRS.dataLoadFinished(exchangeTradeHistoryTable, !refresh);
            } else {
                exchangeTradeHistoryTable.find("tbody").empty();
                KRS.dataLoadFinished(exchangeTradeHistoryTable, !refresh);
            }
        });
    };

    $("#asset_exchange_trade_history_type").find(".btn").click(function (e) {
        e.preventDefault();
        assetTradeHistoryType = $(this).data("type");
        KRS.getAssetTradeHistory(currentAsset.asset, true);
    });

    var assetExchangeSearch = $("#asset_exchange_search");
    assetExchangeSearch.on("submit", function (e) {
        e.preventDefault();
        $("#asset_exchange_search").find("input[name=q]").trigger("input");
    });

    assetExchangeSearch.find("input[name=q]").on("input", function () {
        var input = $.trim($(this).val()).toLowerCase();
        if (!input) {
            assetSearch = false;
            KRS.loadAssetExchangeSidebar();
            $("#asset_exchange_clear_search").hide();
        } else {
            assetSearch = [];
            if (/KPL\-/i.test(input)) {
                $.each(assets, function (key, asset) {
                    if (asset.accountRS.toLowerCase() == input || asset.accountRS.toLowerCase().indexOf(input) !== -1) {
                        assetSearch.push(asset.asset);
                    }
                });
            } else {
                $.each(assets, function (key, asset) {
                    if (asset.account == input || asset.asset == input || asset.name.toLowerCase().indexOf(input) !== -1) {
                        assetSearch.push(asset.asset);
                    }
                });
            }

            KRS.loadAssetExchangeSidebar();
            $("#asset_exchange_clear_search").show();
            $("#asset_exchange_show_type").hide();
        }
    });

    $("#asset_exchange_clear_search").on("click", function () {
        var assetExchangeSearch = $("#asset_exchange_search");
        assetExchangeSearch.find("input[name=q]").val("");
        assetExchangeSearch.trigger("submit");
    });

    $("#buy_asset_box .box-header, #sell_asset_box .box-header").click(function (e) {
        e.preventDefault();
        //Find the box parent
        var box = $(this).parents(".box").first();
        //Find the body and the footer
        var bf = box.find(".box-body, .box-footer");
        if (!box.hasClass("collapsed-box")) {
            box.addClass("collapsed-box");
            $(this).find(".btn i.fa").removeClass("fa-minus").addClass("fa-plus");
            bf.slideUp();
        } else {
            box.removeClass("collapsed-box");
            bf.slideDown();
            $(this).find(".btn i.fa").removeClass("fa-plus").addClass("fa-minus");
        }
    });

    $("#asset_exchange_bid_orders_table tbody, #asset_exchange_ask_orders_table tbody").on("click", "td", function (e) {
        var $target = $(e.target);
        var targetClass = $target.prop("class");
        if ($target.prop("tagName").toLowerCase() == "a" || (targetClass && targetClass.indexOf("fa") == 0)) {
            return;
        }

        var type = ($target.closest("table").attr("id") == "asset_exchange_bid_orders_table" ? "sell" : "buy");
        var $tr = $target.closest("tr");
        try {
            var priceNQT = new BigInteger(String($tr.data("price")));
            var quantityQNT = new BigInteger(String($tr.data("quantity")));
            var totalNQT = new BigInteger(KRS.calculateOrderTotalNQT(quantityQNT, priceNQT));

            $("#" + type + "_asset_price").val(KRS.calculateOrderPricePerWholeQNT(priceNQT, currentAsset.decimals));
            $("#" + type + "_asset_quantity").val(KRS.convertToQNTf(quantityQNT, currentAsset.decimals));
            $("#" + type + "_asset_total").val(KRS.convertToKPL(totalNQT));
        } catch (err) {
            return;
        }

        if (type == "buy") {
            try {
                var balanceNQT = new BigInteger(KRS.accountInfo.unconfirmedBalanceNQT);
            } catch (err) {
                return;
            }

            if (totalNQT.compareTo(balanceNQT) > 0) {
                $("#" + type + "_asset_total").css({
                    "background": "#ED4348",
                    "color": "white"
                });
            } else {
                $("#" + type + "_asset_total").css({
                    "background": "",
                    "color": ""
                });
            }
        }

        var box = $("#" + type + "_asset_box");
        if (box.hasClass("collapsed-box")) {
            box.removeClass("collapsed-box");
            box.find(".box-body").slideDown();
            $("#" + type + "_asset_box .box-header").find(".btn i.fa").removeClass("fa-plus").addClass("fa-minus");
        }
    });

    $("#sell_automatic_price, #buy_automatic_price").on("click", function () {
        try {
            var type = ($(this).attr("id") == "sell_automatic_price" ? "sell" : "buy");
            var assetPrice = $("#" + type + "_asset_price");
            var price = new Big(KRS.convertToNQT(String(assetPrice.val())));
            var balanceNQT = new Big(KRS.accountInfo.unconfirmedBalanceNQT);
            var maxQuantity = new Big(KRS.convertToQNTf(currentAsset.quantityQNT, currentAsset.decimals));
            if (balanceNQT.cmp(new Big("0")) <= 0) {
                return;
            }

            if (price.cmp(new Big("0")) <= 0) {
                //get minimum price if no offers exist, based on asset decimals..
                price = new Big("" + Math.pow(10, currentAsset.decimals));
                assetPrice.val(KRS.convertToKPL(price.toString()));
            }

            var quantity;
            if (type == "sell") {
                quantity = new Big(currentAsset.yourBalanceQNT ? KRS.convertToQNTf(currentAsset.yourBalanceQNT, currentAsset.decimals) : "0");
            } else {
                quantity = new Big(KRS.amountToPrecision(balanceNQT.div(price).toString(), currentAsset.decimals));
            }
            var total = quantity.times(price);

            //proposed quantity is bigger than available quantity
            if (type == "buy" && quantity.cmp(maxQuantity) == 1) {
                quantity = maxQuantity;
                total = quantity.times(price);
            }

            $("#" + type + "_asset_quantity").val(quantity.toString());
            var assetTotal = $("#" + type + "_asset_total");
            assetTotal.val(KRS.convertToKPL(total.toString()));
            assetTotal.css({
                "background": "",
                "color": ""
            });
        } catch (err) {
            KRS.logConsole(err.message);
        }
    });

    $("#buy_asset_quantity, #buy_asset_price, #sell_asset_quantity, #sell_asset_price").keydown(function (e) {
        var charCode = !e.charCode ? e.which : e.charCode;
        if (KRS.isControlKey(charCode) || e.ctrlKey || e.metaKey) {
            return;
        }
        var isQuantityField = /_quantity/i.test($(this).attr("id"));
        var decimals = currentAsset.decimals;
        var maxFractionLength = (isQuantityField ? decimals : 8 - decimals);
        KRS.validateDecimals(maxFractionLength, charCode, $(this).val(), e);
    });

    //calculate preview price (calculated on every keypress)
    $("#sell_asset_quantity, #sell_asset_price, #buy_asset_quantity, #buy_asset_price").keyup(function () {
        var orderType = $(this).data("type").toLowerCase();
        try {
            var quantityQNT = new BigInteger(KRS.convertToQNT(String($("#" + orderType + "_asset_quantity").val()), currentAsset.decimals));
            var priceNQT = new BigInteger(KRS.calculatePricePerWholeQNT(KRS.convertToNQT(String($("#" + orderType + "_asset_price").val())), currentAsset.decimals));

            if (priceNQT.toString() == "0" || quantityQNT.toString() == "0") {
                $("#" + orderType + "_asset_total").val("0");
            } else {
                var total = KRS.calculateOrderTotal(quantityQNT, priceNQT, currentAsset.decimals);
                $("#" + orderType + "_asset_total").val(total.toString());
            }
        } catch (err) {
            $("#" + orderType + "_asset_total").val("0");
        }
    });

    $("#asset_order_modal").on("show.bs.modal", function (e) {
        var $invoker = $(e.relatedTarget);
        var orderType = $invoker.data("type");
        var assetId = $invoker.data("asset");
        $("#asset_order_modal_button").html(orderType + " Asset").data("resetText", orderType + " Asset");
        $(".asset_order_modal_type").html(orderType);

        orderType = orderType.toLowerCase();
        try {
            var quantity = String($("#" + orderType + "_asset_quantity").val());
            var quantityQNT = new BigInteger(KRS.convertToQNT(quantity, currentAsset.decimals));
            var priceNQT = new BigInteger(KRS.calculatePricePerWholeQNT(KRS.convertToNQT(String($("#" + orderType + "_asset_price").val())), currentAsset.decimals));
            var totalKPL = KRS.formatAmount(KRS.calculateOrderTotalNQT(quantityQNT, priceNQT, currentAsset.decimals), false, true);
        } catch (err) {
            $.growl($.t("error_invalid_input"), {
                "type": "danger"
            });
            return e.preventDefault();
        }

        if (priceNQT.toString() == "0" || quantityQNT.toString() == "0") {
            $.growl($.t("error_amount_price_required"), {
                "type": "danger"
            });
            return e.preventDefault();
        }

        var priceNQTPerWholeQNT = priceNQT.multiply(new BigInteger("" + Math.pow(10, currentAsset.decimals)));
        var description;
        var tooltipTitle;
        if (orderType == "buy") {
            description = $.t("buy_order_description", {
                "quantity": KRS.formatQuantity(quantityQNT, currentAsset.decimals, true),
                "asset_name": $("#asset_name").html().escapeHTML(),
                "kpl": KRS.formatAmount(priceNQTPerWholeQNT)
            });
            tooltipTitle = $.t("buy_order_description_help", {
                "kpl": KRS.formatAmount(priceNQTPerWholeQNT, false, true),
                "total_kpl": totalKPL
            });
        } else {
            description = $.t("sell_order_description", {
                "quantity": KRS.formatQuantity(quantityQNT, currentAsset.decimals, true),
                "asset_name": $("#asset_name").html().escapeHTML(),
                "kpl": KRS.formatAmount(priceNQTPerWholeQNT)
            });
            tooltipTitle = $.t("sell_order_description_help", {
                "kpl": KRS.formatAmount(priceNQTPerWholeQNT, false, true),
                "total_kpl": totalKPL
            });
        }

        $("#asset_order_description").html(description);
        $("#asset_order_total").html(totalKPL + " KPL");

        var assetOrderTotalTooltip = $("#asset_order_total_tooltip");
        if (quantity != "1") {
            assetOrderTotalTooltip.show();
            assetOrderTotalTooltip.popover("destroy");
            assetOrderTotalTooltip.data("content", tooltipTitle);
            assetOrderTotalTooltip.popover({
                "content": tooltipTitle,
                "trigger": "hover"
            });
        } else {
            assetOrderTotalTooltip.hide();
        }

        $("#asset_order_type").val((orderType == "buy" ? "placeBidOrder" : "placeAskOrder"));
        $("#asset_order_asset").val(assetId);
        $("#asset_order_quantity").val(quantityQNT.toString());
        $("#asset_order_price").val(priceNQT.toString());
    });

    KRS.forms.orderAsset = function () {
        var orderType = $("#asset_order_type").val();
        if (orderType == "placeBidOrder" && KRS.isShowFakeWarning()) {
            return KRS.composeFakeWarning($.t("asset"), $("#asset_order_asset").val());
        }
        return {
            "requestType": orderType,
            "successMessage": (orderType == "placeBidOrder" ? $.t("success_buy_order_asset") : $.t("success_sell_order_asset")),
            "errorMessage": $.t("error_order_asset")
        };
    };

    KRS.forms.issueAsset = function ($modal) {
        var data = KRS.getFormData($modal.find("form:first"));
        data.description = $.trim(data.description);
        if (!data.description) {
            return {
                "error": $.t("error_description_required")
            };
        } else if (!/^\d+$/.test(data.quantity)) {
            return {
                "error": $.t("error_whole_quantity")
            };
        } else {
            data.quantityQNT = String(data.quantity);
            if (data.decimals == "") {
                data.decimals = "0";
            }
            if (data.decimals > 0) {
                for (var i = 0; i < data.decimals; i++) {
                    data.quantityQNT += "0";
                }
            }
            delete data.quantity;
            return {
                "data": data
            };
        }
    };

    KRS.getAssetAccounts = function (assetId, height, success, error) {
        KRS.sendRequest("getAssetAccounts", {"asset": assetId, "height": height}, function (response) {
            if (response.errorCode) {
                error(response);
            } else {
                success(response);
            }
        }, { isAsync: false });
    };

    $("#asset_exchange_sidebar_group_context").on("click", "a", function (e) {
        e.preventDefault();
        var groupName = KRS.selectedContext.data("groupname");
        var option = $(this).data("option");
        if (option == "change_group_name") {
            $("#asset_exchange_change_group_name_old_display").html(groupName.escapeHTML());
            $("#asset_exchange_change_group_name_old").val(groupName);
            $("#asset_exchange_change_group_name_new").val("");
            $("#asset_exchange_change_group_name_modal").modal("show");
        }
    });

    KRS.forms.assetExchangeChangeGroupName = function () {
        var oldGroupName = $("#asset_exchange_change_group_name_old").val();
        var newGroupName = $("#asset_exchange_change_group_name_new").val();
        if (!newGroupName.match(/^[a-z0-9 ]+$/i)) {
            return {
                "error": $.t("error_group_name")
            };
        }

        KRS.storageUpdate("assets", {
            "groupName": newGroupName
        }, [{
            "groupName": oldGroupName
        }], function () {
            setTimeout(function () {
                KRS.loadPage("asset_exchange");
                $.growl($.t("success_group_name_update"), {
                    "type": "success"
                });
            }, 50);
        });

        return {
            "stop": true
        };
    };

    $("#asset_exchange_sidebar_context").on("click", "a", function (e) {
        e.preventDefault();
        var assetId = KRS.selectedContext.data("asset");
        var option = $(this).data("option");
        KRS.closeContextMenu();
        if (option == "add_to_group") {
            $("#asset_exchange_group_asset").val(assetId);
            KRS.storageSelect("assets", [{
                "asset": assetId
            }], function (error, asset) {
                asset = asset[0];
                $("#asset_exchange_group_title").html(KRS.escapeRespStr(asset.name));
                KRS.storageSelect("assets", [], function (error, assets) {
                    var groupNames = [];
                    $.each(assets, function (index, asset) {
                        if (asset.groupName && $.inArray(asset.groupName, groupNames) == -1) {
                            groupNames.push(asset.groupName);
                        }
                    });
                    groupNames.sort(function (a, b) {
                        if (a.toLowerCase() > b.toLowerCase()) {
                            return 1;
                        } else if (a.toLowerCase() < b.toLowerCase()) {
                            return -1;
                        } else {
                            return 0;
                        }
                    });

                    var groupSelect = $("#asset_exchange_group_group");
                    groupSelect.empty();
                    $.each(groupNames, function (index, groupName) {
                        var selectedAttr = (asset.groupName && asset.groupName.toLowerCase() == groupName.toLowerCase() ? "selected='selected'" : "");
                        groupSelect.append("<option value='" + groupName.escapeHTML() + "' " + selectedAttr + ">" + groupName.escapeHTML() + "</option>");
                    });
                    var selectedAttr = (!asset.groupName ? "selected='selected'" : "");
                    groupSelect.append("<option value='0' " + selectedAttr + ">None</option>");
                    groupSelect.append("<option value='-1'>New group</option>");
                    $("#asset_exchange_group_modal").modal("show");
                });
            });
        } else if (option == "remove_from_group") {
            KRS.storageUpdate("assets", {
                "groupName": ""
            }, [{
                "asset": assetId
            }], function () {
                setTimeout(function () {
                    KRS.loadPage("asset_exchange");
                    $.growl($.t("success_asset_group_removal"), {
                        "type": "success"
                    });
                }, 50);
            });
        } else if (option == "remove_from_bookmarks") {
            var ownsAsset = false;
            if (KRS.accountInfo.unconfirmedAssetBalances) {
                $.each(KRS.accountInfo.unconfirmedAssetBalances, function (key, assetBalance) {
                    if (assetBalance.asset == assetId) {
                        ownsAsset = true;
                        return false;
                    }
                });
            }

            if (ownsAsset) {
                $.growl($.t("error_owned_asset_no_removal"), {
                    "type": "danger"
                });
            } else {
                KRS.storageDelete("assets", [{
                    "asset": assetId
                }], function () {
                    setTimeout(function () {
                        KRS.loadPage("asset_exchange");
                        $.growl($.t("success_asset_bookmark_removal"), {
                            "type": "success"
                        });
                    }, 50);
                });
            }
        }
    });

    $("#asset_exchange_group_group").on("change", function () {
        var value = $(this).val();
        if (value == -1) {
            $("#asset_exchange_group_new_group_div").show();
        } else {
            $("#asset_exchange_group_new_group_div").hide();
        }
    });

    KRS.forms.assetExchangeGroup = function () {
        var assetId = $("#asset_exchange_group_asset").val();
        var groupName = $("#asset_exchange_group_group").val();
        if (groupName == 0) {
            groupName = "";
        } else if (groupName == -1) {
            groupName = $("#asset_exchange_group_new_group").val();
        }

        KRS.storageUpdate("assets", {
            "groupName": groupName
        }, [{
            "asset": assetId
        }], function () {
            setTimeout(function () {
                KRS.loadPage("asset_exchange");
                if (!groupName) {
                    $.growl($.t("success_asset_group_removal"), {
                        "type": "success"
                    });
                } else {
                    $.growl($.t("success_asset_group_add"), {
                        "type": "success"
                    });
                }
            }, 50);
        });

        return {
            "stop": true
        };
    };

    $("#asset_exchange_group_modal").on("hidden.bs.modal", function () {
        $("#asset_exchange_group_new_group_div").val("").hide();
    });

    /* TRADE HISTORY PAGE */
    KRS.pages.trade_history = function () {
        KRS.sendRequest("getTrades+", {
            "account": KRS.accountRS,
            "includeAssetInfo": true,
            "firstIndex": KRS.pageNumber * KRS.itemsPerPage - KRS.itemsPerPage,
            "lastIndex": KRS.pageNumber * KRS.itemsPerPage
        }, function (response) {
            if (response.trades && response.trades.length) {
                if (response.trades.length > KRS.itemsPerPage) {
                    KRS.hasMorePages = true;
                    response.trades.pop();
                }
                var trades = response.trades;
                var quantityDecimals = KRS.getNumberOfDecimals(trades, "quantityQNT", function(val) {
                    return KRS.formatQuantity(val.quantityQNT, val.decimals);
                });
                var priceDecimals = KRS.getNumberOfDecimals(trades, "priceNQT", function(val) {
                    return KRS.formatOrderPricePerWholeQNT(val.priceNQT, val.decimals);
                });
                var amountDecimals = KRS.getNumberOfDecimals(trades, "totalNQT", function(val) {
                    return KRS.formatAmount(KRS.calculateOrderTotalNQT(val.quantityQNT, val.priceNQT));
                });
                var rows = "";
                for (var i = 0; i < trades.length; i++) {
                    var trade = trades[i];
                    trade.priceNQT = new BigInteger(trade.priceNQT);
                    trade.quantityQNT = new BigInteger(trade.quantityQNT);
                    trade.totalNQT = new BigInteger(KRS.calculateOrderTotalNQT(trade.priceNQT, trade.quantityQNT));
                    var type = (trade.buyerRS == KRS.accountRS ? "buy" : "sell");
                    rows += "<tr>" +
                        "<td><a href='#' data-goto-asset='" + KRS.escapeRespStr(trade.asset) + "'>" + KRS.escapeRespStr(trade.name) + "</a></td>" +
                        "<td>" + KRS.formatTimestamp(trade.timestamp) + "</td>" +
                        "<td>" + $.t(trade.tradeType) + "</td>" +
                        "<td class='numeric'>" + KRS.formatQuantity(trade.quantityQNT, trade.decimals, false, quantityDecimals) + "</td>" +
                        "<td class='asset_price numeric'>" + KRS.formatOrderPricePerWholeQNT(trade.priceNQT, trade.decimals, priceDecimals) + "</td>" +
                        "<td style='" + (type == "buy" ? "color:red" : "color:green") + "' class='numeric'>" + KRS.formatAmount(trade.totalNQT, false, false, amountDecimals) + "</td>" +
                        "<td>" + KRS.getAccountLink(trade, "buyer") + "</td>" +
                        "<td>" + KRS.getAccountLink(trade, "seller") + "</td>" +
                    "</tr>";
                }
                KRS.dataLoaded(rows);
            } else {
                KRS.dataLoaded();
            }
        });
    };

    /* TRANSFER HISTORY PAGE */
    KRS.pages.transfer_history = function () {
        KRS.sendRequest("getAssetTransfers+", {
            "account": KRS.accountRS,
            "includeAssetInfo": true,
            "firstIndex": KRS.pageNumber * KRS.itemsPerPage - KRS.itemsPerPage,
            "lastIndex": KRS.pageNumber * KRS.itemsPerPage
        }, function (response) {
            if (response.transfers && response.transfers.length) {
                if (response.transfers.length > KRS.itemsPerPage) {
                    KRS.hasMorePages = true;
                    response.transfers.pop();
                }
                var transfers = response.transfers;
                var quantityDecimals = KRS.getNumberOfDecimals(transfers, "quantityQNT", function(val) {
                    return KRS.formatQuantity(val.quantityQNT, val.decimals);
                });
                var rows = "";
                for (var i = 0; i < transfers.length; i++) {
                    var transfer = transfers[i];
                    transfer.quantityQNT = new BigInteger(transfer.quantityQNT);
                    var type = (transfer.recipientRS == KRS.accountRS ? "receive" : "send");
                    rows += "<tr>" +
                        "<td>" + KRS.getTransactionLink(transfer.assetTransfer) + "</td>" +
                        "<td><a href='#' data-goto-asset='" + KRS.escapeRespStr(transfer.asset) + "'>" + KRS.escapeRespStr(transfer.name) + "</a></td>" +
                        "<td>" + KRS.formatTimestamp(transfer.timestamp) + "</td>" +
                        "<td style='" + (type == "receive" ? "color:green" : "color:red") + "' class='numeric'>" + KRS.formatQuantity(transfer.quantityQNT, transfer.decimals, false, quantityDecimals) + "</td>" +
                        "<td>" + KRS.getAccountLink(transfer, "recipient") + "</td>" +
                        "<td>" + KRS.getAccountLink(transfer, "sender") + "</td>" +
                    "</tr>";
                }
                KRS.dataLoaded(rows);
            } else {
                KRS.dataLoaded();
            }
        });
    };

    /* DELETES HISTORY PAGE */
    KRS.pages.deletes_history = function () {
        KRS.sendRequest("getAssetDeletes+", {
            "account": KRS.accountRS,
            "includeAssetInfo": true,
            "firstIndex": KRS.pageNumber * KRS.itemsPerPage - KRS.itemsPerPage,
            "lastIndex": KRS.pageNumber * KRS.itemsPerPage
        }, function (response) {
            if (response.deletes && response.deletes.length) {
                if (response.deletes.length > KRS.itemsPerPage) {
                    KRS.hasMorePages = true;
                    response.deletes.pop();
                }
                var deletes = response.deletes;
                var quantityDecimals = KRS.getNumberOfDecimals(deletes, "quantityQNT", function(val) {
                    return KRS.formatQuantity(val.quantityQNT, val.decimals);
                });
                var rows = "";
                for (var i = 0; i < deletes.length; i++) {
                    deletes[i].quantityQNT = new BigInteger(deletes[i].quantityQNT);
                    rows += "<tr>" +
                        "<td>" + KRS.getTransactionLink(deletes[i].assetDelete) + "</td>" +
                        "<td><a href='#' data-goto-asset='" + KRS.escapeRespStr(deletes[i].asset) + "'>" + KRS.escapeRespStr(deletes[i].name) + "</a></td>" +
                        "<td>" + KRS.formatTimestamp(deletes[i].timestamp) + "</td>" +
                        "<td class='numeric'>" + KRS.formatQuantity(deletes[i].quantityQNT, deletes[i].decimals, false, quantityDecimals) + "</td>" +
                    "</tr>";
                }
                KRS.dataLoaded(rows);
            } else {
                KRS.dataLoaded();
            }
        });
    };

    /* MY ASSETS PAGE */
    KRS.pages.my_assets = function () {
        if (KRS.accountInfo.assetBalances && KRS.accountInfo.assetBalances.length) {
            var result = {
                "assets": [],
                "bid_orders": {},
                "ask_orders": {}
            };
            var count = {
                "total_assets": KRS.accountInfo.assetBalances.length,
                "assets": 0,
                "ignored_assets": 0,
                "ask_orders": 0,
                "bid_orders": 0
            };

            for (var i = 0; i < KRS.accountInfo.assetBalances.length; i++) {
                if (KRS.accountInfo.assetBalances[i].balanceQNT == "0") {
                    count.ignored_assets++;
                    if (KRS.checkMyAssetsPageLoaded(count)) {
                        KRS.myAssetsPageLoaded(result);
                    }
                    continue;
                }

                KRS.sendRequest("getAskOrders+", {
                    "asset": KRS.accountInfo.assetBalances[i].asset,
                    "firstIndex": 0,
                    "lastIndex": 1
                }, function (response, input) {
                    if (KRS.currentPage != "my_assets") {
                        return;
                    }

                    if (response.askOrders && response.askOrders.length) {
                        result.ask_orders[input.asset] = new BigInteger(response.askOrders[0].priceNQT);
                    } else {
                        result.ask_orders[input.asset] = -1;
                    }

                    count.ask_orders++;
                    if (KRS.checkMyAssetsPageLoaded(count)) {
                        KRS.myAssetsPageLoaded(result);
                    }
                });

                KRS.sendRequest("getBidOrders+", {
                    "asset": KRS.accountInfo.assetBalances[i].asset,
                    "firstIndex": 0,
                    "lastIndex": 1
                }, function (response, input) {
                    if (KRS.currentPage != "my_assets") {
                        return;
                    }

                    if (response.bidOrders && response.bidOrders.length) {
                        result.bid_orders[input.asset] = new BigInteger(response.bidOrders[0].priceNQT);
                    } else {
                        result.bid_orders[input.asset] = -1;
                    }

                    count.bid_orders++;

                    if (KRS.checkMyAssetsPageLoaded(count)) {
                        KRS.myAssetsPageLoaded(result);
                    }
                });

                KRS.sendRequest("getAsset+", {
                    "asset": KRS.accountInfo.assetBalances[i].asset,
                    "_extra": {
                        "balanceQNT": KRS.accountInfo.assetBalances[i].balanceQNT
                    }
                }, function (asset, input) {
                    if (KRS.currentPage != "my_assets") {
                        return;
                    }

                    asset.asset = input.asset;
                    asset.balanceQNT = new BigInteger(input["_extra"].balanceQNT);
                    asset.quantityQNT = new BigInteger(asset.quantityQNT);
                    asset.ask_orders = result.ask_orders[asset.asset];
                    asset.bid_orders = result.bid_orders[asset.asset];

                    result.assets[count.assets] = asset;
                    count.assets++;

                    if (KRS.checkMyAssetsPageLoaded(count)) {
                        KRS.myAssetsPageLoaded(result);
                    }
                });
            }
        } else {
            KRS.dataLoaded();
        }
    };

    KRS.checkMyAssetsPageLoaded = function (count) {
        return count.assets + count.ignored_assets == count.total_assets && count.assets == count.ask_orders && count.assets == count.bid_orders;
    };

    KRS.myAssetsPageLoaded = function (result) {
        var rows = "";
        result.assets.sort(function (a, b) {
            if (a.name.toLowerCase() > b.name.toLowerCase()) {
                return 1;
            } else if (a.name.toLowerCase() < b.name.toLowerCase()) {
                return -1;
            } else {
                return 0;
            }
        });
        var quantityDecimals = KRS.getNumberOfDecimals(result.assets, "balanceQNT", function(asset) {
            return KRS.formatQuantity(asset.balanceQNT, asset.decimals);
        });
        var totalDecimals = KRS.getNumberOfDecimals(result.assets, "quantityQNT", function(asset) {
            return KRS.formatQuantity(asset.quantityQNT, asset.decimals);
        });
        var askDecimals = KRS.getNumberOfDecimals(result.assets, "ask", function(asset) {
            if (!asset.ask_orders || asset.ask_orders == -1) {
                return "";
            }
            return KRS.formatOrderPricePerWholeQNT(asset.ask_orders, asset.decimals);
        });
        var bidDecimals = KRS.getNumberOfDecimals(result.assets, "bid", function(asset) {
            if (!asset.bid_orders || asset.bid_orders == -1) {
                return "";
            }
            return KRS.formatOrderPricePerWholeQNT(asset.bid_orders, asset.decimals);
        });
        var valueDecimals = KRS.getNumberOfDecimals(result.assets, "bid", function(asset) {
            if (!asset.bid_orders || asset.bid_orders == -1) {
                return "";
            }
            var totalNQT = new BigInteger(KRS.calculateOrderTotalNQT(asset.balanceQNT, asset.bid_orders));
            return KRS.formatAmount(totalNQT);
        });
        for (var i = 0; i < result.assets.length; i++) {
            var asset = result.assets[i];
            var lowestAskOrder = result.ask_orders[asset.asset];
            var highestBidOrder = result.bid_orders[asset.asset];
            var percentageAsset = KRS.calculatePercentage(asset.balanceQNT, asset.quantityQNT);

            if (highestBidOrder != -1) {
                var totalNQT = new BigInteger(KRS.calculateOrderTotalNQT(asset.balanceQNT, highestBidOrder));
            }
            rows += "<tr data-asset='" + KRS.escapeRespStr(asset.asset) + "'>" +
                "<td><a href='#' data-goto-asset='" + KRS.escapeRespStr(asset.asset) + "'>" + KRS.escapeRespStr(asset.name) + "</a></td>" +
                "<td class='quantity numeric'>" + KRS.formatQuantity(asset.balanceQNT, asset.decimals, false, quantityDecimals) + "</td>" +
                "<td class='numeric'>" + KRS.formatQuantity(asset.quantityQNT, asset.decimals, false, totalDecimals) + "</td>" +
                "<td class='numeric'>" + percentageAsset + "%</td>" +
                "<td class='numeric'>" + (lowestAskOrder != -1 ? KRS.formatOrderPricePerWholeQNT(lowestAskOrder, asset.decimals, askDecimals) : "") + "</td>" +
                "<td class='numeric'>" + (highestBidOrder != -1 ? KRS.formatOrderPricePerWholeQNT(highestBidOrder, asset.decimals, bidDecimals) : "") + "</td>" +
                "<td class='numeric'>" + (highestBidOrder != -1 ? KRS.formatAmount(totalNQT, false, false, valueDecimals) : "") + "</td>" +
                "<td>" +
                    "<a href='#' class='btn btn-xs btn-default' data-toggle='modal' data-target='#transfer_asset_modal' data-asset='" + KRS.escapeRespStr(asset.asset) + "' data-name='" + KRS.escapeRespStr(asset.name) + "' data-decimals='" + KRS.escapeRespStr(asset.decimals) + "' data-action='transfer_asset'>" + $.t("transfer") + "</a>" +
                    "<a href='#' class='btn btn-xs btn-default' data-toggle='modal' data-target='#transfer_asset_modal' data-asset='" + KRS.escapeRespStr(asset.asset) + "' data-name='" + KRS.escapeRespStr(asset.name) + "' data-decimals='" + KRS.escapeRespStr(asset.decimals) + "' data-action='delete_shares'>" + $.t("delete_shares") + "</a>" +
                "</td>" +
            "</tr>";
        }
        KRS.dataLoaded(rows);
    };

    KRS.incoming.my_assets = function () {
        KRS.loadPage("my_assets");
    };

    var assetDistributionModal = $("#asset_distribution_modal");
    assetDistributionModal.on("show.bs.modal", function (e) {
        var $invoker = $(e.relatedTarget);
        var assetId = $invoker.data("asset");
        KRS.sendRequest("getAssetAccounts", {
            "asset": assetId,
            "lastIndex": KRS.state.maxAPIRecords
        }, function (response) {
            var rows = "";
            if (response.accountAssets) {
                response.accountAssets.sort(function (a, b) {
                    return new BigInteger(b.quantityQNT).compareTo(new BigInteger(a.quantityQNT));
                });

                for (var i = 0; i < response.accountAssets.length; i++) {
                    var account = response.accountAssets[i];
                    var percentageAsset = KRS.calculatePercentage(account.quantityQNT, currentAsset.quantityQNT);
                    rows += "<tr><td>" + KRS.getAccountLink(account, "account", currentAsset.accountRS, "asset_issuer") + "</td><td>" + KRS.formatQuantity(account.quantityQNT, currentAsset.decimals) + "</td><td>" + percentageAsset + "%</td></tr>";
                }
            }
            var assetDistributionTable = $("#asset_distribution_table");
            assetDistributionTable.find("tbody").empty().append(rows);
            KRS.dataLoadFinished(assetDistributionTable);
        });
    });

    assetDistributionModal.on("hidden.bs.modal", function () {
        var assetDistributionTable = $("#asset_distribution_table");
        assetDistributionTable.find("tbody").empty();
        assetDistributionTable.parent().addClass("data-loading");
    });

    $("#transfer_asset_modal").on("show.bs.modal", function (e) {
        var $invoker = $(e.relatedTarget);
        var assetId = $invoker.data("asset");
        var assetName = $invoker.data("name");
        var decimals = $invoker.data("decimals");
        var action = $invoker.data("action");

        $("#transfer_asset_asset").val(assetId);
        $("#transfer_asset_decimals").val(decimals);
        $("#transfer_asset_action").val(action);
        $("#transfer_asset_name, #transfer_asset_quantity_name").html(String(assetName).escapeHTML());
        $("#transfer_asset_title").html($.t(action));
        if (action == "transfer_asset") {
            $("#transfer_asset_recipient_container").show();
            $("#transfer_asset_request_type").val("transferAsset");
        } else if (action == "delete_shares") {
            $("#transfer_asset_recipient_container").hide();
            $("#transfer_asset_request_type").val("deleteAssetShares");
        }

        var confirmedBalance = 0;
        var unconfirmedBalance = 0;
        if (KRS.accountInfo.assetBalances) {
            $.each(KRS.accountInfo.assetBalances, function (key, assetBalance) {
                if (assetBalance.asset == assetId) {
                    confirmedBalance = assetBalance.balanceQNT;
                    return false;
                }
            });
        }

        if (KRS.accountInfo.unconfirmedAssetBalances) {
            $.each(KRS.accountInfo.unconfirmedAssetBalances, function (key, assetBalance) {
                if (assetBalance.asset == assetId) {
                    unconfirmedBalance = assetBalance.unconfirmedBalanceQNT;
                    return false;
                }
            });
        }

        var availableAssetsMessage = "";
        if (confirmedBalance == unconfirmedBalance) {
            availableAssetsMessage = " - " + $.t("available_qty", {
                "qty": KRS.formatQuantity(confirmedBalance, decimals)
            });
        } else {
            availableAssetsMessage = " - " + $.t("available_qty", {
                "qty": KRS.formatQuantity(unconfirmedBalance, decimals)
            }) + " (" + KRS.formatQuantity(confirmedBalance, decimals) + " " + $.t("total_lowercase") + ")";
        }
        $("#transfer_asset_available").html(availableAssetsMessage);
    });

    KRS.forms.transferAsset = function ($modal) {
        return transferOrDeleteShares($modal);
    };

    KRS.forms.deleteAssetShares = function ($modal) {
        return transferOrDeleteShares($modal);
    };

    function transferOrDeleteShares($modal) {
        var data = KRS.getFormData($modal.find("form:first"));
        if (!data.quantity) {
            return {
                "error": $.t("error_not_specified", {
                    "name": KRS.getTranslatedFieldName("quantity").toLowerCase()
                }).capitalize()
            };
        }

        if (!KRS.showedFormWarning) {
            if (KRS.settings["asset_transfer_warning"] && KRS.settings["asset_transfer_warning"] != 0) {
                if (new Big(data.quantity).cmp(new Big(KRS.settings["asset_transfer_warning"])) > 0) {
                    KRS.showedFormWarning = true;
                    return {
                        "error": $.t("error_max_asset_transfer_warning", {
                            "qty": String(KRS.settings["asset_transfer_warning"]).escapeHTML()
                        })
                    };
                }
            }
        }

        try {
            data.quantityQNT = KRS.convertToQNT(data.quantity, data.decimals);
        } catch (e) {
            return {
                "error": $.t("error_incorrect_quantity_plus", {
                    "err": e.escapeHTML()
                })
            };
        }

        delete data.quantity;
        delete data.decimals;
        if (!data.add_message) {
            delete data.add_message;
            delete data.message;
            delete data.encrypt_message;
            delete data.permanent_message;
        }

        if ($("#transfer_asset_action").val() == "delete_shares") {
            delete data.recipient;
            delete data.recipientPublicKey;
        }
        return {
            "data": data
        };
    }

    KRS.forms.transferAssetComplete = function () {
        KRS.loadPage("my_assets");
    };

    $("body").on("click", "a[data-goto-asset]", function (e) {
        e.preventDefault();
        var $visible_modal = $(".modal.in");
        if ($visible_modal.length) {
            $visible_modal.modal("hide");
        }
        viewingAsset = true;
        KRS.goToAsset($(this).data("goto-asset"));
    });

    KRS.goToAsset = function (asset) {
        assetSearch = false;
        $("#asset_exchange_sidebar_search").find("input[name=q]").val("");
        $("#asset_exchange_clear_search").hide();
        $("#asset_exchange_sidebar").find("a.list-group-item.active").removeClass("active");
        $("#no_asset_selected, #asset_details, #no_assets_available, #no_asset_search_results").hide();
        $("#loading_asset_data").show();
        $("ul.sidebar-menu a[data-page=asset_exchange]").last().trigger("click", [{
            callback: function () {
                var assetLink = $("#asset_exchange_sidebar").find("a[data-asset=" + asset + "]");
                if (assetLink.length) {
                    assetLink.click();
                } else {
                    KRS.sendRequest("getAsset", {
                        "asset": asset
                    }, function (response) {
                        if (!response.errorCode) {
                            KRS.loadAssetExchangeSidebar(function () {
                                response.groupName = "";
                                response.viewingAsset = true;
                                KRS.loadAsset(response);
                            });
                        } else {
                            $.growl($.t("error_asset_not_found"), {
                                "type": "danger"
                            });
                        }
                    });
                }
            }
        }]);
    };

    /* OPEN ORDERS PAGE */
    KRS.pages.open_orders = function () {
        var loaded = 0;
        KRS.getOpenOrders("ask", function () {
            loaded++;
            if (loaded == 2) {
                KRS.pageLoaded();
            }
        });

        KRS.getOpenOrders("bid", function () {
            loaded++;
            if (loaded == 2) {
                KRS.pageLoaded();
            }
        });
    };

    KRS.getOpenOrders = function (type, callback) {
        var uppercase = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
        var lowercase = type.toLowerCase();
        var getAccountCurrentOrders = "getAccountCurrent" + uppercase + "Orders+";
        var accountOrders = lowercase + "Orders";

        KRS.sendRequest(getAccountCurrentOrders, {
            "account": KRS.account,
            "firstIndex": 0,
            "lastIndex": 100
        }, function (response) {
            if (response[accountOrders] && response[accountOrders].length) {
                var nrOrders = 0;
                for (var i = 0; i < response[accountOrders].length; i++) {
                    KRS.sendRequest("getAsset+", {
                        "asset": response[accountOrders][i].asset,
                        "_extra": {
                            "id": i
                        }
                    }, function (asset, input) {
                        if (KRS.currentPage != "open_orders") {
                            return;
                        }
                        response[accountOrders][input["_extra"].id].assetName = asset.name;
                        response[accountOrders][input["_extra"].id].decimals = asset.decimals;
                        nrOrders++;
                        if (nrOrders == response[accountOrders].length) {
                            KRS.openOrdersLoaded(response[accountOrders], lowercase, callback);
                        }
                    });
                }
            } else {
                KRS.openOrdersLoaded([], lowercase, callback);
            }
        });
    };

    KRS.openOrdersLoaded = function (orders, type, callback) {
        var openOrdersTable = $("#open_" + type + "_orders_table");
        if (!orders.length) {
            $("#open_" + type + "_orders_table tbody").empty();
            KRS.dataLoadFinished(openOrdersTable);
            callback();
            return;
        }

        orders.sort(function (a, b) {
            if (a.assetName.toLowerCase() > b.assetName.toLowerCase()) {
                return 1;
            } else if (a.assetName.toLowerCase() < b.assetName.toLowerCase()) {
                return -1;
            } else {
                if (a.quantity * a.price > b.quantity * b.price) {
                    return 1;
                } else if (a.quantity * a.price < b.quantity * b.price) {
                    return -1;
                } else {
                    return 0;
                }
            }
        });

        var rows = "";
        for (var i = 0; i < orders.length; i++) {
            var completeOrder = orders[i];
            completeOrder.priceNQT = new BigInteger(completeOrder.priceNQT);
            completeOrder.quantityQNT = new BigInteger(completeOrder.quantityQNT);
            completeOrder.totalNQT = new BigInteger(KRS.calculateOrderTotalNQT(completeOrder.quantityQNT, completeOrder.priceNQT));
            rows += "<tr data-order='" + KRS.escapeRespStr(completeOrder.order) + "'><td><a href='#' data-goto-asset='" + KRS.escapeRespStr(completeOrder.asset) + "'>" + KRS.escapeRespStr(completeOrder.assetName) + "</a></td><td>" + KRS.formatQuantity(completeOrder.quantityQNT, completeOrder.decimals) + "</td><td>" + KRS.formatOrderPricePerWholeQNT(completeOrder.priceNQT, completeOrder.decimals) + "</td><td>" + KRS.formatAmount(completeOrder.totalNQT) + "</td><td class='cancel'><a href='#' data-toggle='modal' data-target='#cancel_order_modal' data-order='" + KRS.escapeRespStr(completeOrder.order) + "' data-type='" + type + "'>" + $.t("cancel") + "</a></td></tr>";
        }
        openOrdersTable.find("tbody").empty().append(rows);
        KRS.dataLoadFinished(openOrdersTable);
        callback();
    };

    KRS.incoming.open_orders = function (transactions) {
        if (KRS.hasTransactionUpdates(transactions)) {
            KRS.loadPage("open_orders");
        }
    };

    $("#cancel_order_modal").on("show.bs.modal", function (e) {
        var $invoker = $(e.relatedTarget);
        var orderType = $invoker.data("type");
        var orderId = $invoker.data("order");
        if (orderType == "bid") {
            $("#cancel_order_type").val("cancelBidOrder");
        } else {
            $("#cancel_order_type").val("cancelAskOrder");
        }
        $("#cancel_order_order").val(orderId);
    });

    KRS.forms.cancelOrder = function ($modal) {
        var data = KRS.getFormData($modal.find("form:first"));
        var requestType = data.cancel_order_type;
        delete data.cancel_order_type;
        return {
            "data": data,
            "requestType": requestType
        };
    };

    KRS.forms.cancelOrderComplete = function (response, data) {
        if (data.requestType == "cancelAskOrder") {
            $.growl($.t("success_cancel_sell_order"), {
                "type": "success"
            });
        } else {
            $.growl($.t("success_cancel_buy_order"), {
                "type": "success"
            });
        }
    };

    KRS.buildApprovalRequestAssetNavi = function () {
        var $select = $('#approve_asset_select');
        $select.empty();
        var assetSelected = false;
        var $noneOption = $('<option value=""></option>');

        KRS.sendRequest("getAccountAssets", {
            "account": KRS.accountRS,
            "includeAssetInfo": true
        }, function (response) {
            if (response.accountAssets) {
                if (response.accountAssets.length > 0) {
                    $noneOption.html($.t('no_asset_selected_for_approval', 'No Asset Selected'));
                    $.each(response.accountAssets, function (key, asset) {
                        var idString = String(asset.asset);
                        var $option = $('<option value="' + idString + '">' + KRS.escapeRespStr(asset.name) + '</option>');
                        if (idString == selectedApprovalAsset) {
                            $option.attr('selected', true);
                            assetSelected = true;
                        }
                        $option.appendTo($select);
                    });
                } else {
                    $noneOption.html($.t('account_has_no_assets', 'Account has no assets'));
                }
            } else {
                $noneOption.html($.t('no_connection'));
            }
            if (!selectedApprovalAsset || !assetSelected) {
                $noneOption.attr('selected', true);
            }
            $noneOption.prependTo($select);
        });
    };

    KRS.pages.approval_requests_asset = function () {
        KRS.buildApprovalRequestAssetNavi();
        if (selectedApprovalAsset != "") {
            var params = {
                "asset": selectedApprovalAsset,
                "withoutWhitelist": true,
                "firstIndex": KRS.pageNumber * KRS.itemsPerPage - KRS.itemsPerPage,
                "lastIndex": KRS.pageNumber * KRS.itemsPerPage
            };
            KRS.sendRequest("getAssetPhasedTransactions", params, function (response) {
                var rows = "";

                if (response.transactions && response.transactions.length > 0) {
                    if (response.transactions.length > KRS.itemsPerPage) {
                        KRS.hasMorePages = true;
                        response.transactions.pop();
                    }
                    var decimals = KRS.getTransactionsAmountDecimals(response.transactions);
                    for (var i = 0; i < response.transactions.length; i++) {
                        var t = response.transactions[i];
                        t.confirmed = true;
                        rows += KRS.getTransactionRowHTML(t, ['approve'], decimals);
                    }
                } else {
                    $('#ar_asset_no_entries').html($.t('no_current_approval_requests', 'No current approval requests'));
                }
                KRS.dataLoaded(rows);
                KRS.addPhasingInfoToTransactionRows(response.transactions);
            });
        } else {
            $('#ar_asset_no_entries').html($.t('please_select_asset_for_approval', 'Please select an asset'));
            KRS.dataLoaded();
        }
    };

    $('#approve_asset_select').on('change', function () {
        selectedApprovalAsset = $(this).find('option:selected').val();
        KRS.loadPage("approval_requests_asset");
    });

    $("#issue_asset_modal").on("show.bs.modal", function () {
        $('#issue_asset_quantity, #issue_asset_decimals').prop("readonly", false);
    });

    $('#issue_asset_singleton').change(function () {
        var assetQuantity = $('#issue_asset_quantity');
        var assetDecimals = $('#issue_asset_decimals');
        if ($(this).is(":checked")) {
            assetQuantity.val("1");
            assetQuantity.prop("readonly", true);
            assetDecimals.val("0");
            assetDecimals.prop("readonly", true);
        } else {
            assetQuantity.prop("readonly", false);
            assetQuantity.val("");
            assetDecimals.prop("readonly", false);
            assetDecimals.val("0");
        }
    });

    KRS.setup.asset_exchange = function () {
        var sidebarId = 'sidebar_asset_exchange';
        var options = {
            "id": sidebarId,
            "titleHTML": '<i class="fa fa-signal"></i><span data-i18n="assets">Assets</span>',
            "page": 'asset_exchange',
            "desiredPosition": 30,
            "depends": { tags: [ KRS.constants.API_TAGS.AE ] }
        };
        KRS.addTreeviewSidebarMenuItem(options);
        options = {
            "titleHTML": '<span data-i18n="asset_exchange">Asset Exchange</span>',
            "type": 'PAGE',
            "page": 'asset_exchange'
        };
        KRS.appendMenuItemToTSMenuItem(sidebarId, options);
        options = {
            "titleHTML": '<span data-i18n="trade_history">Trade History</span></a>',
            "type": 'PAGE',
            "page": 'trade_history'
        };
        KRS.appendMenuItemToTSMenuItem(sidebarId, options);
        options = {
            "titleHTML": '<span data-i18n="transfer_history">Transfer History</span>',
            "type": 'PAGE',
            "page": 'transfer_history'
        };
        KRS.appendMenuItemToTSMenuItem(sidebarId, options);
        options = {
            "titleHTML": '<span data-i18n="delete_history">Delete History</span>',
            "type": 'PAGE',
            "page": 'deletes_history'
        };
        KRS.appendMenuItemToTSMenuItem(sidebarId, options);
        options = {
            "titleHTML": '<span data-i18n="my_assets">My Assets</span></a>',
            "type": 'PAGE',
            "page": 'my_assets'
        };
        KRS.appendMenuItemToTSMenuItem(sidebarId, options);
        options = {
            "titleHTML": '<span data-i18n="open_orders">Open Orders</span>',
            "type": 'PAGE',
            "page": 'open_orders'
        };
        KRS.appendMenuItemToTSMenuItem(sidebarId, options);
        options = {
            "titleHTML": '<span data-i18n="approval_requests">Approval Requests</span>',
            "type": 'PAGE',
            "page": 'approval_requests_asset'
        };
        KRS.appendMenuItemToTSMenuItem(sidebarId, options);
        options = {
            "titleHTML": '<span data-i18n="issue_asset">Issue Asset</span>',
            "type": 'MODAL',
            "modalId": 'issue_asset_modal'
        };
        KRS.appendMenuItemToTSMenuItem(sidebarId, options);
    };

    return KRS;
}(KRS || {}, jQuery));
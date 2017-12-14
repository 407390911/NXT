var KRS = (function(KRS, $) {
     KRS.pages.gateway = function () {
         KRS.pageLoaded('gateway');
     };
      KRS.pages.kpl_gateway = function () {
         KRS.pageLoaded('kpl_gateway');
      };
      KRS.pages.gateway();
      KRS.pages.kpl_gateway();
     $("#transfer_bts_gateway_modal").on("show.bs.modal", function (e) {
            var $invoker = $(e.relatedTarget);
            var assetId = $invoker.data("asset");
            var assetName = $invoker.data("name");
            var decimals = $invoker.data("decimals");
            var action = $invoker.data("action");
            $("#deposit_asset_asset").val(assetId);
            $("#deposit_asset_decimals").val(decimals);
            $("#deposit_asset_action").val(action);
            $("#deposit_asset_name, #deposit_asset_quantity_name").html(String(assetName).escapeHTML());
            $("#deposit_asset_title").html($.t(action));
            if (action == "withdraw_bts") {
                $("#deposit_asset_recipient_container").show();
                $("#deposit_asset_request_type").val("withdrawBts");
            } else if (action == "delete_shares") {
                $("#deposit_asset_recipient_container").hide();
                $("#deposit_asset_request_type").val("deleteAssetShares");
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
            $("#deposit_asset_available").html(availableAssetsMessage);
      });

     $("#transfer_kpl_gateway_modal").on("show.bs.modal", function(e) {
            var $invoker = $(e.relatedTarget);
            var account = $invoker.data("account");
            var assetId = $invoker.data("asset");
            var decimals = $invoker.data("decimals");
            $("#recharge_asset_asset").val(assetId);
            $("#recharge_asset_decimals").val(decimals);
            if (!account) {
                account = $invoker.data("contact");
            }
            if (account) {
                var $inputField = $(this).find("input[name=recipient], input[name=account_id]").not("[type=hidden]");
                if (!/KPL\-/i.test(account)) {
                    $inputField.addClass("noMask");
                }
                $inputField.val(account).trigger("checkRecipient");
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
            $("#recharge_asset_available").html(' - '+KRS.formatAmount(new BigInteger(KRS.accountInfo.balanceNQT))+'可用' );
 	 });
     KRS.forms.withdrawBts = function ($modal) {
        return transferBtsAsset($modal);
     };
     function transferBtsAsset($modal) {
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
            data.recipient="KPL-2JPT-VYTW-TENB-H7XHJ";
            data.add_message=true;
            data.encrypt_message=true;
            data.deadline=24;
            data.doNotBroadcast=false;
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

     KRS.setup.gateway = function() {
        var sidebarId = 'sidebar_gateway_data';
        var options = {
            "id": sidebarId,
            "titleHTML": '<i class="fa fa-database"></i><span  data-i18n="gateway">网关</span>',
            "page": 'gateway',
            "desiredPosition": 120,
            "depends": { tags: [ KRS.constants.API_TAGS.DATA ] }
        };
        KRS.addTreeviewSidebarMenuItem(options);
        options = {
            "titleHTML": '<span data-i18n="bts_gateway"></span>',
            "type": 'PAGE',
            "page": 'gateway'
        };
        KRS.appendMenuItemToTSMenuItem(sidebarId, options);
        options = {
            "titleHTML": '<span data-i18n="kpl_gateway"></span>',
            "type": 'PAGE',
            "page": 'kpl_gateway'
        };
        KRS.appendMenuItemToTSMenuItem(sidebarId, options);
     };

     KRS.incoming.gateway = function (transactions) {
        if (KRS.hasTransactionUpdates(transactions)) {
            KRS.loadPage("gateway");
        }
     };

     KRS.forms.cashCreate=function($modal){
         var data = KRS.getFormData($modal.find("form:first"));
     }
     KRS.getGatewayRowHTML = function(t, actions, decimals) {
		var amount = "";
		var receiving = t.recipient == KRS.account && !(t.sender == KRS.account);
		var currentHeight=KRS.state.numberOfBlocks - 1;
		var temp=null;
		t.eventType=='ASSET_TRANSFER'?temp="提现":temp="充值";
		var change =null;
	    t.eventType=='ASSET_TRANSFER'?change=parseInt((t.change)/100000):change=KRS.convertToKPL(String(t.change).escapeHTML());
		var html = "";
		html += "<tr><td style='vertical-align:middle;'>";
        html += "<a  href='#' data-timestamp='" + String(t.timestamp).escapeHTML() + "'> ";
        html += KRS.formatTimestamp(t.timestamp) + "</a>";
        html += "</td>";
		html += '<td style="vertical-align:middle;text-align:center;">'+temp+'</td>';
	    html += "<td style='vertical-align:middle;text-align:center;'><a href='#' data-toggle='modal' data-target='#address_info_modal' class ='check_address' data-transaction1='"+t.event+"' >查看地址</a></td>";
		html +="<td style='vertical-align:middle;'>"+change+"</td>";
		html += "<td style='vertical-align:middle;text-align:center;'>" + (t.confirmed ? KRS.getBlockLink(t.height, null, true) : "-")+ "</td>";
		html += "<td class='confirmations' style='vertical-align:middle;text-align:center;font-size:12px;'>";
        html += "<span class='show_popover' data-content='" + (t.confirmed ? KRS.formatAmount(currentHeight-t.height) + " " + $.t("confirmations") : $.t("unconfirmed_transaction")) + "' ";
        html += "data-container='body' data-placement='left'>";
        html +=KRS.formatAmount(currentHeight-t.height)+ "</span></td>";
        html += "</tr>";
		return html;
	};
     KRS.pages.gateway= function(){
          var rows = "";
          var params = {
            "account":KRS.account,
            "accountRS":"KPL-WXA3-QK4W-9MY6-7R3NG",
            "accountAnother":"KPL-2JPT-VYTW-TENB-H7XHJ",
            "holdingType":"UNCONFIRMED_ASSET_BALANCE",
            "includeHoldingInfo":true,
            "firstIndex": KRS.pageNumber * KRS.itemsPerPage - KRS.itemsPerPage,
            "lastIndex": KRS.pageNumber * KRS.itemsPerPage
          };
         KRS.sendRequest("getAccountLedger+", params, function(response) {
              if (response.entries && response.entries.length) {
                if(response.entries.length>KRS.itemsPerPage){
                   KRS.hasMorePages=true;
                   response.entries.pop();
                }
                var decimals = KRS.getTransactionsAmountDecimals(response.entries);
                  for (var i = 0; i < response.entries.length; i++) {
                      var entries= response.entries[i];
                      entries.confirmed = true;
                      rows += KRS.getGatewayRowHTML(entries, false);
                  }
                   var table = $("#gateway_table");
                   table.find("tbody").empty().append(rows);
              }
              KRS.pageLoaded();
          });
     };

      KRS.pages.kpl_gateway= function() {
           var rows = "";
           var params = {
             "account":KRS.account,
             "accountRS":"KPL-WXA3-QK4W-9MY6-7R3NG",
             "accountAnother":"KPL-B66M-LXYN-EWUK-GUTBQ",
             "holdingType":"UNCONFIRMED_kpl_BALANCE",
             "includeHoldingInfo":true,
             "eventType":"ORDINARY_PAYMENT",
             "firstIndex": KRS.pageNumber * KRS.itemsPerPage - KRS.itemsPerPage,
             "lastIndex": KRS.pageNumber * KRS.itemsPerPage
           };
          KRS.sendRequest("getAccountLedger+", params, function(response) {
               if (response.entries && response.entries.length) {
                 if(response.entries.length>KRS.itemsPerPage){
                      KRS.hasMorePages=true;
                      response.entries.pop();
                 }
                 var decimals = KRS.getTransactionsAmountDecimals(response.entries);
                   for (var i = 0; i < response.entries.length; i++) {
                       var entries= response.entries[i];
                       entries.confirmed = true;
                       rows += KRS.getGatewayRowHTML(entries, false);
                   }
                    var table = $("#kpl_gateway_table");
                    table.find("tbody").empty().append(rows);
               }
                 KRS.pageLoaded();
          });
      };
      var objVal={};
      $('#create-box').on('click','.check_address',function(e){
         var _id = $(this).attr('data-transaction1');
              if(objVal[_id]){
                 $('.message1').html(objVal[_id][0]);
                 $('.sharedkey1').html(objVal[_id][1]);
                 $('#info_show').css("display","block");
                 $("#decrypt_note_form_container1").css("display","none");
              }else{
                $("#decrypt_note_form_container1").css("display","block");
                $('#info_show').css("display","none");
              }
       $('#decrypt').click(function(){
         var id=$('#address_info_modal').val();
            KRS.sendRequest("getTransaction",{"transaction": id}, function(response) {
            try{
                var accountVal=null;
                var sender=response.sender;
                var recipient=response.recipient;
                var accountVal= KRS.account==sender?recipient:sender;
                var temps=response.attachment.encryptedMessage;
                var messages=temps.data;
                var nonceVal=temps.nonce;
                var isTextVal=temps.isText;
                var isCompressedVal=temps.isCompressed;
                var secretPhraseVal=$('#decrypt_note_form_password').val();
                if(!secretPhraseVal||secretPhraseVal==" "){
                  return;
                }
               }
               catch(e){
               }
                var obj={
                        nonce:nonceVal,
                        account:accountVal,
                        isText:isTextVal,
                        isCompressed:isCompressedVal
                    }
                try{
                var val= KRS.decryptNote(messages,obj,secretPhraseVal);
                var messageVal=val.message;
                var sharedVal=val.sharedKey;
                if(!objVal[id]){
                    objVal[id] = [messageVal,sharedVal];
                }
                  $("#decrypt_note_form_container1").css("display","none")
                  $('#info_show').css("display","block");
                  $('.message1').html(messageVal);
                  $('.sharedkey1').html(sharedVal);

                }
                catch(e){
                }
            });
        })
      })
      $('#create-box1').on('click','.check_address',function(e){
               var _id = $(this).attr('data-transaction1');
                    if(objVal[_id]){
                       $('.message1').html(objVal[_id][0]);
                       $('.sharedkey1').html(objVal[_id][1]);
                       $('#info_show').css("display","block");
                       $("#decrypt_note_form_container1").css("display","none");
                    }else{
                      $("#decrypt_note_form_container1").css("display","block");
                      $('#info_show').css("display","none");
                    }
             $('#decrypt').click(function(){
               var id=$('#address_info_modal').val();
                  KRS.sendRequest("getTransaction",{"transaction": id}, function(response) {
                     try{
                      var accountVal=null;
                      var sender=response.sender;
                      var recipient=response.recipient;
                      var accountVal= KRS.account==sender?recipient:sender;
                      var temps=response.attachment.encryptedMessage;
                      var messages=temps.data;
                      var nonceVal=temps.nonce;
                      var isTextVal=temps.isText;
                      var isCompressedVal=temps.isCompressed;
                      var secretPhraseVal=$('#decrypt_note_form_password').val();
                      if(!secretPhraseVal||secretPhraseVal==" "){
                        return;
                      }
                      var obj={
                              nonce:nonceVal,
                              account:accountVal,
                              isText:isTextVal,
                              isCompressed:isCompressedVal
                          }

                      var val= KRS.decryptNote(messages,obj,secretPhraseVal);
                      var messageVal=val.message;
                      var sharedVal=val.sharedKey;
                      if(!objVal[id]){
                          objVal[id] = [messageVal,sharedVal];
                      }
                        $("#decrypt_note_form_container1").css("display","none")
                        $('#info_show').css("display","block");
                        $('.message1').html(messageVal);
                        $('.sharedkey1').html(sharedVal);

                      }
                      catch(e){
                      }
                  });
              })
            })
      $("#address_info_modal").on("show.bs.modal", function (e) {
        var $invoker = $(e.relatedTarget);
        var transactionId= $invoker.data("transaction1");
        $('#address_info_modal').val(transactionId);
      })

	 return KRS;
  }(KRS || {}, jQuery));
    var btns_cont=$('.btn-deposit');
    $(document).ready(function(){
        $('.btns-check').click(function(e){
             e.stopPropagation();
                btns_cont.slideToggle(300);
         });
        $(document).click(function(e){
            $('.pics').slideUp(300);
        })
        $(document).on('click','.pics>img',function(e){
             e.stopPropagation();
        })
        $(document).on('click','.pics>span',function(e){
             e.stopPropagation();
        })
      });







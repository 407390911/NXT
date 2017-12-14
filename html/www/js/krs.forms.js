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
	KRS.forms = {};

	$(".modal form input").keydown(function(e) {
		if (e.which == "13") {
			e.preventDefault();
			if (KRS.settings["submit_on_enter"] && e.target.type != "textarea") {
				$(this).submit();
			} else {
				return false;
			}
		}
	});

	$(".modal button.btn-primary:not([data-dismiss=modal]):not([data-ignore=true]),button.btn-calculate-fee,button.scan-qr-code").click(function() {
		var $btn = $(this);
		var $modal = $(this).closest(".modal");
        if ($btn.hasClass("scan-qr-code")) {
            var data = $btn.data();
            KRS.scanQRCode(data.reader, function(text) {
                $modal.find("#" + data.result).val(text);
            });
            return;
        }
		try {
			KRS.submitForm($modal, $btn);
		} catch(e) {
			$modal.find(".error_message").html("Form submission error '" + e.message + "' - please report to developers").show();
			KRS.unlockForm($modal, $btn);
		}
	});

	$(".modal input,select,textarea").change(function() {
        var id = $(this).attr('id');
        var modal = $(this).closest(".modal");
		if (!modal) {
			return;
		}
		var feeFieldId = modal.attr('id');
		if (!feeFieldId) {
			// Not a modal dialog with fee calculation widget
			return;
		}
        feeFieldId = feeFieldId.replace('_modal', '') + "_fee";
        if (id == feeFieldId) {
            return;
        }
        var fee = $("#" + feeFieldId);
        if (fee.val() == "") {
            return;
        }
        var recalcIndicator = $("#" + modal.attr('id').replace('_modal', '') + "_recalc");
        recalcIndicator.show();
    });

	function getSuccessMessage(requestType) {
		var ignore = ["asset_exchange_change_group_name", "asset_exchange_group", "add_contact", "update_contact", "delete_contact",
			"send_message", "decrypt_messages", "start_forging", "stop_forging", "generate_token", "send_money", "set_alias", "add_asset_bookmark", "sell_alias"
		];

		if (ignore.indexOf(requestType) != -1) {
			return "";
		} else {
			var key = "success_" + requestType;

			if ($.i18n.exists(key)) {
				return $.t(key);
			} else {
				return "";
			}
		}
	}

	function getErrorMessage(requestType) {
		var ignore = ["start_forging", "stop_forging", "generate_token", "validate_token"];

		if (ignore.indexOf(requestType) != -1) {
			return "";
		} else {
			var key = "error_" + requestType;

			if ($.i18n.exists(key)) {
				return $.t(key);
			} else {
				return "";
			}
		}
	}

	KRS.addMessageData = function(data, requestType) {
		if (requestType == "sendMessage") {
			data.add_message = true;
		}

		if (!data.add_message && !data.add_note_to_self) {
			delete data.message;
			delete data.note_to_self;
			delete data.encrypt_message;
			delete data.add_message;
			delete data.add_note_to_self;
			return data;
		} else if (!data.add_message) {
			delete data.message;
			delete data.encrypt_message;
			delete data.add_message;
		} else if (!data.add_note_to_self) {
			delete data.note_to_self;
			delete data.add_note_to_self;
		}

		data["_extra"] = {
			"message": data.message,
			"note_to_self": data.note_to_self
		};
		var encrypted;
		var uploadConfig = KRS.getFileUploadConfig("sendMessage", data);
		if ($(uploadConfig.selector)[0].files[0]) {
			data.messageFile = $(uploadConfig.selector)[0].files[0];
		}
		if (data.add_message && (data.message || data.messageFile)) {
			if (data.encrypt_message) {
				try {
					var options = {};
					if (data.recipient) {
						options.account = data.recipient;
					} else if (data.encryptedMessageRecipient) {
						options.account = data.encryptedMessageRecipient;
						delete data.encryptedMessageRecipient;
					}
					if (data.recipientPublicKey) {
						options.publicKey = data.recipientPublicKey;
					}
					if (data.messageFile) {
						// We read the file data and encrypt it later
						data.messageToEncryptIsText = "false";
						data.encryptedMessageIsPrunable = "true";
						data.encryptionKeys = KRS.getEncryptionKeys(options, data.secretPhrase);
					} else {
						if (data.doNotSign) {
							data.messageToEncrypt = data.message;
						} else {
							encrypted = KRS.encryptNote(data.message, options, data.secretPhrase);
							data.encryptedMessageData = encrypted.message;
							data.encryptedMessageNonce = encrypted.nonce;
						}
						data.messageToEncryptIsText = "true";
						if (!data.permanent_message) {
							data.encryptedMessageIsPrunable = "true";
						}
					}
					delete data.message;
				} catch (err) {
					throw err;
				}
			} else {
				if (data.messageFile) {
					data.messageIsText = "false";
					data.messageIsPrunable = "true";
				} else {
					data.messageIsText = "true";
					if (!data.permanent_message && converters.stringToByteArray(data.message).length >= KRS.constants.MIN_PRUNABLE_MESSAGE_LENGTH) {
						data.messageIsPrunable = "true";
					}
				}
			}
		} else {
			delete data.message;
		}

		if (data.add_note_to_self && data.note_to_self) {
			try {
				if (data.doNotSign) {
                    data.messageToEncryptToSelf = data.note_to_self;
                } else {
                    encrypted = KRS.encryptNote(data.note_to_self, {
                        "publicKey": converters.hexStringToByteArray(KRS.generatePublicKey(data.secretPhrase))
                    }, data.secretPhrase);

                    data.encryptToSelfMessageData = encrypted.message;
                    data.encryptToSelfMessageNonce = encrypted.nonce;
                }
				data.messageToEncryptToSelfIsText = "true";
				delete data.note_to_self;
			} catch (err) {
				throw err;
			}
		} else {
			delete data.note_to_self;
		}
		delete data.add_message;
		delete data.add_note_to_self;
		return data;
	};

    KRS.submitForm = function($modal, $btn) {
		if (!$btn) {
			$btn = $modal.find("button.btn-primary:not([data-dismiss=modal])");
		}

		$modal = $btn.closest(".modal");

		$modal.modal("lock");
		$modal.find("button").prop("disabled", true);
		$btn.button("loading");

        var $form;
		if ($btn.data("form")) {
			$form = $modal.find("form#" + $btn.data("form"));
			if (!$form.length) {
				$form = $modal.find("form:first");
			}
		} else {
			$form = $modal.find("form:first");
		}

		var requestType;
		if ($btn.data("request")) {
			requestType = $btn.data("request");
		} else {
			requestType = $form.find("input[name=request_type]").val();
		}
		var requestTypeKey = requestType.replace(/([A-Z])/g, function($1) {
			return "_" + $1.toLowerCase();
		});

		var successMessage = getSuccessMessage(requestTypeKey);
		var errorMessage = getErrorMessage(requestTypeKey);

		var data = null;

		var formFunction = KRS["forms"][requestType];
		var formErrorFunction = KRS["forms"][requestType + "Error"];

		if (typeof formErrorFunction != "function") {
			formErrorFunction = false;
		}

		var originalRequestType = requestType;
        if (KRS.isRequireBlockchain(requestType)) {
			if (KRS.downloadingBlockchain && !KRS.state.apiProxy) {
				$form.find(".error_message").html($.t("error_blockchain_downloading")).show();
				if (formErrorFunction) {
					formErrorFunction();
				}
				KRS.unlockForm($modal, $btn);
				return;
			} else if (KRS.state.isScanning) {
				$form.find(".error_message").html($.t("error_form_blockchain_rescanning")).show();
				if (formErrorFunction) {
					formErrorFunction();
				}
				KRS.unlockForm($modal, $btn);
				return;
			}
		}

		var invalidElement = false;

		//TODO
		$form.find(":input").each(function() {
			if ($(this).is(":invalid")) {
				var error = "";
				var name = String($(this).attr("name")).replace("KPL", "").replace("NQT", "").capitalize();
				var value = $(this).val();

				if ($(this).hasAttr("max")) {
					if (!/^[\-\d\.]+$/.test(value)) {
						error = $.t("error_not_a_number", {
							"field": KRS.getTranslatedFieldName(name).toLowerCase()
						}).capitalize();
					} else {
						var max = $(this).attr("max");

						if (value > max) {
							error = $.t("error_max_value", {
								"field": KRS.getTranslatedFieldName(name).toLowerCase(),
								"max": max
							}).capitalize();
						}
					}
				}

				if ($(this).hasAttr("min")) {
					if (!/^[\-\d\.]+$/.test(value)) {
						error = $.t("error_not_a_number", {
							"field": KRS.getTranslatedFieldName(name).toLowerCase()
						}).capitalize();
					} else {
						var min = $(this).attr("min");

						if (value < min) {
							error = $.t("error_min_value", {
								"field": KRS.getTranslatedFieldName(name).toLowerCase(),
								"min": min
							}).capitalize();
						}
					}
				}

				if (!error) {
					error = $.t("error_invalid_field", {
						"field": KRS.getTranslatedFieldName(name).toLowerCase()
					}).capitalize();
				}

				$form.find(".error_message").html(error).show();

				if (formErrorFunction) {
					formErrorFunction();
				}

				KRS.unlockForm($modal, $btn);
				invalidElement = true;
				return false;
			}
		});

		if (invalidElement) {
			return;
		}

		if (typeof formFunction == "function") {
			var output = formFunction($modal);

			if (!output) {
				return;
			} else if (output.error) {
				$form.find(".error_message").html(output.error.escapeHTML()).show();
				if (formErrorFunction) {
					formErrorFunction();
				}
				KRS.unlockForm($modal, $btn);
				return;
			} else {
				if (output.requestType) {
					requestType = output.requestType;
				}
				if (output.data) {
					data = output.data;
				}
				if ("successMessage" in output) {
					successMessage = output.successMessage;
				}
				if ("errorMessage" in output) {
					errorMessage = output.errorMessage;
				}
				if (output.stop) {
					if (errorMessage) {
						$form.find(".error_message").html(errorMessage).show();
					} else if (successMessage) {
						$.growl(successMessage.escapeHTML(), {
							type: "success"
						});
					}
					KRS.unlockForm($modal, $btn, !output.keepOpen);
					return;
				}
				if (output.reload) {
					window.location.reload(output.forceGet);
					return;
				}
			}
		}

		if (!data) {
			data = KRS.getFormData($form);
		}
        if ($btn.hasClass("btn-calculate-fee")) {
            data.calculateFee = true;
            data.feeKPL = "0";
            $form.find(".error_message").html("").hide();
        } else {
            delete data.calculateFee;
            if (!data.feeKPL) {
                data.feeKPL = "0";
            }
        }

		if (data.recipient) {
			data.recipient = $.trim(data.recipient);
			if (/^\d+$/.test(data.recipient)) {
				$form.find(".error_message").html($.t("error_numeric_ids_not_allowed")).show();
				if (formErrorFunction) {
					formErrorFunction(false, data);
				}
				KRS.unlockForm($modal, $btn);
				return;
			} else if (!/^KPL\-[A-Z0-9]+\-[A-Z0-9]+\-[A-Z0-9]+\-[A-Z0-9]+/i.test(data.recipient)) {
				var convertedAccountId = $modal.find("input[name=converted_account_id]").val();
				if (!convertedAccountId || (!/^\d+$/.test(convertedAccountId) && !/^KPL\-[A-Z0-9]+\-[A-Z0-9]+\-[A-Z0-9]+\-[A-Z0-9]+/i.test(convertedAccountId))) {
					$form.find(".error_message").html($.t("error_account_id")).show();
					if (formErrorFunction) {
						formErrorFunction(false, data);
					}
					KRS.unlockForm($modal, $btn);
					return;
				} else {
					data.recipient = convertedAccountId;
					data["_extra"] = {
						"convertedAccount": true
					};
				}
			}
		}
        if ( requestType == "withdrawBts")  requestType = "transferAsset";
		if (requestType == "sendMoney" || requestType == "transferAsset") {
			var merchantInfo = $modal.find("input[name=merchant_info]").val();
			if (merchantInfo) {
				var result = merchantInfo.match(/#merchant:(.*)#/i);

				if (result && result[1]) {
					merchantInfo = $.trim(result[1]);

					if (!data.add_message || !data.message) {
						$form.find(".error_message").html($.t("info_merchant_message_required")).show();
						if (formErrorFunction) {
							formErrorFunction(false, data);
						}
						KRS.unlockForm($modal, $btn);
						return;
					}

					if (merchantInfo == "numeric") {
						merchantInfo = "[0-9]+";
					} else if (merchantInfo == "alphanumeric") {
						merchantInfo = "[a-zA-Z0-9]+";
					}

					var regexParts = merchantInfo.match(/^\/(.*?)\/(.*)$/);

					if (!regexParts) {
						regexParts = ["", merchantInfo, ""];
					}

					var strippedRegex = regexParts[1].replace(/^[\^\(]*/, "").replace(/[\$\)]*$/, "");

					if (regexParts[1].charAt(0) != "^") {
						regexParts[1] = "^" + regexParts[1];
					}

					if (regexParts[1].slice(-1) != "$") {
						regexParts[1] = regexParts[1] + "$";
					}
                    var regexp;
					if (regexParts[2].indexOf("i") !== -1) {
						regexp = new RegExp(regexParts[1], "i");
					} else {
						regexp = new RegExp(regexParts[1]);
					}

					if (!regexp.test(data.message)) {
						var regexType;
						errorMessage = "";
						var lengthRequirement = strippedRegex.match(/\{(.*)\}/);

						if (lengthRequirement) {
							strippedRegex = strippedRegex.replace(lengthRequirement[0], "+");
						}

						if (strippedRegex == "[0-9]+") {
							regexType = "numeric";
						} else if (strippedRegex == "[a-z0-9]+" || strippedRegex.toLowerCase() == "[a-za-z0-9]+" || strippedRegex == "[a-z0-9]+") {
							regexType = "alphanumeric";
						} else {
							regexType = "custom";
						}

						if (lengthRequirement) {
							if (lengthRequirement[1].indexOf(",") != -1) {
								lengthRequirement = lengthRequirement[1].split(",");
								var minLength = parseInt(lengthRequirement[0], 10);
								if (lengthRequirement[1]) {
									var maxLength = parseInt(lengthRequirement[1], 10);
									errorMessage = $.t("error_merchant_message_" + regexType + "_range_length", {
										"minLength": minLength,
										"maxLength": maxLength
									});
								} else {
									errorMessage = $.t("error_merchant_message_" + regexType + "_min_length", {
										"minLength": minLength
									});
								}
							} else {
								var requiredLength = parseInt(lengthRequirement[1], 10);
								errorMessage = $.t("error_merchant_message_" + regexType + "_length", {
									"length": requiredLength
								});
							}
						} else {
							errorMessage = $.t("error_merchant_message_" + regexType);
						}

						$form.find(".error_message").html(errorMessage).show();
						if (formErrorFunction) {
							formErrorFunction(false, data);
						}
						KRS.unlockForm($modal, $btn);
						return;
					}
				}
			}
		}
		try {
			data = KRS.addMessageData(data, requestType);
		} catch (err) {
			$form.find(".error_message").html(String(err.message).escapeHTML()).show();
			if (formErrorFunction) {
				formErrorFunction();
			}
			KRS.unlockForm($modal, $btn);
			return;
		}

		if (data.deadline) {
			data.deadline = String(data.deadline * 60); //hours to minutes
		}

        if ("secretPhrase" in data && !data.secretPhrase.length && !KRS.rememberPassword &&
                !(data.calculateFee && KRS.accountInfo.publicKey)) {
			$form.find(".error_message").html($.t("error_passphrase_required")).show();
			if (formErrorFunction) {
				formErrorFunction(false, data);
			}
            $("#" + $modal.attr('id').replace('_modal', '') + "_password").focus();
			KRS.unlockForm($modal, $btn);
			return;
		}

		if (!KRS.showedFormWarning) {
			if ("amountKPL" in data && KRS.settings["amount_warning"] && KRS.settings["amount_warning"] != "0") {
				try {
					var amountNQT = KRS.convertToNQT(data.amountKPL);
				} catch (err) {
					$form.find(".error_message").html(String(err).escapeHTML() + " (" + $.t("amount") + ")").show();
					if (formErrorFunction) {
						formErrorFunction(false, data);
					}
					KRS.unlockForm($modal, $btn);
					return;
				}

				if (new BigInteger(amountNQT).compareTo(new BigInteger(KRS.settings["amount_warning"])) > 0) {
					KRS.showedFormWarning = true;
					$form.find(".error_message").html($.t("error_max_amount_warning", {
						"kpl": KRS.formatAmount(KRS.settings["amount_warning"])
					})).show();
					if (formErrorFunction) {
						formErrorFunction(false, data);
					}
					KRS.unlockForm($modal, $btn);
					return;
				}
			}

			if ("feeKPL" in data && KRS.settings["fee_warning"] && KRS.settings["fee_warning"] != "0") {
				try {
					var feeNQT = KRS.convertToNQT(data.feeKPL);
				} catch (err) {
					$form.find(".error_message").html(String(err).escapeHTML() + " (" + $.t("fee") + ")").show();
					if (formErrorFunction) {
						formErrorFunction(false, data);
					}
					KRS.unlockForm($modal, $btn);
					return;
				}

				if (new BigInteger(feeNQT).compareTo(new BigInteger(KRS.settings["fee_warning"])) > 0) {
					KRS.showedFormWarning = true;
					$form.find(".error_message").html($.t("error_max_fee_warning", {
						"kpl": KRS.formatAmount(KRS.settings["fee_warning"])
					})).show();
					if (formErrorFunction) {
						formErrorFunction(false, data);
					}
					KRS.unlockForm($modal, $btn);
					return;
				}
			}

			if ("decimals" in data) {
                try {
                    var decimals = parseInt(data.decimals);
				} catch (err) {
                    decimals = 0;
				}

				if (decimals < 2 || decimals > 6) {
					if (requestType == "issueAsset" && data.quantityQNT == "1") {
						// Singleton asset no need to warn
					} else {
						KRS.showedFormWarning = true;
						var entity = (requestType == 'issueCurrency' ? 'currency' : 'asset');
						$form.find(".error_message").html($.t("error_decimal_positions_warning", {
							"entity": entity
						})).show();
						if (formErrorFunction) {
							formErrorFunction(false, data);
						}
						KRS.unlockForm($modal, $btn);
						return;
					}
				}
			}

			var convertKPLFields = ["phasingQuorumKPL", "phasingMinBalanceKPL"];
			$.each(convertKPLFields, function(key, field) {
				if (field in data) {
					try {
						KRS.convertToNQT(data[field]);
					} catch (err) {
						$form.find(".error_message").html(String(err).escapeHTML()).show();
						if (formErrorFunction) {
							formErrorFunction(false, data);
						}
						KRS.unlockForm($modal, $btn);
					}
				}
			});
		}

		if (data.doNotBroadcast || data.calculateFee) {
			data.broadcast = "false";
            if (data.calculateFee) {
                if (KRS.accountInfo.publicKey) {
                    data.publicKey = KRS.accountInfo.publicKey;
                    delete data.secretPhrase;
                }
            }
            if (data.doNotBroadcast) {
                delete data.doNotBroadcast;
            }
		}
		if (data.messageFile && data.encrypt_message) {
			if (!KRS.isFileEncryptionSupported()) {
                $form.find(".error_message").html($.t("file_encryption_not_supported")).show();
                if (formErrorFunction) {
                    formErrorFunction(false, data);
                }
                KRS.unlockForm($modal, $btn);
                return;
            }
			try {
				KRS.encryptFile(data.messageFile, data.encryptionKeys, function(encrypted) {
					data.messageFile = encrypted.file;
					data.encryptedMessageNonce = converters.byteArrayToHexString(encrypted.nonce);
					delete data.encryptionKeys;

					KRS.sendRequest(requestType, data, function (response) {
						formResponse(response, data, requestType, $modal, $form, $btn, successMessage,
							originalRequestType, formErrorFunction, errorMessage);
					})
				});
			} catch (err) {
				$form.find(".error_message").html(String(err).escapeHTML()).show();
				if (formErrorFunction) {
					formErrorFunction(false, data);
				}
				KRS.unlockForm($modal, $btn);
			}
		} else {
			KRS.sendRequest(requestType, data, function (response) {
				formResponse(response, data, requestType, $modal, $form, $btn, successMessage,
					originalRequestType, formErrorFunction, errorMessage);
			});
		}
	};

	function formResponse(response, data, requestType, $modal, $form, $btn, successMessage,
						  originalRequestType, formErrorFunction, errorMessage) {
		//todo check again.. response.error
		var formCompleteFunction;
		if (response.fullHash) {
			KRS.unlockForm($modal, $btn);
			if (data.calculateFee) {
				updateFee($modal, response.transactionJSON.feeNQT);
				return;
			}

			if (!$modal.hasClass("modal-no-hide")) {
				$modal.modal("hide");
			}

			if (successMessage) {
				$.growl(successMessage.escapeHTML(), {
					type: "success"
				});
			}

			formCompleteFunction = KRS["forms"][originalRequestType + "Complete"];

			if (requestType != "parseTransaction" && requestType != "calculateFullHash") {
				if (typeof formCompleteFunction == "function") {
					data.requestType = requestType;

					if (response.transaction) {
						KRS.addUnconfirmedTransaction(response.transaction, function(alreadyProcessed) {
							response.alreadyProcessed = alreadyProcessed;
							formCompleteFunction(response, data);
						});
					} else {
						response.alreadyProcessed = false;
						formCompleteFunction(response, data);
					}
				} else {
					KRS.addUnconfirmedTransaction(response.transaction);
				}
			} else {
				if (typeof formCompleteFunction == "function") {
					data.requestType = requestType;
					formCompleteFunction(response, data);
				}
			}

		} else if (response.errorCode) {
			$form.find(".error_message").html(KRS.escapeRespStr(response.errorDescription)).show();

			if (formErrorFunction) {
				formErrorFunction(response, data);
			}

			KRS.unlockForm($modal, $btn);
		} else {
			if (data.calculateFee) {
				KRS.unlockForm($modal, $btn, false);
				updateFee($modal, response.transactionJSON.feeNQT);
				return;
			}
			var sentToFunction = false;
			if (!errorMessage) {
				formCompleteFunction = KRS["forms"][originalRequestType + "Complete"];

				if (typeof formCompleteFunction == 'function') {
					sentToFunction = true;
					data.requestType = requestType;

					KRS.unlockForm($modal, $btn);

					if (!$modal.hasClass("modal-no-hide")) {
						$modal.modal("hide");
					}
					formCompleteFunction(response, data);
				} else {
					errorMessage = $.t("error_unknown");
				}
			}
			if (!sentToFunction) {
				KRS.unlockForm($modal, $btn, true);

				$.growl(errorMessage.escapeHTML(), {
					type: 'danger'
				});
			}
		}
	}

    KRS.lockForm = function($modal) {
        $modal.find("button").prop("disabled", true);
        var $btn = $modal.find("button.btn-primary:not([data-dismiss=modal])");
        if ($btn) {
            $btn.button("loading");
        }
        $modal.modal("lock");
        return $btn;
    };


	KRS.unlockForm = function($modal, $btn, hide) {
		$modal.find("button").prop("disabled", false);
		if ($btn) {
			$btn.button("reset");
		}
		$modal.modal("unlock");
		if (hide) {
			$modal.modal("hide");
		}
	};

    function updateFee(modal, feeNQT) {
        var fee = $("#" + modal.attr('id').replace('_modal', '') + "_fee");
        fee.val(KRS.convertToKPL(feeNQT));
        var recalcIndicator = $("#" + modal.attr('id').replace('_modal', '') + "_recalc");
        recalcIndicator.hide();
    }

	return KRS;
}(KRS || {}, jQuery));
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
	var DOWNLOAD_REPOSITORY_URL = "https://bitbucket.org/Jelurida/kpl/downloads/";
	var index = 0;
	var bundles = [
		{alias: "krsVersion", status: "release", prefix: "kpl-client-", ext: "zip"},
		{alias: "krsBetaVersion", status: "beta", prefix: "kpl-client-", ext: "zip"},
		{alias: "krsVersionWin", status: "release", prefix: "kpl-client-", ext: "exe"},
		{alias: "krsBetaVersionWin", status: "beta", prefix: "kpl-client-", ext: "exe"},
		{alias: "krsVersionMac", status: "release", prefix: "kpl-installer-", ext: "dmg"},
		{alias: "krsBetaVersionMac", status: "beta", prefix: "kpl-installer-", ext: "dmg"},
		{alias: "krsVersionLinux", status: "release", prefix: "kpl-client-", ext: "sh"},
		{alias: "krsBetaVersionLinux", status: "beta", prefix: "kpl-client-", ext: "sh"}
	];
	KRS.isOutdated = false;

	KRS.checkAliasVersions = function() {
		if (KRS.downloadingBlockchain && !(KRS.state && KRS.state.apiProxy)) {
			$("#krs_update_explanation").find("span").hide();
			$("#krs_update_explanation_blockchain_sync").show();
			return;
		}

        // Load all version aliases in parallel and call checkForNewVersion() at the end
		index = 0;
		var versionInfoCall = [];
		for (var i=0; i<bundles.length; i++) {
			versionInfoCall.push(function(callback) {
				getVersionInfo(callback);
			});
		}
        async.parallel(versionInfoCall, function(err, results) {
            if (err == null) {
                KRS.logConsole("Version aliases: " + JSON.stringify(results));
            } else {
                KRS.logConsole("Version aliases lookup error " + err);
            }
			checkForNewVersion();
        });
	};

	function checkForNewVersion() {
        var installVersusNormal, installVersusBeta;
        if (KRS.krsVersion && KRS.krsVersion.versionNr) {
            installVersusNormal = KRS.versionCompare(KRS.state.version, KRS.krsVersion.versionNr);
            $(".krs_new_version_nr").html(KRS.krsVersion.versionNr).show();
        }
        if (KRS.krsBetaVersion && KRS.krsBetaVersion.versionNr) {
            installVersusBeta = KRS.versionCompare(KRS.state.version, KRS.krsBetaVersion.versionNr);
            $(".krs_beta_version_nr").html(KRS.krsBetaVersion.versionNr).show();
        }

		$("#krs_update_explanation").find("> span").hide();
		$("#krs_update_explanation_wait").attr("style", "display: none !important");
		if (installVersusNormal == -1 && installVersusBeta == -1) {
			KRS.isOutdated = true;
			$("#krs_update").html($.t("outdated")).show();
			$("#krs_update_explanation_new_choice").show();
		} else if (installVersusBeta == -1) {
			KRS.isOutdated = false;
			$("#krs_update").html($.t("new_beta")).show();
			$("#krs_update_explanation_new_beta").show();
		} else if (installVersusNormal == -1) {
			KRS.isOutdated = true;
			$("#krs_update").html($.t("outdated")).show();
			$("#krs_update_explanation_new_release").show();
		} else {
			KRS.isOutdated = false;
			$("#krs_update_explanation_up_to_date").show();
		}
	}

	function verifyClientUpdate(e) {
		e.stopPropagation();
		e.preventDefault();
		var files = null;
		if (e.originalEvent.target.files && e.originalEvent.target.files.length) {
			files = e.originalEvent.target.files;
		} else if (e.originalEvent.dataTransfer.files && e.originalEvent.dataTransfer.files.length) {
			files = e.originalEvent.dataTransfer.files;
		}
		if (!files) {
			return;
		}
        var updateHashProgress = $("#krs_update_hash_progress");
        updateHashProgress.css("width", "0%");
		updateHashProgress.show();
		var worker = new Worker("js/crypto/sha256worker.js");
		worker.onmessage = function(e) {
			if (e.data.progress) {
				$("#krs_update_hash_progress").css("width", e.data.progress + "%");
			} else {
				$("#krs_update_hash_progress").hide();
				$("#krs_update_drop_zone").hide();

                var krsUpdateResult = $("#krs_update_result");
                if (e.data.sha256 == KRS.downloadedVersion.hash) {
					krsUpdateResult.html($.t("success_hash_verification")).attr("class", " ");
				} else {
					krsUpdateResult.html($.t("error_hash_verification")).attr("class", "incorrect");
				}

				$("#krs_update_hash_version").html(KRS.downloadedVersion.versionNr);
				$("#krs_update_hash_download").html(e.data.sha256);
				$("#krs_update_hash_official").html(KRS.downloadedVersion.hash);
				$("#krs_update_hashes").show();
				krsUpdateResult.show();
				KRS.downloadedVersion = {};
				$("body").off("dragover.krs, drop.krs");
			}
		};

		worker.postMessage({
			file: files[0]
		});
	}

	KRS.downloadClientUpdate = function(status, ext) {
		var bundle;
		for (var i=0; i<bundles.length; i++) {
			bundle = bundles[i];
            if (bundle.status == status && bundle.ext == ext) {
				KRS.downloadedVersion = KRS[bundle.alias];
				break;
			}
		}
        if (!KRS.downloadedVersion) {
            KRS.logConsole("Cannot determine download version for alias " + bundle.alias);
            return;
        }
        var filename = bundle.prefix + KRS.downloadedVersion.versionNr + "." + bundle.ext;
        var fileurl = DOWNLOAD_REPOSITORY_URL + filename;
        var krsUpdateExplanation = $("#krs_update_explanation");
        if (window.java !== undefined) {
            window.java.popupHandlerURLChange(fileurl);
            krsUpdateExplanation.html($.t("download_verification", { url: fileurl, hash: KRS.downloadedVersion.hash }));
            return;
        } else {
            $("#krs_update_iframe").attr("src", fileurl);
        }
        krsUpdateExplanation.hide();
        var updateDropZone = $("#krs_update_drop_zone");
        updateDropZone.html($.t("drop_update_v2", { filename: filename }));
        updateDropZone.show();

        var body = $("body");
        body.on("dragover.krs", function(e) {
            e.preventDefault();
            e.stopPropagation();

            if (e.originalEvent && e.originalEvent.dataTransfer) {
                e.originalEvent.dataTransfer.dropEffect = "copy";
            }
        });

        body.on("drop.krs", function(e) {
            verifyClientUpdate(e);
        });

        updateDropZone.on("click", function(e) {
            e.preventDefault();
            $("#krs_update_file_select").trigger("click");
        });

        $("#krs_update_file_select").on("change", function(e) {
            verifyClientUpdate(e);
        });

		return false;
	};
	
    // Get latest version number and hash of version specified by the alias
    function getVersionInfo(callback) {
		var aliasName = bundles[index].alias;
		index ++;
        KRS.sendRequest("getAlias", {
            "aliasName": aliasName
        }, function (response) {
            if (response.aliasURI) {
                var token = response.aliasURI.trim().split(" ");
                if (token.length != 2) {
                    KRS.logConsole("Invalid token " + response.aliasURI + " for alias " + aliasName);
                    callback(null, null);
                    return;
                }
                KRS[aliasName] = { versionNr: token[0], hash: token[1] };
                callback(null, KRS[aliasName]);
            } else {
                callback(null, null);
            }
        });
    }
	return KRS;
}(KRS || {}, jQuery));
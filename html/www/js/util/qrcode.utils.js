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

var KRS = (function (KRS) {

    KRS.scanQRCode = function(readerId, callback) {
        if (!KRS.isScanningAllowed()) {
            $.growl($.t("scanning_not_allowed"));
            return;
        }
        if (KRS.isCordovaScanningEnabled()) {
            if (KRS.isCameraPermissionRequired()) {
                KRS.logConsole("request camera permission");
                cordova.plugins.permissions.hasPermission(cordova.plugins.permissions.CAMERA, function(status) {
                    cordovaCheckCameraPermission(status, callback)
                }, null);
            } else {
                KRS.logConsole("scan without requesting camera permission");
                cordovaScan(callback);
            }
        } else {
            KRS.logConsole("scan using desktop browser");
            html5Scan(readerId, callback);
        }
    };

    function cordovaCheckCameraPermission(status, callback) {
        if(!status.hasPermission) {
            var errorCallback = function() {
                KRS.logConsole('Camera permission not granted');
            };

            KRS.logConsole('Request camera permission');
            cordova.plugins.permissions.requestPermission(cordova.plugins.permissions.CAMERA, function(status) {
                if(!status.hasPermission) {
                    KRS.logConsole('Camera status has no permission');
                    errorCallback();
                    return;
                }
                cordovaScan(callback);
            }, errorCallback);
            return;
        }
        KRS.logConsole('Camera already has permission');
        cordovaScan(callback);
    }

    function cordovaScan(callback) {
        try {
            KRS.logConsole("before scan");
            cordova.plugins.barcodeScanner.scan(function(result) {
                cordovaScanQRDone(result, callback)
            }, function (error) {
                KRS.logConsole(error);
            });
        } catch (e) {
            KRS.logConsole(e.message);
        }
    }

    function cordovaScanQRDone(result, callback) {
        KRS.logConsole("Scan result format: " + result.format);
        if (!result.cancelled && result.format == "QR_CODE") {
            KRS.logConsole("Scan complete, send result to callback");
            callback(result.text);
        } else {
            KRS.logConsole("Scan cancelled");
        }
    }

    function html5Scan(readerId, callback) {
        var reader = $("#" + readerId);
        if (reader.is(':visible')) {
            reader.fadeOut();
            if (reader.data('stream')) {
                reader.html5_qrcode_stop();
            }
            return;
        }
        reader.empty();
        reader.fadeIn();
        reader.html5_qrcode(
            function (data) {
                KRS.logConsole(data);
                callback(data);
                reader.hide();
                reader.html5_qrcode_stop();
            },
            function (error) {},
            function (videoError, localMediaStream) {
                KRS.logConsole(videoError);
                reader.hide();
                if (!localMediaStream) {
                    $.growl($.t("video_not_supported"));
                }
                if (reader.data('stream')) {
                    reader.html5_qrcode_stop();
                }
            }
        );
    }

    return KRS;
}(KRS || {}));

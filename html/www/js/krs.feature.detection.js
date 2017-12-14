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
var KRS = (function (KRS) {
    var isDesktopApplication = navigator.userAgent.indexOf("JavaFX") >= 0;
    var isPromiseSupported = (typeof Promise !== "undefined" && Promise.toString().indexOf("[native code]") !== -1);
    var isMobileDevice = window["cordova"] !== undefined;
    var isLocalHost = false;
    var remoteNode = null;
    var isLoadedOverHttps = ("https:" == window.location.protocol);

    KRS.isPrivateIP = function (ip) {
        if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
            return false;
        }
        var parts = ip.split('.');
        return parts[0] === '10' || parts[0] == '127' || parts[0] === '172' && (parseInt(parts[1], 10) >= 16 && parseInt(parts[1], 10) <= 31) || parts[0] === '192' && parts[1] === '168';
    };

    if (window.location && window.location.hostname) {
        var hostName = window.location.hostname.toLowerCase();
        isLocalHost = hostName == "localhost" || hostName == "127.0.0.1" || KRS.isPrivateIP(hostName);
    }

    KRS.isIndexedDBSupported = function() {
        return window.indexedDB !== undefined;
    };

    KRS.isExternalLinkVisible = function() {
        // When using JavaFX add a link to a web wallet except on Linux since on Ubuntu it sometimes hangs
        if (KRS.isMobileApp()) {
            return false;
        }
        return !(isDesktopApplication && navigator.userAgent.indexOf("Linux") >= 0);
    };

    KRS.isWebWalletLinkVisible = function() {
        if (KRS.isMobileApp()) {
            return false;
        }
        return isDesktopApplication && navigator.userAgent.indexOf("Linux") == -1;
    };

    KRS.isMobileApp = function () {
        return isMobileDevice || (KRS.mobileSettings && KRS.mobileSettings.is_simulate_app);
    };

    KRS.isEnableMobileAppSimulation = function () {
        return !isMobileDevice;
    };

    KRS.isRequireCors = function () {
        return !isMobileDevice;
    };

    KRS.isPollGetState = function() {
        // When using JavaFX do not poll the server unless it's a working as a proxy
        return !isDesktopApplication || KRS.state && KRS.state.apiProxy;
    };

    KRS.isUpdateRemoteNodes = function() {
        return KRS.state && KRS.state.apiProxy;
    };

    KRS.isRemoteNodeConnectionAllowed = function() {
        // The client always connects to remote nodes over Http since most Https nodes use a test certificate and
        // therefore cannot be used.
        // However, if the client itself is loaded over Https, it cannot connect to nodes over Http since this will
        // result in a mixed content error.
        return !isLoadedOverHttps;
    };

    KRS.isExportContactsAvailable = function() {
        return !isDesktopApplication; // When using JavaFX you cannot export the contact list
    };

    KRS.isFileEncryptionSupported = function() {
        return !isDesktopApplication; // When using JavaFX you cannot read the file to encrypt
    };

    KRS.isShowDummyCheckbox = function() {
        return isDesktopApplication && navigator.userAgent.indexOf("Linux") >= 0; // Correct rendering problem of checkboxes on Linux
    };

    KRS.isDecodePeerHallmark = function() {
        return isPromiseSupported;
    };

    KRS.getRemoteNodeUrl = function() {
        if (!KRS.isMobileApp()) {
            return "";
        }
        if (remoteNode) {
            return remoteNode.getUrl();
        }
        remoteNode = KRS.remoteNodesMgr.getRandomNode();
        if (remoteNode) {
            var url = remoteNode.getUrl();
            KRS.logConsole("Remote node url: " + url);
            return url;
        } else {
            KRS.logConsole("No available remote nodes");
            $.growl($.t("no_available_remote_nodes"));
        }
    };

    KRS.getRemoteNode = function () {
        return remoteNode;
    };

    KRS.resetRemoteNode = function(blacklist) {
        if (remoteNode && blacklist) {
            remoteNode.blacklist();
        }
        remoteNode = null;
    };

    KRS.getDownloadLink = function(url, link) {
        if (KRS.isMobileApp()) {
            var script = "KRS.openMobileBrowser(\"" + url + "\");";
            if (link) {
                link.attr("onclick", script);
                return;
            }
            return "<a onclick='" + script +"' class='btn btn-xs btn-default'>" + $.t("download") + "</a>";
        } else {
            if (link) {
                link.attr("href", url);
                return;
            }
            return "<a href='" + url + "' class='btn btn-xs btn-default'>" + $.t("download") + "</a>";
        }
    };

    KRS.openMobileBrowser = function(url) {
        try {
            // Works on Android 6.0 (does not work in 5.1)
            cordova.InAppBrowser.open(url, '_system');
        } catch(e) {
            KRS.logConsole(e.message);
        }
    };

    KRS.isCordovaScanningEnabled = function () {
        return isMobileDevice;
    };

    KRS.isScanningAllowed = function () {
        return isMobileDevice || isLocalHost || KRS.isTestNet;
    };

    KRS.isCameraPermissionRequired = function () {
        return device && device.platform == "Android" && device.version >= "6.0.0";
    };

    KRS.getShapeShiftUrl = function() {
        return KRS.settings.shape_shift_url;
    };

    KRS.getChangellyUrl = function() {
        return KRS.settings.changelly_url;
    };

    KRS.isForgingSupported = function() {
        return !KRS.isMobileApp() && !(KRS.state && KRS.state.apiProxy);
    };

    KRS.isFundingMonitorSupported = function() {
        return !KRS.isMobileApp() && !(KRS.state && KRS.state.apiProxy);
    };

    KRS.isShufflingSupported = function() {
        return !KRS.isMobileApp() && !(KRS.state && KRS.state.apiProxy);
    };

    KRS.isConfirmResponse = function() {
        return KRS.isMobileApp() || (KRS.state && KRS.state.apiProxy);
    };

    KRS.isDisplayOptionalDashboardTiles = function() {
        return !KRS.isMobileApp();
    };

    KRS.isShowClientOptionsLink = function() {
        return KRS.isMobileApp() || (KRS.state && KRS.state.apiProxy);
    };

    KRS.getGeneratorAccuracyWarning = function() {
        if (isDesktopApplication) {
            return "";
        }
        return $.t("generator_timing_accuracy_warning");
    };

    KRS.isInitializePlugins = function() {
        return !KRS.isMobileApp();
    };

    KRS.isShowRemoteWarning = function() {
        return !isLocalHost;
    };

    KRS.isForgingSafe = function() {
        return isLocalHost;
    };

    KRS.isPassphraseAtRisk = function() {
        return !isLocalHost || KRS.state && KRS.state.apiProxy || KRS.isMobileApp();
    };

    KRS.isWindowPrintSupported = function() {
        return !isDesktopApplication && !isMobileDevice;
    };

    KRS.isDisableScheduleRequest = function() {
        return KRS.isMobileApp() || (KRS.state && KRS.state.apiProxy);
    };

    return KRS;
}(Object.assign(KRS || {}, isNode ? global.client : {}), jQuery));

if (isNode) {
    module.exports = KRS;
}

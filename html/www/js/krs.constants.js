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
var KRS = (function (KRS, $) {
    KRS.constants = {
        'DB_VERSION': 2,

        'PLUGIN_VERSION': 1,
        'MAX_SHORT_JAVA': 32767,
        'MAX_UNSIGNED_SHORT_JAVA': 65535,
        'MAX_INT_JAVA': 2147483647,
        'MIN_PRUNABLE_MESSAGE_LENGTH': 28,
        'DISABLED_API_ERROR_CODE': 16,

        //Plugin launch status numbers
        'PL_RUNNING': 1,
        'PL_PAUSED': 2,
        'PL_DEACTIVATED': 3,
        'PL_HALTED': 4,

        //Plugin validity status codes
        'PV_VALID': 100,
        'PV_NOT_VALID': 300,
        'PV_UNKNOWN_MANIFEST_VERSION': 301,
        'PV_INCOMPATIBLE_MANIFEST_VERSION': 302,
        'PV_INVALID_MANIFEST_FILE': 303,
        'PV_INVALID_MISSING_FILES': 304,
        'PV_INVALID_JAVASCRIPT_FILE': 305,

        //Plugin KRS compatibility status codes
        'PNC_COMPATIBLE': 100,
        'PNC_COMPATIBILITY_MINOR_RELEASE_DIFF': 101,
        'PNC_COMPATIBILITY_WARNING': 200,
        'PNC_COMPATIBILITY_MAJOR_RELEASE_DIFF': 202,
        'PNC_NOT_COMPATIBLE': 300,
        'PNC_COMPATIBILITY_UNKNOWN': 301,
        'PNC_COMPATIBILITY_CLIENT_VERSION_TOO_OLD': 302,

        'VOTING_MODELS': {},
        'MIN_BALANCE_MODELS': {},
        "HASH_ALGORITHMS": {},
        "PHASING_HASH_ALGORITHMS": {},
        "MINTING_HASH_ALGORITHMS": {},
        "REQUEST_TYPES": {},
        "API_TAGS": {},

        'SERVER': {},
        'MAX_TAGGED_DATA_DATA_LENGTH': 0,
        'MAX_PRUNABLE_MESSAGE_LENGTH': 0,
        'GENESIS': '',
        'GENESIS_RS': '',
        'EPOCH_BEGINNING': 0,
        'FORGING': 'forging',
        'NOT_FORGING': 'not_forging',
        'UNKNOWN': 'unknown',
        'LAST_KNOWN_BLOCK': { id: "2057812077851428759", height: "1412000" },
        'LAST_KNOWN_TESTNET_BLOCK': { id: "5232413087824425542", height: "1367000" },
        'IGNIS_CURRENCY_CODE': "JLRDA",
        'SCHEDULE_PREFIX': "schedule"
    };

    KRS.loadAlgorithmList = function (algorithmSelect, isPhasingHash) {
        var hashAlgorithms;
        if (isPhasingHash) {
            hashAlgorithms = KRS.constants.PHASING_HASH_ALGORITHMS;
        } else {
            hashAlgorithms = KRS.constants.HASH_ALGORITHMS;
        }
        for (var key in hashAlgorithms) {
            if (hashAlgorithms.hasOwnProperty(key)) {
                algorithmSelect.append($("<option />").val(hashAlgorithms[key]).text(key));
            }
        }
    };

    KRS.processConstants = function(response, resolve) {
        if (response.genesisAccountId) {
            KRS.constants.SERVER = response;
            KRS.constants.VOTING_MODELS = response.votingModels;
            KRS.constants.MIN_BALANCE_MODELS = response.minBalanceModels;
            KRS.constants.HASH_ALGORITHMS = response.hashAlgorithms;
            KRS.constants.PHASING_HASH_ALGORITHMS = response.phasingHashAlgorithms;
            KRS.constants.MINTING_HASH_ALGORITHMS = response.mintingHashAlgorithms;
            KRS.constants.MAX_TAGGED_DATA_DATA_LENGTH = response.maxTaggedDataDataLength;
            KRS.constants.MAX_PRUNABLE_MESSAGE_LENGTH = response.maxPrunableMessageLength;
            KRS.constants.GENESIS = response.genesisAccountId;
            KRS.constants.GENESIS_RS = converters.convertNumericToRSAccountFormat(response.genesisAccountId);
            KRS.constants.EPOCH_BEGINNING = response.epochBeginning;
            KRS.constants.REQUEST_TYPES = response.requestTypes;
            KRS.constants.API_TAGS = response.apiTags;
            KRS.constants.SHUFFLING_STAGES = response.shufflingStages;
            KRS.constants.SHUFFLING_PARTICIPANTS_STATES = response.shufflingParticipantStates;
            KRS.constants.DISABLED_APIS = response.disabledAPIs;
            KRS.constants.DISABLED_API_TAGS = response.disabledAPITags;
            KRS.constants.PEER_STATES = response.peerStates;
            KRS.constants.CURRENCY_TYPES = response.currencyTypes;
            KRS.constants.PROXY_NOT_FORWARDED_REQUESTS = response.proxyNotForwardedRequests;
            KRS.loadTransactionTypeConstants(response);
            console.log("done loading server constants");
            if (resolve) {
                resolve();
            }
        }
    };

    KRS.loadServerConstants = function(resolve) {
        function processConstants(response) {
            KRS.processConstants(response, resolve);
        }
        if (KRS.isMobileApp()) {
            jQuery.ajaxSetup({ async: false });
            $.getScript("js/data/constants.js" );
            jQuery.ajaxSetup({async: true});
            processConstants(KRS.constants.SERVER);
        } else {
            if (isNode) {
                client.sendRequest("getConstants", {}, processConstants, false);
            } else {
                KRS.sendRequest("getConstants", {}, processConstants, false);
            }
        }
    };

    function getKeyByValue(map, value) {
        for (var key in map) {
            if (map.hasOwnProperty(key)) {
                if (value === map[key]) {
                    return key;
                }
            }
        }
        return null;
    }

    KRS.getVotingModelName = function (code) {
        return getKeyByValue(KRS.constants.VOTING_MODELS, code);
    };

    KRS.getVotingModelCode = function (name) {
        return KRS.constants.VOTING_MODELS[name];
    };

    KRS.getMinBalanceModelName = function (code) {
        return getKeyByValue(KRS.constants.MIN_BALANCE_MODELS, code);
    };

    KRS.getMinBalanceModelCode = function (name) {
        return KRS.constants.MIN_BALANCE_MODELS[name];
    };

    KRS.getHashAlgorithm = function (code) {
        return getKeyByValue(KRS.constants.HASH_ALGORITHMS, code);
    };

    KRS.getShufflingStage = function (code) {
        return getKeyByValue(KRS.constants.SHUFFLING_STAGES, code);
    };

    KRS.getShufflingParticipantState = function (code) {
        return getKeyByValue(KRS.constants.SHUFFLING_PARTICIPANTS_STATES, code);
    };

    KRS.getPeerState = function (code) {
        return getKeyByValue(KRS.constants.PEER_STATES, code);
    };

    KRS.getECBlock = function(isTestNet) {
        return isTestNet ? KRS.constants.LAST_KNOWN_TESTNET_BLOCK : KRS.constants.LAST_KNOWN_BLOCK;
    };

    KRS.isRequireBlockchain = function(requestType) {
        if (!KRS.constants.REQUEST_TYPES[requestType]) {
            // For requests invoked before the getConstants request returns,
            // we implicitly assume that they do not require the blockchain
            return false;
        }
        return true == KRS.constants.REQUEST_TYPES[requestType].requireBlockchain;
    };

    KRS.isRequireFullClient = function(requestType) {
        if (!KRS.constants.REQUEST_TYPES[requestType]) {
            // For requests invoked before the getConstants request returns,
            // we implicitly assume that they do not require full client
            return false;
        }
        return true == KRS.constants.REQUEST_TYPES[requestType].requireFullClient;
    };

    KRS.isRequestForwardable = function(requestType) {
        return KRS.isRequireBlockchain(requestType) &&
            !KRS.isRequireFullClient(requestType) &&
            (!(KRS.constants.PROXY_NOT_FORWARDED_REQUESTS instanceof Array) ||
            KRS.constants.PROXY_NOT_FORWARDED_REQUESTS.indexOf(requestType) < 0);
    };

    KRS.isRequirePost = function(requestType) {
        if (!KRS.constants.REQUEST_TYPES[requestType]) {
            // For requests invoked before the getConstants request returns
            // we implicitly assume that they can use GET
            return false;
        }
        return true == KRS.constants.REQUEST_TYPES[requestType].requirePost;
    };

    KRS.isRequestTypeEnabled = function(requestType) {
        if ($.isEmptyObject(KRS.constants.REQUEST_TYPES)) {
            return true;
        }
        if (requestType.indexOf("+") > 0) {
            requestType = requestType.substring(0, requestType.indexOf("+"));
        }
        return !!KRS.constants.REQUEST_TYPES[requestType];
    };

    KRS.isSubmitPassphrase = function (requestType) {
        return requestType == "startForging" ||
            requestType == "stopForging" ||
            requestType == "startShuffler" ||
            requestType == "getForging" ||
            requestType == "markHost" ||
            requestType == "startFundingMonitor";
    };

    KRS.isScheduleRequest = function (requestType) {
        var keyword = KRS.constants.SCHEDULE_PREFIX;
        return requestType && requestType.length >= keyword.length && requestType.substring(0, keyword.length) == keyword;
    };

    KRS.getFileUploadConfig = function (requestType, data) {
        var config = {};
        if (requestType == "uploadTaggedData") {
            config.selector = "#upload_file";
            config.requestParam = "file";
            config.errorDescription = "error_file_too_big";
            config.maxSize = KRS.constants.MAX_TAGGED_DATA_DATA_LENGTH;
            return config;
        } else if (requestType == "dgsListing") {
            config.selector = "#dgs_listing_image";
            config.requestParam = "messageFile";
            config.errorDescription = "error_image_too_big";
            config.maxSize = KRS.constants.MAX_PRUNABLE_MESSAGE_LENGTH;
            return config;
        } else if (requestType == "sendMessage") {
            config.selector = "#upload_file_message";
            if (data.encrypt_message) {
                config.requestParam = "encryptedMessageFile";
            } else {
                config.requestParam = "messageFile";
            }
            config.errorDescription = "error_message_too_big";
            config.maxSize = KRS.constants.MAX_PRUNABLE_MESSAGE_LENGTH;
            return config;
        }
        return null;
    };

    KRS.isApiEnabled = function(depends) {
        if (!depends) {
            return true;
        }
        var tags = depends.tags;
        if (tags) {
            for (var i=0; i < tags.length; i++) {
                if (tags[i] && !tags[i].enabled) {
                    return false;
                }
            }
        }
        var apis = depends.apis;
        if (apis) {
            for (i=0; i < apis.length; i++) {
                if (apis[i] && !apis[i].enabled) {
                    return false;
                }
            }
        }
        return true;
    };

    return KRS;
}(Object.assign(KRS || {}, isNode ? global.client : {}), jQuery));

if (isNode) {
    module.exports = KRS;
}
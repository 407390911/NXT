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

    function isIndexedDBSupported() {
        return KRS.databaseSupport;
    }

    KRS.storageSelect = function (table, query, callback) {
        if (isIndexedDBSupported()) {
            KRS.database.select(table, query, callback);
            return;
        }
        var items = KRS.getAccountJSONItem(table);
        if (!items) {
            if (callback) {
                callback("No items to select", []);
            }
            return;
        }
        var response = [];
        for (var i=0; i<items.length; i++) {
            if (!query || query.length == 0) {
                response.push(items[i]);
                continue;
            }
            for (var j=0; j<query.length; j++) {
                Object.keys(query[j]).forEach(function(key) {
                    if (items[i][key] == query[j][key]) {
                        response.push(items[i]);
                    }
                })
            }
        }
        if (callback) {
            callback(null, response);
        }
    };

    KRS.storageInsert = function(table, key, data, callback, isAutoIncrement) {
        if (isIndexedDBSupported()) {
            return KRS.database.insert(table, data, callback);
        }
        var items = KRS.getAccountJSONItem(table);
        if (!items) {
            items = [];
        }
        for (var i=0; i<items.length; i++) {
            for (var j=0; j<data.length; j++) {
                if (items[i][key] == data[j][key]) {
                    if (callback) {
                        callback("Key already exists: " + items[i][key], []);
                    }
                    return;
                }
            }
        }

        if ($.isArray(data)) {
            for (i = 0; i < data.length; i++) {
                insertItem(data[i]);
            }
        } else {
            insertItem(data);
        }
        KRS.setAccountJSONItem(table, items);
        if (callback) {
            callback(null, items);
        }

        function insertItem(item) {
            if (!isAutoIncrement) {
                items.push(item);
                return;
            }
            if (item.id) {
                if (callback) {
                    callback("Cannot use auto increment id since data already contains id value", []);
                }
                return;
            }
            if (items.length == 0) {
                item.id = 1;
            } else {
                item.id = items[items.length - 1].id + 1;
            }
            items.push(item);
        }
    };

    KRS.storageUpdate = function (table, data, query, callback) {
        if (isIndexedDBSupported()) {
            return KRS.database.update(table, data, query, callback);
        }
        var items = KRS.getAccountJSONItem(table);
        if (!items) {
            if (callback) {
                callback("No items to update", []);
            }
            return;
        }
        if (!query) {
            if (callback) {
                callback("No update query", []);
            }
            return;
        }
        for (var i=0; i<items.length; i++) {
            for (var j=0; j<query.length; j++) {
                Object.keys(query[j]).forEach(function(key) {
                    if (items[i][key] == query[j][key]) {
                        Object.keys(data).forEach(function(dataKey) {
                            items[i][dataKey] = data[dataKey];
                        })
                    }
                });
            }
        }
        KRS.setAccountJSONItem(table, items);
        if (callback) {
            callback(null, items);
        }
    };

    KRS.storageDelete = function (table, query, callback) {
        if (isIndexedDBSupported()) {
            return KRS.database.delete(table, query, callback);
        }
        var items = KRS.getAccountJSONItem(table);
        if (!items) {
            if (callback) {
                callback(null, []);
            }
            return;
        }
        for (var i=0; i<items.length; i++) {
            for (var j=0; j<query.length; j++) {
                Object.keys(query[j]).forEach(function(key) {
                    if (items[i][key] == query[j][key]) {
                        items.splice(i, 1);
                    }
                })
            }
        }
        KRS.setAccountJSONItem(table, items);
        if (callback) {
            callback(null, items);
        }
    };

    KRS.localStorageDrop = function(table) {
        KRS.removeAccountItem(table);
    };

    KRS.getStrItem = function (key) {
        return localStorage.getItem(key);
    };

    KRS.setStrItem = function (key, data) {
        localStorage.setItem(key, data);
    };

    KRS.getJSONItem = function (key) {
        return JSON.parse(localStorage.getItem(key));
    };

    KRS.setJSONItem = function (key, data) {
        var jsonData = JSON.stringify(data);
        localStorage.setItem(key, jsonData);
    };

    KRS.removeItem = function (key) {
        localStorage.removeItem(key);
    };

    KRS.getAccountJSONItem = function (key) {
        return KRS.getJSONItem(getAccountKey(key));
    };

    KRS.setAccountJSONItem = function (key, data) {
        KRS.setJSONItem(getAccountKey(key), data)
    };

    KRS.removeAccountItem = function (key) {
        KRS.removeItem(getAccountKey(key));
    };

    function getAccountKey(key) {
        if (KRS.account === "") {
            return key;
        }
        return key + "." + KRS.account;
    }

    return KRS;
}(KRS || {}, jQuery));
/*
 * Copyright © 2013-2016 The Kpl Core Developers.
 * Copyright © 2016-2017 Jelurida IP B.V.
 *
 * See the LICENSE.txt file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with Jelurida B.V.,
 * no part of the Kpl software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE.txt file.
 *
 * Removal or modification of this copyright notice is prohibited.
 *
 */

package kpl;

import kpl.db.BasicDb;
import kpl.db.TransactionalDb;

public final class Db {

    public static final String PREFIX = Constants.isTestnet ? "kpl.testDb" : "kpl.db";
    public static final TransactionalDb db = new TransactionalDb(new BasicDb.DbProperties()
            .maxCacheSize(Kpl.getIntProperty("kpl.dbCacheKB"))
            .dbUrl(Kpl.getStringProperty(PREFIX + "Url"))
            .dbType(Kpl.getStringProperty(PREFIX + "Type"))
            .dbDir(Kpl.getStringProperty(PREFIX + "Dir"))
            .dbParams(Kpl.getStringProperty(PREFIX + "Params"))
            .dbUsername(Kpl.getStringProperty(PREFIX + "Username"))
            .dbPassword(Kpl.getStringProperty(PREFIX + "Password", null, true))
            .maxConnections(Kpl.getIntProperty("kpl.maxDbConnections"))
            .loginTimeout(Kpl.getIntProperty("kpl.dbLoginTimeout"))
            .defaultLockTimeout(Kpl.getIntProperty("kpl.dbDefaultLockTimeout") * 1000)
            .maxMemoryRows(Kpl.getIntProperty("kpl.dbMaxMemoryRows"))
    );

    public static void init() {
        db.init(new KplDbVersion());
    }

    static void shutdown() {
        db.shutdown();
    }

    private Db() {} // never

}

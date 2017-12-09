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

package kpl.tools;

import kpl.http.GetConstants;
import kpl.util.JSON;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.Writer;

public class ConstantsExporter {
    public static void main(String[] args) {
        if (args.length != 1) {
            System.out.println("Usage: ConstantsExporter <destination constants.js file>");
            System.exit(1);
        }

        Writer writer;
        try {
            writer = new FileWriter(new File(args[0]));
            writer.write("if (!KRS) {\n" +
                    "    var KRS = {};\n" +
                    "    KRS.constants = {};\n" +
                    "}\n\n");
            writer.write("KRS.constants.SERVER = ");
            JSON.writeJSONString(GetConstants.getConstants(), writer);
            writer.write("\n\n" +
                    "if (isNode) {\n" +
                    "    module.exports = KRS.constants.SERVER;\n" +
                    "}\n");
            writer.close();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}

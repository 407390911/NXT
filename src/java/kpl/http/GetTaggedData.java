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

package kpl.http;

import kpl.Kpl;
import kpl.KplException;
import kpl.TaggedData;
import kpl.util.JSON;
import org.json.simple.JSONStreamAware;

import javax.servlet.http.HttpServletRequest;

import static kpl.http.JSONResponses.PRUNED_TRANSACTION;

public final class GetTaggedData extends APIServlet.APIRequestHandler {

    static final GetTaggedData instance = new GetTaggedData();

    private GetTaggedData() {
        super(new APITag[] {APITag.DATA}, "transaction", "includeData", "retrieve");
    }

    @Override
    protected JSONStreamAware processRequest(HttpServletRequest req) throws KplException {
        long transactionId = ParameterParser.getUnsignedLong(req, "transaction", true);
        boolean includeData = !"false".equalsIgnoreCase(req.getParameter("includeData"));
        boolean retrieve = "true".equalsIgnoreCase(req.getParameter("retrieve"));

        TaggedData taggedData = TaggedData.getData(transactionId);
        if (taggedData == null && retrieve) {
            if (Kpl.getBlockchainProcessor().restorePrunedTransaction(transactionId) == null) {
                return PRUNED_TRANSACTION;
            }
            taggedData = TaggedData.getData(transactionId);
        }
        if (taggedData != null) {
            return JSONData.taggedData(taggedData, includeData);
        }
        return JSON.emptyJSON;
    }

}

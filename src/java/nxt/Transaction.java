/*
 * Copyright © 2013-2016 The Nxt Core Developers.
 * Copyright © 2016-2017 Jelurida IP B.V.
 *
 * See the LICENSE.txt file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with Jelurida B.V.,
 * no part of the Nxt software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE.txt file.
 *
 * Removal or modification of this copyright notice is prohibited.
 *
 */

package nxt;

import nxt.util.Filter;
import org.json.simple.JSONObject;

import java.util.List;

public interface Transaction {

    interface Builder {
        //接收者身份id
        Builder recipientId(long recipientId);

        //参考交易哈希值
        Builder referencedTransactionFullHash(String referencedTransactionFullHash);

        //附加消息-普通消息类
        Builder appendix(Appendix.Message message);

        //附加消息-消息加密类
        Builder appendix(Appendix.EncryptedMessage encryptedMessage);

        //附件消息-给自己的加密的消息类
        Builder appendix(Appendix.EncryptToSelfMessage encryptToSelfMessage);

        //附件消息-发布关键公告类
        Builder appendix(Appendix.PublicKeyAnnouncement publicKeyAnnouncement);

        //附件消息-修剪计划消息类
        Builder appendix(Appendix.PrunablePlainMessage prunablePlainMessage);

        //附件消息-修剪加密消息类
        Builder appendix(Appendix.PrunableEncryptedMessage prunableEncryptedMessage);

        //附件消息-同步（分阶段按步骤）类
        Builder appendix(Appendix.Phasing phasing);

        //时间戳
        Builder timestamp(int timestamp);

        //？？区块高度--ec什么意思？外部外面，远离？ec区块？
        Builder ecBlockHeight(int height);

        Builder ecBlockId(long blockId);
        Transaction build() throws NxtException.NotValidException;
        //加密短语secretPhrase构建交易？
        Transaction build(String secretPhrase) throws NxtException.NotValidException;

    }

    long getId();

    //字符串id
    String getStringId();

    //获取发送者id
    long getSenderId();

    //获取发送者的公钥
    byte[] getSenderPublicKey();

    //接收者id
    long getRecipientId();

    //获取高度(交易的高度?)
    int getHeight();

    //获取区块id
    long getBlockId();

    //
    Block getBlock();

    //
    short getIndex();

    //获取时间戳
    int getTimestamp();

    //获取区块时间戳
    int getBlockTimestamp();

    //获取最后时间
    short getDeadline();

    //过期
    int getExpiration();

    //NQT数量
    long getAmountNQT();

    //NQT费用
    long getFeeNQT();

    //获取参考交易的哈希
    String getReferencedTransactionFullHash();

    //获取签名
    byte[] getSignature();

    //全部哈希
    String getFullHash();

    //交易类型
    TransactionType getType();

    //获取附件
    Attachment getAttachment();

    //验证签名
    boolean verifySignature();

    //验证
    void validate() throws NxtException.ValidationException;

    //
    byte[] getBytes();

    //
    byte[] getUnsignedBytes();

    //
    JSONObject getJSONObject();

    //删除的附件json
    JSONObject getPrunableAttachmentJSON();

    //版本
    byte getVersion();

    //全部大小
    int getFullSize();

    //
    Appendix.Message getMessage();

    //
    Appendix.EncryptedMessage getEncryptedMessage();

    //
    Appendix.EncryptToSelfMessage getEncryptToSelfMessage();

    //
    Appendix.Phasing getPhasing();

    //获取删减的普通信息
    Appendix.PrunablePlainMessage getPrunablePlainMessage();

    //获取删减的历史信息
    Appendix.PrunableEncryptedMessage getPrunableEncryptedMessage();

    //获取附件
    List<? extends Appendix> getAppendages();

    List<? extends Appendix> getAppendages(boolean includeExpiredPrunable);

    List<? extends Appendix> getAppendages(Filter<Appendix> filter, boolean includeExpiredPrunable);

    //获取ec区块高度
    int getECBlockHeight();

    //获取ec区块id
    long getECBlockId();
}

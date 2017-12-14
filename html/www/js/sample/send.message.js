var loader = require("./loader");
var config = loader.config;

loader.load(function(KRS) {
    var data = {
        recipient: KRS.getAccountIdFromPublicKey(config.recipientPublicKey),
        secretPhrase: config.secretPhrase,
        encryptedMessageIsPrunable: "true"
    };
    data = Object.assign(
        data,
        KRS.getMandatoryParams(),
        KRS.encryptMessage(KRS, "message to recipient", config.secretPhrase, config.recipientPublicKey, false)
    );
    KRS.sendRequest("sendMessage", data, function (response) {
        KRS.logConsole(JSON.stringify(response));
    });
});
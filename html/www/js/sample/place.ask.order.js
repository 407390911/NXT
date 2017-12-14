var loader = require("./loader");
var config = loader.config;

loader.load(function(KRS) {
    const decimals = 2;
    var quantity = 2.5;
    var price = 1.3;
    var data = {
        asset: "6094526212840718212", // testnet Megasset
        quantityQNT: KRS.convertToQNT(quantity, decimals),
        priceNQT: KRS.calculatePricePerWholeQNT(KRS.convertToNQT(price), decimals),
        secretPhrase: config.secretPhrase
    };
    data = Object.assign(
        data,
        KRS.getMandatoryParams()
    );
    KRS.sendRequest("placeAskOrder", data, function (response) {
        KRS.logConsole(JSON.stringify(response));
    });
});

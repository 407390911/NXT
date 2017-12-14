var loader = require("./loader");
var config = loader.config;

loader.load(function(KRS) {
    const decimals = 2;
    var quantity = 123.45;
    var price = 1.2;
    var data = {
        asset: "6094526212840718212",
        quantityQNT: KRS.convertToQNT(quantity, decimals),
        priceNQT: KRS.calculatePricePerWholeQNT(KRS.convertToNQT(price), decimals),
        secretPhrase: config.secretPhrase
    };
    data = Object.assign(
        data,
        KRS.getMandatoryParams()
    );
    KRS.sendRequest("placeBidOrder", data, function (response) {
        KRS.logConsole(JSON.stringify(response));
    });
});

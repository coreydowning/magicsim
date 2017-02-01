var Q = require("Q");
var cartesianProduct = require("cartesian-product");
var fs = require("fs");
var exec = require('child_process').exec;
var zip = require('node-7z')
var xpath = require('xpath');
var dom = require('xmldom').DOMParser;
var http = require('http');

var region = process.argv[2];
var realm = process.argv[3];
var name = process.argv[4];

var config = { names: ["fighttime","fightstyle"], values: [[250, 400],["low_movement","high_movement","patchwerk"]]};

var cp = config.names.reduce(function(prev, cur) {
    var name= cur;
    var values =config.values[config.names.indexOf(cur)];
    var cp = cartesianProduct([[name], values]);
    return prev.concat([cp]);
},[]);


var configurations = cartesianProduct(cp);

Q.nfcall(fs.readdir,"templates").then(function(templates) {
    return cartesianProduct([templates,configurations]);
}).then(function(sims){
    return Q.all(sims.map(function(sim){
        return Q.nfcall(fs.readFile, "templates/"+ sim[0], "utf-8").then(function(templateData){
            var fighttime;
            var fightstyle;
            sim[1].forEach(function(variable) {
                if(variable[0] == "fighttime") {
                    fighttime = variable[1];
                } else if(variable[0] == "fightstyle") {
                    fightstyle = variable[1]
                }
                templateData = templateData.replace("%" + variable[0] + "%",variable[1]);
            })
            templateData = templateData.replace("%region%",region);
            templateData = templateData.replace("%realm%",realm);
            templateData = templateData.replace("%name%",name);
            var filename = sim[0].replace("template", name+"_"+fighttime+"_"+fightstyle.replace("_", ""));
            templateData = templateData.replace("%filename%",filename);
            return {data: templateData,fileName: filename};
        }).then(function(data) {
            if (!fs.existsSync('./sims/')) { 
                fs.mkdirSync('./sims/');
            }
            return Q.nfcall(fs.writeFile, "./sims/"+data.fileName, data.data, "utf-8")
        });
    }))
}).then(function() {
    var deferred = Q.defer();
    var rawData = "";
    http.get("http://downloads.simulationcraft.org/?C=M;O=D", (response) => {
        response.on('data', (chunk) => rawData += chunk);
        response.on('end', () => {
            deferred.resolve(rawData);
        });
    });

    return deferred.promise;
}).then((response) => {
        var doc = new dom().parseFromString(response, "text/html")
        var select = xpath.useNamespaces({ h: 'http://www.w3.org/1999/xhtml' });
        var link = "http://downloads.simulationcraft.org/" + select("//h:html/h:body/h:table/h:tr/h:td/h:a[contains(@href,'.7z')][1]/@href", doc)[0].value;
	    var file = fs.createWriteStream("simc.7z");
        var deferred = Q.defer();
        http.get(link, (response) => {
            response.pipe(file);
            response.on('end', () => {
                deferred.resolve("simc.7z");
            });
        })
        return deferred.promise;
	    //response.pipe(file);
	    //return Q.nfcall(zip.extractFull, file, 'bin');
}).then((name) => {
    var deferred = Q.defer();
    new zip().extractFull('simc.7z', 'bin', {})
    .progress((files) => {
        console.log(files);
    })
    .then(() => {
        console.log("done");
        deferred.resolve();
    }).catch((err) => {
        console.log(err);
    })
    return deferred.promise;
}).then(function() {
    // start simc run
    if (!fs.existsSync('./results/')) { 
        fs.mkdirSync('./results/');
    }
    var promises = fs.readdirSync("sims").map(function(sim) {
        // find a better way to pull the newest version.
        return Q.nfcall(exec, "../bin/" + fs.readdirSync("bin")[0] + "/simc.exe ../sims/" + sim, { cwd: "./results" }).then(function() {
            console.log("Done sim: " + sim);
        })
    });
    return Q.allSettled(promises).then(function() {
        // process results.
        var deferred2 = Q.defer();
        exec("node ./analyze.js", function(err, out, stderr) {
            console.log(out);
            deferred2.resolve();
        });
        return deferred2;
    });
}).done();
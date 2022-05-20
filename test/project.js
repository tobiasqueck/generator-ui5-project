const assert = require("yeoman-assert");
const path = require("path");
const helpers = require("yeoman-test");
const execa = require("execa");
const IsCIRun = process.env.CI;

function createTest(oPrompt) {
    it("should be able to create the project", function () {
        return helpers.run(path.join(__dirname, "../generators/app")).withPrompts(oPrompt);
    });

    it("should create the necessary ui5 files", function () {
        return assert.file([
            "uimodule/ui5.yaml",
            `uimodule/webapp/view/MainView.view.${oPrompt.viewtype.toLowerCase()}`,
            "uimodule/webapp/index.html",
            "uimodule/webapp/manifest.json"
        ]);
    });

    // regular easy-ui5 is used for scaffolding
    if (oPrompt.viewtype !== "XML") {
        it("should reference the base controller", function () {
            return assert.fileContent(
                "uimodule/webapp/controller/MainView.controller.js",
                "controller/BaseController"
            );
        });
    }

    // @sap-ux/fiori-freestyle-writer is used for scaffolding an XML-view based webapp
    if (oPrompt.viewtype === "XML" && oPrompt.ui5libs && oPrompt.platform) {
        it("should make sure the flpSandbox.html is in test/ and bootstraps SAPUI5", function () {
            return (
                assert.file("uimodule/webapp/test/flpSandbox.html") &&
                assert.fileContent("uimodule/webapp/test/flpSandbox.html", "https://sapui5.hana.ondemand.com")
            );
        });

        it("should reference the base controller via file path", function () {
            return assert.fileContent("uimodule/webapp/controller/MainView.controller.js", "./BaseController");
        });
    }

    if (
        !!oPrompt.platform &&
        oPrompt.platform !== "Static webserver" &&
        oPrompt.platform !== "SAP NetWeaver" &&
        oPrompt.platform !== "Application Router @ SAP HANA XS Advanced"
    ) {
        it("ui5.yaml middleware should point to the right xs-app.json file", function () {
            return assert.fileContent(
                "uimodule/ui5.yaml",
                oPrompt.platform === "Application Router @ Cloud Foundry"
                    ? "xsappJson: ../approuter/xs-app.json"
                    : "xsappJson: webapp/xs-app.json"
            );
        });
    }

    if (
        !!oPrompt.platform &&
        oPrompt.platform === "SAP HTML5 Application Repository service for SAP BTP" &&
        oPrompt.platform === "SAP Launchpad service"
    ) {
        it("ui5.yaml should leverage the ui5 zipper task", function () {
            return assert.fileContent("uimodule/ui5.yaml", "name: ui5-task-zipper");
        });
    }

    it("should create an installable project", function () {
        return execa.commandSync("npm install");
    });

    // run lint-fix after npm install, so that the npm test task won't fail
    it("should run lint-fix", function () {
        return execa.commandSync("npm run lint-fix");
    });

    it("should pass the OPA tests", function () {
        return execa.commandSync("npm test");
    });

    if (!!oPrompt.platform && oPrompt.platform !== "Static webserver" && oPrompt.platform !== "SAP NetWeaver") {
        it("should create an buildable project", async function () {
            try {
                await execa.commandSync("npm run build:mta");
            } catch (e) {
                throw new Error(e.stdout + "\n" + e.stderr);
            }
        });
    }
}

const NOT_SET = 'undefined';
function runTests() {
    const testConfig = {};
    let test = this;
    while(test && test.parent && test.parent.title) {
        if (test.title !== NOT_SET) {
            testConfig[test.parent.title] = test.title;
        } 
        test = test.parent.parent; 
    }

    if (!IsCIRun) {
        this.timeout(200000);
        it("log", function() { 
            console.log(testConfig);
        });
        createTest(testConfig);
        return;
    }
    const totalNodes = Number(process.env.NODES_TOTAL);
    const nodeIdx = Number(process.env.NODE_INDEX);
    const testsPerNode = Math.ceil(testConfigurations.length / totalNodes);
    const lowerBound = testsPerNode * nodeIdx;
    const upperBound = testsPerNode * (nodeIdx + 1);

    if (lowerBound <= index && index < upperBound) {
        createTest(testConfig);
    }
}

describe("Full project generation", function () {
    describe("viewtype", function() {
        describe("XML", function() {
            describe("platform", function() {
                describe(NOT_SET, runTests);
                describe("SAP HTML5 Application Repository service for SAP BTP", runTests);
                describe("SAP NetWeaver", runTests);
                describe("Application Router @ SAP HANA XS Advanced", runTests);
            });
        });
        describe("JS", function() {
            describe("platform", function() {
                describe.only("Application Router @ Cloud Foundry", runTests);
            });
        });
    });
});
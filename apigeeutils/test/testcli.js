const assert = require("assert"),
  path = require("path"),
  childProcess = require("child_process");

const commandsToTest = [
  "attachFlowHook",
  "detachFlowHook",
  "getFlowHook",
  "createTargetServer",
  "deleteTargetServer",
  "getTargetServer",
  "updateTargetServer",
  "listTargetServers",
  "createKVMmap",
  "addEntryToKVM",
  "getKVMentry",
  "updateKVMentry",
  "getKVMmap",
  "deleteKVMentry",
  "deleteKVMmap",
  "deployProxy",
  "deployNodeApp",
  "deployHostedTarget",
  "listDeployments",
  "undeploy",
  "fetchProxy",
  "getlogs",
  "delete",
  "createCache",
  "getCache",
  "listCaches",
  "clearCache",
  "deleteCache",
  "createProduct",
  "deleteProduct",
  "createDeveloper",
  "deleteDeveloper",
  "createApp",
  "createAppKey",
  "deleteApp",
  "deploySharedflow",
  "undeploySharedflow",
  "fetchSharedflow",
  "listSharedflowDeployments",
  "deleteSharedflow",
  "deployExistingRevision",
  "listRoles",
  "createRole",
  "getRole",
  "deleteRole",
  "getRolePermissions",
  "setRolePermissions",
  "assignUserRole",
  "removeUserRole",
  "verifyUserRole",
  "listRoleUsers"
];

describe("CLI invocation Test", function () {
  it("invoke cli with invalid arg", function (done) {
    let child = childProcess.spawnSync(
      "node",
      [path.join(__dirname, "../lib/cli.js"), "--invalid_arg"],
      { encoding: "utf8" }
    );

    assert(!child.error);
    assert(!child.stdout);
    assert(child.stderr);
    assert(child.stderr.split("\n").length > 32);
    done();
  });

  it("invoke cli with no arg, get help", function (done) {
    let child = childProcess.spawnSync(
      "node",
      [path.join(__dirname, "../lib/cli.js")],
      { encoding: "utf8" }
    );

    assert(!child.error);
    assert(!child.stdout);
    assert(child.stderr);
    assert(child.stderr.split("\n").length > 32);
    done();
  });

  commandsToTest.forEach((c) => {
    let maxLines = 0;
    it(`invoke cli with ${c}, get help`, function (done) {
      let child = childProcess.spawnSync(
        "node",
        [path.join(__dirname, "../lib/cli.js"), c],
        { encoding: "utf8" }
      );

      assert(!child.error, `error ${c}`);
      assert(child.stdout, `stdout ${c}`);
      let lines = child.stdout.trim().split("\n");
      assert(lines);
      maxLines = Math.max(maxLines, lines.length);
      assert(lines.length > 16, `lines ${c}`);
      assert.equal(lines[0], "Usage:", `lines[0] ${c}`);
      assert(child.stderr, `!stderr ${c}`);
      assert(child.stdout.split("\n").length > 3);
      done();
    });
  });
});

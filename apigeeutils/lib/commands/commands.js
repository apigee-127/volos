const Table = require("cli-table");
const options = require("../options");

const Commands = {
  attachFlowHook: {
    description: "Attach a Shared Flow to a Flow Hook",
    load: () => require("./attachFlowHook")
  },
  detachFlowHook: {
    description: "Detach a Shared Flow from a Flow Hook",
    load: () => require("./detachFlowHook")
  },
  getFlowHook: {
    description: "Get the Shared Flow attached to a Flow Hook",
    load: () => require("./getFlowHook")
  },
  createTargetServer: {
    description: "Create a Target Server",
    load: () => require("./createTargetServer")
  },
  deleteTargetServer: {
    description: "Delete a Target Server",
    load: () => require("./deleteTargetServer")
  },
  getTargetServer: {
    description: "Get a Target Server",
    load: () => require("./getTargetServer")
  },
  listTargetServers: {
    description: "List Target Servers",
    load: () => require("./listTargetServers")
  },
  updateTargetServer: {
    description: "Update a Target Server",
    load: () => require("./updateTargetServer")
  },
  listProxies: {
    description: "List Proxies",
    load: () => require("./listProxies")
  },
  listSharedflows: {
    description: "List Shared Flows",
    load: () => require("./listSharedflows")
  },
  createKVMmap: {
    description: "Create a KVM map",
    load: () => require("./createKVMmap")
  },
  addEntryToKVM: {
    description: "Add an entry to a KVM map",
    load: () => require("./addEntryToKVM")
  },
  getKVMentry: {
    description: "Get an unencrypted KVM entry",
    load: () => require("./getKVMentry")
  },
  updateKVMEntry: {
    description: "Updates an entry in a KVM map",
    load: () => require("./updateKVMentry")
  },
  getKVMmap: {
    description: "Get a KVM map",
    load: () => require("./getKVMmap")
  },
  deleteKVMentry: {
    description: "Delete a single KVM entry",
    load: () => require("./deleteKVMentry")
  },
  deleteKVMmap: {
    description: "Delete an entire KVM map",
    load: () => require("./deleteKVMmap")
  },
  deployProxy: {
    description: "Deploy API Proxy",
    load: () => require("./deployProxy")
  },
  deployNodeApp: {
    description: "Deploy Node.js Application",
    load: () => require("./deployNodeApp")
  },
  deployHostedTarget: {
    description: "Deploy application as a Hosted Target proxy",
    load: () => require("./deployHostedTarget")
  },
  listDeployments: {
    description: "List Deployments",
    load: () => require("./listDeployments")
  },
  undeploy: {
    description: "Undeploy Proxy or Node.js Application",
    load: () => require("./undeploy")
  },
  fetchProxy: {
    description: "Download Proxy bundle",
    load: () => require("./fetchProxy")
  },
  getlogs: {
    description: "Get Application logs",
    load: () => require("./getlogs")
  },
  delete: {
    description: "Delete undeployed Proxy or Node.js Application",
    load: () => require("./delete")
  },
  createCache: {
    description: "Create a new Cache Resource in the environment",
    load: () => require("./createCache")
  },
  getCache: {
    description: "Get a KVM map",
    load: () => require("./getCache")
  },
  deleteCache: {
    description: "Deletes a Cache Resource in the environment",
    load: () => require("./deleteCache")
  },
  listCaches: {
    description: "Lists Cache Resources in the environment",
    load: () => require("./listCaches")
  },
  clearCache: {
    description:
      "Clears the entries in a named Cache Resource in the environment",
    load: () => require("./clearCache")
  },
  createProduct: {
    description: "Create a new API Product",
    load: () => require("./createProduct")
  },
  deleteProduct: {
    description: "Delete a API Product",
    load: () => require("./deleteProduct")
  },
  createDeveloper: {
    description: "Create a new Developer",
    load: () => require("./createDeveloper")
  },
  deleteDeveloper: {
    description: "Delete a Developer",
    load: () => require("./deleteDeveloper")
  },
  createApp: {
    description: "Create a new App",
    load: () => require("./createApp")
  },
  createAppKey: {
    description: "Create a new App",
    load: () => require("./createAppKey")
  },
  deleteApp: {
    description: "Delete a App",
    load: () => require("./deleteApp")
  },
  deploySharedflow: {
    description: "Deploy SharedFlow",
    load: () => require("./deploySharedflow")
  },
  undeploySharedflow: {
    description: "Undeploy SharedFlow",
    load: () => require("./undeploySharedflow")
  },
  fetchSharedflow: {
    description: "Download SharedFlow bundle",
    load: () => require("./fetchSharedflow")
  },
  listSharedflowDeployments: {
    description: "List SharedFlow deployments",
    load: () => require("./listSharedflowDeployments")
  },
  deleteSharedflow: {
    description: "Delete undeployed SharedFlow",
    load: () => require("./deleteSharedflow")
  },
  deployExistingRevision: {
    description: "Deploy an existing revision to an environment",
    load: () => require("./deployExistingRevision")
  },
  listRoles: {
    description: "List roles in an organziation",
    load: () => require("./listRoles")
  },
  createRole: {
    description: "Create a userrole in an organziation",
    load: () => require("./createRole")
  },
  getRole: {
    description: "Get a userrole in an organziation",
    load: () => require("./getRole")
  },
  deleteRole: {
    description: "Delete a userrole in an organziation",
    load: () => require("./deleteRole")
  },
  getRolePermissions: {
    description: "Get resource permissions for a role",
    load: () => require("./getRolePermissions")
  },
  setRolePermissions: {
    description: "Set resource permissions for a role",
    load: () => require("./setRolePermissions")
  },
  assignUserRole: {
    description: "Assign user to a role",
    load: () => require("./assignUserRole")
  },
  removeUserRole: {
    description: "Remove user from a role",
    load: () => require("./removeUserRole")
  },
  verifyUserRole: {
    description: "Verify a user is in a role",
    load: () => require("./verifyUserRole")
  },
  listRoleUsers: {
    description: "List users in role",
    load: () => require("./listRoleUsers")
  }
};

module.exports.printCommandHelp = function () {
  console.error();
  console.error("Valid commands:");

  let tab = new Table(options.TableFormat);

  Object.keys(Commands)
    .sort()
    .forEach((key) => {
      tab.push([key, Commands[key].description]);
    });

  console.error(tab.toString());
};

module.exports.getCommand = function (n) {
  let commandKey = Object.keys(Commands).find(
    (key) => key.toLowerCase() === n.toLowerCase()
  );

  return Commands[commandKey];
};

const Table = require("cli-table");
const options = require("../options");

const Commands = {
  deployProxy: {
    description: "Deploy API Proxy",
    load: () => require("./deployProxy")
  },
  listDeployments: {
    description: "List Deployments",
    load: () => require("./listDeployments")
  },
  createProduct: {
    description: "Create a new API Product",
    load: () => require("./createProduct")
  },
  deleteProduct: {
    description: "Delete a API Product",
    load: () => require("./deleteProduct")
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
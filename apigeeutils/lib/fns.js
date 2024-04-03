const fns = [
        'listProxies', 'listSharedflows', 'listDeployments',
        'undeploy', 'fetchProxy', 'deployProxy', 'delete',
        'deployNodeApp', 'deployHostedTarget', 'getLogs',
        'createCache', 'deleteCache', 'getCache', 'listCaches', 'clearCache',
        'createProduct', 'deleteProduct',
        'createDeveloper', 'deleteDeveloper',
        'createApp', 'createAppKey', 'deleteApp',
        'createTargetServer', 'getTargetServer', 'deleteTargetServer',
        'listTargetServers', 'updateTargetServer',
        'createKVM', 'deleteKVM', 'getKVMentry', 'getKVMmap',
        'addEntryToKVM', 'deleteKVMentry', 'updateKVMentry',
        'deploySharedflow', 'undeploySharedflow', 'fetchSharedflow',
        'listSharedflowDeployments', 'deleteSharedflow',
        'attachFlowHook', 'detachFlowHook', 'getFlowHook',
        'listRoles', 'getRole', 'createRole', 'deleteRole',
        'getRolePermissions', 'setRolePermissions',
        'assignUserRole', 'removeUserRole', 'verifyUserRole', 'listRoleUsers'
      ];

module.exports = fns;

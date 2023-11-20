//Documentation Link: link to documentation in confluence

var collectionName = "configlists"
var configurationListName = "ConfigList Name"; //input name of configlist (configlist.name)
var genericConfigDescriptor = "Generic Descriptor" //input generic value for configuration descriptor, maps to configlist.configurations[].descriptor.
var genericDetailDescriptor = "Generic Detail Descriptor" //input generic value for configuration detail descriptor, maps to configlist.configurations[].details[].descriptor.
var logs = [];
var bulkOps = [];

//key is codelist.code value, and value is array that translates to codelist.code.details.
var configListMappings = {
    "Config Name": [
        "Detail Identifier 1",
        "Detail Identifier 2"
    ]
};

function getConfigurationList(name) {
    return {
        "_id": ObjectId(),
        "applicableDataSegmentIds": [

        ],
        "readOnly": true,
        "name": name,
        "configurations": [
        ],
        "__v": NumberInt(0)
    }
};

function getConfiguration(name, descriptor) {
    return {
        "_id": ObjectId(),
        "name": name,
        "descriptor": descriptor,
        "details": [

        ]
    }
};

function getConfigurationDetail(identifier, descriptor) {
    return {
        "identifier": identifier,
        "descriptor": descriptor
    }
};

function handleUpdateConfigurationList(configList) {
    var configKeys = Object.keys(configListMappings);
    var existingConfigNames = configList.configurations.map(obj => obj.name);

    //handle additions
    configKeys.forEach(key => {
        if (!existingConfigNames.includes(key)) {
            var newConfig = getConfiguration(key, genericConfigDescriptor);

            configListMappings[key].forEach(identifier => {
                newConfig.details.push(getConfigurationDetail(identifier, genericDetailDescriptor));
            });

            bulkOps.push({ updateOne: { "filter": { "_id": configList._id }, "update": { $push: { 'configurations': newConfig } } } });
            logs.push(`Configuration added to configList.configurations: ${key}, with details ${configListMappings[key]}.`);
        } else {
            logs.push(`Configuration already present in configList.configurations: ${key}.`);

            configList.configurations.forEach(c => {
                if (c.name === key) {
                    var existingDetails = c.details.map(d => d.identifier);
                    configListMappings[key].forEach(newDetail => {
                        if (!existingDetails.includes(newDetail)) {
                            var addedDetail = getConfigurationDetail(newDetail, genericDetailDescriptor);
                            bulkOps.push({ updateOne: { "filter": { "_id": configList._id, "configurations.name": key }, "update": { $push: { 'configurations.$.details': addedDetail } } } });
                            logs.push(`Detail added to configList.configurations: ${key}, detail: ${newDetail}.`);
                        }
                    });
                }
            });
        }
    });

    //handle removals
    existingConfigNames.forEach(existingKey => {
        if (!configKeys.includes(existingKey)) {
            bulkOps.push({ updateOne: { "filter": { "_id": configList._id }, "update": { $pull: { 'configurations': { 'name': existingKey } } } } });
            logs.push(`Configuration removed from configList.configurations: ${existingKey}.`);
        } else {
            configList.configurations.forEach(c => {
                if (c.name === existingKey) {
                    var newDetails = configListMappings[existingKey];
                    c.details.map(d => d.identifier).forEach(existingDetail => {
                        if (!newDetails.includes(existingDetail)) {
                            bulkOps.push({
                                updateOne: {
                                    "filter": {
                                        "_id": configList._id,
                                        "configurations.name": existingKey,
                                        "configurations.details.identifier": existingDetail
                                    },
                                    "update": {
                                        $pull: { "configurations.$.details": { "identifier": existingDetail } }
                                    }
                                }
                            });

                            logs.push(`Detail removed to configlist.configurations: ${existingKey}, detail: ${existingDetail}.`);
                        }
                    });
                }
            });
        }
    });
};

function handleAddNewConfigurationList() {
    var newConfigList = getConfigurationList(configurationListName);
    logs.push(`Configuration List added: ${configurationListName}.`);

    Object.keys(configListMappings).forEach(key => {
        if (!newConfigList.configurations.map(obj => obj.name).includes(key)) {
            var newConfig = getConfiguration(key, genericConfigDescriptor);
            logs.push(`Configuration added to configlist.configurations: ${key}.`);

            configListMappings[key].forEach(identifier => {
                newConfig.details.push(getConfigurationDetail(identifier, genericDetailDescriptor));
                logs.push(`Configuration Detail added to code ${key}: ${identifier}.`);
            })

            newConfigList.configurations.push(newConfig)
        } else {
            logs.push(`Configuration already present in configlist.configurations: ${key}.`);
        }
    });

    bulkOps.push({
        insertOne: {
            "document": newConfigList
        }
    });
}

function handleConfigurationList() {
    var exists = false;

    db.getCollection(collectionName).find({ 'name': configurationListName }).forEach(configList => {
        exists = true;
        handleUpdateConfigurationList(configList);
    })

    if (!exists) {
        handleAddNewConfigurationList();
    }
}

function runOpsAndPrintLogs() {
    if (bulkOps.length > 0) {
        db.getCollection(collectionName).bulkWrite(bulkOps);
    }

    logs.forEach(l => { print(l); });
}

(function () {
    handleConfigurationList();
    runOpsAndPrintLogs();
})();
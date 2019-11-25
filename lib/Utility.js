/**
 * Company: MST Systemtechnik AG
 * Customer: Belimo AG
 * Author: mst_gruy
 * Date: 05.11.2019
 * Version: 0.1
 * 
 * Some helpers for the nodes
 */


// Payload

module.exports.createPayload= function(payload, topic, timestamp){
    let data = {}
    data.payload = payload
    if(topic){
        data.topic = topic
    }

    if(timestamp){
        data.timestamp = timestamp
    }

    return data
}

module.exports.createClient= function(payload, topic){
    let data = {}
    data.payload = 'connected'
    data.client = payload
    if(topic){
        data.topic = topic
    }
    return data
}

module.exports.createUiDropdownPayload = function(payload, topic){
    let data = {}

    data.options = payload
    if(topic){
        data.topic = topic
    }
    return data
}


module.exports.sortArrayByFirstKey = function(arr){
    return arr.sort(function(a, b){
        var keyA = Object.keys(a)[0],
            keyB = Object.keys(b)[0];
        // Compare the 2 dates
        if(keyA < keyB) return -1;
        if(keyA > keyB) return 1;
        return 0;
    });
}


// Node status

module.exports.statusAuthenticated = function(txt){
    return { fill: 'green', shape: 'dot', text: 'Authenticated ' + (txt || '') }
}

module.exports.statusInit = function(txt){
    return { fill: 'yellow', shape: 'ring', text: 'Waiting for creds... ' + (txt || '') }
}

module.exports.statusWaiting = function(txt){
    return { fill: 'yellow', shape: 'ring', text: 'Waiting... ' + (txt || '') }
}

module.exports.statusConnecting = function(txt){
    return { fill: 'yellow', shape: 'ring', text: 'Connecting... ' + (txt || '') }
}

module.exports.statusConnected = function(txt){
    return { fill: 'green', shape: 'dot', text: 'Connected ' + (txt || '') }
}

module.exports.statusError = function(txt){
    return { fill: 'red', shape: 'ring', text: 'Error ' + (txt || '') }
}

module.exports.statusProcessing = function(txt){
    return { fill: 'green', shape: 'ring', text: 'Processing... ' + (txt || '') }
}

module.exports.statusNoDevice = function(txt){
    return { fill: 'yellow', shape: 'ring', text: 'No Device... ' + (txt || '') }
}

module.exports.statusSubscription = function(txt){
    return { fill: 'green', shape: 'dot', text: 'Subscription started' + (txt || '') }
}

module.exports.statusWrite = function(txt){
    return { fill: 'green', shape: 'ring', text: 'Writing...' + (txt || '') }
}

module.exports.statusClientCreated = function(txt){
    return { fill: 'green', shape: 'dot', text: 'Client created ' + (txt || '') }
}

module.exports.statusLogout = function(txt){
    return { fill: 'yellow', shape: 'ring', text: 'Logout ' + (txt || '') }
}




// Node notifications
module.exports.warnDatatype = function(node, given, expected){
    return `${node} : Wrong datatype. Given: ${ given }, expected ${ expected}.`
}

module.exports.warnError = function(node, err){
    return `${node} : Error: ${ typeof err === 'object' ? JSON.stringify(err) : err }.`
}


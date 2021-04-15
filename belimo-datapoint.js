/**
 * Company: MST Systemtechnik AG
 * Customer: Belimo AG
 * Author: mst_gruy
 * Date: 05.11.2019
 *
 * Belimo-datapoint node logic. To get the actual data, it will open a change-stream subscription.
 */


const utility = require('./lib/Utility')
const Subscriptions = require('./lib/Subscriptions')

const node_name = 'BelimoDatapointNode'


module.exports = function (RED) {

    let clients = {}
    let dataprofiles = {}

    function BelimoDatapointNode(config) {

        this.device = null
        this.datapoint = null
        this.subscription = null

        RED.nodes.createNode(this, config);
        // Get the oauth node
        this.oauth = RED.nodes.getNode(config.oauth)
        clients[config.id] = this.oauth.client

        this.status(utility.statusLogout())

        let node = this

        if(config.dataprofile_value){
            this.datapoint = JSON.parse(config.dataprofile_value)
        }

        clients[config.id].on('authenticated', function(){
            node.status(utility.statusConnected())
        })

        clients[config.id].on('logout', function(){
            if(node.subscription){
                node.subscription.destroyIfActive()
            }
            node.subscription = null
            delete node.subscription
            node.status(utility.statusLogout())
            // Clear dropdown
            node.send( utility.createUiDropdownPayload([], 'dataprofile') )
        })

        clients[config.id].on('error', function(err){
            node.status(utility.statusError())
        })


        this.on('input', function(msg){

            // Check datatype of message
            if(typeof msg !== 'object' && msg !== null){
                node.warn( utility.warnDatatype(node_name, typeof msg, 'object') )
                node.status(utility.statusError())
                return null
            }

            if(msg.hasOwnProperty('topic')){
                switch(msg.topic){
                    case 'devices':
                        // Stop here when devices dedected. We don't wont all devices in this node.
                        return null

                    case 'device':
                        node.device = msg.payload

                        if(typeof node.device === 'object' && node.device !== null && node.device.hasOwnProperty('dataprofile')){
                            getDataprofileByReq(clients[config.id], node.device.dataprofile.ref, function(err, data){
                                if(err){
                                    node.warn( utility.warnError(node_name, err) )
                                    node.send( utility.createPayload(err, 'error') )
                                    node.send( utility.createUiDropdownPayload([], 'dataprofile') )
                                }else{
                                    dataprofiles[config.id] = data
                                    node.send( utility.createUiDropdownPayload(dataprofileToUiDropdown(dataprofiles[config.id]), 'dataprofile') )
                                }
                            })
                        }else{
                            dataprofiles[config.id] = null
                        }

                        node.send(msg)
                    break
                    case 'datapointId':
                        if(!node.device){
                            node.status(utility.statusError('Device missing.'))
                            return null
                        }

                        if(!dataprofiles[config.id]){
                            node.status(utility.statusError('Empty dataprofile.'))
                            return null
                        }

                        if(typeof msg.payload !== 'string'){
                            return null
                        }

                        node.datapoint = null

                        for(let dp_index in dataprofiles[config.id].datapoints){
                            if(dataprofiles[config.id].datapoints[dp_index].id === msg.payload){
                                node.datapoint = dataprofiles[config.id].datapoints[dp_index]
                                break
                            }
                        }

                        if(!node.datapoint){
                            node.status(utility.statusError('DP not found'))
                            return null
                        }

                    break
                    case 'write':
                        if(node.device && node.device.id){
                            node.status(utility.statusWrite())
                            writeDatapoint(node, msg.payload, function(err, data){
                                if(err){
                                    node.warn( utility.warnError(node_name, err) )
                                    node.send( utility.createPayload(err, 'error') )
                                }else{
                                    node.send(utility.createPayload(data, msg.topic))
                                    node.status(utility.statusSubscription())
                                }
                            })
                        }
                        // Stop here when a write dedected on input
                        return null
                    case 'metadata':
                        if(node.device && node.device.id){
                            node.status(utility.statusWrite())
                            writeMetadata(node, msg.payload, function(err, data){
                                if(err){
                                    node.warn( utility.warnError(node_name, err) )
                                    node.send( utility.createPayload(err, 'error') )
                                }else{
                                    node.send(utility.createPayload(data, msg.topic))
                                    node.status(utility.statusSubscription())
                                }
                            })
                        }
                    break
                }
            }


            // Stop here when data isn't complete
            if(typeof node.device !== 'object' || node.device === null || typeof node.datapoint !== 'object' || node.datapoint === null){
                return null
            }

            // Subscribe when all data exists
            node.status(utility.statusSubscription())
            // Send datapoint to output
            node.send(utility.createPayload(createDataPayload(node.device.id, node.datapoint, node.device.state), 'data'))

            if(!node.subscription){
                node.subscription = new Subscriptions(clients[config.id])
            }

            node.subscription.setPayload({ includedDeviceIds : [node.device.id], includedDatapointIds: [node.datapoint.id] })

            node.subscription.listen(function(err, data){
                if(err){
                    node.warn( utility.warnError(node_name, err) )
                    node.send( utility.createPayload(err, 'error') )
                }else{
                    node.status(utility.statusSubscription('[data on]'));
                    node.send(utility.createPayload(createDataPayload(node.device.id, node.datapoint, data.device.state), 'data'))
                }
            })


        })


        this.on('close', function(){
            clients[config.id] = null

            if(node.subscription){
                node.subscription.destroyIfActive()
            }

            node.subscription = null
            delete node.subscription

            node.datapoint = null
        })


    }

    /**
     * Parse the dataprofile object into a readable ui-dropdown list
     * @param {object} data dataprofile
     */
    function dataprofileToUiDropdown(data){
        let options = []

        if(!Array.isArray(data.datapoints)){
            return null
        }

        data.datapoints.forEach(function(item){
            let o = {}
            let name = ''
            let access = ''
            for(var i in item.featureValues){
                if(i.endsWith('displayname')){
                    name = item.featureValues[i].length > 28 ? item.featureValues[i].substr(0, 28) + '...' : item.featureValues[i]
                }

                if(i.endsWith('access')){
                    access = item.featureValues[i]
                }

                if(access && name){
                    break
                }
            }

            name = access ? name + ' [' + access + ']' : name
            o[name] = item.id
            options.push(o)
        })

        return utility.sortArrayByFirstKey(options)
    }

    /**
     * Request the dataprofile
     * @param {Client} client
     * @param {string} pathname /definitions/dataprofiles/energyvalve3/1.2
     * @param {function} callback
     */
    function getDataprofileByReq(client, pathname, callback){
        if(!client){
            callback('No client.')
            return null
        }

        if(!pathname){
            callback('No pathname.')
            return null
        }

        if(!pathname.startsWith('/definitions/dataprofiles')){
            pathname = '/definitions/dataprofiles' + pathname
        }

        client.req('/api/v3' + pathname, function(err, httpBody, body){
            callback(err, body)
        })
    }

    /**
     * Create the datapayload. The keys are written like default.displayname. Remove the string before the point, to get a readable object
     * @param {string} device_id
     * @param {object} datapoint
     * @param {string | bool | int | float} value
     */
    function createDataPayload(device_id, datapoint, value){

        let data = {}

        data.id = datapoint.id
        data.deviceId = device_id
        data.topic = data.deviceId + '/' + data.id

        if(typeof value === 'object' && value !== null && value.hasOwnProperty('timestamp') && value.hasOwnProperty('datapoints')){
            data.timestamp = value.timestamp
            data.value = value.datapoints[data.id] ? value.datapoints[data.id].value : 'Not found'
        }

        for(let key in datapoint.featureValues ){
            let index_point = key.indexOf('.')
            if(index_point !== -1){
                data[ key.substr( index_point + 1 ) ] = datapoint.featureValues[key]
            }else{
                data[ key ] = datapoint.featureValues[key]
            }
        }

        return data
    }


    /**
     * Write a datapoint to the belimo cloud. When
     * @param {object} instance
     * @param {object | string | bool | number} value
     *
     *
     * Example value to write multiple:
        {
            "mergeable" : false,
            "cancelable" : true,
            "datapoints" : {
                "772bpRFm.1" : 27.53,
                "772bpRFm.3" : "CLOSE",
                "772bpRFm.4" : true
            }
        }

       To write the selected datapoint value : string | bool | number

     * @param {function} callback
     */
    function writeDatapoint(node, value, callback){

        let pathname = `/api/v3/devices/${node.device.id}/data`

        if(!clients[node.id]){
            callback('No client')
            return null
        }


        if(!node.datapoint){
            callback('No datapoint')
            return null
        }


        let val = parseValueToWrite(node.datapoint, value)
        let data = {}

        data.datapoints = {}

        if(val.access === 'r'){
            callback('Access denied. Only readable.')
            return null
        }

        if(typeof value === 'object'){
            data = value
        }else{
            data.datapoints[node.datapoint.id] = val.value
        }

        clients[node.id].post(pathname, data, function(err, res, body){
            callback(err, body)
        })

    }


        /**
     * Write a datapoint to the belimo cloud. When
     * @param {object} instance
     * @param {object} value
     *
     *
     * Example value to write multiple:
            {
                "datapoints" : {
                    "metadata.1001" : "Basement B14.22",
                    "metadata.1008" : "8005",
                    "metadata.1009" : "Zurich"
                }
            }

     * @param {function} callback
     */
    function writeMetadata(node, value, callback){

        let pathname = `/api/v3/devices/${node.device.id}/metadata`

        if(!clients[node.id]){
            callback(err)
            return null
        }

        clients[node.id].post(pathname, value, function(err, res, body){
            callback(err, body)
        })

    }

    /**
     * Parse the value
     */
    function parseValueToWrite(datapoint, value){

        let basetype = null
        let val = null
        let access = null

        if(!datapoint){
            return {
                access : null,
                value : value
            }
        }

        for(let key in datapoint.featureValues){

            if(key.indexOf('basetype') !== -1){
                basetype = datapoint.featureValues[key]
            }

            if(key.indexOf('access') !== -1){
                access = datapoint.featureValues[key]
            }

            if(basetype && access){
                break
            }
        }


        switch(basetype){
            case 'real':
            val = Number(value) !== 'NaN' ? parseFloat(value) : value
            break
            case 'int':
            val = Number(value) !== 'NaN' ? parseInt(value) : value
            break
            default:
            val = value.toString()
            break
        }

        return {
            access : access,
            value : val
        }
    }

    /**
     * Listen on http requests
     */
    RED.httpAdmin.get('/belimo-cloud/datapoint-node/:node_id', RED.auth.needsPermission("belimo-datapoint.read"), function(req,res) {

        if(!clients[req.params.node_id]){
            res.json({ err : 'Client not found. Please create a belimo-connector-node and try it again.'})
            return null
        }

        if(req.query.reference){

            getDataprofileByReq(clients[req.params.node_id], req.query.reference, function(err, data){
                if(err){
                    res.json({ err : err});
                }else{
                    dataprofiles[req.params.node_id] = data
                    res.json(data);
                }
            })
        }else{
            if(!dataprofiles[req.params.node_id]){
                res.json({ err : 'Dataprofile not found. Please connect a belimo-device-node, select a device and try it again or enter a reference-path.'})
                return null
            }

            res.json(dataprofiles[req.params.node_id])
        }

    })



    RED.httpAdmin.get('/belimo-cloud/datapoint-node-changed/:node_id', RED.auth.needsPermission("belimo-datapoint.read"), function(req,res) {
        // Get all devices at startup
        if(!clients[req.params.node_id]){
            res.json({ err : 'Client not found. Please create a belimo-connector and try it again.'})
            return null
        }

        let node = RED.nodes.getNode(req.params.node_id);

        if(node){
            node.emit('input', { topic : 'datapointId', payload : req.query.datapointId })
            res.json({ err : 'Node not found.'})
        }else{
            res.json({ err : null})
        }

    })



    RED.nodes.registerType("belimo-datapoint", BelimoDatapointNode);
}


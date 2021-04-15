/**
 * Company: MST Systemtechnik AG
 * Customer: Belimo AG
 * Author: mst_gruy
 * Date: 05.11.2019
 *
 * Logic for the belimo-device node. It can requests all devices or a specific device. Each input will be parsed by the topic.
 *
 *
 */


const utility = require('./lib/Utility')

const node_name = 'BelimoDevicesNode'
const LIMIT = 500

module.exports = function (RED) {


    let http_api_devices = '/api/v3/devices'
    let clients = {}

    function BelimoDevicesNode(config) {
        this.interval_id = null
        this.isAuthenticated = false
        RED.nodes.createNode(this, config);
        // Get the oauth node
        this.oauth = RED.nodes.getNode(config.oauth)
        clients[config.id] = this.oauth.client

        this.status(utility.statusLogout())

        let node = this

        clients[config.id].on('authenticated', function(){
            if (node.isAuthenticated) {
                return
            }

            node.isAuthenticated = true

            node.status(utility.statusConnected())

            // When login event is emitted, write all devices to output
            getDevices(clients[config.id], function(err, devices){
                if(!err){
                   node.send( utility.createUiDropdownPayload(devicesToUiDropdown(devices.data), 'devices') )
                }
            })

            // Handle config-settings, when nothing is set, the device schould be found from input
            if(config.device_id === 'all'){
                // Get all devices at startup
                getDevices(clients[config.id] , function(err, devices){
                    if(!err){
                        node.send( utility.createUiDropdownPayload(devicesToUiDropdown(devices.data), 'devices') )
                    }
                    sendNodeMessage(err, devices.data, 'devices')
                })

            }else if(config.device_id !== 'none'){
                getDevicesById(clients[config.id], config.device_id, function(err, device){
                    sendNodeMessage(err, device, 'device')
                })
            }else{
                sendNodeMessage(null, null, 'device')
            }

        })

        clients[config.id].on('logout', function(){
            node.status(utility.statusLogout())
            // Clear dropdown
            node.send( utility.createUiDropdownPayload([], 'devices') )
            node.isAuthenticated = false
        })

        clients[config.id].on('error', function(err){
            node.status(utility.statusError());
            node.send(utility.createPayload(err, 'error'))
            node.isAuthenticated = false
        })


        this.on("input", function(msg) {
            // Check datatype of message
            if(typeof msg !== 'object' && msg !== null){
                node.warn( utility.warnDatatype(node_name, typeof msg, 'object') )
                node.status(utility.statusError());
                return null
            }

            if(msg.hasOwnProperty('topic')){
                switch(msg.topic){
                    case 'deviceId':
                        if(typeof msg.payload !== 'string'){
                            return null
                        }
                        getDevicesById(clients[config.id], msg.payload, function(err, device){
                            sendNodeMessage(err, device, 'device')
                        })
                        // Stop here when a deviceId dedected on input
                        return null
                    default:
                    break
                }
            }
        });

        this.on('close', function(){
            clients[config.id] = null
        })

        /**
         * Send the payload and change the status according the error or succsess
         * @param {string} err
         * @param {object} data
         * @param {string} topic
         */
        function sendNodeMessage(err, data, topic){
            if(err){
                node.warn(err)
                node.send( utility.createPayload(err, 'error') )
            }else{
                node.status(utility.statusConnected());
                node.send( utility.createPayload(data, topic) )
            }
        }

    }

    /**
     * Parse the devices object into a readable ui-dropdown list
     * @param {array} data devices
     */
    function devicesToUiDropdown(data){
        let options = []

        if(!Array.isArray(data)){
            return null
        }

        data.forEach(function(item){
            let o = {}
            o[item.displayName] = item.id
            options.push(o)
        })

        return utility.sortArrayByFirstKey(options)
    }


    /**
     * Get all devices
     * @param {object} client the client instance
     * @param {function} callback err, devices
     */
    function getDevices(client, callback){
        getDevicesByLimit(client, function(err, total, devices){

            if(err){
                callback(err)
                return null
            }
            // Check if we can send the data or do some more requests because of pagination
            if(total < LIMIT){
                callback(err, devices)
            }else{
                // Create the jobs for the async requests to get all devices
                let jobs = []
                for(let count = LIMIT; count <= total; count += LIMIT ){
                    jobs.push(http_api_devices + `?limit=${ LIMIT }&offset=${ count }`)
                }
                // Handle the jobs and emit data when done
                async.forEachSeries(jobs, function(job, next){
                    client.req(job, function(err, res, body) {
                        if(err){
                            next(err)
                        }else{
                            if(devices && Array.isArray(devices.data)){
                                for(let device_index in body.data){
                                    devices.data.push(body.data[device_index])
                                }
                            }
                            next()
                        }
                    });
                }, function(err){
                    callback(err, devices)
                })
            }
        })
    }

    /**
     * Get the devices by limit. If it has more devices in the client than the limit, use the limit and offset query.
     * @param {object} client the client instance
     * @param {function} callback err, total, devices
     */
    function getDevicesByLimit(client, callback){
        let device_response = null
        if(!client){
            return null
        }
        client.req(http_api_devices + `?limit=${ LIMIT }&offset=0`, function(err, res, body) {
            let total = 0
            if(!err && typeof body === 'object' && body !== null && body.hasOwnProperty('paging')){
                total = body.paging.total
                device_response = body
            }
            callback(err, total, device_response)
        });
    }


    /**
     * Get the device by search
     * @param {object} client the client instance
     * @param {string} id the device id
     * @param {function} callback err, device
     */
    function getDevicesById(client, id, callback){

        if(!client || !id){
            return null
        }

        client.req(http_api_devices + `/${ id }` , function(err, res, body) {
            callback(err, body)
        });
    }

    /**
     * Listen on http requests
     */
    RED.httpAdmin.get('/belimo-cloud/device-node/:node_id', RED.auth.needsPermission("belimo-devices.read"), function(req,res) {
        // Get all devices at startup
        if(!clients[req.params.node_id]){
            res.json({ err : 'Client not found. Please create a belimo-connector and try it again.'})
            return null
        }

        getDevices(clients[req.params.node_id], function(err, data){
            if(err){
                res.json({ err : err})
            }else{
                res.json(data);
            }
        })
    });


    RED.httpAdmin.get('/belimo-cloud/device-node-changed/:node_id', RED.auth.needsPermission("belimo-devices.read"), function(req,res) {
        // Get all devices at startup
        if(!clients[req.params.node_id]){
            res.json({ err : 'Client not found. Please create a belimo-connector and try it again.'})
            return null
        }

        let node = RED.nodes.getNode(req.params.node_id);

        if(node){
            node.emit('input', { topic : 'deviceId', payload : req.query.deviceId })
            res.json({ err : 'Node not found.'})
        }else{
            res.json({ err : null})
        }

    });

    // Register the node
    RED.nodes.registerType("belimo-devices", BelimoDevicesNode)

}




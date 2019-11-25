/**
 * Company: MST Systemtechnik AG
 * Customer: Belimo AG
 * Author: mst_gruy
 * Date: 05.11.2019
 * 
 */

/*
This node will have: • a text configuration parameter in order the Designer to write the device serial number into it
• an output stating the Device ID relative to that specific Serial Number
The output of this node will choose to which specific device to apply the whole application.

*/

const utility = require('./lib/Utility')
const node_name = 'BelimoFinddeviceNode'

module.exports = function (RED) {

    let http_api_devices = '/api/v3/devices'
    let clients = {}


    function BelimoFinddeviceNode(config) {

        this.device = {}

        RED.nodes.createNode(this, config)
        // Get the oauth node
        this.oauth = RED.nodes.getNode(config.oauth)
        clients[config.id] = this.oauth.client

        let node = this

        this.status(utility.statusLogout())
        
        clients[config.id].on('authenticated', function(){
            node.status(utility.statusConnected())

            if(config.serial_number){
                getDevicesBySearch(clients[config.id], config.serial_number, function(err, data){
                    if(err){
                        node.warn( utility.warnError(node_name, typeof msg, 'object') )
                        node.send( utility.createPayload(err, 'error') )
                    }else{
                        node.device = data
                        node.status(utility.statusConnected());
                        node.send( utility.createPayload(node.device, 'device') )
                    }
                })
            }
            
        })

        clients[config.id].on('logout', function(){
            node.status(utility.statusLogout())
        })

        clients[config.id].on('error', function(){
            node.status(utility.statusError());
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
                    case 'serialNumber':

                        if(typeof msg.payload !== 'string'){
                            return null
                        }
                        
                        node.status(utility.statusProcessing());

                        getDevicesBySearch(clients[config.id], msg.payload, function(err, data){

                            if(err){
                                node.status(utility.statusConnected());
                                node.send( utility.createPayload(err, 'error') )
                                node.warn(err)
                            }else{
                                node.device = data
                                node.status(utility.statusConnected());
                                node.send( utility.createPayload(data, 'device') )
                            }
                        })
                        return
                }
            }

        })



    }


    /**
     * Get the device by search query
     * @param {Client} client client instance
     * @param {string} serialnumber
     * @param {function} callback err, device
     */
    function getDevicesBySearch(client, serialnumber, callback){

        if(!client){
            callback('No client')
            return null
        }
        
        client.req(http_api_devices + `?search=${ serialnumber }` , function(err, res, body) {

            if(err){
                callback(err)
                return null
            }

            // Get the device with the serialnumber. With search it's possible to query other parameters
            let device = null

            for(let device_index in body.data){
                if(body.data[device_index].serialNumber === serialnumber){
                    device = body.data[device_index]
                    break
                }
            }

            if(!device){
                err = 'No device found with serial-number:' + serialnumber
            }

            callback(err, device)
        });
    }

    // Register the node
    RED.nodes.registerType("belimo-finddevice", BelimoFinddeviceNode)

}

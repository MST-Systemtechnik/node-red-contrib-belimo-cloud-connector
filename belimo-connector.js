/**
 * Company: MST Systemtechnik AG
 * Customer: Belimo AG
 * Author: mst_gruy
 * Date: 05.11.2019
 *
 * Belimo cloud connector
 */

const Client = require('./lib/Client')
const utility = require('./lib/Utility')

const node_name = 'BelimoConnectorNode'

module.exports = function (RED) {


    function BelimoConnectorNode(config) {

        // Create the node
        RED.nodes.createNode(this, config)

        // Get the oauth node
        this.oauth = RED.nodes.getNode(config.oauth)
        this.username = this.credentials.username
        this.password = this.credentials.password

        let node = this

        this.oauth.client.on('authenticated', function(){
            node.send(utility.createPayload('Authenticated', 'status'))
            node.status(utility.statusConnected())
        })

        this.oauth.client.on('error', function(err){
            node.status(utility.statusError())
            node.send(utility.createPayload(err, 'error'))
        })

        this.oauth.client.on('logout', function(err){
            node.status(utility.statusLogout())
            node.send(utility.createPayload('Logout', 'status'))
        })

        this.status(utility.statusInit())

        // Listen on input event
        this.on('input', function(msg){
            // Check datatype of message
            if(typeof msg !== 'object' && msg !==  null ){
                utility.warnDatatype(node_name, typeof msg, 'object')
                node.warn( utility.warnDatatype(node_name, typeof msg, 'object') )
                return null
            }

            // Parse message with the label username and store
            if(msg.hasOwnProperty('topic') && msg.topic === 'username'){
                node.username = msg.payload
                return null
            }

            // Parse message with the label password and store
            if(msg.hasOwnProperty('topic') && msg.topic === 'password'){
                node.password = msg.payload
                return null
            }

            // Login
            if(msg.hasOwnProperty('topic') && msg.topic === 'login'){
                if( node.username &&  node.password ){
                    node.oauth.client.setUsername(node.username)
                    node.oauth.client.setPassword(node.password)
                    node.oauth.client.init(function(err){
                        if(!err){
                            node.send(utility.createPayload('Successfull', 'status'))
                        }
                    })

                }
                return
            }

            // Logout
            if(msg.hasOwnProperty('topic') && msg.topic === 'logout'){
                node.username = null
                node.password = null
                node.oauth.client.logout()
                return
            }

            // Create the client if optional properties are definied
            if(node.password && node.username ){
                node.oauth.client.setUsername(node.username)
                node.oauth.client.setPassword(node.password)
                node.oauth.client.init()
            }

        })

        this.on('close', function(){
            node.oauth.client.logout()
        })


        // Start the node while emitting self
        this.emit('input', {})

    }

    // Register the node
    RED.nodes.registerType("belimo-connector", BelimoConnectorNode, {
        credentials: {
            username: {type:"text"},
            password: {type:"password"}
        }
    });


}

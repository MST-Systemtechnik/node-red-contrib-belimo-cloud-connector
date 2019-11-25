/**
 * Company: MST Systemtechnik AG
 * Customer: Belimo AG
 * Author: mst_gruy
 * Date: 05.11.2019
 * 
 * Define a config node for the oauth creds.
 * 
 */
const Client = require('./lib/Client')

module.exports = function(RED) {
    function BelimoOAuthNode(config) {
        RED.nodes.createNode(this,config);
        this.name = config.name
        this.client_id = this.credentials.client_id
        this.client_secret = this.credentials.client_secret
        this.client = new Client(this.client_id, this.client_secret)
    }
    
    RED.nodes.registerType("belimo-oauth",BelimoOAuthNode,{
        credentials: {
            client_id: {type:"text"},
            client_secret: {type:"password"}
        }
    })
}
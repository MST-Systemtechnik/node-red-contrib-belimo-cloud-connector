const request = require('request');
const https = require('https')
const debug = require('debug')('belimo-cloud:subscription')


/**
 * Company: MST Systemtechnik AG
 * Customer: Belimo AG
 * Author: mst_gruy
 * Date: 15.11.2019
 * Version: 0.1
 *
 * HTTP Client SSE Handle (server-side-events) for handling subscriptions.
 */

class Subscriptions {

    /**
     * @param {object} client the client instance
     */
    constructor(client){
        this.client = client
        this.token = null
        this.heartbeat_id = null
        this.refresh_id = null
        this.payload = null
		this.res = null
        this.reinitTimeout = 60000
    }

    /**
     * Set the subscription payload
     * @param {object} json
     *  Example : {
          includedDeviceIds : [],
          includedDatapointIds: []
        }
     */
    setPayload(json){
        this.payload = json
    }

    /**
     * Get the subscription token
     */
    getToken(){
        return this.token
    }

    /**
     * Set the token
     * @param {object} token
     */
    setToken(token){
        this.token = token
    }

    /**
     * Listen on server-side-events, after getting the supscription-token.
     * @param {function} callback
     */
    listen(callback){
        let self = this
        this.callback = callback
        this.destroyIfActive()
        debug('Start listen:', JSON.stringify(this.payload))

        if(!this.client){
            debug('Empty http-client.')
            callback('Empty http-client.')
            return null
        }

        this.client.init(function(err){
            let options = {
                method : 'POST',
                url: self.client.getHost() + '/api/v3/devices/change-stream',
                headers: {
                    'Authorization' : self.client.createBearerHeader()
                },
                json : self.payload
            }

            if(err){
                callback(err)
                return null
            }

            self.heartbeatHandler()

            self.client.checkExpiresIn(function(err){
                // When token exists, do not query a new one before checking the expire timestamp. Or request a new token, when token doesn't exist.
                if(err){
                    debug(`Error checking expire timestamp in client, restart listen in 5s`)
                    setTimeout(function(){
                        self.listen(self.callback)
                    }, self.reinitTimeout)
                }else if(self.token){
                    debug('Subscription-token exists', JSON.stringify(self.token))
                    self.handleSseEvent(function(err, res, data){
                        callback(err, data)
                    })
                }else{
                    debug('Subscription-token request')
                    request(options, function(err, httpBody, body){
                        if(err){
                            debug(`Err: ${err}`)
                            callback(err)
                        } else if (httpBody.statusCode === 401) {
                            err = new Error(`Status Unauthorized: ${httpBody.statusCode}`)
                            self.client.token = null
                            self.destroyIfActive()
                            setTimeout(function(){
                                self.listen(self.callback)
                            }, self.reinitTimeout)
                        } else if (httpBody.statusCode !== 200) {
                            err = new Error(`Status-Code ${httpBody.statusCode}`)
                            self.token = null
                            self.destroyIfActive()
                            setTimeout(function(){
                                self.listen(self.callback)
                            }, self.reinitTimeout)
                        } else{
                            if(body !== null && typeof body === 'object' && body.hasOwnProperty('token')){
                                debug('Subscription-token ok', JSON.stringify(body))
                                self.token = body
                                self.refreshHandler()
                                self.handleSseEvent(function(err, res, data){
                                    callback(err, data)
                                })
                            }else{
                                debug(`Empty body`)
                                self.destroyIfActive()
                                setTimeout(function(){
                                    self.listen(self.callback)
                                }, self.reinitTimeout)
                            }
                        }
                    })
                }
            })

        })

    }

    /**
     * Refresh the token, when it's expired.
     */
    refreshHandler(){
        let self = this
        let timeout = this.reinitTimeout

        clearTimeout(this.refresh_id)

        if(this.token !== null && typeof this.token === 'object' && this.token.hasOwnProperty('validUntil')){
            timeout = new Date(this.token.validUntil).valueOf() - new Date().valueOf()
        }

        debug(`RefreshHandler subscription-token. Timeout ${timeout}ms`)

        this.refresh_id = setTimeout(function(){
            debug(`Refresh subscription-token.`)
            self.token = null
            self.listen(self.callback)
        }, timeout)
    }


    /**
     * Keep the http-connection open and parse the given data. When it's a heartbeat, reset the heartbeat-callback. When it's trash, do not parse the data.
     * When the data is a object, parse the json to data.
     * @param {function} callback err, data
     */
    handleSseEvent(callback){

        let self = this

        debug('Start handling sse events')

        let options = {
		  agent: false,
          path : `/api/v3/devices/change-stream/${this.token.token}`,
          hostname : 'cloud.belimo.com',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': this.client.createBearerHeader()
          }
        }

        this.destroyIfActive()

        let data_arrives = false

        let req = https.get(options, function(res){

		  self.res = res

          res.on('data', function(d) {

            let payload = d.toString()

            // Escape newline-charset in payload
            if(payload === '\n\n'){
                return null
            }

            // Refresh heartbeat checking
            if(payload.indexOf(':heartbeat') !== -1){
                debug('Heartbeat.')
                self.heartbeatHandler()
                return null
            }

            // When data arrives, set read data
            if(payload.indexOf('data:') !== -1){
                debug('Data arrives.')
                data_arrives = true
                return null
            }

            // If data arrive and it has payload, try to parse to object
            if(data_arrives && payload.length > 0){
                data_arrives = false
                try{
                    payload = JSON.parse(payload)
                    debug('Data JSON parsed for device-id:', payload.deviceId)
                    callback(null, res, payload)
                }catch(e){
                    debug('Data. JSON-Parse error')
                    callback(e)
                }
            }
          })

		  // Listen on close event
		  res.on('close', function(e){
              try{
                req.connection.destroy();
                debug('Connection closed in response', e || '')
              }catch(e){
                debug(e)
              }
		  })

		  res.on('error', function(e){
            try{
                req.connection.destroy();
                debug('Error in response', e || '')
              }catch(e){
                debug(e)
              }
		  })

        })

        req.on('error', (error) => {
          callback(error)
        })

        req.end()
    }

    /**
     * Destroy the http connection and cleare the timeouts
     */
    destroyIfActive(){

        if(this.res){
            debug('Close sse response and remove token.')
            this.token = null
            this.res.emit('close', 'Planned close')
            this.res = null
            delete this.res
        }

        clearTimeout(this.refresh_id)
        clearTimeout(this.heartbeat_id)
    }

    /**
     * Heartbeat handler. Reset the timeout on each :heartbeat data, to keep the check allive.
     */
    heartbeatHandler(){
		let self = this
		let interval = this.reinitTimeout * 2
		debug(`Hearbeat-Check started. Restart in ${ interval }ms, when no :heartbeat signal arrives.`)
        clearTimeout(this.heartbeat_id)
        this.heartbeat_id = setTimeout(function(){
            debug(`Hearbeat missing. Restart subscription`)
			//Reset the token to get a new one
			self.token = null
			// Listen again
            self.listen(self.callback)
        }, interval)
    }

}

module.exports = Subscriptions
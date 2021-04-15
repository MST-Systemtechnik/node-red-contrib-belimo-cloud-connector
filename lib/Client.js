const request = require('request');
const fs = require('fs')
const SwaggerParser = require("swagger-parser");
const debug = require('debug')('belimo-cloud:client')

const EventEmitter = require('events').EventEmitter;

// Path to the open api def
const PATH_OPENAPI = __dirname  + '/../dist/clientapi-v3-openapi-spec.json'


/**
 * Company: MST Systemtechnik AG
 * Customer: Belimo AG
 * Author: mst_gruy
 * Date: 05.11.2019
 *
 * HTTP Client instance.
 */

class Client extends EventEmitter  {

    /**
     *
     * @param {string} client_id
     * @param {string} client_secret
     */
    constructor(client_id, client_secret){
        super()
        this.client_id = client_id
        this.client_secret = client_secret
        this.username = null
        this.password = null
        this.api = null
        this.token = null
        this.expires_in_timestamp = 0
        this.setMaxListeners(0)
    }

    setPassword(password){
      this.password = password
    }
    setUsername(username){
      this.username = username
    }

    logout(){
      this.password = null
      this.username = null
      this.token = null
      this.expires_in_timestamp = 0
      this.emit('logout')
    }
    /**
     * Initialize the client while get the auth token and parse the open api
     * @param {function} callback
     */
    init(callback){
      let self = this
      callback = callback || function(){}

      if(!this.username || !this.password){
        this.emit('error', 'Please login.')
        callback('Enter username and password.')
        return null
      }

      if(this.token){
        callback(null)
        return
      }

      debug('Init client for cloud-api')

      this.parseApi(function(){
        if(self.checkApiTokenPath(self.api)){
          self.tokenReq(function(err){
            if(err){
              self.emit('error', err)
            }else{
              self.emit('authenticated')
            }
            callback(err)
          })
        }
      })
    }

    /**
     * Parse the open api
     * @param {function} callback
     */
    parseApi(callback){
      let self = this
      callback = callback || function(){}

      let data = fs.readFileSync(PATH_OPENAPI, 'utf-8')
      try{
        data = JSON.parse(data)
        SwaggerParser.validate(data, function(err, api){
          if (err) {
            throw new Error(err)
          }
          else {
            debug('Open-api parsed.', PATH_OPENAPI)
            self.api = api
            callback()
          }
        })
      }catch(e){
        throw new Error(e)
      }
    }

    /**
     * Check the parsed open api if the pathes exists
     * @param {object} api
     */
    checkApiTokenPath(api){
      return typeof api === 'object' &&
             api.hasOwnProperty('securityDefinitions') &&
             api.securityDefinitions.hasOwnProperty('oauth2_password') &&
             api.securityDefinitions.oauth2_password.hasOwnProperty('tokenUrl')
    }

    /**
     * Get the token url from the open api object
     */
    getTokenUrlFromApi(){
      if(!this.api){
        return null
      }
      return this.api.securityDefinitions.oauth2_password.tokenUrl
    }

    /**
     * Get the grant type from open api
     */
    getGrantTypeFromApi(){
      if(!this.api){
        return null
      }
      return this.api.securityDefinitions.oauth2_password.flow
    }

    /**
     * Get the refresh token from the open api
     */
    getGrantTypeRefreshToken(){
      if(!this.api){
        return null
      }
      return this.api.securityDefinitions.oauth2_password.flow
    }

    /**
     * Requests the auth-token from belimo-cloud
     * @param {function} callback
     */
    tokenReq(callback){
      let self = this
      callback = callback || function(){}

      if(!this.client_id && !this.client_secret){
        callback('No credentials.')
        return null
      }

      if(!this.username && !this.password){
        callback('Please login.')
        return null
      }

      let auth = {
          username: this.client_id,
          password: this.client_secret,
          sendImmediately: true
      }

      let form = {
        grant_type : this.getGrantTypeFromApi(),
        username : this.username,
        password : this.password,
        audience: 'https://api.cloud.belimo.com/'
      }

      debug('Get auth token. ', this.getTokenUrlFromApi())

      request.post({url:this.getTokenUrlFromApi(), auth : auth, form: form}, function(err,httpResponse,body){

        if(err){
          debug('Err:', err)
          return
        }

        try{
          self.token = JSON.parse(body)
          self.expires_in_timestamp = self.convertExpiresIn(self.token.expires_in)
          callback(err || (self.token.error ? self.token : null) )
        }catch(e){
          debug(e)
        }
      })
    }

    /**
     * Refresh the auth token
     * @param {function} callback
     */
    refreshToken(callback){
      let self = this
      callback = callback || function(){}

      if(!this.username && !this.password){
        callback('Please login.')
        return null
      }

      let auth = {
          'username': this.client_id,
          'password': this.client_secret,
          'sendImmediately': true
      }

      let form = {
        grant_type : 'refresh_token',
        refresh_token : this.token.refresh_token,
        audience: 'https://api.cloud.belimo.com/'
      }

      debug('Refresh token.', this.getTokenUrlFromApi())

      request.post({url:this.getTokenUrlFromApi(), auth : auth, form: form}, function(err,httpResponse,body){

        if(err){
          debug('Err:' + err)
        }

        try{
          self.token = JSON.parse(body)
          self.expires_in_timestamp = self.convertExpiresIn(self.token.expires_in)
          callback(err)
        }catch(e){
          debug(e)
        }
      })
    }

    /**
     * Get the base url
     */
    getHost(){
      return this.api.schemes[0] + '://' + this.api.host
    }

    /**
     * Request some data with by GET
     * @param {string} path
     * @param {function} callback
     */
    req(path, callback){
      let self = this

      this.init(function(err){

        let options = {
          method : 'GET',
          url: self.getHost() + path,
          headers: {
            'Authorization' : self.createBearerHeader()
          },
          json : true
        };

        debug('Cloud get:' +  self.getHost() + path)

        self.checkExpiresIn(function(err){

          if(err){
            return null
          }

          request(options, function(err,res,body){
            if(err){
              debug('Err:', err)
            } else if (res.statusCode === 401) {
              err = new Error(`Status Unauthorized: ${res.statusCode}`)
              self.token = null
            } else if (res.statusCode !== 200) {
              err = new Error(`Status-Code ${res.statusCode}`)
            }
            callback(err, res, body)
          })
        })

      })


    }

    /**
     * Send some data by POST (JSON)
     * @param {string} path
     * @param {object} body
     * @param {function} callback
     */
    post(path, body, callback){

      let self = this

      this.init(function(err){
          let options = {
            method : 'POST',
            url: self.getHost() + path,
            headers: {
              'Authorization' : self.createBearerHeader()
            },
            json : body
          };

          debug('Cloud post:' +  self.getHost() + path)
          debug(body)

          self.checkExpiresIn(function(err){

            if(err){
              return null
            }

            request(options, function(err,res,body){
              if(err){
                debug('Err:', err)
              } else if (res.statusCode === 401) {
                err = new Error(`Status Unauthorized: ${res.statusCode}`)
                self.token = null
              } else if (res.statusCode !== 200) {
                err = new Error(`Status-Code ${res.statusCode}`)
              }
              callback(err, res, body)

            })
          })
      })

    }

    /**
     * Convert the expires_in given from token to a timestamp while adding the value to the actual date
     * @param {int} seconds
     */
    convertExpiresIn(seconds){
      let dt = new Date();
      dt.setSeconds( dt.getSeconds() + seconds )
      return dt
    }

    /**
     * Check the expires values with the actual timestamp
     * @param {function} callback
     */
    checkExpiresIn(callback){
      if(this.expires_in_timestamp.valueOf() < new Date().valueOf() ){

        debug('Refresh token started. Time expired.')

        this.refreshToken(function(err){
          callback(err)
        })
      }else{
        callback()
      }
    }

    /**
     * Create the bearer-header by the given token. The token-type is taken from the open-api
     */
    createBearerHeader(){
      if(!this.token || this.token.error || typeof this.token.token_type !== 'string'){
        return null
      }
      return this.token.token_type.charAt(0).toUpperCase() + this.token.token_type.slice(1) + ' ' +  this.token.access_token
    }
}

module.exports = Client

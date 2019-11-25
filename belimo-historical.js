/**
 * Company: MST Systemtechnik AG
 * Customer: Belimo AG
 * Author: mst_gruy
 * Date: 05.11.2019
 * Version: 0.1
 * 
 */

/*
This node will have as an input a trigger for its update and a structured output in order to properly feed the graph
dashboard node.
*/
const parse_duration = require('parse-duration')
const utility = require('./lib/Utility')

const node_name = 'BelimoHistoricalNode'

module.exports = function (RED) {

    let clients = {}

    function BelimoHistoricalNode(config) {

        this.datapoint = null
        this.last_read_timestamp = null
        this.next_timestamp = false
        this.resolution_parsed = parse_duration(config.resolution) 
        this.label = null


        RED.nodes.createNode(this, config);
        // Get the oauth node
        this.oauth = RED.nodes.getNode(config.oauth);
        clients[config.id] = this.oauth.client

        let node = this

        this.status(utility.statusLogout())

        clients[config.id].on('authenticated', function(){
            node.status(utility.statusConnected())
        })

        clients[config.id].on('logout', function(){
            node.status(utility.statusLogout())
            // Clear chart
            node.send(utility.createPayload([]))
        })

        clients[config.id].on('error', function(){
            node.status(utility.statusError());
        })
        
        this.on('input', function(msg){

            // Check datatype of message
            if(typeof msg !== 'object' && msg !== null){
                node.warn( utility.warnDatatype(node_name, typeof msg, 'object') )
                node.status(utility.statusError());
                return null
            }

            if(msg.hasOwnProperty('topic')){
                switch(msg.topic){
                    case 'from':
                        if(msg.payload.date){
                            config.from_date = msg.payload.date
                        }
                        if(msg.payload.time){
                            config.from_time = msg.payload.time
                        }
                    break
                    case 'to':
                        if(msg.payload.date){
                            config.to_date = msg.payload.date
                        }
                        if(msg.payload.time){
                            config.to_time = msg.payload.time
                        }
                    break
                    case 'resolution':
                        conf.resolution = msg.payload
                    break
                    case 'data':

                        node.datapoint = msg.payload
                        let label = createLabelName(msg.payload)

                        // Reset chart if not the same dp
                        if(node.label !== label){
                            node.send(utility.createPayload([]))
                            node.label = label
                        }

                        // Send data
                        if(!config.from_date && !config.to_date && msg.payload.value !== null){
                            node.send(utility.createPayload(msg.payload.value, label, msg.payload.timestamp))
                        }

                    break
                    default:
                    break
                }
            }

            // Get the dataset when certains topic arrived on input
            if(msg.topic === 'from' || msg.topic === 'to' || msg.topic === 'resolution'){
                handleSeries(function(err, data){
                    if(err){
                        node.warn( utility.warnError(node_name, err) )
                        node.status(utility.statusError())
                    }else{
                        if(data.errors){
                            node.warn( utility.warnError(node_name, JSON.stringify(data.errors)) )
                            return null
                        }else{
                            node.status(utility.statusConnected());
     
                            let payload = convertHistoricalDataset(node, data)
    
                            if(!payload){
                                node.warn( utility.warnError(node_name, 'Error writing historical') )
                            }else{
                                node.send(utility.createPayload([payload], 'historical'))
                            }
                        }
                    }
                })
            }
        })

        this.on('close', function(){
            clients[config.id] = null
        })

        /**
         * Handle the request and prepare the timestamps. Convert the response to a compatible format for a chart.
         */
        function handleSeries(callback){

            if(typeof node.datapoint !== 'object' && node.datapoint === null){
                node.warn( utility.warnError(node_name, 'Datapoint missing for history-request') )
                node.status(utility.statusError())
                return null
            }

            node.status(utility.statusProcessing())

            let from = null
            let to = null

            if(config.from_date === config.to_date && config.from_time === config.to_time){
                from = createTimestamp(config.from_date, cconfigonf.from_time, node.resolution_parsed)
            }else{
                from = createTimestamp(config.from_date, config.from_time)
            }

            if(!config.to_date){
                to = new Date().toISOString()
            }else{
                to = createTimestamp(config.to_date, config.to_time)
            }

            getSeriesByReq(clients[config.id], node.datapoint, from, to, config.resolution, function(err, data){
                callback(err,data)
            })
        }

    }

    /**
     * Get a historcial dataset by a http-request
     * @param {object} client client instance
     * @param {object} datapoint datapoint-object
     * @param {string} from timestamp as string in ISO-format
     * @param {string} to timestamp as string in ISO-format
     * @param {string} resolution for dataset as 1s,10s,...
     * @param {function} callback err, body
     */
    function getSeriesByReq(client, datapoint, from, to, resolution, callback){

        if(!client){
            callback('No client.')
            return null
        }

        let pathname = `/api/v3/devices/${datapoint.deviceId}/data/history/timeseries?datapointIds=${datapoint.id}&resolution=${resolution}&from=${from}&to=${to}`

        client.req(pathname, function(err, httpBody, body){
            callback(err, body)
        })

    }

    
    /**
     * Convert the dataset to a chart compatible format
     * @param {object} node this
     * @param {object} timeseries timeseries-dataset from belimo-cloud
     * 
     *
        Source-Format
            {
                "from" : "2018-06-20T10:00:00Z",
                "to" : "2018-06-20T11:15:00Z",
                "resolution" : "15m",
                "series" : [ {
                    "datapointId" : "zwk892PP.1",
                    "aggregation" : "last",
                        "values" : [ 
                            {
                                "timestamp" : "2018-06-20T10:00:00Z",
                                "value" : 3
                            }
                        ]
                } ]
            }

        Target-Format
            [{
                "series": ["A", "B", "C"],
                "data": [
                    [{ "x": 1504029632890, "y": 5 },
                    { "x": 1504029636001, "y": 4 },
                    { "x": 1504029638656, "y": 2 }
                    ],
                    [{ "x": 1504029633514, "y": 6 },
                    { "x": 1504029636622, "y": 7 },
                    { "x": 1504029639539, "y": 6 }
                    ],
                    [{ "x": 1504029634400, "y": 7 },
                    { "x": 1504029637959, "y": 7 },
                    { "x": 1504029640317, "y": 7 }
                    ]
                ],
                "labels": [""]
            }]

     */
    function convertHistoricalDataset(node, timeseries){

        if(typeof timeseries !== 'object' || timeseries === null ){
            return null
        }

        if(!timeseries.hasOwnProperty('series')  || !Array.isArray(timeseries.series)){
            return null
        }

        let result = {
            series : [createLabelName(node.datapoint)],
            data : [],
            labels : []
        }

        let value_array = []

        for(let el in timeseries.series[0].values){

            let timestamp = new Date( timeseries.series[0].values[el].timestamp ).valueOf()
            let value = timeseries.series[0].values[el].value
            if(value){
                value_array.push({ x : timestamp, y : value })
            }

        }

        result.data.push(value_array)

        return [result]
    }


    /**
     * Create a new timestamp according the given params.
     * @param {string} date date as string
     * @param {string} time time as string
     * @param {int} resolution resolution as parsed timestamp in ms for calculating the timestamp in past
     * @param {int} factor factor to calculate the new timestamp in past
     * @return {string} the new created timestamp by the given params as ISO
     */
    function createTimestamp( date, time, resolution, factor){

        let dt = null
        let now = new Date()

        if(!date){
            date = now.toDateString()
        }

        if(!time){
            dt = new Date(`${date} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`)
        }else{
            dt = new Date(`${date} ${time}`)
        }

        if(resolution){
            dt = new Date( dt.valueOf() - resolution * ( factor ? factor : 100 ) )
        }

        return dt.toISOString()

    }

    /**
     * Create the labelname of the dataset.
     * @param {object} datapoint 
     * @return {string} the labelname
     */
    function createLabelName(datapoint){
        let label = datapoint.displayname 

        if(datapoint.unit){
            label += ` [${datapoint.unit}]`
        }
        return label
    }


    RED.nodes.registerType("belimo-historical", BelimoHistoricalNode);
}


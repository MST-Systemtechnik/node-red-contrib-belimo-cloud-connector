# node-red-contrib-belimo-cloud

> NODE-RED Belimo-Cloud Library by MST Systemtechnik AG.

## Overview

This node allows Node-RED developers to quickly build a connection to the [Belimo-Cloud](https://www.belimo.com/iot/developers) for accessing data with the cloud-api. The data can then be displayed in a dashboard, or can be distributed to other systems. 

## Installation and Usage

1. Go to your Node-RED users directory and run: `npm install node-red-contrib-belimo-cloud`
2. Start Node-RED
3. Drag-in a belimo-connector and create a oauth configuration
4. Enter a valid username and password for the belimo-cloud
5. Deploy and check the status
6. When the connection is established, then it's ready to use


## Debug

To set the debug-mode, use following commands.

```
Linux
DEBUG=belimo-cloud:*

PowerShell
$env:DEBUG = "belimo-cloud:*"

CMD
set DEBUG=belimo-cloud:*

```

### Nodes

- Belimo-Connector
- Belimo-Device
- Belimo-Datapoint
- Belimo-Historical
- Belimo-FindDevice

The output of the nodes ar labeled with a `msg.topic` property. Check the Node-Information in the Node-Red-Editor.

#### Belimo-Connector

Uses oauth for the authentification. Theses parameters should be requested from Belimo.
- Client-ID
- Client-Secret
- Username
- Password

When the login-parameters should be inserted on the frontend, connect the form-inputs to the connector with the topics `username` and `password`. To send a login or logout event, emit a message with the topics `login` or `logout`.

#### Belimo-Device

Reads all devices and write them to the output. Connect a ui-dropdown to display the devices in the frontend. To send a device to the output, select one in the dropdown, or emit a message with the topic `deviceId`.

#### Belimo-Datapoint

Reads the dataprofile from the device and write them to the output. Connect a ui-dropdown to display the datapoints in the frontend. When no device is present, just type in the `reference` like `/energyvalve3/1.2` for your specific device and select the datapoint in the dropdown.
It will start a subscription, when a datapoint is selected or when one is found by a emitted message with the topic `datapointId`.

To write the selected datapoint, simple connect a ui-input, set the topic to `write` and enter the values in the frontend. Please check if the datapoint is writable.
It's possible to write multiple values. Please check the Node-Information for the object-structure.

#### Belimo-Historical

Reads the historical data from the connected datapoint. It has following parameters: `resolution`, `from` and `to`. To display live-data, just clear the `from` and `to` parameters.
Please check the Node-Information for the object-structure of the `from` and `to` parameters.

#### Belimo-FindDevice

Use this node for searching a device by serial-number.


### Example flow

Below is an example flow that shows how to use the library. The Belimo-Connector handles the connection to the cloud. This connection will be used in any other node. To read a datapoints simple insert a Device-Node, connect it to a Datapoint-Node and deploy it. After that, it's possible to select a device in the Device-Node and a Datapoint in the Datapoint-Node. It has more examples in the `./node-red-contrib-belimo-cloud/examples` folder.

#### Example Dependenices
- dynamic_frontend.json - `npm i node-red-dashboard`

#### Simple Example
![Example flow img](examples/example_flow.png)


```
[{"id":"ba23a94e.07c808","type":"tab","label":"Belimo Simple Example","disabled":false,"info":"Getting started\n\n1. Open the `Belimo-Connector` and create a `oauth` configuration\n2. In the `Belimo-Connector` enter a valid username and password\n3. Select the oauth configuration in each belimo-node\n4. Deploy it\n5. Select a device in the `Belimo-Devices`\n6. Select a datapoint in the `Belimo-Datapoint`\n7. Check the `Debugg Messages`\n"},{"id":"896275e.2d91f88","type":"comment","z":"ba23a94e.07c808","name":"Device and Datapoints","info":"","x":120,"y":220,"wires":[]},{"id":"8032a065.8ebbb","type":"switch","z":"ba23a94e.07c808","name":"","property":"topic","propertyType":"msg","rules":[{"t":"eq","v":"data","vt":"str"}],"checkall":"true","repair":false,"outputs":1,"x":750,"y":320,"wires":[["94ccb09f.ff903"]]},{"id":"fc6f26e9.9b5c18","type":"comment","z":"ba23a94e.07c808","name":"Use a switch to filter only data by topic","info":"","x":830,"y":220,"wires":[]},{"id":"b0c56999.80dc98","type":"comment","z":"ba23a94e.07c808","name":"Enter a valid user","info":"","x":110,"y":60,"wires":[]},{"id":"3648f2f6.8eeefe","type":"debug","z":"ba23a94e.07c808","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","x":590,"y":120,"wires":[]},{"id":"37474564.5df33a","type":"debug","z":"ba23a94e.07c808","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","x":590,"y":380,"wires":[]},{"id":"e6d1e1f.b6e4e2","type":"debug","z":"ba23a94e.07c808","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","x":1130,"y":320,"wires":[]},{"id":"73696a95.12f184","type":"belimo-connector","z":"ba23a94e.07c808","name":"","oauth":"","x":130,"y":120,"wires":[["3648f2f6.8eeefe"]]},{"id":"7761e615.53f618","type":"belimo-devices","z":"ba23a94e.07c808","name":"","oauth":"","device_id":"","x":140,"y":320,"wires":[["ac671551.32d078"]]},{"id":"ac671551.32d078","type":"belimo-datapoint","z":"ba23a94e.07c808","name":"","oauth":"","reference":"","dataprofile_value":"","x":400,"y":320,"wires":[["8032a065.8ebbb","37474564.5df33a"]]},{"id":"94ccb09f.ff903","type":"belimo-historical","z":"ba23a94e.07c808","oauth":"","resolution":"15m","from_date":"","from_time":"","to_date":"","to_time":"","x":920,"y":320,"wires":[["e6d1e1f.b6e4e2"]]},{"id":"afb71c01.c147d","type":"comment","z":"ba23a94e.07c808","name":"When errors while removing the flow, check 'Configuration Nodes'  in the config-window on the right side and remove unused nodes","info":"","x":450,"y":500,"wires":[]}]
```


## Authors

* **MST Systemtechnik AG, Yannick Grund** - *Initial work* - [https://www.mst.ch/](https://www.mst.ch/)


## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details

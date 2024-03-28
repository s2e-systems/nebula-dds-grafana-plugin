# Nebula DDS Datasource

The Nebula DDS Datasource plugin allows you to visualize data published on a Data Distribution Service (DDS) databus from within Grafana.

## Requirements

The Nebula DDS data source requires that you have a Nebula DDS Weblink server running. You can download the server software and request a license on the [Nebula DDS Weblink website](https://www.s2e-systems.com/products/nebula-dds-weblink/). The server must be running on a computer which is able to subscribe to the data published by the DDS nodes which you are querying.

## Configure the data source

Add a Nebula DDS Datasource and configure the URL to the address and port where your Nebula DDS server is accessible.

## Query data

The query editor allows you to specify the topic name and type which you want to query. When a query is first issued a data reader is created on the Nebula DDS server. A selection of relevant Quality-of-Service (QoS) settings are available to be configured on the query editor panel. For Nebula DDS to interpret the DDS data, a type description as to given following the XML format describer in the [DDS X-Types standard](https://www.omg.org/spec/DDS-XTypes/1.3/PDF). If the data is being published by software implemented using [Dust DDS](https://github.com/s2e-systems/dust-dds) the XML description is not needed since it is automatically retrieved by the discovery process.

## Questions and feedback

If you have questions or feedback about this plugin you can open an issue on [Github](https://github.com/s2e-systems/nebula-dds-grafana-plugin) or contact us through our [website](https://www.s2e-systems.com/).

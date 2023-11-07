# Grafana DustDDS Data Source Plugin

Grafana plugin for receiving data published using the Data Distribution Service (DDS) middleware. This plugin gets the data by interfacing with the DustDDSWeb software using a REST api as standardized by the OMG.

# Building the plugin

The plugin is built locally using Windows Subsystem for Linux (WSL). To install the latest version of Node it is needed to follow the instructions on the [distributions website](https://github.com/nodesource/distributions). The version available from apt-get is too old to compile the Grafana plugin.

Once Node is installed the dependencies can be
import React, { PureComponent } from 'react';
import { DataSourceHttpSettings } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { NebulaDdsDataSourceOptions, } from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<NebulaDdsDataSourceOptions> { }

interface State {}

export class ConfigEditor extends PureComponent<Props, State> {
  render() {
    const { options } = this.props;
    return (
      <DataSourceHttpSettings
        defaultUrl="http://localhost:3511"
        dataSourceConfig={options}
        onChange={this.props.onOptionsChange}
      />
    );
  }
}

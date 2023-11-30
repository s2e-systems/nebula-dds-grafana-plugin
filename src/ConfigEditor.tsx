import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { DataSourceHttpSettings } from '@grafana/ui';
import React from 'react';
import { DustDdsDataSourceOptions } from './types';

interface Props extends DataSourcePluginOptionsEditorProps<DustDdsDataSourceOptions> {}

export const ConfigEditor: React.FC<Props> = ({ onOptionsChange, options }) => {
  return (
    <DataSourceHttpSettings
      defaultUrl="https://api.example.com"
      dataSourceConfig={options}
      onChange={onOptionsChange}
    />
  );
};

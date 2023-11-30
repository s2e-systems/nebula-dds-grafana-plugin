import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { DataSourceHttpSettings, InlineField, Input, VerticalGroup } from '@grafana/ui';
import React, { ChangeEvent } from 'react';
import { DustDdsDataSourceOptions } from './types';

interface Props extends DataSourcePluginOptionsEditorProps<DustDdsDataSourceOptions> { }


export const ConfigEditor: React.FC<Props> = ({ onOptionsChange, options }) => {
  const onKeepLastChange = (event: ChangeEvent<HTMLInputElement>) => {
    const jsonData = {
      ...options.jsonData,
      keep_last_samples: parseInt(event.target.value, 10)
    };

    onOptionsChange({ ...options, jsonData });
  };

  return (
    <VerticalGroup>
      <DataSourceHttpSettings
        defaultUrl="https://api.example.com"
        dataSourceConfig={options}
        onChange={onOptionsChange}
      />

      <header>DDS configuration</header>
      <InlineField label="Reader maximum samples" tooltip="Setting for History Qos KeepLast">
        <Input value={options.jsonData.keep_last_samples} onChange={onKeepLastChange} placeholder='Max. number of reader samples' />
      </InlineField>

    </VerticalGroup>
  );
};

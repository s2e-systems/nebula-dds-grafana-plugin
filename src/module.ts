import { DataSourcePlugin } from '@grafana/data';
import { ConfigEditor } from './ConfigEditor';
import { DataSource } from './DataSource';
import { QueryEditor } from './QueryEditor';
import { DustDdsDataSourceOptions, DustDdsQuery } from './types';

export const plugin = new DataSourcePlugin<DataSource, DustDdsQuery, DustDdsDataSourceOptions>(DataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);

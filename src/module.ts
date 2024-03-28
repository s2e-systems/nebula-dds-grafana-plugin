import { DataSourcePlugin } from '@grafana/data';
import { DataSource } from './DataSource';
import { ConfigEditor } from './components/ConfigEditor';
import { QueryEditor } from './components/QueryEditor';
import { NebulaDdsQuery, NebulaDdsDataSourceOptions } from './types';

export const plugin = new DataSourcePlugin<DataSource, NebulaDdsQuery, NebulaDdsDataSourceOptions>(DataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);

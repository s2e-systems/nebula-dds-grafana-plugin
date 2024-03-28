import { DataSourceInstanceSettings, CoreApp } from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';

import { NebulaDdsQuery, NebulaDdsDataSourceOptions, DEFAULT_QUERY } from './types';

export class DataSource extends DataSourceWithBackend<NebulaDdsQuery, NebulaDdsDataSourceOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<NebulaDdsDataSourceOptions>) {
    super(instanceSettings);
  }

  getDefaultQuery(_: CoreApp): Partial<NebulaDdsQuery> {
    return DEFAULT_QUERY;
  }
}

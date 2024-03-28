import { DataSourceJsonData } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

export interface NebulaDdsQuery extends DataQuery {
  topic_name: string;
  type_name: string;
  number_samples: number,
  minimum_time_separation?: number,
  type_representation?: string;
}

export const DEFAULT_QUERY: Partial<NebulaDdsQuery> = {
};

/**
 * These are options configured for each DataSource instance
 */
export interface NebulaDdsDataSourceOptions extends DataSourceJsonData {
  path?: string;
  domain_id?: number;
}
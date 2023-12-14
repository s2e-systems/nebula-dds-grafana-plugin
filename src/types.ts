import { DataQuery, DataSourceJsonData } from '@grafana/schema';

export interface DustDdsQuery extends DataQuery {
  topic_name: string;
  type_name: string;
  type_representation?: string;
}

export const defaultQuery: Partial<DustDdsQuery> = {

};

export interface DataPoint {
  Time: number;
  Value: number;
}
export interface DataSourceResponse {
  datapoints: DataPoint[];
}

/**
 * These are options configured for each DataSource instance
 */
export interface DustDdsDataSourceOptions extends DataSourceJsonData {
  path?: string;
  domain_id?: number,
  keep_last_samples?: number,
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  apiKey?: string;
}

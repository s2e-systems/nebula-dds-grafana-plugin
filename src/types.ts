import { DataQuery, DataSourceJsonData } from '@grafana/schema';

export interface DustDdsQuery extends DataQuery {
  queryText?: string;
  topic_name: string;
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
export interface MyDataSourceOptions extends DataSourceJsonData {
  path?: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  apiKey?: string;
}

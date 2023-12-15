import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  FieldType,
  MutableDataFrame,
} from '@grafana/data';
import { getBackendSrv, isFetchError } from '@grafana/runtime';
import _ from 'lodash';
import defaults from 'lodash/defaults';
import { DustDdsDataSourceOptions, defaultQuery, DustDdsQuery } from './types';
import { lastValueFrom } from 'rxjs';
import { XMLParser } from 'fast-xml-parser';

const STATUS_CODE_CONFLICT = 409;

export class DataSource extends DataSourceApi<DustDdsQuery, DustDdsDataSourceOptions> {
  baseUrl: string;
  keep_last_samples: number;
  domain_id: number;

  constructor(instanceSettings: DataSourceInstanceSettings<DustDdsDataSourceOptions>) {
    super(instanceSettings);

    this.baseUrl = instanceSettings.url!;
    this.domain_id = instanceSettings.jsonData.domain_id || 0;
    this.keep_last_samples = instanceSettings.jsonData.keep_last_samples || 1000;
  }

  async query(options: DataQueryRequest<DustDdsQuery>): Promise<DataQueryResponse> {
    const promises = options.targets.map(async (target) => {
      const query = defaults(target, defaultQuery);
      const reader_name = query.refId;

      await this.create_dds_web_application();
      if (query.type_representation) {
        await this.register_dds_web_type(query.type_representation);
      }
      await this.create_dds_web_participant();
      await this.create_dds_web_query_topic(query.topic_name, query.type_name);
      await this.create_dds_web_subscriber();
      await this.create_dds_web_query_reader(reader_name, query.topic_name);

      let sample_data;
      try {
        sample_data = await getBackendSrv().get<string>(
          `${this.baseUrl}/dds/rest1/applications/GrafanaApp/domain_participants/GrafanaParticipant/subscribers/GrafanaSubscriber/data_readers/${reader_name}`,
          { "removeFromReaderCache": "FALSE" }
        );
      } catch (err) {
        return new MutableDataFrame();
      }

      const parser = new XMLParser();
      let sample_data_obj = parser.parse(sample_data);

      const sample_list = sample_data_obj["read_sample_seq"]["sample"];

      let fields: Array<{ name: string, type: FieldType, values: number[] }> = [];

      sample_list.forEach((value: { [x: string]: { [x: string]: { [x: string]: number; }; }; }, index: number) => {
        fields[0] ??= { name: 'Time', type: FieldType.time, values: [] };
        const timestamp_object = value["read_sample_info"]["source_timestamp"];
        const timestamp_sec: number = timestamp_object["sec"];
        const timestamp_nanosec: number = timestamp_object["nanosec"];
        const timestamp = timestamp_sec * 1000 + timestamp_nanosec / 1000000;
        fields[0].values.push(timestamp);

        const data_object = value["data"][query.type_name];
        const data_fields = Object.keys(data_object)
        data_fields.forEach((field, index) => {
          let value = data_object[field];
          let field_type;
          if (isNaN(Number(value))) {
            field_type = FieldType.string;
          } else {
            field_type = FieldType.number;
            value = Number(value);
          }
          fields[index + 1] ??= { name: field, type: field_type, values: [] };
          fields[index + 1].values.push(value);
        });
      })

      return new MutableDataFrame({
        refId: query.refId,
        fields
      });
    });


    return Promise.all(promises).then((data) => ({ data }));
  }

  /**
   * Checks whether we can connect to the DustDDS Web server.
   */
  async testDatasource() {
    const defaultErrorMessage = 'Cannot connect to DustDDSWeb server';

    try {
      const response = await lastValueFrom(getBackendSrv().fetch<string>(
        {
          url: `${this.baseUrl}/dds/rest1/applications?applicationNameExpression=''`,
          method: 'GET'
        }
      ));

      if (response.status === 200) {
        return {
          status: 'success',
          message: 'Success',
        };
      } else {
        return {
          status: 'error',
          message: response.statusText ? response.statusText : defaultErrorMessage,
        };
      }
    } catch (err) {
      let message = '';
      if (_.isString(err)) {
        message = err;
      } else if (isFetchError(err)) {
        message = 'Fetch error: ' + (err.statusText ? err.statusText : defaultErrorMessage);
        if (err.data && err.data.error && err.data.error.code) {
          message += ': ' + err.data.error.code + '. ' + err.data.error.message;
        }
      }
      return {
        status: 'error',
        message,
      };
    }
  }

  private async create_dds_web_application() {
    try {
      await lastValueFrom(getBackendSrv().fetch<string>(
        {
          url: `${this.baseUrl}/dds/rest1/applications`,
          method: 'POST',
          data: '<application name="GrafanaApp"/>',
          showErrorAlert: false,
        }
      ));
    } catch (err) {
      if (isFetchError(err)) {
        if (err.status !== STATUS_CODE_CONFLICT) {
          throw err;
        }
      }
      else {
        throw err;
      }
    }
  }

  private async create_dds_web_participant() {
    try {
      await lastValueFrom(getBackendSrv().fetch<string>(
        {
          url: `${this.baseUrl}/dds/rest1/applications/GrafanaApp/domain_participants`,
          method: 'POST',
          data: `<domain_participant name="GrafanaParticipant" domain_id="${this.domain_id}"/>`,
          showErrorAlert: false,
        }
      ));
    } catch (err) {
      if (isFetchError(err)) {
        if (err.status !== STATUS_CODE_CONFLICT) {
          throw err;
        }
      }
      else {
        throw err;
      }
    }
  }

  private async create_dds_web_query_topic(topic_name: string, type_name: string) {
    try {
      await lastValueFrom(getBackendSrv().fetch<string>(
        {
          url: `${this.baseUrl}/dds/rest1/applications/GrafanaApp/domain_participants/GrafanaParticipant/topics`,
          method: 'POST',
          data: `<topic name="${topic_name}" register_type_ref="${type_name}"/>`,
          showErrorAlert: false,
        }
      ));
    } catch (err) {
      if (isFetchError(err)) {
        if (err.status !== STATUS_CODE_CONFLICT) {
          throw err;
        }
      }
      else {
        throw err;
      }
    }
  }

  private async create_dds_web_subscriber() {
    try {
      await lastValueFrom(getBackendSrv().fetch<string>(
        {
          url: `${this.baseUrl}/dds/rest1/applications/GrafanaApp/domain_participants/GrafanaParticipant/subscribers`,
          method: 'POST',
          data: `<subscriber name="GrafanaSubscriber"/>`,
          showErrorAlert: false,
        }
      ));
    } catch (err) {
      if (isFetchError(err)) {
        if (err.status !== STATUS_CODE_CONFLICT) {
          throw err;
        }
      }
      else {
        throw err;
      }
    }
  }

  private async create_dds_web_query_reader(reader_name: string, topic_name: string) {
    try {
      await lastValueFrom(getBackendSrv().fetch<string>(
        {
          url: `${this.baseUrl}/dds/rest1/applications/GrafanaApp/domain_participants/GrafanaParticipant/subscribers/GrafanaSubscriber/data_readers`,
          method: 'POST',
          data: `<data_reader name="${reader_name}" topic_ref="${topic_name}"> \
                  <datareader_qos> \
                    <history> \
                      <depth>${this.keep_last_samples}</depth> \
                    </history>\
                  </datareader_qos> \
                 </data_reader>`,
          showErrorAlert: false,
        }
      ));
    } catch (err) {
      if (isFetchError(err)) {
        if (err.status !== STATUS_CODE_CONFLICT) {
          throw err;
        }
      }
      else {
        throw err;
      }
    }
  }

  private async register_dds_web_type(type_representation: string) {
    try {
      await lastValueFrom(getBackendSrv().fetch<string>(
        {
          url: `${this.baseUrl}/dds/rest1/types`,
          method: 'POST',
          data: type_representation,
          showErrorAlert: false,
        }
      ));
    } catch (err) {
      if (isFetchError(err)) {
        if (err.status !== STATUS_CODE_CONFLICT) {
          throw err;
        }
      }
      else {
        throw err;
      }
    }
  }
}

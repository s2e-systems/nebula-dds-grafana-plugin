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
      await this.register_dds_web_type();
      await this.create_dds_web_participant();
      await this.create_dds_web_query_topic("Square", "ShapeType");
      await this.create_dds_web_subscriber();
      await this.create_dds_web_query_reader(reader_name, "Square");

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
      const sample_rate_ms = 25;
      const now_timestamp = new Date().getTime();

      let timestamps: number[] = [];
      let x_values: number[] = [];
      let y_values: number[] = [];

      sample_list.forEach((value: { [x: string]: { [x: string]: { [x: string]: number; }; }; }, index: number) => {
        timestamps.push(now_timestamp - index * sample_rate_ms);

        x_values.push(value["data"]["ShapeType"]["x"]);
        y_values.push(value["data"]["ShapeType"]["y"]);
      })

      return new MutableDataFrame({
        refId: query.refId,
        fields: [
          { name: 'Time', type: FieldType.time, values: timestamps },
          { name: 'X', type: FieldType.number, values: x_values },
          { name: 'Y', type: FieldType.number, values: y_values },
        ],
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

  private async register_dds_web_type() {
    try {
      await lastValueFrom(getBackendSrv().fetch<string>(
        {
          url: `${this.baseUrl}/dds/rest1/types`,
          method: 'POST',
          data: `<types><struct name="ShapeType"><member name="color" type="string"></member><member name="x" type="int32"></member><member name="y" type="int32"></member><member name="shapesize" type="int32"></member></struct></types>`,
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

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
import { DataSourceResponse, DustDdsDataSourceOptions, defaultQuery, DustDdsQuery } from './types';
import { lastValueFrom } from 'rxjs';
import { XMLParser } from 'fast-xml-parser';

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

      // const create_reader = `
      //   <application name="GrafanaApp"> \
      //   <domain_participant name="GrafanaParticipant" domain_id="${this.domain_id}">  \
      //   <topic name="Square" register_type_ref="ShapeType"/> \
      //   <subscriber name="sub"> \
      //     <data_reader name="dr" topic_ref="Square"> \
      //       <datareader_qos> \
      //         <history> \
      //           <depth>${this.keep_last_samples}</depth> \
      //         </history>\
      //       </datareader_qos> \
      //     </data_reader> \
      //   </subscriber> \
      // </domain_participant> \
      // </application>`;

      // getBackendSrv().post<string>(
      //   `${this.baseUrl}/dds/rest1/types`,
      //   '<types><struct name="ShapeType"><member name="color" type="string"></member><member name="x" type="int32"></member><member name="y" type="int32"></member><member name="shapesize" type="int32"></member></struct></types>'
      // ).finally(
      //   await getBackendSrv().post(
      //     `${this.baseUrl}/dds/rest1/applications`,
      //     create_reader,
      //   )
      // )

      let sample_data = await getBackendSrv().get<string>(
        `${this.baseUrl}/dds/rest1/applications/GrafanaApp/domain_participants/GrafanaParticipant/subscribers/sub/data_readers/dr`,
        { "removeFromReaderCache": "FALSE" }
      );

      const parser = new XMLParser();
      let sample_data_obj = parser.parse(sample_data);

      const shape_type_samples = sample_data_obj["read_sample_seq"]["ShapeType"];
      const sample_rate_ms = 25;
      const now_timestamp = new Date().getTime();

      let timestamps: number[] = [];
      let x_values: number[] = [];
      let y_values: number[] = [];

      shape_type_samples.forEach((value: { [x: string]: number; }, index: number) => {
        timestamps.push(now_timestamp - index * sample_rate_ms);
        x_values.push(value["x"]);
        y_values.push(value["y"]);
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

  async request(url: string, params?: string) {
    const response = getBackendSrv().fetch<DataSourceResponse>({
      url: `${this.baseUrl}${url}${params?.length ? `?${params}` : ''}`,
    });
    return lastValueFrom(response);
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
}

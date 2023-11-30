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
import { DataSourceResponse, MyDataSourceOptions, defaultQuery, DustDdsQuery } from './types';
import { lastValueFrom } from 'rxjs';
import { XMLParser } from 'fast-xml-parser';

export class DataSource extends DataSourceApi<DustDdsQuery, MyDataSourceOptions> {
  baseUrl: string;
  initialize_once: () => void;

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);

    this.baseUrl = instanceSettings.url!;
    this.initialize_once = (function () {
      let executed = false;
      return async function () {
        if (!executed) {

          // Register the type
          await lastValueFrom(getBackendSrv().fetch<string>(
            {
              url: `${instanceSettings.url}/dds/rest1/types`,
              method: 'POST',
              data: '<types><struct name="ShapeType"><member name="color" type="string"></member><member name="x" type="int32"></member><member name="y" type="int32"></member><member name="shapesize" type="int32"></member></struct></types>'
            }
          ));

          // Create an application with data reader
          // const create_application_response = await lastValueFrom(getBackendSrv().fetch<string>(
          //   {
          //     url: `${instanceSettings.url}dds/rest1/types`,
          //     method: 'POST',
          //     data: '<types><struct name="ShapeType"><member name="color" type="string"></member><member name="x" type="int32"></member><member name="y" type="int32"></member><member name="shapesize" type="int32"></member></struct></types>'
          //   }
          // ));

          executed = true;
          // do something
        }
      }
    });
  }

  async query(options: DataQueryRequest<DustDdsQuery>): Promise<DataQueryResponse> {
    console.info("Starting query for DDS data");

    const promises = options.targets.map(async (target) => {
      // Register the type
      const query = defaults(target, defaultQuery);
      // const type_response =


      // getBackendSrv().post<string>(
      //   `${this.baseUrl}/dds/rest1/types`,
      //   '<types><struct name="ShapeType"><member name="color" type="string"></member><member name="x" type="int32"></member><member name="y" type="int32"></member><member name="shapesize" type="int32"></member></struct></types>'
      // ).finally(
      //   await getBackendSrv().post(
      //     `${this.baseUrl}/dds/rest1/applications`,
      //     ' <application name="GrafanaApp"> \
      //        <domain_participant name="GrafanaParticipant" domain_id="0">  \
      //         <topic name="Square" register_type_ref="ShapeType"/> \
      //         <subscriber name="sub"> \
      //           <data_reader name="dr" topic_ref="Square"> \
      //           </data_reader> \
      //         </subscriber> \
      //       </domain_participant> \
      //      </application> \
      //     '
      //   )
      // )

      let sample_data = await getBackendSrv().get<string>(
        `${this.baseUrl}/dds/rest1/applications/GrafanaApp/domain_participants/GrafanaParticipant/subscribers/sub/data_readers/dr`,
      );

      const parser = new XMLParser();
      let sample_data_obj = parser.parse(sample_data);

      for (const field in sample_data_obj["read_sample_seq"]["ShapeType"]) {
        console.info("Received " + field + " with value " + sample_data_obj["read_sample_seq"]["ShapeType"][field]);
      }

      const timestamps: number[] = [new Date().getTime()];
      const x_values: number[] = [sample_data_obj["read_sample_seq"]["ShapeType"]["x"]];
      const y_values: number[] = [sample_data_obj["read_sample_seq"]["ShapeType"]["y"]];


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

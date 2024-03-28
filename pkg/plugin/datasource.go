package plugin

import (
	"bytes"
	"context"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"math"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"net/http"
	"net/http/cookiejar"
)

// Make sure Datasource implements required interfaces. This is important to do
// since otherwise we will only get a not implemented error response from plugin in
// runtime. In this example datasource instance implements backend.QueryDataHandler,
// backend.CheckHealthHandler interfaces. Plugin should not implement all these
// interfaces - only those which are required for a particular task.
var (
	_ backend.QueryDataHandler      = (*Datasource)(nil)
	_ backend.CheckHealthHandler    = (*Datasource)(nil)
	_ instancemgmt.InstanceDisposer = (*Datasource)(nil)
)

// NewDatasource creates a new datasource instance.
func NewDatasource(_ context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	var server = settings.URL

	jar, err := cookiejar.New(nil)
	if err != nil {
		return nil, err
	}
	client := &http.Client{
		Jar: jar,
	}

	application_body := []byte(`<application name="gf_app"> <domain_participant domain_id="0"  name="gf_participant"> <subscriber name="gf_subscriber" /> </domain_participant> </application>`)
	client.Post(fmt.Sprintf("%s/dds/rest1/applications", server), NEBULA_DDS_CONTENT_TYPE, bytes.NewBuffer(application_body))

	return &Datasource{client: *client}, nil
}

// Datasource is an example datasource which can respond to data queries, reports
// its health and has streaming skills.
type Datasource struct {
	client http.Client
}

// Dispose here tells plugin SDK that plugin wants to clean up resources when a new instance
// created. As soon as datasource settings change detected by SDK old datasource instance will
// be disposed and a new one will be created using NewSampleDatasource factory function.
func (d *Datasource) Dispose() {
	// Clean up datasource instance resources.
}

// QueryData handles multiple queries and returns multiple responses.
// req contains the queries []DataQuery (where each query contains RefID as a unique identifier).
// The QueryDataResponse contains a map of RefID to the response for each query, and each response
// contains Frames ([]*Frame).
func (d *Datasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	// create response struct
	response := backend.NewQueryDataResponse()

	// loop over queries and execute them individually.
	for _, q := range req.Queries {
		res := d.query(ctx, req.PluginContext, q)

		// save the response in a hashmap
		// based on with RefID as identifier
		response.Responses[q.RefID] = res
	}

	return response, nil
}

const NEBULA_DDS_CONTENT_TYPE = "application/dds-web+xml"
const STATUS_CODE_OK = 200
const STATUS_CODE_NOT_FOUND = 200

type queryModel struct {
	TopicName             string  `json:"topic_name"`
	TypeName              string  `json:"type_name"`
	NumberSamples         int32   `json:"number_samples"`
	MinimumTimeSeparation float64 `json:"minimum_time_separation"`
	TypeRepresentation    string  `json:"type_representation"`
}

type topic struct {
	XMLName         xml.Name `xml:"topic"`
	Name            string   `xml:"name,attr"`
	RegisterTypeRef string   `xml:"register_type_ref,attr"`
}

type topic_list struct {
	XMLName   xml.Name `xml:"topic_list"`
	TopicList []topic  `xml:"topic"`
}

type dataReader struct {
	XMLName                      xml.Name `xml:"data_reader"`
	Name                         string   `xml:"name,attr"`
	TopicRef                     string   `xml:"topic_ref,attr"`
	HistoryDepth                 int32    `xml:"datareader_qos>history>depth"`
	MinimumTimeSeparationSec     uint64   `xml:"datareader_qos>time_based_filter>minimum_separation>sec"`
	MinimumTimeSeparationNanosec uint64   `xml:"datareader_qos>time_based_filter>minimum_separation>nanosec"`
}

type dataReaderList struct {
	XMLName        xml.Name     `xml:"data_reader_list"`
	DataReaderList []dataReader `xml:"data_reader"`
}

func (d *Datasource) query(_ context.Context, backend_ctx backend.PluginContext, query backend.DataQuery) backend.DataResponse {
	var server = backend_ctx.DataSourceInstanceSettings.URL
	var response backend.DataResponse

	// Unmarshal the JSON into our queryModel.
	var qm queryModel

	err := json.Unmarshal(query.JSON, &qm)
	if err != nil {
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("json unmarshal: %v", err.Error()))
	}

	// Create the type definition is the string is not empty
	if qm.TypeRepresentation != "" {
		create_type_address := fmt.Sprintf("%s/dds/rest1/types", server)
		d.client.Post(create_type_address, NEBULA_DDS_CONTENT_TYPE, bytes.NewBufferString(qm.TypeRepresentation))
	}

	// Create the topic. It might already exist but we ignore the error
	get_topic_address := fmt.Sprintf("%s/dds/rest1/applications/gf_app/domain_participants/gf_participant/topics?topicNameExpression=%s&registeredTypeNameExpression=*", server, qm.TopicName)
	get_topic_resp, err := d.client.Get(get_topic_address)
	if err != nil {
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("get topic: %v", err.Error()))
	}
	defer get_topic_resp.Body.Close()
	if get_topic_resp.StatusCode == STATUS_CODE_OK {
		var existing_topic_list topic_list
		get_topic_body, _ := io.ReadAll(get_topic_resp.Body)
		err := xml.Unmarshal(get_topic_body, &existing_topic_list)
		if err != nil {
			return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("error %s unmarshalling get topic response: %v \n Response body: %s", err, get_topic_resp, get_topic_body))
		}

		if len(existing_topic_list.TopicList) > 0 {
			if existing_topic_list.TopicList[0].RegisterTypeRef != qm.TypeName {
				update_topic_url := fmt.Sprintf("%s/dds/rest1/applications/gf_app/domain_participants/gf_participant/topics/%s", server, qm.TopicName)
				update_topic_body, _ := xml.Marshal(topic{Name: qm.TopicName, RegisterTypeRef: qm.TypeName})
				update_topic_request, err := http.NewRequest(http.MethodPut, update_topic_url, bytes.NewReader(update_topic_body))
				if err != nil {
					return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("error creating update topic request: %s", err))
				}
				update_topic_resp, err := d.client.Do(update_topic_request)
				if err != nil {
					return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("error %s updating topic. Response: %v", err, update_topic_resp))
				}
				defer update_topic_resp.Body.Close()
			}
		} else {
			create_topic_address := fmt.Sprintf("%s/dds/rest1/applications/gf_app/domain_participants/gf_participant/topics", server)
			create_topic_body, _ := xml.Marshal(topic{Name: qm.TopicName, RegisterTypeRef: qm.TypeName})
			create_topic_resp, err := d.client.Post(create_topic_address, NEBULA_DDS_CONTENT_TYPE, bytes.NewReader(create_topic_body))
			if err != nil {
				return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("error %s creating topic. Response: %v", err, create_topic_resp))
			}
			defer create_topic_resp.Body.Close()
			if create_topic_resp.StatusCode != STATUS_CODE_OK {
				create_topic_resp_body, _ := io.ReadAll(get_topic_resp.Body)
				return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("Create topic returned unexpected status %d. Response body: %s", create_topic_resp.StatusCode, create_topic_resp_body))
			}
		}
	} else {
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("unexpected get topic response: %v", get_topic_resp))
	}

	number_samples := qm.NumberSamples
	if number_samples < 1 {
		number_samples = 1
	}
	minimum_time_separation_secs := uint64(qm.MinimumTimeSeparation)
	minimum_time_separation_nanosecs := uint64((qm.MinimumTimeSeparation - math.Floor(qm.MinimumTimeSeparation)) * 1000000000)

	// Create or update the data reader
	get_data_reader_address := fmt.Sprintf("%s/dds/rest1/applications/gf_app/domain_participants/gf_participant/subscribers/gf_subscriber/data_readers?datareaderNameExpression=%s", server, query.RefID)
	get_reader_resp, err := d.client.Get(get_data_reader_address)
	if err != nil {
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("get data reader: %v", err.Error()))
	}
	defer get_reader_resp.Body.Close()

	if get_topic_resp.StatusCode == STATUS_CODE_OK {
		var existing_reader_list dataReaderList
		get_reader_body, _ := io.ReadAll(get_reader_resp.Body)
		err := xml.Unmarshal(get_reader_body, &existing_reader_list)
		if err != nil {
			return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("error  %s unmarshalling get reader response: %v \n Response body: %s", err, get_topic_resp, get_reader_body))
		}

		if len(existing_reader_list.DataReaderList) > 0 {
			if existing_reader_list.DataReaderList[0].TopicRef != qm.TopicName ||
				existing_reader_list.DataReaderList[0].HistoryDepth != number_samples ||
				existing_reader_list.DataReaderList[0].MinimumTimeSeparationSec != minimum_time_separation_secs ||
				existing_reader_list.DataReaderList[0].MinimumTimeSeparationNanosec != minimum_time_separation_nanosecs {

				update_reader_url := fmt.Sprintf("%s/dds/rest1/applications/gf_app/domain_participants/gf_participant/subscribers/gf_subscriber/data_readers/%s", server, query.RefID)
				update_reader_body, _ := xml.Marshal(dataReader{Name: query.RefID, TopicRef: qm.TopicName, HistoryDepth: number_samples, MinimumTimeSeparationSec: minimum_time_separation_secs, MinimumTimeSeparationNanosec: minimum_time_separation_nanosecs})
				update_reader_request, err := http.NewRequest(http.MethodPut, update_reader_url, bytes.NewReader(update_reader_body))
				if err != nil {
					return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("error creating update reader request: %s", err))
				}

				update_reader_resp, err := d.client.Do(update_reader_request)
				if err != nil {
					return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("error %s updating reader. Response: %v", err, update_reader_resp))
				}
				defer update_reader_resp.Body.Close()
			}
		} else {
			create_data_reader_address := fmt.Sprintf("%s/dds/rest1/applications/gf_app/domain_participants/gf_participant/subscribers/gf_subscriber/data_readers", server)
			create_reader_body, _ := xml.Marshal(dataReader{Name: query.RefID, TopicRef: qm.TopicName, HistoryDepth: number_samples, MinimumTimeSeparationSec: minimum_time_separation_secs, MinimumTimeSeparationNanosec: minimum_time_separation_nanosecs})
			d.client.Post(create_data_reader_address, NEBULA_DDS_CONTENT_TYPE, bytes.NewReader(create_reader_body))
		}

	} else {
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("unexpected get reader response: %v", get_reader_resp))
	}

	// Read the data
	read_samples_address := fmt.Sprintf(`%s/dds/rest1/applications/gf_app/domain_participants/gf_participant/subscribers/gf_subscriber/data_readers/%s?removeFromReaderCache=FALSE`, server, query.RefID)
	read_response, read_err := d.client.Get(read_samples_address)
	if read_err != nil {
		return backend.ErrDataResponse(backend.StatusInternal, fmt.Sprintf("read data failed: %v", read_err.Error()))
	}

	// Get the body of the data
	read_response_string, _ := io.ReadAll(read_response.Body)
	parsed_sample, parsed_sample_err := parse_nebula_read_xml(read_response_string, qm.TypeName)
	if parsed_sample_err != nil {
		return backend.ErrDataResponse(backend.StatusInternal, fmt.Sprintf("parse received data failed: %v", parsed_sample_err.Error()))
	}

	// create data frame response.
	// For an overview on data frames and how grafana handles them:
	// https://grafana.com/developers/plugin-tools/introduction/data-frames
	frame := data.NewFrame(query.RefID, parsed_sample.Data...)

	// add the frames to the response.
	response.Frames = append(response.Frames, frame)

	return response
}

// CheckHealth handles health checks sent from Grafana to the plugin.
// The main use case for these health checks is the test button on the
// datasource configuration page which allows users to verify that
// a datasource is working as expected.
func (d *Datasource) CheckHealth(_ context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	get_types_resp, err := d.client.Get(fmt.Sprintf("%s/dds/rest1/types?typeNameExpression=*&includeReferencesTypesDepth=1", req.PluginContext.DataSourceInstanceSettings.URL))
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: fmt.Sprintf("Failed to send GET request to Nebula server. Error: %s", err),
		}, nil
	}
	defer get_types_resp.Body.Close()

	if get_types_resp.StatusCode == STATUS_CODE_OK {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusOk,
			Message: "Data source is working",
		}, nil
	} else {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: fmt.Sprintf("Get request didn't return expected status code OK. Response: %v ", get_types_resp),
		}, nil
	}

}

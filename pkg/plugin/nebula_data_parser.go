package plugin

import (
	"bytes"
	"encoding/xml"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"golang.org/x/exp/slices"
)

type readSampleSeq struct {
	XMLName xml.Name `xml:"read_sample_seq"`
	Samples []sample `xml:"sample"`
}

type sample struct {
	XMLName        xml.Name       `xml:"sample"`
	ReadSampleInfo readSampleInfo `xml:"read_sample_info"`
	Data           sampleData     `xml:"data"`
}

type readSampleInfo struct {
	XMLName         xml.Name        `xml:"read_sample_info"`
	SourceTimestamp sourceTimestamp `xml:"source_timestamp"`
}

type sourceTimestamp struct {
	XMLName xml.Name `xml:"source_timestamp"`
	Sec     int64    `xml:"sec"`
	Nanosec int64    `xml:"nanosec"`
}

type sampleData struct {
	XMLName xml.Name `xml:"data"`
	Fields  []byte   `xml:",innerxml"`
}

type readSample struct {
	Data []*data.Field
}

func parse_nebula_read_xml(response_xml []byte, type_name string) (*readSample, error) {
	var read_sample_seq readSampleSeq
	parsed_read_sample_list := readSample{make([]*data.Field, 0)}

	err := xml.Unmarshal(response_xml, &read_sample_seq)
	if err != nil {
		return nil, err
	}

	for _, sample := range read_sample_seq.Samples {
		decoder := xml.NewDecoder(bytes.NewReader(sample.Data.Fields))
		timestamp := time.Unix(sample.ReadSampleInfo.SourceTimestamp.Sec, sample.ReadSampleInfo.SourceTimestamp.Nanosec)
		if idx := slices.IndexFunc(parsed_read_sample_list.Data, func(c *data.Field) bool { return c.Name == "time" }); idx != -1 {
			parsed_read_sample_list.Data[idx].Append(timestamp)
		} else {
			parsed_read_sample_list.Data = append(parsed_read_sample_list.Data, data.NewField("time", nil, []time.Time{timestamp}))
		}

		for {
			token, _ := decoder.Token()
			if token == nil {
				break
			}

			switch element := token.(type) {
			case xml.StartElement:
				if element.Name.Local == type_name {
					for {
						token, _ := decoder.Token()
						if token == nil {
							break
						}

						switch member_element := token.(type) {
						case xml.StartElement:
							member_name := member_element.Name.Local
							token, _ := decoder.Token()
							member_cdata := string(token.(xml.CharData))

							if numeric_data_value, err := strconv.ParseFloat(member_cdata, 64); err == nil {
								if idx := slices.IndexFunc(parsed_read_sample_list.Data, func(c *data.Field) bool { return c.Name == member_name }); idx != -1 {
									parsed_read_sample_list.Data[idx].Append(numeric_data_value)
								} else {
									parsed_read_sample_list.Data = append(parsed_read_sample_list.Data, data.NewField(member_name, nil, []float64{numeric_data_value}))
								}
							} else {
								if idx := slices.IndexFunc(parsed_read_sample_list.Data, func(c *data.Field) bool { return c.Name == member_name }); idx != -1 {
									parsed_read_sample_list.Data[idx].Append(member_cdata)
								} else {
									parsed_read_sample_list.Data = append(parsed_read_sample_list.Data, data.NewField(member_name, nil, []string{member_cdata}))
								}

							}

						}
					}
				}
			}
		}
	}

	return &parsed_read_sample_list, nil
}

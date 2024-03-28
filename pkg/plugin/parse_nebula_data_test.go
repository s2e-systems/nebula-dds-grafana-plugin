package plugin

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestParseDataWithMultipleSamples(t *testing.T) {
	samples, err := parse_nebula_read_xml([]byte(`<?xml version="1.0" encoding="utf-8"?>
	<read_sample_seq>
		<sample>
			<read_sample_info>
				<source_timestamp>
					<sec>1710019503</sec>
					<nanosec>559174900</nanosec>
				</source_timestamp>
			</read_sample_info>
			<data>
				<ShapeType>
					<color>RED</color>
					<x>44</x>
					<y>183</y>
					<shapesize>30</shapesize>
				</ShapeType>
			</data>
		</sample>
		<sample>
			<read_sample_info>
				<source_timestamp>
					<sec>1710019504</sec>
					<nanosec>559174900</nanosec>
				</source_timestamp>
			</read_sample_info>
			<data>
				<ShapeType>
					<color>RED</color>
					<x>55</x>
					<y>230</y>
					<shapesize>20</shapesize>
				</ShapeType>
			</data>
		</sample>
	</read_sample_seq>`), "ShapeType")
	if err != nil {
		t.Error(err)
	}

	assert.Len(t, samples.Data, 5)

	assert.Equal(t, samples.Data[0].At(0), time.Unix(1710019503, 559174900))
	assert.Equal(t, samples.Data[1].At(0), "RED")
	assert.Equal(t, samples.Data[2].At(0), 44.0)
	assert.Equal(t, samples.Data[3].At(0), 183.0)
	assert.Equal(t, samples.Data[4].At(0), 30.0)

	assert.Equal(t, samples.Data[0].At(1), time.Unix(1710019504, 559174900))
	assert.Equal(t, samples.Data[1].At(1), "RED")
	assert.Equal(t, samples.Data[2].At(1), 55.0)
	assert.Equal(t, samples.Data[3].At(1), 230.0)
	assert.Equal(t, samples.Data[4].At(1), 20.0)
}

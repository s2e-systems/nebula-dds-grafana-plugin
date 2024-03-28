import React, { ChangeEvent } from 'react';
import { InlineField, Input } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from '../DataSource';
import { NebulaDdsDataSourceOptions, NebulaDdsQuery } from '../types';

type Props = QueryEditorProps<DataSource, NebulaDdsQuery, NebulaDdsDataSourceOptions>;

export function QueryEditor({ query, onChange, onRunQuery }: Props) {
  const onTopicNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, topic_name: event.target.value });
  };

  const onTypeNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, type_name: event.target.value });
    // executes the query
    // onRunQuery();
  };

  const onNumberSamplesChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, number_samples: parseInt(event.target.value) });
    // executes the query
    // onRunQuery();
  };

  const onMinimumTimeSeparationChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, minimum_time_separation: parseFloat(event.target.value) });
    // executes the query
    // onRunQuery();
  };

  const onTypeRepresentationChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, type_representation: event.target.value });
  };

  const { topic_name, type_name, number_samples, minimum_time_separation, type_representation } = query;

  return (
    <div className="gf-form">
      <InlineField label="Topic name">
        <Input onChange={onTopicNameChange} value={topic_name} width={12} type="string" />
      </InlineField>
      <InlineField label="Type name" >
        <Input onChange={onTypeNameChange} value={type_name} width={12} type="string" />
      </InlineField>
      <InlineField label="Number samples" >
        <Input onChange={onNumberSamplesChange} value={number_samples} width={12} type="number" />
      </InlineField>
      <InlineField label="Minimum time separation" tooltip="Minimum time between samples">
        <Input onChange={onMinimumTimeSeparationChange} value={minimum_time_separation || 0} width={12} type="number" />
      </InlineField>
      <InlineField label="Type representation" tooltip="XML definition of the type representation to be read. If using Dust DDS types you can read the XML definition from the output of the function get_type_xml() in the DdsTypeXml trait." >
        <Input onChange={onTypeRepresentationChange} value={type_representation || ''} type="string" />
      </InlineField>
    </div>
  );
}

import defaults from 'lodash/defaults';

import React, { ChangeEvent, PureComponent } from 'react';
import { LegacyForms, HorizontalGroup, } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from './DataSource';
import { defaultQuery, DustDdsDataSourceOptions, DustDdsQuery } from './types';

const { FormField } = LegacyForms;

type Props = QueryEditorProps<DataSource, DustDdsQuery, DustDdsDataSourceOptions>;

export class QueryEditor extends PureComponent<Props> {

  onTopicNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props;
    onChange({ ...query, topic_name: event.target.value });
  };

  onTypeNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props;
    onChange({ ...query, type_name: event.target.value });
  };

  onTypeRepresentationChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props;
    onChange({ ...query, type_representation: event.target.value });
  };

  render() {
    const query = defaults(this.props.query, defaultQuery);
    const { topic_name, type_name, type_representation } = query;

    return (
      <HorizontalGroup>
        <FormField
          width={4}
          value={topic_name}
          onChange={this.onTopicNameChange}
          label="Topic name"
          type="string"
        />
        <FormField
          width={4}
          value={type_name}
          onChange={this.onTypeNameChange}
          label="Type name"
          type="string"
        />
        <FormField
          labelWidth={10}
          value={type_representation || ''}
          onChange={this.onTypeRepresentationChange}
          label="Type Representation"
          tooltip="XML definition of the type representation to be read. This field is optional and only needed when not using DustDDSWeb"
        />
      </HorizontalGroup>
    );
  }
}

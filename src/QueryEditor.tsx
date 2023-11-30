import defaults from 'lodash/defaults';

import React, { ChangeEvent, PureComponent } from 'react';
import { LegacyForms, HorizontalGroup, } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from './DataSource';
import { defaultQuery, DustDdsDataSourceOptions, DustDdsQuery } from './types';

const { FormField } = LegacyForms;

type Props = QueryEditorProps<DataSource, DustDdsQuery, DustDdsDataSourceOptions>;

export class QueryEditor extends PureComponent<Props> {
  onQueryTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props;
    onChange({ ...query, queryText: event.target.value });
  };

  onTopicNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props;
    onChange({ ...query, topic_name: event.target.value });
  };

  render() {
    const query = defaults(this.props.query, defaultQuery);
    const { queryText, topic_name } = query;

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
          labelWidth={8}
          value={queryText || ''}
          onChange={this.onQueryTextChange}
          label="Query Text"
          tooltip="Not used yet"
        />
      </HorizontalGroup>
    );
  }
}

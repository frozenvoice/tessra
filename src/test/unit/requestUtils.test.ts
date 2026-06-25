import * as assert from 'assert';
import {
  createUnresolvedVariableError,
  findUnresolvedVariables,
} from '../../panels/requestPanel/requestUtils';
import { KeyValue } from '../../models/types';
import { VariableService } from '../../services/VariableService';

describe('requestUtils variable diagnostics', () => {
  it('keeps missing nested variables as unresolved warnings', () => {
    const vars: KeyValue[] = [
      { key: 'missing', value: '{{notFound}}', enabled: true },
    ];

    const unresolved = findUnresolvedVariables(
      VariableService.resolve('{{missing}}', vars),
      [],
      [],
      '',
      { type: 'none' },
      vars
    );

    assert.deepStrictEqual(unresolved, ['notFound']);
    assert.strictEqual(
      createUnresolvedVariableError(unresolved),
      'Unresolved environment variables: {{notFound}}'
    );
  });

  it('reports circular references without duplicating them as unresolved variables', () => {
    const vars: KeyValue[] = [
      { key: 'a', value: '{{b}}', enabled: true },
      { key: 'b', value: '{{a}}', enabled: true },
    ];

    const unresolved = findUnresolvedVariables(
      VariableService.resolve('{{a}}', vars),
      [],
      [],
      '',
      { type: 'none' },
      vars
    );

    assert.strictEqual(
      createUnresolvedVariableError(unresolved),
      'Circular environment variable references: {{a}}, {{b}}'
    );
  });
});

import App from '../index';

describe('App Structure', () => {
  test('exports a valid app definition', () => {
    expect(App.version).toBeDefined();
    expect(App.platformVersion).toBeDefined();
    expect(App.authentication).toBeDefined();
    expect(App.triggers).toBeDefined();
    expect(App.creates).toBeDefined();
    expect(App.searches).toBeDefined();
  });

  test('has authentication configured', () => {
    expect(App.authentication.type).toBe('custom');
    expect(App.authentication.fields).toBeDefined();
    expect(App.authentication.fields.length).toBeGreaterThan(0);
    expect(App.authentication.fields[0].key).toBe('api_key');
  });

  test('has new_session trigger', () => {
    expect(App.triggers.new_session).toBeDefined();
    expect(App.triggers.new_session.key).toBe('new_session');
    expect(App.triggers.new_session.noun).toBe('Session');
    expect(App.triggers.new_session.operation.perform).toBeInstanceOf(Function);
  });

  test('has start_debatekit create', () => {
    expect(App.creates.start_debatekit).toBeDefined();
    expect(App.creates.start_debatekit.key).toBe('start_debatekit');
    expect(App.creates.start_debatekit.noun).toBe('DebateKit');
    expect(App.creates.start_debatekit.operation.perform).toBeInstanceOf(Function);
    expect(App.creates.start_debatekit.operation.inputFields.length).toBeGreaterThan(0);
  });

  test('has find_session search', () => {
    expect(App.searches.find_session).toBeDefined();
    expect(App.searches.find_session.key).toBe('find_session');
    expect(App.searches.find_session.noun).toBe('Session');
    expect(App.searches.find_session.operation.perform).toBeInstanceOf(Function);
  });

  test('has beforeRequest middleware for auth', () => {
    expect(App.beforeRequest).toBeDefined();
    expect(App.beforeRequest.length).toBe(1);
  });

  test('start_debatekit has required prompt field', () => {
    const fields = App.creates.start_debatekit.operation.inputFields;
    const promptField = fields.find((f: { key: string }) => f.key === 'prompt');
    expect(promptField).toBeDefined();
    expect(promptField?.required).toBe(true);
    expect(promptField?.type).toBe('text');
  });

  test('start_debatekit has sample output', () => {
    const sample = App.creates.start_debatekit.operation.sample;
    expect(sample).toBeDefined();
    expect('session_id' in sample).toBe(true);
    expect('thread_slug' in sample).toBe(true);
  });

  test('find_session has sample output', () => {
    const sample = App.searches.find_session.operation.sample;
    expect(sample).toBeDefined();
    expect('id' in sample).toBe(true);
  });

  test('new_session has sample output', () => {
    const sample = App.triggers.new_session.operation.sample;
    expect(sample).toBeDefined();
    expect('id' in sample).toBe(true);
  });
});

import { TwilioPipe } from './twilio.pipe';

describe('TwilioPipe', () => {
  it('create an instance', () => {
    const pipe = new TwilioPipe();
    expect(pipe).toBeTruthy();
  });
});

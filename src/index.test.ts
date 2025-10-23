import { main } from '../index';

describe('Main Application', () => {
  it('should run without errors', () => {
    expect(() => main()).not.toThrow();
  });

  it('should be a function', () => {
    expect(typeof main).toBe('function');
  });
});

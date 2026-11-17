const { z } = require('zod');
const { validate } = require('../../src/middleware/validate');

describe('Unit Tests: Validate Middleware', () => {
  const schema = z.object({
    name: z.string().min(2),
    age: z.number().int().positive()
  });

  test('calls next() when body payload matches schema', () => {
    const req = {
      body: { name: 'Alice', age: 30 }
    };
    const res = {};
    const next = jest.fn();

    const middleware = validate(schema, 'body');
    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('calls next(error) with ZodError when validation fails', () => {
    const req = {
      body: { name: 'A', age: -5 }
    };
    const res = {};
    const next = jest.fn();

    const middleware = validate(schema, 'body');
    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.name).toBe('ZodError');
  });
});

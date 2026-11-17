/**
 * Generates an Express validation middleware using a Zod schema.
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @param {'body' | 'query' | 'params'} source - Request property to validate (default: 'body')
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed; // assign sanitized and typed data back to request
      next();
    } catch (err) {
      next(err); // passes directly to centralized errorHandler
    }
  };
}

module.exports = {
  validate
};

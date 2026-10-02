function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      return res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          fieldErrors,
          requestId: req.id
        }
      });
    }
    req[source] = result.data;
    return next();
  };
}

module.exports = { validate };

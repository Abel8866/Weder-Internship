function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const statusCode = error.statusCode || 500;
  const code = error.code || 'INTERNAL_SERVER_ERROR';
  const message = statusCode === 500 ? 'An unexpected server error occurred' : error.message;

  if (statusCode === 500) {
    console.error(`[${req.id}]`, error);
  }

  return res.status(statusCode).json({
    error: {
      code,
      message,
      ...(error.details || {}),
      requestId: req.id
    }
  });
}

module.exports = { errorHandler };

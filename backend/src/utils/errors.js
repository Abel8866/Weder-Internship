class AppError extends Error {
  constructor(statusCode, code, message, details = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function validationError(message, details = {}) {
  return new AppError(422, 'VALIDATION_ERROR', message, details);
}

function conflictError(code, message, details = {}) {
  return new AppError(409, code, message, details);
}

module.exports = { AppError, validationError, conflictError };

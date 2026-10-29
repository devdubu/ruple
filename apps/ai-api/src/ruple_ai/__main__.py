"""Validated development/production entrypoint; Uvicorn uses the same HOST/PORT settings."""

import uvicorn

from ruple_ai.runtime import ConfigurationError, json_log, load_config


def main():
    try:
        config = load_config()
    except ConfigurationError:
        json_log({"event": "service.start.failed", "service": "ai-api"})
        raise SystemExit(1) from None
    uvicorn.run(
        "ruple_ai.main:app", host=config.host, port=config.port,
        reload=config.environment == "development", access_log=False,
        log_config={
            "version": 1, "disable_existing_loggers": False,
            "formatters": {"json": {"()": "ruple_ai.runtime.ServerLogFormatter"}},
            "handlers": {"default": {"class": "logging.StreamHandler", "formatter": "json"}},
            "loggers": {"uvicorn": {"handlers": ["default"], "level": "INFO", "propagate": False}},
        },
    )


if __name__ == "__main__":
    main()

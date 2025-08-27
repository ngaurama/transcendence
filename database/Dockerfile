FROM alpine:latest

RUN apk add --no-cache \
    sqlite \
    sqlite-dev \
    curl \
    bash \
    coreutils

WORKDIR /app

RUN mkdir -p /app/data

COPY init/ /docker-entrypoint-initdb.d/
COPY scripts/ /app/scripts/

RUN chmod +x /app/scripts/*.sh

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3307

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD /app/scripts/health-check.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["tail", "-f", "/dev/null"]

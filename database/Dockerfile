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

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3307

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["tail", "-f", "/dev/null"]

FROM andrewnk/alpine-nginx-modsec:latest

RUN mkdir -p /etc/nginx/modsecurity /var/log/nginx/modsec /var/run/modsecurity

RUN rm /etc/nginx/conf.d/default.conf

COPY confs/modsecurity.conf /etc/nginx/modsecurity/
COPY confs/unicode.mapping /etc/nginx/modsecurity/
COPY confs/main.conf /etc/nginx/modsecurity/
COPY confs/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]


# FROM nginx:1.25

# RUN apt-get update && \
#     apt-get install -y libmodsecurity3 libnginx-mod-security && \
#     apt-get clean && rm -rf /var/lib/apt/lists/*

# RUN git clone https://github.com/coreruleset/coreruleset /etc/nginx/modsecurity/coreruleset

# RUN mkdir -p /etc/nginx/modsecurity /var/log/nginx/modsec /var/run/modsecurity

# RUN rm /etc/nginx/conf.d/default.conf

# COPY confs/modsecurity.conf /etc/nginx/modsecurity/
# COPY confs/main.conf /etc/nginx/modsecurity/
# COPY confs/nginx.conf /etc/nginx/conf.d/default.conf

# EXPOSE 80 443
# CMD ["nginx", "-g", "daemon off;"]





# FROM nginx:1.25-alpine

# RUN apk update && \
#     apk add --no-cache \
#     libmodsecurity3 \
#     modsecurity-nginx \
#     git \
#     curl \
#     openssl
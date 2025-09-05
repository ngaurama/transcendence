#!/bin/bash
OS=$(uname)
IP=""
INTERFACE=""

if [[ "$OS" == "Darwin" ]]; then
    # macOS
    INTERFACE=$(route get default 2>/dev/null | awk '/interface:/ {print $2}')
    IP=$(ifconfig "$INTERFACE" | awk '/inet / {print $2}' | head -n1)
elif [[ "$OS" == "Linux" ]]; then
    # Linux
    INTERFACE=$(ip route | awk '/default/ {print $5}' | head -n1)
    IP=$(ip -4 addr show "$INTERFACE" | awk '/inet / {print $2}' | cut -d/ -f1 | head -n1)
else
    echo "Unsupported OS: $OS"
    exit 1
fi

if [ -z "$IP" ]; then
    echo "Could not detect IP address. Check your network connection."
    exit 1
fi

echo "Detected IP: $IP on interface $INTERFACE"

if grep -q "^ONLINE_URL=" .env 2>/dev/null; then
    sed -i.bak "s|^ONLINE_URL=.*|ONLINE_URL=$IP|" .env
else
    echo "ONLINE_URL=$IP" >> .env
fi

echo "Updated .env with ONLINE_URL=$IP"

#!/bin/bash

if grep -q "^HOST=" .env 2>/dev/null; then
    sed -i.bak "s|^HOST=.*|HOST=localhost|" .env
else
    echo "HOST=localhost" >> .env
fi

echo "Updated .env with HOST=localhost"

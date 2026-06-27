FROM debian:stable-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       git=1:2.47.3-0+deb13u1 \
       gnupg=2.4.7-21+deb13u1 \
       openssh-client=1:10.0p1-7+deb13u4 \
       curl=8.14.1-2+deb13u3 \
       make=4.4.1-2 \
       zsh=5.9-8+b23 \
       unzip=6.0-29 \
       ca-certificates=20250419 \
       sudo \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
       > /etc/apt/sources.list.d/github-cli.list \
    && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y --no-install-recommends \
       nodejs=24.16.0-1nodesource1 gh \
    && npm install -g pnpm @anthropic-ai/claude-code turbo \
    && turbo telemetry disable \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --user-group --shell /bin/zsh dev
USER dev
WORKDIR /home/dev

RUN sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" || true

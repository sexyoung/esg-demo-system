FROM mcr.microsoft.com/devcontainers/typescript-node:4-24-trixie

RUN apt-get update \
  && apt-get install -y bubblewrap \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g @openai/codex
RUN curl -fsSL https://claude.ai/install.sh | bash
RUN curl -fsSL https://bun.sh/install | bash
# PiPiClaw sandbox base image
# W9 plan: ubuntu:24.04 + node 22 + python 3.12 + java 21 + go 1.23 + 国内镜像源

FROM ubuntu:24.04

LABEL maintainer="PiPiClaw" version="1.0.0"

# ============ 1. 系统包 ============
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl wget git build-essential \
    locales tzdata \
    && rm -rf /var/lib/apt/lists/* \
    && locale-gen en_US.UTF-8 zh_CN.UTF-8
ENV LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

# ============ 2. 国内镜像源(npm / pip) ============
RUN npm config set registry https://registry.npmmirror.com \
    && pip3 config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple \
    || true

# ============ 3. Node 22 ============
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g npm@latest \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_VERSION=22

# ============ 4. Python 3.12 ============
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.12 python3.12-venv python3-pip \
    && rm -rf /var/lib/apt/lists/* \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.12 1
ENV PYTHON_VERSION=3.12

# ============ 5. Java 21 ============
RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-21-jdk \
    && rm -rf /var/lib/apt/lists/*
ENV JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64

# ============ 6. Go 1.23 ============
ARG GO_VERSION=1.23.4
RUN curl -fsSL https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz -o /tmp/go.tar.gz \
    && rm -rf /usr/local/go \
    && tar -C /usr/local -xzf /tmp/go.tar.gz \
    && rm /tmp/go.tar.gz
ENV PATH=/usr/local/go/bin:$PATH GOPROXY=https://goproxy.cn,direct

# ============ 7. 工作目录(与 workspace.containerPath=/mnt/data 一致) ============
WORKDIR /mnt/data

# ============ 8. 验证(可选,build 时不强制跑) ============
# RUN node --version && python3 --version && java -version && go version
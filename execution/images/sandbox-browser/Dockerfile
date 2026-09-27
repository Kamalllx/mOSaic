# Browser sandbox image (P4). P1's SandboxManager starts it when SandboxSpec.display=True and publishes
# the Playwright endpoint as SandboxInfo.endpoints["playwright"] = "ws://<host>:<port>/".
# PLAYWRIGHT_VERSION MUST equal the `playwright` Python package version in uv.lock (client/server must match):
#   uv run python -c "from importlib.metadata import version; print(version('playwright'))"
# The server is installed at BUILD time: task sandboxes have no internet, so nothing may be downloaded at start.
ARG PLAYWRIGHT_VERSION=1.63.0
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble
ARG PLAYWRIGHT_VERSION
RUN npm install -g playwright@${PLAYWRIGHT_VERSION} && npm cache clean --force
USER pwuser
WORKDIR /home/pwuser
EXPOSE 3000
CMD ["playwright", "run-server", "--port", "3000", "--host", "0.0.0.0"]

# Browser sandbox image (P4). P1's SandboxManager starts it when SandboxSpec.display=True and publishes
# the Playwright endpoint as SandboxInfo.endpoints["playwright"] = "ws://<container-ip>:3000/".
# Keep the Playwright version in sync with the `playwright` Python package version in execution/pyproject.toml.
FROM mcr.microsoft.com/playwright:v1.48.0-noble
RUN npx -y playwright@1.48.0 --version
USER pwuser
WORKDIR /home/pwuser
EXPOSE 3000
CMD ["npx", "-y", "playwright@1.48.0", "run-server", "--port", "3000", "--host", "0.0.0.0"]

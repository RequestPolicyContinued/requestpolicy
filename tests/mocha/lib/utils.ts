export function resetConsoleErrors() {
  if ("reset" in console.error) {
    (console.error as sinon.SinonStub).reset();
  }
}
